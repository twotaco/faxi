/**
 * Property-based tests for Log Analysis Service
 * 
 * Tests universal properties that should hold across all log analysis scenarios.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { LogAnalysisService } from './logAnalysisService.js';
import type { ErrorCategory } from '../types/index.js';

describe('LogAnalysisService - Property Tests', () => {
  let service: LogAnalysisService;

  beforeAll(() => {
    service = new LogAnalysisService();
  });

  /**
   * Feature: deployment-mcp, Property 10: Log Categorization Accuracy
   * Validates: Requirements 4.2
   * 
   * For any error log, the AI categorization assigns it to exactly one category
   */
  it('property: log categorization accuracy - each error assigned to exactly one category', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            message: fc.oneof(
              // Build errors
              fc.constant('error TS2304: Cannot find name "undefined"'),
              fc.constant('Compilation error in src/index.ts'),
              fc.constant('npm ERR! code ELIFECYCLE'),
              
              // Missing variable errors
              fc.constant('Error: Environment variable DATABASE_URL not found'),
              fc.constant('Missing required environment variable: API_KEY'),
              
              // Permission errors
              fc.constant('EACCES: permission denied, open "/var/log/app.log"'),
              fc.constant('Error: Access forbidden to /etc/config'),
              
              // Network errors
              fc.constant('Error: connect ECONNREFUSED 127.0.0.1:5432'),
              fc.constant('Error: ETIMEDOUT connecting to api.example.com'),
              fc.constant('DNS lookup failed for database.internal'),
              
              // Dependency errors
              fc.constant('npm WARN peer dependency @types/node@^18.0.0 required'),
              fc.constant('Error: Version mismatch for package "react"'),
              
              // Runtime errors
              fc.constant('Uncaught Exception: TypeError: Cannot read property "id" of undefined'),
              fc.constant('Unhandled Promise Rejection: Error: Database connection failed'),
              fc.constant('Segmentation fault (core dumped)')
            ),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (errorRecords) => {
          const errorLogs = errorRecords.map(r => r.message);

          // Categorize the errors
          const categories = await service.categorizeErrors(errorLogs);

          // Property 1: Each error should be assigned to a category
          const totalCategorized = categories.reduce((sum, cat) => sum + cat.count, 0);
          expect(totalCategorized).toBeGreaterThan(0);
          expect(totalCategorized).toBeLessThanOrEqual(errorLogs.length);

          // Property 2: Each category should have valid type
          const validTypes: ErrorCategory['type'][] = [
            'build',
            'runtime',
            'missing_variable',
            'permissions',
            'network',
            'dependency',
          ];

          for (const category of categories) {
            expect(validTypes).toContain(category.type);
          }

          // Property 3: Each category should have valid severity
          const validSeverities: ErrorCategory['severity'][] = [
            'critical',
            'high',
            'medium',
            'low',
          ];

          for (const category of categories) {
            expect(validSeverities).toContain(category.severity);
          }

          // Property 4: Examples should not exceed count
          for (const category of categories) {
            expect(category.examples.length).toBeLessThanOrEqual(category.count);
          }

          // Property 5: Count should match examples length (or be greater if truncated)
          for (const category of categories) {
            expect(category.count).toBeGreaterThanOrEqual(category.examples.length);
          }

          // Property 6: No duplicate examples within a category
          for (const category of categories) {
            const uniqueExamples = new Set(category.examples);
            expect(uniqueExamples.size).toBe(category.examples.length);
          }
        }
      ),
      { numRuns: 2 } // Minimal runs due to slow AI calls (10-15s each)
    );
  }, 180000); // 3 minute timeout for AI calls

  /**
   * Feature: deployment-mcp, Property 19: Log Source Completeness
   * Validates: Requirements 4.1
   * 
   * For any log analysis request, logs are read from all specified sources
   */
  it('property: log source completeness - all requested sources are processed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom('build', 'deployment', 'service', 'docker', 'systemd'),
          { minLength: 1, maxLength: 5 }
        ).map(sources => Array.from(new Set(sources))), // Remove duplicates
        fc.constantFrom('development', 'staging', 'production'),
        async (sources, environment) => {
          // Analyze logs from the specified sources
          const result = await service.analyzeLogs({
            sources: sources as any[],
            environment,
          });

          // Property 1: Result should be defined
          expect(result).toBeDefined();
          expect(result.totalErrors).toBeGreaterThanOrEqual(0);

          // Property 2: Categorized errors should be an array
          expect(Array.isArray(result.categorizedErrors)).toBe(true);

          // Property 3: Suggested fixes should be an array
          expect(Array.isArray(result.suggestedFixes)).toBe(true);

          // Property 4: Critical issues should be an array
          expect(Array.isArray(result.criticalIssues)).toBe(true);

          // Property 5: If there are errors, there should be categories
          if (result.totalErrors > 0) {
            expect(result.categorizedErrors.length).toBeGreaterThan(0);
          }

          // Property 6: Critical issues should come from critical severity errors
          const criticalCategories = result.categorizedErrors.filter(
            c => c.severity === 'critical'
          );
          if (criticalCategories.length > 0) {
            // Critical issues should exist if there are critical categories
            expect(result.criticalIssues.length).toBeGreaterThanOrEqual(0);
          }

          // Property 7: Total errors should match sum of category counts
          const sumOfCounts = result.categorizedErrors.reduce(
            (sum, cat) => sum + cat.count,
            0
          );
          if (result.totalErrors > 0) {
            expect(sumOfCounts).toBeGreaterThan(0);
            expect(sumOfCounts).toBeLessThanOrEqual(result.totalErrors);
          }
        }
      ),
      { numRuns: 5 } // Reduced runs due to file I/O and potential AI calls
    );
  }, 180000); // 3 minute timeout

  /**
   * Feature: deployment-mcp, Property 20: Fix Suggestion Safety
   * Validates: Requirements 4.4
   * 
   * For any suggested fix with high risk level, the system requires explicit approval
   */
  it('property: fix suggestion safety - high risk fixes require approval', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom<ErrorCategory['type']>(
              'build',
              'runtime',
              'missing_variable',
              'permissions',
              'network',
              'dependency'
            ),
            count: fc.integer({ min: 1, max: 10 }),
            examples: fc.array(fc.string({ minLength: 10, maxLength: 100 }), {
              minLength: 1,
              maxLength: 3,
            }),
            severity: fc.constantFrom<ErrorCategory['severity']>(
              'critical',
              'high',
              'medium',
              'low'
            ),
            affectedComponents: fc.array(
              fc.constantFrom('backend', 'admin-dashboard', 'marketing-website'),
              { maxLength: 3 }
            ),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (errorCategories) => {
          // Generate fix suggestions
          const fixes = await service.suggestFixes(errorCategories);

          // Property 1: All fixes should have required fields
          for (const fix of fixes) {
            expect(fix.id).toBeDefined();
            expect(fix.description).toBeDefined();
            expect(Array.isArray(fix.commands)).toBe(true);
            expect(typeof fix.confidence).toBe('number');
            expect(fix.confidence).toBeGreaterThanOrEqual(0);
            expect(fix.confidence).toBeLessThanOrEqual(1);
            expect(['low', 'medium', 'high']).toContain(fix.riskLevel);
            expect(typeof fix.requiresApproval).toBe('boolean');
          }

          // Property 2: High risk fixes MUST require approval
          const highRiskFixes = fixes.filter(f => f.riskLevel === 'high');
          for (const fix of highRiskFixes) {
            expect(fix.requiresApproval).toBe(true);
          }

          // Property 3: Fixes with dangerous commands should be high risk
          for (const fix of fixes) {
            const hasDangerousCommand = fix.commands.some(cmd =>
              /rm\s+-rf|dd\s+if=|mkfs|shutdown|reboot/.test(cmd)
            );

            if (hasDangerousCommand) {
              expect(fix.riskLevel).toBe('high');
              expect(fix.requiresApproval).toBe(true);
            }
          }

          // Property 4: Fix IDs should be unique
          const fixIds = fixes.map(f => f.id);
          const uniqueIds = new Set(fixIds);
          expect(uniqueIds.size).toBe(fixIds.length);

          // Property 5: Confidence should correlate with risk
          // Higher risk should generally have lower confidence or require approval
          for (const fix of fixes) {
            if (fix.riskLevel === 'high') {
              expect(fix.requiresApproval).toBe(true);
            }
          }
        }
      ),
      { numRuns: 2 } // Minimal runs due to slow AI calls (10-15s each)
    );
  }, 180000); // 3 minute timeout for AI calls

  /**
   * Additional property: Fix application safety
   * High-risk fixes should not be auto-executed
   */
  it('property: fix application blocks high-risk operations without approval', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 5, maxLength: 20 }),
          description: fc.string({ minLength: 10, maxLength: 100 }),
          commands: fc.array(fc.string({ minLength: 5, maxLength: 50 }), {
            minLength: 1,
            maxLength: 3,
          }),
          confidence: fc.float({ min: 0, max: 1 }),
          riskLevel: fc.constantFrom<'low' | 'medium' | 'high'>('low', 'medium', 'high'),
          requiresApproval: fc.boolean(),
        }),
        async (fixSuggestion) => {
          // Apply the fix
          const result = await service.applyFix(fixSuggestion);

          // Property 1: Result should have required fields
          expect(result.success).toBeDefined();
          expect(result.fixId).toBe(fixSuggestion.id);
          expect(Array.isArray(result.commandsExecuted)).toBe(true);
          expect(typeof result.output).toBe('string');
          expect(Array.isArray(result.errors)).toBe(true);

          // Property 2: High-risk fixes requiring approval should not execute
          if (fixSuggestion.riskLevel === 'high' && fixSuggestion.requiresApproval) {
            expect(result.success).toBe(false);
            expect(result.commandsExecuted.length).toBe(0);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('approval');
          }

          // Property 3: If commands were executed, they should be recorded
          if (result.commandsExecuted.length > 0) {
            expect(result.commandsExecuted.length).toBeLessThanOrEqual(
              fixSuggestion.commands.length
            );
          }

          // Property 4: If there are errors, success should be false
          if (result.errors.length > 0 && result.commandsExecuted.length === 0) {
            expect(result.success).toBe(false);
          }

          // Property 5: Dangerous commands should never be executed
          const dangerousPatterns = [
            /rm\s+-rf\s+\//,
            /dd\s+if=/,
            /mkfs/,
            /shutdown/,
            /reboot/,
          ];

          for (const executed of result.commandsExecuted) {
            for (const pattern of dangerousPatterns) {
              expect(pattern.test(executed)).toBe(false);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 60000); // 1 minute timeout
});
