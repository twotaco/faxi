/**
 * Log Analysis Service
 * 
 * AI-powered log interpretation and error diagnosis for deployment failures.
 * Aggregates logs from multiple sources, categorizes errors using Gemini AI,
 * and suggests fixes with safety checks.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../../config/index.js';
import { loggingService } from '../../../services/loggingService.js';
import type {
  LogAnalysisOptions,
  LogAnalysisResult,
  ErrorCategory,
  FixSuggestion,
  FixApplicationResult,
} from '../types/index.js';

const execAsync = promisify(exec);

/**
 * Log source configuration
 */
interface LogSource {
  type: 'build' | 'deployment' | 'service' | 'docker' | 'systemd';
  paths: string[];
  command?: string; // Alternative: use command to fetch logs
}

/**
 * Parsed log entry
 */
interface LogEntry {
  timestamp?: Date;
  level?: string;
  source: string;
  message: string;
  raw: string;
}

/**
 * Error pattern for extraction
 */
interface ErrorPattern {
  regex: RegExp;
  category: ErrorCategory['type'];
  severity: ErrorCategory['severity'];
}

export class LogAnalysisService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  // Default log paths for different sources
  private readonly LOG_SOURCES: Record<string, LogSource> = {
    build: {
      type: 'build',
      paths: [
        'backend/logs/build.log',
        'admin-dashboard/logs/build.log',
        'marketing-website/logs/build.log',
        'npm-debug.log',
      ],
    },
    deployment: {
      type: 'deployment',
      paths: [
        'logs/deployment.log',
        'backend/logs/deployment.log',
      ],
    },
    service: {
      type: 'service',
      paths: [
        'backend/logs/app.log',
        'backend/logs/error.log',
        'admin-dashboard/logs/app.log',
        'marketing-website/logs/app.log',
      ],
    },
    docker: {
      type: 'docker',
      paths: [],
      command: 'docker-compose logs --tail=500 --no-color',
    },
    systemd: {
      type: 'systemd',
      paths: [],
      command: 'journalctl -u faxi-* --no-pager -n 500',
    },
  };

  // Error patterns for quick categorization
  private readonly ERROR_PATTERNS: ErrorPattern[] = [
    // Build errors
    { regex: /error TS\d+:/i, category: 'build', severity: 'high' },
    { regex: /compilation error/i, category: 'build', severity: 'high' },
    { regex: /syntax error/i, category: 'build', severity: 'high' },
    { regex: /cannot find module/i, category: 'build', severity: 'high' },
    { regex: /npm ERR!/i, category: 'build', severity: 'medium' },
    
    // Missing variables
    { regex: /environment variable.*not found/i, category: 'missing_variable', severity: 'critical' },
    { regex: /missing required.*variable/i, category: 'missing_variable', severity: 'critical' },
    { regex: /undefined.*env/i, category: 'missing_variable', severity: 'high' },
    
    // Permissions
    { regex: /permission denied/i, category: 'permissions', severity: 'high' },
    { regex: /EACCES/i, category: 'permissions', severity: 'high' },
    { regex: /access forbidden/i, category: 'permissions', severity: 'high' },
    
    // Network
    { regex: /ECONNREFUSED/i, category: 'network', severity: 'high' },
    { regex: /ETIMEDOUT/i, category: 'network', severity: 'medium' },
    { regex: /network.*unreachable/i, category: 'network', severity: 'high' },
    { regex: /connection.*refused/i, category: 'network', severity: 'high' },
    { regex: /DNS.*failed/i, category: 'network', severity: 'medium' },
    
    // Dependencies
    { regex: /peer dependency/i, category: 'dependency', severity: 'medium' },
    { regex: /version mismatch/i, category: 'dependency', severity: 'medium' },
    { regex: /incompatible.*version/i, category: 'dependency', severity: 'high' },
    
    // Runtime errors
    { regex: /uncaught exception/i, category: 'runtime', severity: 'critical' },
    { regex: /unhandled rejection/i, category: 'runtime', severity: 'critical' },
    { regex: /segmentation fault/i, category: 'runtime', severity: 'critical' },
    { regex: /out of memory/i, category: 'runtime', severity: 'critical' },
  ];

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: config.gemini.model || 'gemini-2.0-flash-exp',
    });
  }

  /**
   * Analyze logs from multiple sources
   */
  async analyzeLogs(options: LogAnalysisOptions): Promise<LogAnalysisResult> {
    try {
      loggingService.info('Starting log analysis', {
        sources: options.sources,
        environment: options.environment,
      });

      // Step 1: Read logs from all sources
      const logEntries = await this.readLogsFromSources(options.sources, options.timeRange);

      if (logEntries.length === 0) {
        loggingService.warn('No logs found for analysis');
        return {
          totalErrors: 0,
          categorizedErrors: [],
          suggestedFixes: [],
          criticalIssues: [],
        };
      }

      // Step 2: Extract error lines
      const errorLines = this.extractErrors(logEntries, options.errorPatterns);

      if (errorLines.length === 0) {
        loggingService.info('No errors found in logs');
        return {
          totalErrors: 0,
          categorizedErrors: [],
          suggestedFixes: [],
          criticalIssues: [],
        };
      }

      loggingService.info('Errors extracted', { count: errorLines.length });

      // Step 3: Categorize errors using AI
      const categorizedErrors = await this.categorizeErrors(errorLines);

      // Step 4: Generate fix suggestions
      const suggestedFixes = await this.suggestFixes(categorizedErrors);

      // Step 5: Identify critical issues
      const criticalIssues = categorizedErrors
        .filter(e => e.severity === 'critical')
        .flatMap(e => e.examples.slice(0, 2));

      return {
        totalErrors: errorLines.length,
        categorizedErrors,
        suggestedFixes,
        criticalIssues,
      };
    } catch (error: any) {
      loggingService.error('Log analysis failed', error);
      throw error;
    }
  }

  /**
   * Read logs from specified sources
   */
  private async readLogsFromSources(
    sources: LogAnalysisOptions['sources'],
    timeRange?: { start: Date; end: Date }
  ): Promise<LogEntry[]> {
    const allEntries: LogEntry[] = [];

    for (const sourceType of sources) {
      const source = this.LOG_SOURCES[sourceType];
      if (!source) {
        loggingService.warn('Unknown log source', { sourceType });
        continue;
      }

      try {
        let entries: LogEntry[];

        if (source.command) {
          // Use command to fetch logs
          entries = await this.readLogsFromCommand(source.command, sourceType);
        } else {
          // Read from file paths
          entries = await this.readLogsFromFiles(source.paths, sourceType);
        }

        // Filter by time range if specified
        if (timeRange) {
          entries = entries.filter(entry => {
            if (!entry.timestamp) return true; // Include entries without timestamp
            return entry.timestamp >= timeRange.start && entry.timestamp <= timeRange.end;
          });
        }

        allEntries.push(...entries);
      } catch (error: any) {
        loggingService.warn('Failed to read logs from source', {
          sourceType,
          error: error.message,
        });
      }
    }

    return allEntries;
  }

  /**
   * Read logs from file paths
   */
  private async readLogsFromFiles(paths: string[], sourceType: string): Promise<LogEntry[]> {
    const entries: LogEntry[] = [];

    for (const logPath of paths) {
      try {
        const fullPath = join(process.cwd(), logPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
          entries.push(this.parseLogLine(line, sourceType));
        }
      } catch (error: any) {
        // File might not exist, which is okay
        if (error.code !== 'ENOENT') {
          loggingService.debug('Could not read log file', { path: logPath, error: error.message });
        }
      }
    }

    return entries;
  }

  /**
   * Read logs from command output
   */
  private async readLogsFromCommand(command: string, sourceType: string): Promise<LogEntry[]> {
    try {
      const { stdout } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer
      const lines = stdout.split('\n').filter(line => line.trim());

      return lines.map(line => this.parseLogLine(line, sourceType));
    } catch (error: any) {
      loggingService.warn('Failed to execute log command', {
        command,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Parse a log line into structured format
   */
  private parseLogLine(line: string, source: string): LogEntry {
    // Try to extract timestamp (ISO format or common log formats)
    const isoMatch = line.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
    const timestamp = isoMatch ? new Date(isoMatch[1]) : undefined;

    // Try to extract log level
    const levelMatch = line.match(/\b(ERROR|WARN|INFO|DEBUG|FATAL|CRITICAL)\b/i);
    const level = levelMatch ? levelMatch[1].toUpperCase() : undefined;

    return {
      timestamp,
      level,
      source,
      message: line,
      raw: line,
    };
  }

  /**
   * Extract error lines from log entries
   */
  private extractErrors(entries: LogEntry[], customPatterns?: string[]): string[] {
    const errorLines: string[] = [];
    const seenErrors = new Set<string>();

    for (const entry of entries) {
      const line = entry.message;

      // Check if line contains error indicators
      const isError =
        entry.level === 'ERROR' ||
        entry.level === 'FATAL' ||
        entry.level === 'CRITICAL' ||
        /\berror\b/i.test(line) ||
        /\bfailed\b/i.test(line) ||
        /\bexception\b/i.test(line) ||
        /\bfatal\b/i.test(line);

      // Check custom patterns
      const matchesCustomPattern = customPatterns?.some(pattern => {
        try {
          return new RegExp(pattern, 'i').test(line);
        } catch {
          return false;
        }
      });

      if (isError || matchesCustomPattern) {
        // Deduplicate similar errors
        const normalized = line.toLowerCase().replace(/\d+/g, 'N').substring(0, 100);
        if (!seenErrors.has(normalized)) {
          seenErrors.add(normalized);
          errorLines.push(line);
        }
      }
    }

    return errorLines;
  }

  /**
   * Categorize errors using pattern matching and AI
   */
  async categorizeErrors(logs: string[]): Promise<ErrorCategory[]> {
    // First pass: Quick categorization using patterns
    const quickCategories = this.quickCategorize(logs);

    // Second pass: Use AI for more nuanced categorization
    const aiCategories = await this.aiCategorize(logs, quickCategories);

    return aiCategories;
  }

  /**
   * Quick categorization using regex patterns
   */
  private quickCategorize(logs: string[]): Map<ErrorCategory['type'], string[]> {
    const categories = new Map<ErrorCategory['type'], string[]>();

    for (const log of logs) {
      let categorized = false;

      for (const pattern of this.ERROR_PATTERNS) {
        if (pattern.regex.test(log)) {
          const existing = categories.get(pattern.category) || [];
          existing.push(log);
          categories.set(pattern.category, existing);
          categorized = true;
          break; // Only assign to first matching category
        }
      }

      // If no pattern matched, categorize as runtime
      if (!categorized) {
        const existing = categories.get('runtime') || [];
        existing.push(log);
        categories.set('runtime', existing);
      }
    }

    return categories;
  }

  /**
   * AI-powered categorization using Gemini
   */
  private async aiCategorize(
    logs: string[],
    quickCategories: Map<ErrorCategory['type'], string[]>
  ): Promise<ErrorCategory[]> {
    try {
      // Prepare prompt for AI categorization
      const prompt = this.buildCategorizationPrompt(logs, quickCategories);

      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      // Parse AI response
      const aiCategories = this.parseCategorizationResponse(response, quickCategories);

      return aiCategories;
    } catch (error: any) {
      loggingService.error('AI categorization failed, falling back to pattern matching', error);

      // Fallback to quick categorization
      return this.convertQuickCategoriesToErrorCategories(quickCategories);
    }
  }

  /**
   * Build prompt for AI categorization
   */
  private buildCategorizationPrompt(
    logs: string[],
    quickCategories: Map<ErrorCategory['type'], string[]>
  ): string {
    const sampleLogs = logs.slice(0, 50).join('\n');

    return `You are an expert at analyzing deployment and application logs. Categorize the following errors into these categories:

Categories:
- build: Compilation, syntax, or build-time errors
- runtime: Application crashes, exceptions, or runtime failures
- missing_variable: Missing environment variables or configuration
- permissions: File system or access permission issues
- network: Network connectivity, DNS, or timeout issues
- dependency: Package version conflicts or missing dependencies

For each error, also assign a severity:
- critical: System cannot function, immediate action required
- high: Major functionality broken, urgent fix needed
- medium: Degraded functionality, should be fixed soon
- low: Minor issues, can be addressed later

Initial categorization (from pattern matching):
${Array.from(quickCategories.entries())
  .map(([cat, examples]) => `${cat}: ${examples.length} errors`)
  .join('\n')}

Error logs to analyze:
${sampleLogs}

Respond in JSON format:
{
  "categories": [
    {
      "type": "build|runtime|missing_variable|permissions|network|dependency",
      "count": <number>,
      "severity": "critical|high|medium|low",
      "examples": ["error message 1", "error message 2"],
      "affectedComponents": ["backend", "admin-dashboard", etc],
      "summary": "Brief description of the issue"
    }
  ]
}`;
  }

  /**
   * Parse AI categorization response
   */
  private parseCategorizationResponse(
    response: string,
    fallback: Map<ErrorCategory['type'], string[]>
  ): ErrorCategory[] {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.categories || !Array.isArray(parsed.categories)) {
        throw new Error('Invalid response format');
      }

      return parsed.categories.map((cat: any) => ({
        type: cat.type,
        count: cat.count || cat.examples?.length || 0,
        examples: cat.examples || [],
        severity: cat.severity || 'medium',
        affectedComponents: cat.affectedComponents || [],
      }));
    } catch (error: any) {
      loggingService.warn('Failed to parse AI categorization response', {
        error: error.message,
      });

      // Fallback to quick categorization
      return this.convertQuickCategoriesToErrorCategories(fallback);
    }
  }

  /**
   * Convert quick categories to ErrorCategory format
   */
  private convertQuickCategoriesToErrorCategories(
    quickCategories: Map<ErrorCategory['type'], string[]>
  ): ErrorCategory[] {
    const categories: ErrorCategory[] = [];

    for (const [type, examples] of quickCategories.entries()) {
      // Determine severity based on type
      let severity: ErrorCategory['severity'] = 'medium';
      if (type === 'missing_variable' || type === 'runtime') {
        severity = 'critical';
      } else if (type === 'build' || type === 'permissions' || type === 'network') {
        severity = 'high';
      }

      // Try to identify affected components from log messages
      const affectedComponents = this.identifyAffectedComponents(examples);

      categories.push({
        type,
        count: examples.length,
        examples: examples.slice(0, 3), // Keep top 3 examples
        severity,
        affectedComponents,
      });
    }

    return categories;
  }

  /**
   * Identify affected components from error messages
   */
  private identifyAffectedComponents(errors: string[]): string[] {
    const components = new Set<string>();

    for (const error of errors) {
      if (/backend/i.test(error)) components.add('backend');
      if (/admin[-_]dashboard/i.test(error)) components.add('admin-dashboard');
      if (/marketing[-_]website/i.test(error)) components.add('marketing-website');
      if (/postgres|database/i.test(error)) components.add('database');
      if (/redis/i.test(error)) components.add('redis');
      if (/docker/i.test(error)) components.add('docker');
    }

    return Array.from(components);
  }

  /**
   * Suggest fixes for categorized errors using AI
   */
  async suggestFixes(errors: ErrorCategory[]): Promise<FixSuggestion[]> {
    if (errors.length === 0) {
      return [];
    }

    try {
      const prompt = this.buildFixSuggestionPrompt(errors);

      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      const fixes = this.parseFixSuggestions(response);

      return fixes;
    } catch (error: any) {
      loggingService.error('Failed to generate fix suggestions', error);
      return [];
    }
  }

  /**
   * Build prompt for fix suggestions
   */
  private buildFixSuggestionPrompt(errors: ErrorCategory[]): string {
    const errorSummary = errors
      .map(
        e =>
          `${e.type} (${e.severity}): ${e.count} errors\nExamples:\n${e.examples
            .slice(0, 2)
            .map(ex => `  - ${ex}`)
            .join('\n')}`
      )
      .join('\n\n');

    return `You are an expert DevOps engineer. Given the following deployment errors, suggest specific fixes with commands to resolve them.

Errors:
${errorSummary}

For each category of errors, provide:
1. A clear description of the fix
2. Specific commands to execute (if applicable)
3. Confidence level (0-1)
4. Risk level (low/medium/high)
5. Whether it requires manual approval

Respond in JSON format:
{
  "fixes": [
    {
      "id": "fix-1",
      "description": "Clear description of what this fix does",
      "commands": ["command 1", "command 2"],
      "confidence": 0.9,
      "riskLevel": "low|medium|high",
      "requiresApproval": true|false,
      "addresses": ["error_category_1", "error_category_2"]
    }
  ]
}

Guidelines:
- For missing environment variables, suggest checking .env.example and adding missing vars
- For build errors, suggest clearing node_modules and reinstalling
- For permission errors, suggest checking file ownership and permissions
- For network errors, suggest checking service status and connectivity
- For dependency errors, suggest npm audit fix or updating packages
- Mark high-risk operations (data deletion, production changes) as requiring approval`;
  }

  /**
   * Parse fix suggestions from AI response
   */
  private parseFixSuggestions(response: string): FixSuggestion[] {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.fixes || !Array.isArray(parsed.fixes)) {
        throw new Error('Invalid response format');
      }

      return parsed.fixes.map((fix: any, index: number) => ({
        id: fix.id || `fix-${index + 1}`,
        description: fix.description || 'No description provided',
        commands: fix.commands || [],
        confidence: fix.confidence || 0.5,
        riskLevel: fix.riskLevel || 'medium',
        requiresApproval: fix.requiresApproval !== false, // Default to true for safety
      }));
    } catch (error: any) {
      loggingService.warn('Failed to parse fix suggestions', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Apply a fix suggestion
   */
  async applyFix(fix: FixSuggestion): Promise<FixApplicationResult> {
    loggingService.info('Applying fix', { fixId: fix.id, description: fix.description });

    // Safety check: High-risk fixes require approval
    if (fix.riskLevel === 'high' && fix.requiresApproval) {
      return {
        success: false,
        fixId: fix.id,
        commandsExecuted: [],
        output: '',
        errors: ['High-risk fix requires manual approval before execution'],
      };
    }

    const commandsExecuted: string[] = [];
    const outputs: string[] = [];
    const errors: string[] = [];

    for (const command of fix.commands) {
      try {
        loggingService.info('Executing fix command', { command });

        // Safety: Don't execute dangerous commands
        if (this.isDangerousCommand(command)) {
          errors.push(`Dangerous command blocked: ${command}`);
          continue;
        }

        const { stdout, stderr } = await execAsync(command, {
          timeout: 60000, // 1 minute timeout
          maxBuffer: 5 * 1024 * 1024, // 5MB buffer
        });

        commandsExecuted.push(command);
        outputs.push(stdout);

        if (stderr) {
          outputs.push(`STDERR: ${stderr}`);
        }
      } catch (error: any) {
        loggingService.error('Fix command failed', error, undefined, { command });
        errors.push(`Command failed: ${command}\nError: ${error.message}`);
      }
    }

    const success = errors.length === 0 && commandsExecuted.length > 0;

    return {
      success,
      fixId: fix.id,
      commandsExecuted,
      output: outputs.join('\n\n'),
      errors,
    };
  }

  /**
   * Check if a command is dangerous and should not be auto-executed
   */
  private isDangerousCommand(command: string): boolean {
    const dangerousPatterns = [
      /rm\s+-rf\s+\//i, // Recursive delete from root
      /dd\s+if=/i, // Disk operations
      /mkfs/i, // Format filesystem
      /fdisk/i, // Partition operations
      /shutdown/i, // System shutdown
      /reboot/i, // System reboot
      /kill\s+-9\s+1/i, // Kill init process
      />\s*\/dev\/sda/i, // Write to disk device
      /curl.*\|\s*bash/i, // Pipe to bash (security risk)
      /wget.*\|\s*sh/i, // Pipe to shell (security risk)
    ];

    return dangerousPatterns.some(pattern => pattern.test(command));
  }
}

// Export singleton instance
export const logAnalysisService = new LogAnalysisService();
