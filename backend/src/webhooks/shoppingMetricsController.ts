/**
 * Shopping Metrics Controller
 * 
 * Provides HTTP endpoints for shopping metrics and monitoring
 */

import { Request, Response } from 'express';
import { shoppingMetricsService } from '../services/shoppingMetricsService';

/**
 * Get comprehensive shopping dashboard metrics
 * GET /api/admin/shopping/metrics/dashboard
 */
export async function getShoppingDashboard(req: Request, res: Response): Promise<void> {
  try {
    const timeWindowHours = parseInt(req.query.timeWindow as string) || 24;
    const metrics = await shoppingMetricsService.getDashboardMetrics(timeWindowHours);

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching shopping dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shopping dashboard metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get search metrics
 * GET /api/admin/shopping/metrics/search
 */
export async function getSearchMetrics(req: Request, res: Response): Promise<void> {
  try {
    const timeWindowHours = parseInt(req.query.timeWindow as string) || 24;
    const dashboard = await shoppingMetricsService.getDashboardMetrics(timeWindowHours);

    res.json({
      success: true,
      data: dashboard.search,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching search metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch search metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get order metrics
 * GET /api/admin/shopping/metrics/orders
 */
export async function getOrderMetrics(req: Request, res: Response): Promise<void> {
  try {
    const timeWindowHours = parseInt(req.query.timeWindow as string) || 24;
    const dashboard = await shoppingMetricsService.getDashboardMetrics(timeWindowHours);

    res.json({
      success: true,
      data: dashboard.orders,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching order metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get payment metrics
 * GET /api/admin/shopping/metrics/payments
 */
export async function getPaymentMetrics(req: Request, res: Response): Promise<void> {
  try {
    const timeWindowHours = parseInt(req.query.timeWindow as string) || 24;
    const dashboard = await shoppingMetricsService.getDashboardMetrics(timeWindowHours);

    res.json({
      success: true,
      data: dashboard.payments,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching payment metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get browser automation metrics
 * GET /api/admin/shopping/metrics/automation
 */
export async function getBrowserAutomationMetrics(req: Request, res: Response): Promise<void> {
  try {
    const timeWindowHours = parseInt(req.query.timeWindow as string) || 24;
    const dashboard = await shoppingMetricsService.getDashboardMetrics(timeWindowHours);

    res.json({
      success: true,
      data: dashboard.browserAutomation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching browser automation metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch browser automation metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get price discrepancy metrics
 * GET /api/admin/shopping/metrics/price-discrepancy
 */
export async function getPriceDiscrepancyMetrics(req: Request, res: Response): Promise<void> {
  try {
    const timeWindowHours = parseInt(req.query.timeWindow as string) || 24;
    const dashboard = await shoppingMetricsService.getDashboardMetrics(timeWindowHours);

    res.json({
      success: true,
      data: dashboard.priceDiscrepancy,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching price discrepancy metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price discrepancy metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get active alerts
 * GET /api/admin/shopping/metrics/alerts
 */
export async function getShoppingAlerts(req: Request, res: Response): Promise<void> {
  try {
    const alerts = await shoppingMetricsService.checkAlerts();

    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        criticalCount: alerts.filter(a => a.severity === 'critical').length,
        warningCount: alerts.filter(a => a.severity === 'warning').length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching shopping alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shopping alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Health check for shopping service
 * GET /api/admin/shopping/metrics/health
 */
export async function getShoppingHealth(req: Request, res: Response): Promise<void> {
  try {
    const metrics = await shoppingMetricsService.getDashboardMetrics(1); // Last hour
    const alerts = await shoppingMetricsService.checkAlerts();

    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const isHealthy = criticalAlerts.length === 0 &&
      metrics.search.successRate >= 90 &&
      metrics.payments.successRate >= 95;

    res.json({
      success: true,
      data: {
        status: isHealthy ? 'healthy' : criticalAlerts.length > 0 ? 'critical' : 'degraded',
        checks: {
          searchSuccessRate: {
            value: metrics.search.successRate,
            threshold: 90,
            passing: metrics.search.successRate >= 90
          },
          orderCompletionRate: {
            value: metrics.orders.completionRate,
            threshold: 85,
            passing: metrics.orders.completionRate >= 85
          },
          paymentSuccessRate: {
            value: metrics.payments.successRate,
            threshold: 95,
            passing: metrics.payments.successRate >= 95
          },
          browserAutomationSuccessRate: {
            value: metrics.browserAutomation.successRate,
            threshold: 80,
            passing: metrics.browserAutomation.totalAttempts === 0 || metrics.browserAutomation.successRate >= 80
          },
          priceDiscrepancyRate: {
            value: metrics.priceDiscrepancy.discrepancyRate,
            threshold: 15,
            passing: metrics.priceDiscrepancy.discrepancyRate <= 15
          }
        },
        alerts: {
          total: alerts.length,
          critical: criticalAlerts.length,
          warning: alerts.filter(a => a.severity === 'warning').length
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking shopping health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check shopping health',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
