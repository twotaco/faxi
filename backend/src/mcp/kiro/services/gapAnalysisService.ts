/**
 * Gap Analysis Service
 * 
 * Analyzes gaps between requirements, implementation, and test results.
 */

import type { ParsedRequirement } from './specParserService.js';
import type { TestResult } from './testExecutionService.js';
import type { CriteriaValidationResult } from './codeAnalysisService.js';

export interface Gap {
  id: string;
  type: 'missing_implementation' | 'missing_tests' | 'failing_tests' | 'untested_criteria';
  requirement_id: string;
  criterion_number: number;
  criterion_text: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  evidence: {
    code_status?: 'implemented' | 'missing' | 'partial' | 'needs_review';
    test_status?: 'passed' | 'failed' | 'missing' | 'error';
    test_error?: string;
    file_path?: string;
  };
}

export interface GapAnalysisResult {
  gaps: Gap[];
  summary: {
    total_gaps: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  traceability_matrix: TraceabilityEntry[];
}

export interface TraceabilityEntry {
  requirement_id: string;
  criterion_number: number;
  criterion_text: string;
  has_code: boolean;
  code_status?: string;
  has_tests: boolean;
  test_status?: string;
  tests_passing: boolean;
  completeness_score: number; // 0-100
}

class GapAnalysisService {
  /**
   * Analyze all validation gaps
   */
  async analyzeGaps(
    requirements: ParsedRequirement[],
    implementationStatus: CriteriaValidationResult[],
    testResults: TestResult[]
  ): Promise<GapAnalysisResult> {
    const gaps: Gap[] = [];

    // Build traceability matrix
    const traceabilityMatrix = this.buildTraceabilityMatrix(
      requirements,
      implementationStatus,
      testResults
    );

    // Analyze each criterion
    for (const entry of traceabilityMatrix) {
      // Gap 1: Missing implementation
      if (!entry.has_code || entry.code_status === 'missing') {
        gaps.push({
          id: `gap-${entry.requirement_id}-${entry.criterion_number}-impl`,
          type: 'missing_implementation',
          requirement_id: entry.requirement_id,
          criterion_number: entry.criterion_number,
          criterion_text: entry.criterion_text,
          severity: 'critical',
          description: `Requirement ${entry.requirement_id}.${entry.criterion_number} is not implemented`,
          evidence: {
            code_status: 'missing',
            test_status: entry.test_status,
          },
        });
      }

      // Gap 2: Missing tests
      if (entry.has_code && !entry.has_tests) {
        gaps.push({
          id: `gap-${entry.requirement_id}-${entry.criterion_number}-test`,
          type: 'missing_tests',
          requirement_id: entry.requirement_id,
          criterion_number: entry.criterion_number,
          criterion_text: entry.criterion_text,
          severity: 'high',
          description: `No tests found for requirement ${entry.requirement_id}.${entry.criterion_number}`,
          evidence: {
            code_status: entry.code_status as any,
            test_status: 'missing',
          },
        });
      }

      // Gap 3: Failing tests
      if (entry.has_tests && entry.test_status === 'failed') {
        gaps.push({
          id: `gap-${entry.requirement_id}-${entry.criterion_number}-fail`,
          type: 'failing_tests',
          requirement_id: entry.requirement_id,
          criterion_number: entry.criterion_number,
          criterion_text: entry.criterion_text,
          severity: 'high',
          description: `Tests failing for requirement ${entry.requirement_id}.${entry.criterion_number}`,
          evidence: {
            code_status: entry.code_status as any,
            test_status: 'failed',
          },
        });
      }

      // Gap 4: Untested criteria (partial implementation)
      if (entry.code_status === 'partial' && !entry.has_tests) {
        gaps.push({
          id: `gap-${entry.requirement_id}-${entry.criterion_number}-untested`,
          type: 'untested_criteria',
          requirement_id: entry.requirement_id,
          criterion_number: entry.criterion_number,
          criterion_text: entry.criterion_text,
          severity: 'medium',
          description: `Partially implemented but untested: ${entry.requirement_id}.${entry.criterion_number}`,
          evidence: {
            code_status: 'partial',
            test_status: 'missing',
          },
        });
      }
    }

    // Calculate severity
    for (const gap of gaps) {
      gap.severity = this.calculateSeverity(gap);
    }

    // Prioritize gaps
    const prioritizedGaps = this.prioritizeGaps(gaps);

    // Calculate summary
    const summary = {
      total_gaps: prioritizedGaps.length,
      critical: prioritizedGaps.filter((g) => g.severity === 'critical').length,
      high: prioritizedGaps.filter((g) => g.severity === 'high').length,
      medium: prioritizedGaps.filter((g) => g.severity === 'medium').length,
      low: prioritizedGaps.filter((g) => g.severity === 'low').length,
    };

    return {
      gaps: prioritizedGaps,
      summary,
      traceability_matrix: traceabilityMatrix,
    };
  }

