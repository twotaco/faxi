import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { db } from './connection';

/**
 * Proper Migration System for Faxi
 *
 * Key features:
 * - Tracks applied migrations in schema_migrations table
 * - Only runs new migrations (never re-runs)
 * - Fails loudly on errors (no silent swallowing)
 * - Runs migrations in strict numerical order
 * - Supports both fresh installs and upgrades
 */

interface MigrationRecord {
  version: string;
  name: string;
  applied_at: Date;
  checksum: string;
}

/**
 * Calculate a simple checksum for migration content
 */
function calculateChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Extract version from migration filename
 * Supports both formats:
 * - Timestamp: "20241204004600_description.sql" -> "20241204004600"
 * - Sequential: "001_description.sql" -> "001"
 *
 * Timestamp format is preferred for new migrations (YYYYMMDDHHmmss)
 */
function extractVersion(filename: string): string {
  // Try timestamp format first (14 digits)
  const timestampMatch = filename.match(/^(\d{14})_/);
  if (timestampMatch) {
    return timestampMatch[1];
  }

  // Fall back to sequential format (any number of digits)
  const sequentialMatch = filename.match(/^(\d+)_/);
  if (sequentialMatch) {
    return sequentialMatch[1];
  }

  throw new Error(`Invalid migration filename format: ${filename}. Expected format: YYYYMMDDHHmmss_description.sql (e.g., 20241204004600_add_feature.sql)`);
}

/**
 * Ensure the schema_migrations table exists
 */
async function ensureMigrationsTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(10) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      checksum VARCHAR(20) NOT NULL
    )
  `);
}

/**
 * Get list of already applied migrations
 */
async function getAppliedMigrations(): Promise<Map<string, MigrationRecord>> {
  const result = await db.query<MigrationRecord>(`
    SELECT version, name, applied_at, checksum
    FROM schema_migrations
    ORDER BY version
  `);

  const migrations = new Map<string, MigrationRecord>();
  for (const row of result.rows) {
    migrations.set(row.version, row);
  }
  return migrations;
}

/**
 * Record a migration as applied
 */
async function recordMigration(version: string, name: string, checksum: string): Promise<void> {
  await db.query(
    `INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)`,
    [version, name, checksum]
  );
}

/**
 * Get all migration files sorted by version
 */
function getMigrationFiles(migrationsDir: string): { version: string; filename: string; path: string }[] {
  if (!existsSync(migrationsDir)) {
    return [];
  }

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .map(filename => ({
      version: extractVersion(filename),
      filename,
      path: join(migrationsDir, filename)
    }))
    .sort((a, b) => a.version.localeCompare(b.version));

  // Check for duplicate versions
  const versions = new Set<string>();
  for (const file of files) {
    if (versions.has(file.version)) {
      throw new Error(`Duplicate migration version ${file.version} found. Each migration must have a unique version number.`);
    }
    versions.add(file.version);
  }

  return files;
}

/**
 * Run a single migration within a transaction
 */
async function runMigration(filepath: string, filename: string): Promise<void> {
  const content = readFileSync(filepath, 'utf-8');

  // Run the entire migration in a transaction
  await db.query('BEGIN');
  try {
    await db.query(content);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

/**
 * Main migration runner
 */
export async function runMigrations(): Promise<void> {
  console.log('='.repeat(60));
  console.log('FAXI DATABASE MIGRATION SYSTEM');
  console.log('='.repeat(60));

  try {
    // Step 1: Ensure migrations tracking table exists
    console.log('\n[1/4] Ensuring schema_migrations table exists...');
    await ensureMigrationsTable();
    console.log('      ✓ schema_migrations table ready');

    // Step 2: Get applied migrations
    console.log('\n[2/4] Checking applied migrations...');
    const appliedMigrations = await getAppliedMigrations();
    console.log(`      Found ${appliedMigrations.size} previously applied migrations`);

    // Step 3: Get pending migrations
    console.log('\n[3/4] Scanning for migration files...');
    const migrationsDir = join(__dirname, 'migrations');
    const migrationFiles = getMigrationFiles(migrationsDir);
    console.log(`      Found ${migrationFiles.length} total migration files`);

    // Step 4: Run pending migrations
    console.log('\n[4/4] Running pending migrations...');

    let applied = 0;
    let skipped = 0;

    for (const migration of migrationFiles) {
      const existing = appliedMigrations.get(migration.version);

      if (existing) {
        // Migration already applied - verify checksum
        const content = readFileSync(migration.path, 'utf-8');
        const currentChecksum = calculateChecksum(content);

        if (existing.checksum !== currentChecksum) {
          console.error(`\n❌ CHECKSUM MISMATCH for ${migration.filename}`);
          console.error(`   Migration was modified after being applied!`);
          console.error(`   Expected: ${existing.checksum}`);
          console.error(`   Current:  ${currentChecksum}`);
          throw new Error(`Migration ${migration.filename} has been modified after being applied. This is not allowed.`);
        }

        skipped++;
        continue;
      }

      // New migration - apply it
      console.log(`\n   Applying: ${migration.filename}`);

      const content = readFileSync(migration.path, 'utf-8');
      const checksum = calculateChecksum(content);

      try {
        await runMigration(migration.path, migration.filename);
        await recordMigration(migration.version, migration.filename, checksum);
        console.log(`   ✓ ${migration.filename} applied successfully`);
        applied++;
      } catch (error: any) {
        console.error(`\n❌ MIGRATION FAILED: ${migration.filename}`);
        console.error(`   Error: ${error.message}`);
        if (error.code) {
          console.error(`   PostgreSQL Error Code: ${error.code}`);
        }
        if (error.detail) {
          console.error(`   Detail: ${error.detail}`);
        }
        throw new Error(`Migration ${migration.filename} failed: ${error.message}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`   Applied: ${applied} migration(s)`);
    console.log(`   Skipped: ${skipped} migration(s) (already applied)`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('MIGRATION FAILED');
    console.error('='.repeat(60));
    throw error;
  }
}

/**
 * Check migration status without running anything
 */
export async function checkMigrationStatus(): Promise<void> {
  await ensureMigrationsTable();

  const appliedMigrations = await getAppliedMigrations();
  const migrationsDir = join(__dirname, 'migrations');
  const migrationFiles = getMigrationFiles(migrationsDir);

  console.log('\nMigration Status:');
  console.log('-'.repeat(60));

  for (const migration of migrationFiles) {
    const existing = appliedMigrations.get(migration.version);
    const status = existing ? '✓ Applied' : '○ Pending';
    const date = existing ? ` (${existing.applied_at.toISOString()})` : '';
    console.log(`  ${status} ${migration.filename}${date}`);
  }

  console.log('-'.repeat(60));
}

/**
 * Generate a new migration filename with timestamp
 */
export function generateMigrationFilename(description: string): string {
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0');

  // Sanitize description: lowercase, replace spaces with underscores, remove special chars
  const sanitized = description
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  return `${timestamp}_${sanitized}.sql`;
}

// Run migrations if this file is executed directly
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'status') {
    checkMigrationStatus()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Error checking status:', error);
        process.exit(1);
      });
  } else if (command === 'new') {
    const description = process.argv.slice(3).join(' ') || 'new_migration';
    const filename = generateMigrationFilename(description);
    console.log(`\nCreate new migration file:`);
    console.log(`  backend/src/database/migrations/${filename}`);
    console.log(`\nExample content:`);
    console.log(`-- Migration: ${description}`);
    console.log(`-- Add your SQL here\n`);
    process.exit(0);
  } else {
    runMigrations()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Migration error:', error);
        process.exit(1);
      });
  }
}
