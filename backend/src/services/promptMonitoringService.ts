/**
 * Prompt Monitoring Service
 * 
 * Tracks and monitors:
 * - Schema validation success rates
 * - Insights extraction quality
 * - Error rates
 * - Performance metrics
 */

import { logger } from './loggingService';

export interface ValidationMetric {
  useCase: string;
  success: boolean;
  attemptNumber: number;
  validationErrors?: string[];
  timestamp: Date;
  userId?: string;
  faxJobId?: string;
}

export interface InsightsMetric {
  useCase: string;
  userId: string;
  faxJobId: string;
  insightsExtracted: boolean;
  confidenceScores: {
    demographics?: number;
    lifeEvents?: number;
    intent?: number;
  };
  fieldsExtracted: string[];
  timestamp: Date;
}

export interface PerformanceMetric {
  useCase: string;
  operation: 'llm_call' | 'validation' | 'insights_processing' | 'total';
  durationMs: number;
  timestamp: Date;
  userId?: string;
  faxJobId?: string;
}

export interface ErrorMetric {
  useCase: string;
  errorType: 'validation_failure' | 'json_parse_error' | 'llm_error' | 'insights_error';
  errorMessage: string;
  retryCount: number;
  resolved: boolean;
  timestamp: Date;
  userId?: string;
  faxJobId?: string;
}

