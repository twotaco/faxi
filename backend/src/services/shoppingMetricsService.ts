/**
 * Shopping Metrics Service
 * 
 * Collects and calculates metrics for shopping operations including:
 * - Product search success rate
 * - Order completion rate
 * - Payment success rate
 * - Browser automation success rate
 * - Price discrepancy rate
 */

import { db } from '../database/connection';
import { redis } from '../queue/connection';

interface ShoppingMetric {
  timestamp: Date;
  metricType: string;
  value: number;
  metadata?: Record<string, any>;
}

interface SearchMetrics {
  totalSearches: number;
  successfulSearches: number;
  failedSearches: number;
  successRate: number;
  averageResultCount: number;
  averageResponseTime: number;
  cacheHitRate: number;
}

interface OrderMetrics {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  completionRate: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  averageTimeToCompletion: number;
}

interface PaymentMetrics {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  successRate: number;
  averagePaymentAmount: number;
  paymentMethodDistribution: Record<string, number>;
  averageProcessingTime: number;
}

interface BrowserAutomationMetrics {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  successRate: number;
  averageExecutionTime: number;
  failureReasons: Record<string, number>;
}

interface PriceDiscrepancyMetrics {
  totalValidations: number;
  discrepanciesFound: number;
  discrepancyRate: number;
  averageDiscrepancy: number;
  maxDiscrepancy: number;
  discrepanciesRequiringApproval: number;
}

interface ShoppingDashboardMetrics {
  search: SearchMetrics;
  orders: OrderMetrics;
  payments: PaymentMetrics;
  browserAutomation: BrowserAutomationMetrics;
  priceDiscrepancy: PriceDiscrepancyMetrics;
  timestamp: string;
}

export class ShoppingMetricsService {
  private static instance: ShoppingMetricsService;
  private metrics: ShoppingMetric[] = [];
  private readonly REDIS_KEY_PREFIX = 'shopping_metrics:';
  private readonly METRIC_RETENTION_HOURS = 24;

  private constructor() {
    this.startMetricsCollection();
  }

  public static getInstance(): ShoppingMetricsService {
    if (!ShoppingMetricsService.instance) {
      ShoppingMetricsService.instance = new ShoppingMetricsService();
    }
    return ShoppingMetricsService.instance;
  }

  /**
   * Record a product search metric
   */
  public async recordSearchMetric(
    success: boolean,
    resultCount: number,
    responseTimeMs: number,
    cacheHit: boolean,
    query?: string,
    error?: string
  ): Promise<void> {
    const metric: ShoppingMetric = {
      timestamp: new Date(),
      metricType: 'product_search',
      value: success ? 1 : 0,
      metadata: {
        success,
        resultCount,
        responseTimeMs,
        cacheHit,
        query: query?.substring(0, 100), // Truncate for privacy
        error
      }
    };

    await this.storeMetric(metric);
  }

  /**
   * Record an order lifecycle metric
   */
  public async recordOrderMetric(
    orderId: string,
    status: string,
    previousStatus?: string,
    orderValue?: number
  ): Promise<void> {
    const metric: ShoppingMetric = {
      timestamp: new Date(),
      metricType: 'order_lifecycle',
      value: 1,
      metadata: {
        orderId,
        status,
        previousStatus,
        orderValue
      }
    };

    await this.storeMetric(metric);
  }

  /**
   * Record a payment processing metric
   */
  public async recordPaymentMetric(
    success: boolean,
    amount: number,
    paymentMethod: 'card' | 'bank_transfer',
    processingTimeMs: number,
    error?: string
  ): Promise<void> {
    const metric: ShoppingMetric = {
      timestamp: new Date(),
      metricType: 'payment_processing',
      value: success ? 1 : 0,
      metadata: {
        success,
        amount,
        paymentMethod,
        processingTimeMs,
        error
      }
    };

    await this.storeMetric(metric);
  }

  /**
   * Record a browser automation metric
   */
  public async recordBrowserAutomationMetric(
    success: boolean,
    executionTimeMs: number,
    orderId: string,
    failureReason?: string
  ): Promise<void> {
    const metric: ShoppingMetric = {
      timestamp: new Date(),
      metricType: 'browser_automation',
      value: success ? 1 : 0,
      metadata: {
        success,
        executionTimeMs,
        orderId,
        failureReason
      }
    };

    await this.storeMetric(metric);
  }