  /**
   * Build traceability matrix
   */
  buildTraceabilityMatrix(
    requirements: ParsedRequirement[],
    implementationStatus: CriteriaValidationResult[],
    testResults: TestResult[]
  ): TraceabilityEntry[] {
    const matrix: TraceabilityEntry[] = [];

    for (const req of requirements) {
      for (const criterion of req.acceptanceCriteria) {
        // Find implementation status
        const implStatus = implementationStatus.find(
          (s) =>
            s.criterionNumber === criterion.number &&
            s.criterionText === criterion.text
        );

        // Find test results
        const tests = testResults.filter(
          (t) =>
            t.requirement_id === req.id &&
            t.criterion_number === criterion.number
        );

        const hasCode = implStatus?.status === 'implemented' || implStatus?.status === 'partial';
        const hasTests = tests.length > 0;
        const testsPassing = tests.length > 0 && tests.every((t) => t.status === 'passed');

        // Calculate completeness score
        let score = 0;
        if (hasCode) score += 40;
        if (implStatus?.status === 'implemented') score += 10;
        if (hasTests) score += 30;
        if (testsPassing) score += 20;

        matrix.push({
          requirement_id: req.id,
          criterion_number: criterion.number,
          criterion_text: criterion.text,
          has_code: hasCode,
          code_status: implStatus?.status,
          has_tests: hasTests,
          test_status: tests[0]?.status,
          tests_passing: testsPassing,
          completeness_score: score,
        });
      }
    }

    return matrix;
  }

  /**
   * Calculate gap severity
   */
  calculateSeverity(gap: Gap): 'critical' | 'high' | 'medium' | 'low' {
    // Critical: Missing implementation
    if (gap.type === 'missing_implementation') {
      return 'critical';
    }

    // High: Failing tests (implementation exists but broken)
    if (gap.type === 'failing_tests') {
      return 'high';
    }

    // High: Missing tests for implemented features
    if (gap.type === 'missing_tests' && gap.evidence.code_status === 'implemented') {
      return 'high';
    }

    // Medium: Untested criteria
    if (gap.type === 'untested_criteria') {
      return 'medium';
    }

    // Low: Everything else
    return 'low';
  }

  /**
   * Prioritize gaps
   */
  prioritizeGaps(gaps: Gap[]): Gap[] {
    const severityOrder = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return gaps.sort((a, b) => {
      // Sort by severity first
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      // Then by requirement ID
      return a.requirement_id.localeCompare(b.requirement_id);
    });
  }

  /**
   * Calculate overall coverage percentage
   */
  calculateCoveragePercentage(matrix: TraceabilityEntry[]): number {
    if (matrix.length === 0) return 0;

    const totalScore = matrix.reduce((sum, entry) => sum + entry.completeness_score, 0);
    const maxScore = matrix.length * 100;

    return Math.round((totalScore / maxScore) * 100);
  }
}

// Export singleton instance
export const gapAnalysisService = new GapAnalysisService();
