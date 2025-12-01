/**
 * Secrets Validator Service
 * 
 * Validates environment variables and secrets before deployment:
 * - Verifies all required secrets exist
 * - Validates secret formats (JWT, URLs, API keys)
 * - Ensures environment matching (staging keys for staging, prod for prod)
 * - Scans for leaked secrets in logs and git history
 * - Validates database migrations match schema files
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  SecretsValidationResult,
  FormatValidationResult,
  LeakScanResult,
  EnvironmentMatchResult,
} from '../types';

export class SecretsValidator {
  private readonly projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Verify all required secrets exist in the target environment
   * Validates: Requirements 7.1
   */
  async verifySecrets(environment: string): Promise<SecretsValidationResult> {
    const requiredSecrets = await this.getRequiredSecrets();
    const envSecrets = await this.loadEnvironmentSecrets(environment);

    const missingSecrets: string[] = [];
    const invalidFormats: Array<{ key: string; reason: string }> = [];
    const environmentMismatches: Array<{ key: string; issue: string }> = [];

    // Check for missing secrets
    for (const secretKey of requiredSecrets) {
      if (!(secretKey in envSecrets) || !envSecrets[secretKey]) {
        missingSecrets.push(secretKey);
      }
    }

    // Validate formats
    const formatResult = await this.validateFormats(envSecrets);
    invalidFormats.push(...formatResult.invalidSecrets);

    // Verify environment matching
    const matchResult = await this.verifyEnvironmentMatch(environment, envSecrets);
    environmentMismatches.push(...matchResult.mismatches);

    return {
      allSecretsPresent: missingSecrets.length === 0,
      missingSecrets,
      invalidFormats,
      environmentMismatches,
    };
  }

  /**
   * Validate secret formats (JWT, URLs, API keys)
   * Validates: Requirements 7.2
   */
  async validateFormats(secrets: Record<string, string>): Promise<FormatValidationResult> {
    const invalidSecrets: Array<{ key: string; reason: string }> = [];

    for (const [key, value] of Object.entries(secrets)) {
      // Skip empty or whitespace-only values
      if (!value || value.trim() === '') continue;

      // JWT validation (ADMIN_JWT_SECRET, etc.)
      if (key.includes('JWT_SECRET') || key.includes('WEBHOOK_SECRET')) {
        if (value.length < 32) {
          invalidSecrets.push({
            key,
            reason: 'JWT/webhook secret must be at least 32 characters',
          });
        }
      }

      // URL validation
      if (key.includes('URL') || key.includes('ENDPOINT')) {
        try {
          new URL(value);
        } catch {
          invalidSecrets.push({
            key,
            reason: 'Invalid URL format',
          });
        }
      }

      // Stripe keys have specific prefixes
      if (key.includes('STRIPE')) {
        if (key.includes('SECRET') && key.includes('KEY') && !value.startsWith('sk_') && !value.startsWith('rk_')) {
          invalidSecrets.push({
            key,
            reason: 'Stripe secret keys should start with "sk_" or "rk_"',
          });
        }
        if (key.includes('PUBLISHABLE') && key.includes('KEY') && !value.startsWith('pk_')) {
          invalidSecrets.push({
            key,
            reason: 'Stripe publishable keys should start with "pk_"',
          });
        }
        if (key.includes('WEBHOOK_SECRET') && !value.startsWith('whsec_')) {
          invalidSecrets.push({
            key,
            reason: 'Stripe webhook secrets should start with "whsec_"',
          });
        }
      }

      // API Key validation (basic pattern checks)
      if (key.includes('API_KEY')) {
        // Telnyx keys start with KEY
        if (key.includes('TELNYX') && !value.startsWith('KEY') && value !== 'your_telnyx_test_api_key_here') {
          invalidSecrets.push({
            key,
            reason: 'Telnyx API keys should start with "KEY"',
          });
        }

        // Gemini API keys start with AIza
        if (key.includes('GEMINI') && !value.startsWith('AIza')) {
          invalidSecrets.push({
            key,
            reason: 'Gemini API keys should start with "AIza"',
          });
        }

        // SendGrid keys start with SG.
        if (key.includes('SENDGRID') && !value.startsWith('SG.') && value !== 'your_sendgrid_api_key_here') {
          invalidSecrets.push({
            key,
            reason: 'SendGrid API keys should start with "SG."',
          });
        }
      }

      // AWS credentials validation
      if (key === 'AWS_ACCESS_KEY_ID' && value.length < 16) {
        invalidSecrets.push({
          key,
          reason: 'AWS Access Key ID should be at least 16 characters',
        });
      }

      if (key === 'AWS_SECRET_ACCESS_KEY' && value.length < 40) {
        invalidSecrets.push({
          key,
          reason: 'AWS Secret Access Key should be at least 40 characters',
        });
      }

      // ARN validation
      if (key.includes('ARN') && !value.startsWith('arn:aws:')) {
        invalidSecrets.push({
          key,
          reason: 'AWS ARN should start with "arn:aws:"',
        });
      }

      // Email validation
      if (key.includes('EMAIL') && key.includes('FROM') && !value.includes('@')) {
        invalidSecrets.push({
          key,
          reason: 'Email address should contain "@"',
        });
      }

      // Phone number validation (E.164 format)
      if (key.includes('PHONE') || key.includes('FAX_NUMBER')) {
        if (!value.startsWith('+') || !/^\+\d{10,15}$/.test(value)) {
          invalidSecrets.push({
            key,
            reason: 'Phone/fax number should be in E.164 format (+1234567890)',
          });
        }
      }
    }

    return {
      valid: invalidSecrets.length === 0,
      invalidSecrets,
    };
  }

  /**
   * Verify environment matching (staging keys for staging, prod for prod)
   * Validates: Requirements 7.3
   */
  async verifyEnvironmentMatch(
    environment: string,
    secrets: Record<string, string>
  ): Promise<EnvironmentMatchResult> {
    const mismatches: Array<{ key: string; issue: string }> = [];

    // Check Stripe keys match environment
    if (secrets.STRIPE_SECRET_KEY) {
      const isTestKey = secrets.STRIPE_SECRET_KEY.startsWith('sk_test_');
      const isLiveKey = secrets.STRIPE_SECRET_KEY.startsWith('sk_live_');

      if (environment === 'production' && isTestKey) {
        mismatches.push({
          key: 'STRIPE_SECRET_KEY',
          issue: 'Production environment should use live Stripe keys (sk_live_), not test keys',
        });
      }

      if ((environment === 'development' || environment === 'staging') && isLiveKey) {
        mismatches.push({
          key: 'STRIPE_SECRET_KEY',
          issue: `${environment} environment should use test Stripe keys (sk_test_), not live keys`,
        });
      }
    }

    // Check NODE_ENV matches deployment environment
    if (secrets.NODE_ENV) {
      if (environment === 'production' && secrets.NODE_ENV !== 'production') {
        mismatches.push({
          key: 'NODE_ENV',
          issue: 'NODE_ENV should be "production" for production deployments',
        });
      }

      if (environment === 'staging' && secrets.NODE_ENV === 'production') {
        mismatches.push({
          key: 'NODE_ENV',
          issue: 'NODE_ENV should not be "production" for staging deployments',
        });
      }
    }

    // Check TEST_MODE is appropriate for environment
    if (secrets.TEST_MODE === 'true' && environment === 'production') {
      mismatches.push({
        key: 'TEST_MODE',
        issue: 'TEST_MODE should be false in production',
      });
    }

    // Check JWT secrets are strong in production
    if (environment === 'production') {
      if (secrets.ADMIN_JWT_SECRET && secrets.ADMIN_JWT_SECRET.includes('local_dev')) {
        mismatches.push({
          key: 'ADMIN_JWT_SECRET',
          issue: 'Production should not use development JWT secrets',
        });
      }
    }

    // Check S3 endpoint matches environment
    if (secrets.S3_ENDPOINT) {
      const isLocalEndpoint = secrets.S3_ENDPOINT.includes('localhost') || secrets.S3_ENDPOINT.includes('127.0.0.1');
      
      if (environment === 'production' && isLocalEndpoint) {
        mismatches.push({
          key: 'S3_ENDPOINT',
          issue: 'Production should not use localhost S3 endpoint',
        });
      }
    }

    // Check database host matches environment
    if (secrets.DATABASE_HOST) {
      const isLocalHost = secrets.DATABASE_HOST === 'localhost' || secrets.DATABASE_HOST === '127.0.0.1';
      
      if (environment === 'production' && isLocalHost) {
        mismatches.push({
          key: 'DATABASE_HOST',
          issue: 'Production should not use localhost database',
        });
      }
    }

    return {
      matches: mismatches.length === 0,
      mismatches,
    };
  }

  /**
   * Scan for leaked secrets in logs and git history
   * Validates: Requirements 7.4
   */
  async scanForLeaks(scope: 'logs' | 'commits' | 'both' = 'both'): Promise<LeakScanResult> {
    const leaks: Array<{ location: string; secretKey: string; context: string }> = [];

    // Get list of secret keys to search for
    const secretKeys = await this.getSecretKeys();

    if (scope === 'logs' || scope === 'both') {
      const logLeaks = await this.scanLogs(secretKeys);
      leaks.push(...logLeaks);
    }

    if (scope === 'commits' || scope === 'both') {
      const commitLeaks = await this.scanGitHistory(secretKeys);
      leaks.push(...commitLeaks);
    }

    return {
      leaksFound: leaks.length > 0,
      leaks,
    };
  }

  /**
   * Validate database migrations match schema files
   * Validates: Requirements 7.5
   */
  async validateMigrationSchemaMatch(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      const migrationsDir = path.join(this.projectRoot, 'backend/src/database/migrations');
      const schemaPath = path.join(this.projectRoot, 'backend/src/database/schema.sql');

      // Check if paths exist
      try {
        await fs.access(migrationsDir);
      } catch {
        issues.push('Migrations directory not found');
        return { valid: false, issues };
      }

      try {
        await fs.access(schemaPath);
      } catch {
        issues.push('Schema file not found');
        return { valid: false, issues };
      }

      // Read schema file
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');

      // Get all migration files
      const migrationFiles = await fs.readdir(migrationsDir);
      const sqlMigrations = migrationFiles.filter(f => f.endsWith('.sql')).sort();

      // Extract table names from schema
      const schemaTables = this.extractTableNames(schemaContent);

      // Check each migration for consistency
      for (const migrationFile of sqlMigrations) {
        const migrationPath = path.join(migrationsDir, migrationFile);
        const migrationContent = await fs.readFile(migrationPath, 'utf-8');

        // Extract tables created/altered in migration
        const migrationTables = this.extractTableNames(migrationContent);

        // Check if migration tables exist in schema
        for (const table of migrationTables) {
          if (!schemaTables.includes(table)) {
            issues.push(`Migration ${migrationFile} references table "${table}" not found in schema.sql`);
          }
        }
      }

      return {
        valid: issues.length === 0,
        issues,
      };
    } catch (error) {
      issues.push(`Error validating migrations: ${error instanceof Error ? error.message : String(error)}`);
      return { valid: false, issues };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async getRequiredSecrets(): Promise<string[]> {
    try {
      const envExamplePath = path.join(this.projectRoot, 'backend/.env');
      const content = await fs.readFile(envExamplePath, 'utf-8');

      const secrets: string[] = [];
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          // Match environment variable keys (must start with letter or underscore, followed by letters, numbers, or underscores)
          const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
          if (match) {
            // Skip keys that are just underscore (invalid)
            if (match[1] !== '_') {
              secrets.push(match[1]);
            }
          }
        }
      }

      return secrets;
    } catch {
      // If .env file doesn't exist, return common required secrets
      return [
        'DATABASE_HOST',
        'DATABASE_PORT',
        'DATABASE_NAME',
        'DATABASE_USER',
        'DATABASE_PASSWORD',
        'REDIS_HOST',
        'REDIS_PORT',
        'S3_ENDPOINT',
        'S3_BUCKET',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
        'GEMINI_API_KEY',
        'NODE_ENV',
        'PORT',
      ];
    }
  }

  private async loadEnvironmentSecrets(environment: string): Promise<Record<string, string>> {
    // Try environment-specific file first, then fall back to .env
    const envFiles = [
      path.join(this.projectRoot, `backend/.env.${environment}`),
      path.join(this.projectRoot, 'backend/.env'),
    ];

    const secrets: Record<string, string> = {};

    for (const envFile of envFiles) {
      try {
        const content = await fs.readFile(envFile, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
            if (match && match[1] !== '_') {
              // Only store non-empty values, and don't overwrite existing keys
              const value = match[2];
              if (value && value.trim() !== '' && !(match[1] in secrets)) {
                secrets[match[1]] = value;
              }
            }
          }
        }
      } catch {
        // File doesn't exist, continue
      }
    }

    return secrets;
  }

  private async getSecretKeys(): Promise<string[]> {
    const secrets = await this.getRequiredSecrets();
    return secrets.filter(key =>
      key.includes('SECRET') ||
      key.includes('KEY') ||
      key.includes('PASSWORD') ||
      key.includes('TOKEN')
    );
  }

  private async scanLogs(secretKeys: string[]): Promise<Array<{ location: string; secretKey: string; context: string }>> {
    const leaks: Array<{ location: string; secretKey: string; context: string }> = [];
    const logsDir = path.join(this.projectRoot, 'backend/logs');

    try {
      await fs.access(logsDir);
      const logFiles = await fs.readdir(logsDir);

      for (const logFile of logFiles) {
        if (!logFile.endsWith('.log')) continue;

        const logPath = path.join(logsDir, logFile);
        const content = await fs.readFile(logPath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Check if line contains any secret key patterns
          for (const secretKey of secretKeys) {
            // Look for patterns like KEY=value or "KEY":"value"
            const patterns = [
              new RegExp(`${secretKey}\\s*=\\s*[^\\s]+`, 'i'),
              new RegExp(`"${secretKey}"\\s*:\\s*"[^"]+"`, 'i'),
              new RegExp(`'${secretKey}'\\s*:\\s*'[^']+'`, 'i'),
            ];

            for (const pattern of patterns) {
              if (pattern.test(line)) {
                leaks.push({
                  location: `${logFile}:${i + 1}`,
                  secretKey,
                  context: line.substring(0, 100),
                });
              }
            }
          }
        }
      }
    } catch {
      // Logs directory doesn't exist or can't be read
    }

    return leaks;
  }

  private async scanGitHistory(secretKeys: string[]): Promise<Array<{ location: string; secretKey: string; context: string }>> {
    const leaks: Array<{ location: string; secretKey: string; context: string }> = [];

    try {
      // Get recent commits (last 100)
      const commits = execSync('git log --all --oneline -100', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      }).trim().split('\n');

      for (const commit of commits) {
        const commitHash = commit.split(' ')[0];

        // Get diff for this commit
        try {
          const diff = execSync(`git show ${commitHash}`, {
            cwd: this.projectRoot,
            encoding: 'utf-8',
          });

          // Check for secret patterns in diff
          for (const secretKey of secretKeys) {
            const patterns = [
              new RegExp(`${secretKey}\\s*=\\s*[^\\s]+`, 'i'),
              new RegExp(`"${secretKey}"\\s*:\\s*"[^"]+"`, 'i'),
            ];

            for (const pattern of patterns) {
              if (pattern.test(diff)) {
                const match = diff.match(pattern);
                if (match) {
                  leaks.push({
                    location: `commit ${commitHash}`,
                    secretKey,
                    context: match[0],
                  });
                }
              }
            }
          }
        } catch {
          // Skip commits that can't be read
        }
      }
    } catch {
      // Git not available or not a git repository
    }

    return leaks;
  }

  private extractTableNames(sql: string): string[] {
    const tables: string[] = [];

    // Match CREATE TABLE statements
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi;
    let match;

    while ((match = createTableRegex.exec(sql)) !== null) {
      tables.push(match[1].toLowerCase());
    }

    // Match ALTER TABLE statements
    const alterTableRegex = /ALTER\s+TABLE\s+([a-z_][a-z0-9_]*)/gi;
    while ((match = alterTableRegex.exec(sql)) !== null) {
      if (!tables.includes(match[1].toLowerCase())) {
        tables.push(match[1].toLowerCase());
      }
    }

    return tables;
  }
}