class PromptMonitoringService {
  private validationMetrics: ValidationMetric[] = [];
  private insightsMetrics: InsightsMetric[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private errorMetrics: ErrorMetric[] = [];

  // Retention period (24 hours)
  private readonly RETENTION_MS = 24 * 60 * 60 * 1000;

  /**
   * Record a validation attempt
   */
  recordValidation(metric: ValidationMetric): void {
    this.validationMetrics.push(metric);
    this.cleanOldMetrics();

    // Log validation failures
    if (!metric.success) {
      logger.warn('Schema validation failed', {
        useCase: metric.useCase,
        attemptNumber: metric.attemptNumber,
        errors: metric.validationErrors,
        userId: metric.userId,
        faxJobId: metric.faxJobId
      });
    }

    // Alert if validation success rate drops below threshold
    this.checkValidationThreshold(metric.useCase);
  }

  /**
   * Record insights extraction
   */
  recordInsights(metric: InsightsMetric): void {
    this.insightsMetrics.push(metric);
    this.cleanOldMetrics();

    // Log insights extraction
    logger.info('Insights extracted', {
      useCase: metric.useCase,
      fieldsExtracted: metric.fieldsExtracted,
      confidenceScores: metric.confidenceScores,
      userId: metric.userId,
      faxJobId: metric.faxJobId
    });

    // Check insights quality
    this.checkInsightsQuality(metric);
  }

  /**
   * Record performance metric
   */
  recordPerformance(metric: PerformanceMetric): void {
    this.performanceMetrics.push(metric);
    this.cleanOldMetrics();

    // Alert on slow operations
    if (metric.operation === 'total' && metric.durationMs > 5000) {
      logger.warn('Slow response time', {
        useCase: metric.useCase,
        durationMs: metric.durationMs,
        userId: metric.userId,
        faxJobId: metric.faxJobId
      });
    }

    if (metric.operation === 'validation' && metric.durationMs > 100) {
      logger.warn('Slow validation', {
        useCase: metric.useCase,
        durationMs: metric.durationMs
      });
    }
  }

  /**
   * Record an error
   */
  recordError(metric: ErrorMetric): void {
    this.errorMetrics.push(metric);
    this.cleanOldMetrics();

    logger.error('Prompt system error', {
      useCase: metric.useCase,
      errorType: metric.errorType,
      errorMessage: metric.errorMessage,
      retryCount: metric.retryCount,
      resolved: metric.resolved,
      userId: metric.userId,
      faxJobId: metric.faxJobId
    });

    // Alert on high error rates
    this.checkErrorThreshold(metric.useCase);
  }

  /**
   * Get validation success rate for a use case
   */
  getValidationSuccessRate(useCase: string, timeWindowMs: number = 3600000): number {
    const cutoff = Date.now() - timeWindowMs;
    const recentMetrics = this.validationMetrics.filter(
      m => m.useCase === useCase && m.timestamp.getTime() > cutoff
    );

    if (recentMetrics.length === 0) return 1.0;

    const successful = recentMetrics.filter(m => m.success).length;
    return successful / recentMetrics.length;
  }

  /**
   * Get average confidence scores for insights
   */
  getAverageConfidenceScores(useCase: string, timeWindowMs: number = 3600000): {
    demographics: number;
    lifeEvents: number;
    intent: number;
  } {
    const cutoff = Date.now() - timeWindowMs;
    const recentMetrics = this.insightsMetrics.filter(
      m => m.useCase === useCase && m.timestamp.getTime() > cutoff && m.insightsExtracted
    );

    if (recentMetrics.length === 0) {
      return { demographics: 0, lifeEvents: 0, intent: 0 };
    }

    const sum = recentMetrics.reduce(
      (acc, m) => ({
        demographics: acc.demographics + (m.confidenceScores.demographics || 0),
        lifeEvents: acc.lifeEvents + (m.confidenceScores.lifeEvents || 0),
        intent: acc.intent + (m.confidenceScores.intent || 0)
      }),
      { demographics: 0, lifeEvents: 0, intent: 0 }
    );

    return {
      demographics: sum.demographics / recentMetrics.length,
      lifeEvents: sum.lifeEvents / recentMetrics.length,
      intent: sum.intent / recentMetrics.length
    };
  }

  /**
   * Get average performance metrics
   */
  getAveragePerformance(useCase: string, operation: string, timeWindowMs: number = 3600000): number {
    const cutoff = Date.now() - timeWindowMs;
    const recentMetrics = this.performanceMetrics.filter(
      m => m.useCase === useCase && m.operation === operation && m.timestamp.getTime() > cutoff
    );

    if (recentMetrics.length === 0) return 0;

    const sum = recentMetrics.reduce((acc, m) => acc + m.durationMs, 0);
    return sum / recentMetrics.length;
  }

  /**
   * Get error rate
   */
  getErrorRate(useCase: string, timeWindowMs: number = 3600000): number {
    const cutoff = Date.now() - timeWindowMs;
    const recentErrors = this.errorMetrics.filter(
      m => m.useCase === useCase && m.timestamp.getTime() > cutoff
    );

    const recentValidations = this.validationMetrics.filter(
      m => m.useCase === useCase && m.timestamp.getTime() > cutoff
    );

    const totalAttempts = recentValidations.length;
    if (totalAttempts === 0) return 0;

    return recentErrors.length / totalAttempts;
  }

  /**
   * Get insights extraction rate
   */
  getInsightsExtractionRate(useCase: string, timeWindowMs: number = 3600000): number {
    const cutoff = Date.now() - timeWindowMs;
    const recentMetrics = this.insightsMetrics.filter(
      m => m.useCase === useCase && m.timestamp.getTime() > cutoff
    );

    if (recentMetrics.length === 0) return 0;

    const extracted = recentMetrics.filter(m => m.insightsExtracted).length;
    return extracted / recentMetrics.length;
  }

  /**
   * Get dashboard metrics for all use cases
   */
  getDashboardMetrics(timeWindowMs: number = 3600000): {
    useCases: {
      [useCase: string]: {
        validationSuccessRate: number;
        averageConfidenceScores: { demographics: number; lifeEvents: number; intent: number };
        averageResponseTime: number;
        averageValidationTime: number;
        errorRate: number;
        insightsExtractionRate: number;
        totalRequests: number;
      };
    };
    overall: {
      validationSuccessRate: number;
      errorRate: number;
      averageResponseTime: number;
    };
  } {
    const cutoff = Date.now() - timeWindowMs;
    const useCases = new Set([
      ...this.validationMetrics.map(m => m.useCase),
      ...this.insightsMetrics.map(m => m.useCase),
      ...this.performanceMetrics.map(m => m.useCase)
    ]);

    const useCaseMetrics: any = {};

    for (const useCase of useCases) {
      const validations = this.validationMetrics.filter(
        m => m.useCase === useCase && m.timestamp.getTime() > cutoff
      );

      useCaseMetrics[useCase] = {
        validationSuccessRate: this.getValidationSuccessRate(useCase, timeWindowMs),
        averageConfidenceScores: this.getAverageConfidenceScores(useCase, timeWindowMs),
        averageResponseTime: this.getAveragePerformance(useCase, 'total', timeWindowMs),
        averageValidationTime: this.getAveragePerformance(useCase, 'validation', timeWindowMs),
        errorRate: this.getErrorRate(useCase, timeWindowMs),
        insightsExtractionRate: this.getInsightsExtractionRate(useCase, timeWindowMs),
        totalRequests: validations.length
      };
    }

    // Calculate overall metrics
    const allValidations = this.validationMetrics.filter(m => m.timestamp.getTime() > cutoff);
    const allErrors = this.errorMetrics.filter(m => m.timestamp.getTime() > cutoff);
    const allPerformance = this.performanceMetrics.filter(
      m => m.operation === 'total' && m.timestamp.getTime() > cutoff
    );

    const overallValidationSuccess = allValidations.length > 0
      ? allValidations.filter(m => m.success).length / allValidations.length
      : 1.0;

    const overallErrorRate = allValidations.length > 0
      ? allErrors.length / allValidations.length
      : 0;

    const overallAvgResponseTime = allPerformance.length > 0
      ? allPerformance.reduce((acc, m) => acc + m.durationMs, 0) / allPerformance.length
      : 0;

    return {
      useCases: useCaseMetrics,
      overall: {
        validationSuccessRate: overallValidationSuccess,
        errorRate: overallErrorRate,
        averageResponseTime: overallAvgResponseTime
      }
    };
  }

  /**
   * Check if validation success rate is below threshold
   */
  private checkValidationThreshold(useCase: string): void {
    const successRate = this.getValidationSuccessRate(useCase, 3600000); // 1 hour window
    const threshold = 0.95;

    if (successRate < threshold) {
      logger.error('Validation success rate below threshold', {
        useCase,
        successRate,
        threshold,
        alert: 'VALIDATION_THRESHOLD_BREACH'
      });
    }
  }

  /**
   * Check insights quality
   */
  private checkInsightsQuality(metric: InsightsMetric): void {
    const minConfidence = 0.6;

    // Check if any confidence scores are too low
    const lowConfidence = Object.entries(metric.confidenceScores)
      .filter(([_, score]) => score !== undefined && score < minConfidence);

    if (lowConfidence.length > 0) {
      logger.warn('Low confidence insights extracted', {
        useCase: metric.useCase,
        lowConfidenceFields: lowConfidence,
        userId: metric.userId,
        faxJobId: metric.faxJobId
      });
    }
  }

  /**
   * Check if error rate is above threshold
   */
  private checkErrorThreshold(useCase: string): void {
    const errorRate = this.getErrorRate(useCase, 3600000); // 1 hour window
    const threshold = 0.05;

    if (errorRate > threshold) {
      logger.error('Error rate above threshold', {
        useCase,
        errorRate,
        threshold,
        alert: 'ERROR_THRESHOLD_BREACH'
      });
    }
  }

  /**
   * Clean old metrics to prevent memory leaks
   */
  private cleanOldMetrics(): void {
    const cutoff = Date.now() - this.RETENTION_MS;

    this.validationMetrics = this.validationMetrics.filter(
      m => m.timestamp.getTime() > cutoff
    );
    this.insightsMetrics = this.insightsMetrics.filter(
      m => m.timestamp.getTime() > cutoff
    );
    this.performanceMetrics = this.performanceMetrics.filter(
      m => m.timestamp.getTime() > cutoff
    );
    this.errorMetrics = this.errorMetrics.filter(
      m => m.timestamp.getTime() > cutoff
    );
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    validation: ValidationMetric[];
    insights: InsightsMetric[];
    performance: PerformanceMetric[];
    errors: ErrorMetric[];
  } {
    return {
      validation: [...this.validationMetrics],
      insights: [...this.insightsMetrics],
      performance: [...this.performanceMetrics],
      errors: [...this.errorMetrics]
    };
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.validationMetrics = [];
    this.insightsMetrics = [];
    this.performanceMetrics = [];
    this.errorMetrics = [];
  }
}

export const promptMonitoringService = new PromptMonitoringService();
