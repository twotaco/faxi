/**
 * Monitoring Controller
 * 
 * Provides HTTP endpoints for monitoring prompt system health
 */

import { Request, Response } from 'express';
import { promptMonitoringService } from '../services/promptMonitoringService';

/**
 * Get dashboard metrics
 * GET /api/monitoring/prompts/dashboard
 */
export async function getPromptDashboard(req: Request, res: Response): Promise<void> {
  try {
    const timeWindowMs = parseInt(req.query.timeWindow as string) || 3600000; // Default 1 hour
    const metrics = promptMonitoringService.getDashboardMetrics(timeWindowMs);

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get validation metrics for a specific use case
 * GET /api/monitoring/prompts/validation/:useCase
 */
export async function getValidationMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { useCase } = req.params;
    const timeWindowMs = parseInt(req.query.timeWindow as string) || 3600000;

    const successRate = promptMonitoringService.getValidationSuccessRate(useCase, timeWindowMs);

    res.json({
      success: true,
      data: {
        useCase,
        successRate,
        threshold: 0.95,
        status: successRate >= 0.95 ? 'healthy' : 'warning'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch validation metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get insights quality metrics for a specific use case
 * GET /api/monitoring/prompts/insights/:useCase
 */
export async function getInsightsMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { useCase } = req.params;
    const timeWindowMs = parseInt(req.query.timeWindow as string) || 3600000;

    const confidenceScores = promptMonitoringService.getAverageConfidenceScores(useCase, timeWindowMs);
    const extractionRate = promptMonitoringService.getInsightsExtractionRate(useCase, timeWindowMs);

    res.json({
      success: true,
      data: {
        useCase,
        averageConfidenceScores: confidenceScores,
        extractionRate,
        status: extractionRate >= 0.8 ? 'healthy' : 'warning'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch insights metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get performance metrics for a specific use case
 * GET /api/monitoring/prompts/performance/:useCase
 */
export async function getPerformanceMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { useCase } = req.params;
    const timeWindowMs = parseInt(req.query.timeWindow as string) || 3600000;

    const avgResponseTime = promptMonitoringService.getAveragePerformance(useCase, 'total', timeWindowMs);
    const avgValidationTime = promptMonitoringService.getAveragePerformance(useCase, 'validation', timeWindowMs);

    res.json({
      success: true,
      data: {
        useCase,
        averageResponseTimeMs: avgResponseTime,
        averageValidationTimeMs: avgValidationTime,
        responseTimeThreshold: 5000,
        validationTimeThreshold: 100,
        status: avgResponseTime < 5000 && avgValidationTime < 100 ? 'healthy' : 'warning'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get error metrics for a specific use case
 * GET /api/monitoring/prompts/errors/:useCase
 */
export async function getErrorMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { useCase } = req.params;
    const timeWindowMs = parseInt(req.query.timeWindow as string) || 3600000;

    const errorRate = promptMonitoringService.getErrorRate(useCase, timeWindowMs);

    res.json({
      success: true,
      data: {
        useCase,
        errorRate,
        threshold: 0.05,
        status: errorRate < 0.05 ? 'healthy' : 'critical'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch error metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Export all metrics (for external monitoring systems)
 * GET /api/monitoring/prompts/export
 */
export async function exportMetrics(req: Request, res: Response): Promise<void> {
  try {
    const metrics = promptMonitoringService.exportMetrics();

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to export metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Health check endpoint
 * GET /api/monitoring/prompts/health
 */
export async function getHealthStatus(req: Request, res: Response): Promise<void> {
  try {
    const metrics = promptMonitoringService.getDashboardMetrics(3600000); // 1 hour

    const isHealthy = 
      metrics.overall.validationSuccessRate >= 0.95 &&
      metrics.overall.errorRate < 0.05 &&
      metrics.overall.averageResponseTime < 5000;

    res.json({
      success: true,
      data: {
        status: isHealthy ? 'healthy' : 'degraded',
        validationSuccessRate: metrics.overall.validationSuccessRate,
        errorRate: metrics.overall.errorRate,
        averageResponseTime: metrics.overall.averageResponseTime,
        checks: {
          validation: metrics.overall.validationSuccessRate >= 0.95,
          errors: metrics.overall.errorRate < 0.05,
          performance: metrics.overall.averageResponseTime < 5000
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check health status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