  /**
   * Record a price discrepancy metric
   */
  public async recordPriceDiscrepancyMetric(
    orderId: string,
    quotedPrice: number,
    actualPrice: number,
    requiresApproval: boolean
  ): Promise<void> {
    const discrepancy = Math.abs(actualPrice - quotedPrice);
    const metric: ShoppingMetric = {
      timestamp: new Date(),
      metricType: 'price_discrepancy',
      value: discrepancy,
      metadata: {
        orderId,
        quotedPrice,
        actualPrice,
        discrepancy,
        requiresApproval
      }
    };

    await this.storeMetric(metric);
  }

  /**
   * Get comprehensive dashboard metrics
   */
  public async getDashboardMetrics(timeWindowHours: number = 24): Promise<ShoppingDashboardMetrics> {
    const [search, orders, payments, browserAutomation, priceDiscrepancy] = await Promise.all([
      this.getSearchMetrics(timeWindowHours),
      this.getOrderMetrics(timeWindowHours),
      this.getPaymentMetrics(timeWindowHours),
      this.getBrowserAutomationMetrics(timeWindowHours),
      this.getPriceDiscrepancyMetrics(timeWindowHours)
    ]);

    return {
      search,
      orders,
      payments,
      browserAutomation,
      priceDiscrepancy,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get search metrics
   */
  private async getSearchMetrics(timeWindowHours: number): Promise<SearchMetrics> {
    const metrics = await this.getMetricsByType('product_search', timeWindowHours);
    
    const totalSearches = metrics.length;
    const successfulSearches = metrics.filter(m => m.metadata?.success).length;
    const failedSearches = totalSearches - successfulSearches;
    const successRate = totalSearches > 0 ? (successfulSearches / totalSearches) * 100 : 0;

    const resultCounts = metrics
      .filter(m => m.metadata?.resultCount !== undefined)
      .map(m => m.metadata!.resultCount);
    const averageResultCount = resultCounts.length > 0
      ? resultCounts.reduce((sum, count) => sum + count, 0) / resultCounts.length
      : 0;

    const responseTimes = metrics
      .filter(m => m.metadata?.responseTimeMs !== undefined)
      .map(m => m.metadata!.responseTimeMs);
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    const cacheHits = metrics.filter(m => m.metadata?.cacheHit).length;
    const cacheHitRate = totalSearches > 0 ? (cacheHits / totalSearches) * 100 : 0;

    return {
      totalSearches,
      successfulSearches,
      failedSearches,
      successRate,
      averageResultCount,
      averageResponseTime,
      cacheHitRate
    };
  }

  /**
   * Get order metrics
   */
  private async getOrderMetrics(timeWindowHours: number): Promise<OrderMetrics> {
    try {
      const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

      // Get order counts by status
      const statusResult = await db.query(`
        SELECT 
          status,
          COUNT(*) as count,
          AVG(total_amount) as avg_amount
        FROM orders
        WHERE created_at >= $1
          AND product_asin IS NOT NULL
        GROUP BY status
      `, [cutoffTime]);

      const ordersByStatus: Record<string, number> = {};
      let totalOrders = 0;
      let totalAmount = 0;
      let completedOrders = 0;
      let cancelledOrders = 0;

      statusResult.rows.forEach(row => {
        const count = parseInt(row.count, 10);
        const avgAmount = parseFloat(row.avg_amount || '0');
        
        ordersByStatus[row.status] = count;
        totalOrders += count;
        totalAmount += avgAmount * count;

        if (row.status === 'delivered') {
          completedOrders = count;
        } else if (row.status === 'cancelled') {
          cancelledOrders = count;
        }
      });

      const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;
      const averageOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;

      // Calculate average time to completion
      const completionTimeResult = await db.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (purchased_at - created_at))) as avg_seconds
        FROM orders
        WHERE created_at >= $1
          AND purchased_at IS NOT NULL
          AND product_asin IS NOT NULL
      `, [cutoffTime]);

      const averageTimeToCompletion = parseFloat(completionTimeResult.rows[0]?.avg_seconds || '0');

      return {
        totalOrders,
        completedOrders,
        cancelledOrders,
        completionRate,
        averageOrderValue,
        ordersByStatus,
        averageTimeToCompletion
      };
    } catch (error) {
      console.error('Error calculating order metrics:', error);
      return {
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        completionRate: 0,
        averageOrderValue: 0,
        ordersByStatus: {},
        averageTimeToCompletion: 0
      };
    }
  }

  /**
   * Get payment metrics
   */
  private async getPaymentMetrics(timeWindowHours: number): Promise<PaymentMetrics> {
    const metrics = await this.getMetricsByType('payment_processing', timeWindowHours);
    
    const totalPayments = metrics.length;
    const successfulPayments = metrics.filter(m => m.metadata?.success).length;
    const failedPayments = totalPayments - successfulPayments;
    const successRate = totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0;

    const amounts = metrics
      .filter(m => m.metadata?.amount !== undefined)
      .map(m => m.metadata!.amount);
    const averagePaymentAmount = amounts.length > 0
      ? amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length
      : 0;

    const paymentMethodDistribution: Record<string, number> = {};
    metrics.forEach(m => {
      const method = m.metadata?.paymentMethod || 'unknown';
      paymentMethodDistribution[method] = (paymentMethodDistribution[method] || 0) + 1;
    });

    const processingTimes = metrics
      .filter(m => m.metadata?.processingTimeMs !== undefined)
      .map(m => m.metadata!.processingTimeMs);
    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    return {
      totalPayments,
      successfulPayments,
      failedPayments,
      successRate,
      averagePaymentAmount,
      paymentMethodDistribution,
      averageProcessingTime
    };
  }

  /**
   * Get browser automation metrics
   */
  private async getBrowserAutomationMetrics(timeWindowHours: number): Promise<BrowserAutomationMetrics> {
    const metrics = await this.getMetricsByType('browser_automation', timeWindowHours);
    
    const totalAttempts = metrics.length;
    const successfulAttempts = metrics.filter(m => m.metadata?.success).length;
    const failedAttempts = totalAttempts - successfulAttempts;
    const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;

    const executionTimes = metrics
      .filter(m => m.metadata?.executionTimeMs !== undefined)
      .map(m => m.metadata!.executionTimeMs);
    const averageExecutionTime = executionTimes.length > 0
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
      : 0;

    const failureReasons: Record<string, number> = {};
    metrics
      .filter(m => !m.metadata?.success && m.metadata?.failureReason)
      .forEach(m => {
        const reason = m.metadata!.failureReason;
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      });

    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      successRate,
      averageExecutionTime,
      failureReasons
    };
  }

  /**
   * Get price discrepancy metrics
   */
  private async getPriceDiscrepancyMetrics(timeWindowHours: number): Promise<PriceDiscrepancyMetrics> {
    const metrics = await this.getMetricsByType('price_discrepancy', timeWindowHours);
    
    const totalValidations = metrics.length;
    const discrepanciesFound = metrics.filter(m => m.value > 0).length;
    const discrepancyRate = totalValidations > 0 ? (discrepanciesFound / totalValidations) * 100 : 0;

    const discrepancies = metrics.map(m => m.value);
    const averageDiscrepancy = discrepancies.length > 0
      ? discrepancies.reduce((sum, disc) => sum + disc, 0) / discrepancies.length
      : 0;

    const maxDiscrepancy = discrepancies.length > 0
      ? Math.max(...discrepancies)
      : 0;

    const discrepanciesRequiringApproval = metrics.filter(m => m.metadata?.requiresApproval).length;

    return {
      totalValidations,
      discrepanciesFound,
      discrepancyRate,
      averageDiscrepancy,
      maxDiscrepancy,
      discrepanciesRequiringApproval
    };
  }

  /**
   * Check for alert conditions
   */
  public async checkAlerts(): Promise<Array<{ severity: string; message: string; metric: string; value: number }>> {
    const alerts: Array<{ severity: string; message: string; metric: string; value: number }> = [];
    const metrics = await this.getDashboardMetrics(1); // Last hour

    // Search success rate alert
    if (metrics.search.successRate < 90) {
      alerts.push({
        severity: metrics.search.successRate < 80 ? 'critical' : 'warning',
        message: `Product search success rate is ${metrics.search.successRate.toFixed(1)}% (threshold: 90%)`,
        metric: 'search_success_rate',
        value: metrics.search.successRate
      });
    }

    // Order completion rate alert
    if (metrics.orders.completionRate < 85) {
      alerts.push({
        severity: metrics.orders.completionRate < 70 ? 'critical' : 'warning',
        message: `Order completion rate is ${metrics.orders.completionRate.toFixed(1)}% (threshold: 85%)`,
        metric: 'order_completion_rate',
        value: metrics.orders.completionRate
      });
    }

    // Payment success rate alert
    if (metrics.payments.successRate < 95) {
      alerts.push({
        severity: metrics.payments.successRate < 90 ? 'critical' : 'warning',
        message: `Payment success rate is ${metrics.payments.successRate.toFixed(1)}% (threshold: 95%)`,
        metric: 'payment_success_rate',
        value: metrics.payments.successRate
      });
    }

    // Browser automation success rate alert
    if (metrics.browserAutomation.totalAttempts > 0 && metrics.browserAutomation.successRate < 80) {
      alerts.push({
        severity: metrics.browserAutomation.successRate < 60 ? 'critical' : 'warning',
        message: `Browser automation success rate is ${metrics.browserAutomation.successRate.toFixed(1)}% (threshold: 80%)`,
        metric: 'browser_automation_success_rate',
        value: metrics.browserAutomation.successRate
      });
    }

    // Price discrepancy rate alert
    if (metrics.priceDiscrepancy.discrepancyRate > 15) {
      alerts.push({
        severity: metrics.priceDiscrepancy.discrepancyRate > 25 ? 'critical' : 'warning',
        message: `Price discrepancy rate is ${metrics.priceDiscrepancy.discrepancyRate.toFixed(1)}% (threshold: 15%)`,
        metric: 'price_discrepancy_rate',
        value: metrics.priceDiscrepancy.discrepancyRate
      });
    }

    // Average discrepancy amount alert
    if (metrics.priceDiscrepancy.averageDiscrepancy > 100) {
      alerts.push({
        severity: metrics.priceDiscrepancy.averageDiscrepancy > 200 ? 'critical' : 'warning',
        message: `Average price discrepancy is ¥${metrics.priceDiscrepancy.averageDiscrepancy.toFixed(0)} (threshold: ¥100)`,
        metric: 'average_price_discrepancy',
        value: metrics.priceDiscrepancy.averageDiscrepancy
      });
    }

    return alerts;
  }

  /**
   * Store metric in Redis with TTL
   */
  private async storeMetric(metric: ShoppingMetric): Promise<void> {
    try {
      const client = redis.getClient();
      const key = `${this.REDIS_KEY_PREFIX}${metric.metricType}`;
      const value = JSON.stringify(metric);
      
      // Add to list
      await client.lpush(key, value);
      
      // Trim to keep only recent metrics (last 10000 per type)
      await client.ltrim(key, 0, 9999);
      
      // Set expiration
      await client.expire(key, this.METRIC_RETENTION_HOURS * 60 * 60);

      // Also store in memory for quick access
      this.metrics.push(metric);
      
      // Keep memory usage bounded
      if (this.metrics.length > 10000) {
        this.metrics = this.metrics.slice(-5000);
      }
    } catch (error) {
      console.error('Error storing shopping metric:', error);
      // Don't throw - metrics shouldn't break the main flow
    }
  }

  /**
   * Get metrics by type from Redis
   */
  private async getMetricsByType(metricType: string, timeWindowHours: number): Promise<ShoppingMetric[]> {
    try {
      const client = redis.getClient();
      const key = `${this.REDIS_KEY_PREFIX}${metricType}`;
      
      // Get all metrics from Redis
      const values = await client.lrange(key, 0, -1);
      
      const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
      
      return values
        .map(v => JSON.parse(v) as ShoppingMetric)
        .filter(m => new Date(m.timestamp) >= cutoffTime);
    } catch (error) {
      console.error(`Error retrieving metrics for ${metricType}:`, error);
      
      // Fallback to in-memory metrics
      const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
      return this.metrics
        .filter(m => m.metricType === metricType && m.timestamp >= cutoffTime);
    }
  }

  /**
   * Start periodic metrics collection and alert checking
   */
  private startMetricsCollection(): void {
    // Check alerts every 5 minutes
    setInterval(async () => {
      try {
        const alerts = await this.checkAlerts();
        
        if (alerts.length > 0) {
          console.warn('Shopping metrics alerts:', alerts);
          
          // Log alerts to database
          for (const alert of alerts) {
            await db.query(
              `INSERT INTO application_logs (level, message, metadata, created_at)
               VALUES ($1, $2, $3, $4)`,
              [
                alert.severity === 'critical' ? 'error' : 'warn',
                `Shopping Alert: ${alert.message}`,
                JSON.stringify(alert),
                new Date()
              ]
            );
          }
        }
      } catch (error) {
        console.error('Error checking shopping alerts:', error);
      }
    }, 5 * 60 * 1000);

    // Clean up old in-memory metrics every hour
    setInterval(() => {
      const cutoffTime = new Date(Date.now() - this.METRIC_RETENTION_HOURS * 60 * 60 * 1000);
      this.metrics = this.metrics.filter(m => m.timestamp >= cutoffTime);
    }, 60 * 60 * 1000);
  }
}

export const shoppingMetricsService = ShoppingMetricsService.getInstance();
