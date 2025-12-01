/**
 * Test Execution Service
 * 
 * Runs Playwright tests and captures results for validation against requirements.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import type { ParsedRequirement } from './specParserService.js';

const execAsync = promisify(exec);

export interface TestExecutionResult {
  tests_run: number;
  tests_passed: number;
  tests_failed: number;
  tests_skipped: number;
  test_results: TestResult[];
  summary: {
    coverage_percent: number;
    untested_criteria: number[];
    duration_ms: number;
  };
}

export interface TestResult {
  requirement_id?: string;
  criterion_number?: number;
  test_name: string;
  test_file: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  duration_ms: number;
  error_message?: string;
  error_stack?: string;
  screenshot_path?: string;
  trace_path?: string;
}

export interface TestOptions {
  capture_traces?: boolean;
  capture_screenshots?: boolean;
  timeout?: number;
  grep?: string;  // Filter tests by pattern
}

export interface MappedTestResult extends TestResult {
  requirement_id: string;
  criterion_number: number;
  criterion_text: string;
}

class TestExecutionService {
  /**
   * Run Playwright tests for a spec
   */
  async runAcceptanceTests(
    specPath: string,
    requirementId?: string,
    options: TestOptions = {}
  ): Promise<TestExecutionResult> {
    const startTime = Date.now();

    // Find test files related to this spec
    const testFiles = await this.findTestFiles(specPath);

    if (testFiles.length === 0) {
      return {
        tests_run: 0,
        tests_passed: 0,
        tests_failed: 0,
        tests_skipped: 0,
        test_results: [],
        summary: {
          coverage_percent: 0,
          untested_criteria: [],
          duration_ms: Date.now() - startTime,
        },
      };
    }

    // Execute tests
    const allResults: TestResult[] = [];

    for (const testFile of testFiles) {
      try {
        const results = await this.executeTest(testFile, options);
        allResults.push(...results);
      } catch (error) {
        // If test execution fails, record as error
        allResults.push({
          test_name: path.basename(testFile),
          test_file: testFile,
          status: 'error',
          duration_ms: 0,
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Filter by requirement if specified
    let filteredResults = allResults;
    if (requirementId) {
      filteredResults = allResults.filter(
        (r) => r.requirement_id === requirementId
      );
    }

    // Calculate summary
    const passed = filteredResults.filter((r) => r.status === 'passed').length;
    const failed = filteredResults.filter((r) => r.status === 'failed').length;
    const skipped = filteredResults.filter((r) => r.status === 'skipped').length;

    return {
      tests_run: filteredResults.length,
      tests_passed: passed,
      tests_failed: failed,
      tests_skipped: skipped,
      test_results: filteredResults,
      summary: {
        coverage_percent:
          filteredResults.length > 0
            ? Math.round((passed / filteredResults.length) * 100)
            : 0,
        untested_criteria: [], // TODO: Calculate from requirements
        duration_ms: Date.now() - startTime,
      },
    };
  }

  /**
   * Find test files related to a spec
   */
  async findTestFiles(specPath: string): Promise<string[]> {
    const specName = path.basename(specPath);

    // Search patterns for test files
    const patterns = [
      `**/*${specName}*.test.ts`,
      `**/*${specName}*.spec.ts`,
      `**/*${specName}*.property.test.ts`,
      `**/test/**/*${specName}*.ts`,
      `**/__tests__/**/*${specName}*.ts`,
    ];

    const testFiles: string[] = [];

    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          cwd: process.cwd(),
          ignore: ['node_modules/**', 'dist/**', '.next/**'],
        });
        testFiles.push(...files);
      } catch (error) {
        // Ignore glob errors
      }
    }

    // Remove duplicates
    return Array.from(new Set(testFiles));
  }

  /**
   * Execute a specific test file
   */
  async executeTest(
    testFile: string,
    options: TestOptions = {}
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    try {
      // Determine test runner (Vitest for .test.ts, Playwright for .spec.ts)
      const isPlaywright = testFile.includes('.spec.ts') || testFile.includes('e2e');
      const isVitest = testFile.includes('.test.ts');

      let command: string;
      let env: Record<string, string> = { ...process.env };

      if (isPlaywright) {
        // Run with Playwright
        command = `npx playwright test ${testFile}`;
        if (options.capture_traces) {
          command += ' --trace on';
        }
        if (options.grep) {
          command += ` --grep "${options.grep}"`;
        }
      } else if (isVitest) {
        // Run with Vitest
        command = `npx vitest run ${testFile} --reporter=json`;
        env.NODE_ENV = 'test';
      } else {
        // Default to Vitest
        command = `npx vitest run ${testFile} --reporter=json`;
      }

      // Execute the test
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        env,
        timeout: options.timeout || 60000, // 60 second default timeout
      });

      // Parse results based on test runner
      if (isVitest) {
        results.push(...this.parseVitestOutput(stdout, testFile));
      } else if (isPlaywright) {
        results.push(...this.parsePlaywrightOutput(stdout, testFile));
      }
    } catch (error: any) {
      // Test execution failed - parse error output
      if (error.stdout) {
        // Try to parse partial results
        try {
          results.push(...this.parseVitestOutput(error.stdout, testFile));
        } catch {
          // If parsing fails, record as error
          results.push({
            test_name: path.basename(testFile),
            test_file: testFile,
            status: 'error',
            duration_ms: 0,
            error_message: error.message,
            error_stack: error.stack,
          });
        }
      } else {
        results.push({
          test_name: path.basename(testFile),
          test_file: testFile,
          status: 'error',
          duration_ms: 0,
          error_message: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Parse Vitest JSON output
   */
  private parseVitestOutput(output: string, testFile: string): TestResult[] {
    const results: TestResult[] = [];

    try {
      const json = JSON.parse(output);

      // Vitest JSON reporter format
      if (json.testResults) {
        for (const testResult of json.testResults) {
          for (const assertionResult of testResult.assertionResults || []) {
            // Extract requirement info from test name
            const reqMatch = assertionResult.title.match(/[Rr]equirement[s]?\s+(\d+(?:\.\d+)?)/);
            const propMatch = assertionResult.title.match(/[Pp]roperty\s+(\d+)/);

            results.push({
              test_name: assertionResult.title,
              test_file: testFile,
              status: assertionResult.status === 'passed' ? 'passed' : 'failed',
              duration_ms: assertionResult.duration || 0,
              requirement_id: reqMatch ? reqMatch[1] : undefined,
              criterion_number: propMatch ? parseInt(propMatch[1]) : undefined,
              error_message: assertionResult.failureMessages?.[0],
            });
          }
        }
      }
    } catch (error) {
      // If JSON parsing fails, try to parse text output
      results.push(...this.parseTextOutput(output, testFile));
    }

    return results;
  }

  /**
   * Parse Playwright output
   */
  private parsePlaywrightOutput(output: string, testFile: string): TestResult[] {
    const results: TestResult[] = [];

    // Parse Playwright text output
    // Format: "✓ test name (123ms)"
    const lines = output.split('\n');

    for (const line of lines) {
      // Passed test
      const passMatch = line.match(/✓\s+(.+?)\s+\((\d+)ms\)/);
      if (passMatch) {
        results.push({
          test_name: passMatch[1].trim(),
          test_file: testFile,
          status: 'passed',
          duration_ms: parseInt(passMatch[2]),
        });
        continue;
      }

      // Failed test
      const failMatch = line.match(/✗\s+(.+?)\s+\((\d+)ms\)/);
      if (failMatch) {
        results.push({
          test_name: failMatch[1].trim(),
          test_file: testFile,
          status: 'failed',
          duration_ms: parseInt(failMatch[2]),
        });
      }
    }

    return results;
  }

  /**
   * Parse text output (fallback)
   */
  private parseTextOutput(output: string, testFile: string): TestResult[] {
    const results: TestResult[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Look for common test output patterns
      if (line.includes('✓') || line.includes('PASS')) {
        const testName = line.replace(/[✓✗]/g, '').trim();
        if (testName) {
          results.push({
            test_name: testName,
            test_file: testFile,
            status: 'passed',
            duration_ms: 0,
          });
        }
      } else if (line.includes('✗') || line.includes('FAIL')) {
        const testName = line.replace(/[✓✗]/g, '').trim();
        if (testName) {
          results.push({
            test_name: testName,
            test_file: testFile,
            status: 'failed',
            duration_ms: 0,
          });
        }
      }
    }

    return results;
  }

  /**
   * Map test results to requirements
   */
  mapTestsToRequirements(
    testResults: TestResult[],
    requirements: ParsedRequirement[]
  ): MappedTestResult[] {
    const mapped: MappedTestResult[] = [];

    for (const test of testResults) {
      // If test already has requirement info, use it
      if (test.requirement_id && test.criterion_number) {
        const req = requirements.find((r) => r.id === test.requirement_id);
        if (req) {
          const criterion = req.acceptanceCriteria.find(
            (c) => c.number === test.criterion_number
          );
          if (criterion) {
            mapped.push({
              ...test,
              requirement_id: test.requirement_id,
              criterion_number: test.criterion_number,
              criterion_text: criterion.text,
            });
          }
        }
      } else {
        // Try to infer from test name
        for (const req of requirements) {
          // Check if test name mentions requirement
          const reqPattern = new RegExp(
            `requirement[s]?\\s+${req.id}`,
            'i'
          );
          if (reqPattern.test(test.test_name)) {
            // Try to find criterion number
            for (const criterion of req.acceptanceCriteria) {
              const critPattern = new RegExp(
                `criterion\\s+${criterion.number}|${criterion.number}\\.\\d+`,
                'i'
              );
              if (critPattern.test(test.test_name)) {
                mapped.push({
                  ...test,
                  requirement_id: req.id,
                  criterion_number: criterion.number,
                  criterion_text: criterion.text,
                });
                break;
              }
            }
          }
        }
      }
    }

    return mapped;
  }
}

// Export singleton instance
export const testExecutionService = new TestExecutionService();
