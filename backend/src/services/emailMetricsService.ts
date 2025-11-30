import { db } from '../database/connection';
import { loggingService } from './loggingService';

/**
 * Email event types for metrics tracking
 */
export type EmailEventType = 'sent' | 'delivered' | 'bounced' | 'complained';

/**
 * Email event for recording
 */
export interface EmailEvent {
  eventType: EmailEventType;
  userId?: string;
  messageId?: string;
  occurredAt?: Date;
  details?: Record<string, any>;
}

/**
 * Calculated email quality metrics
 */
export interface EmailMetrics {
  totalSent: number;
  totalDelivered: number;
  totalBounced: number;
  totalComplaints: number;
  bounceRate: number;      // bounces / totalSent
  complaintRate: number;   // complaints / totalSent
  deliveryRate: number;    // delivered / totalSent
}

/**
 * Alert for threshold violations
 */
export interface MetricAlert {
  type: 'bounce_rate' | 'complaint_rate' | 'delivery_rate';
  threshold: number;
  actual: number;
  severity: 'warning' | 'critical';
  message: string;
}

/**
 * Email Metrics Service
 * 
 * Tracks email quality metrics including send, delivery, bounce, and complaint rates.
 * Monitors thresholds and generates alerts when quality metrics fall outside acceptable ranges.
 */
export class EmailMetricsService {
  // Threshold constants
  private readonly BOUNCE_RATE_THRESHOLD = 0.05;      // 5%
  private readonly COMPLAINT_RATE_THRESHOLD = 0.001;  // 0.1%
  private readonly DELIVERY_RATE_THRESHOLD = 0.95;    // 95%

  /**
   * Record an email event for metrics tracking
   */
  async recordEmailEvent(event: EmailEvent): Promise<void> {
    try {
      const occurredAt = event.occurredAt || new Date();
      const details = event.details ? JSON.stringify(event.details) : null;

      await db.query(
        `INSERT INTO email_metrics (event_type, user_id, message_id, occurred_at, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [event.eventType, event.userId || null, event.messageId || null, occurredAt, details]
      );

      loggingService.info(`Email event recorded: ${event.eventType}`, {}, {
        eventType: event.eventType,
        userId: event.userId,
        messageId: event.messageId,
      });
    } catch (error) {
      loggingService.error('Error recording email event', error as Error, {}, {
        eventType: event.eventType,
        userId: event.userId,
      });
      throw error;
    }
  }

  /**
   * Calculate email quality metrics for a time period
   */
  async calculateMetrics(startDate: Date, endDate: Date): Promise<EmailMetrics> {
    try {
      // Query event counts by type
      const result = await db.query(
        `SELECT 
           event_type,
           COUNT(*) as count
         FROM email_metrics
         WHERE occurred_at >= $1 AND occurred_at <= $2
         GROUP BY event_type`,
        [startDate, endDate]
      );

      // Initialize counts
      let totalSent = 0;
      let totalDelivered = 0;
      let totalBounced = 0;
      let totalComplaints = 0;

      // Parse results
      for (const row of result.rows) {
        const count = parseInt(row.count, 10);
        switch (row.event_type) {
          case 'sent':
            totalSent = count;
            break;
          case 'delivered':
            totalDelivered = count;
            break;
          case 'bounced':
            totalBounced = count;
            break;
          case 'complained':
            totalComplaints = count;
            break;
        }
      }

      // Calculate rates (avoid division by zero)
      const bounceRate = totalSent > 0 ? totalBounced / totalSent : 0;
      const complaintRate = totalSent > 0 ? totalComplaints / totalSent : 0;
      const deliveryRate = totalSent > 0 ? totalDelivered / totalSent : 0;

      const metrics: EmailMetrics = {
        totalSent,
        totalDelivered,
        totalBounced,
        totalComplaints,
        bounceRate,
        complaintRate,
        deliveryRate,
      };

      loggingService.info('Email metrics calculated', {}, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        metrics,
      });

      return metrics;
    } catch (error) {
      loggingService.error('Error calculating email metrics', error as Error, {}, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      throw error;
    }
  }

  /**
   * Check if metrics exceed thresholds and generate alerts
   */
  async checkThresholds(metrics: EmailMetrics): Promise<MetricAlert[]> {
    const alerts: MetricAlert[] = [];

    // Check bounce rate
    if (metrics.bounceRate > this.BOUNCE_RATE_THRESHOLD) {
      alerts.push({
        type: 'bounce_rate',
        threshold: this.BOUNCE_RATE_THRESHOLD,
        actual: metrics.bounceRate,
        severity: metrics.bounceRate > this.BOUNCE_RATE_THRESHOLD * 2 ? 'critical' : 'warning',
        message: `Bounce rate (${(metrics.bounceRate * 100).toFixed(2)}%) exceeds threshold (${(this.BOUNCE_RATE_THRESHOLD * 100).toFixed(2)}%)`,
      });
    }

    // Check complaint rate
    if (metrics.complaintRate > this.COMPLAINT_RATE_THRESHOLD) {
      alerts.push({
        type: 'complaint_rate',
        threshold: this.COMPLAINT_RATE_THRESHOLD,
        actual: metrics.complaintRate,
        severity: metrics.complaintRate > this.COMPLAINT_RATE_THRESHOLD * 2 ? 'critical' : 'warning',
        message: `Complaint rate (${(metrics.complaintRate * 100).toFixed(3)}%) exceeds threshold (${(this.COMPLAINT_RATE_THRESHOLD * 100).toFixed(3)}%)`,
      });
    }

    // Check delivery rate
    if (metrics.deliveryRate < this.DELIVERY_RATE_THRESHOLD && metrics.totalSent > 0) {
      alerts.push({
        type: 'delivery_rate',
        threshold: this.DELIVERY_RATE_THRESHOLD,
        actual: metrics.deliveryRate,
        severity: metrics.deliveryRate < this.DELIVERY_RATE_THRESHOLD * 0.9 ? 'critical' : 'warning',
        message: `Delivery rate (${(metrics.deliveryRate * 100).toFixed(2)}%) is below threshold (${(this.DELIVERY_RATE_THRESHOLD * 100).toFixed(2)}%)`,
      });
    }

    if (alerts.length > 0) {
      loggingService.warn('Email quality thresholds exceeded', {}, {
        alertCount: alerts.length,
        alerts: alerts.map(a => ({ type: a.type, actual: a.actual, threshold: a.threshold })),
      });
    }

    return alerts;
  }

  /**
   * Get metrics for the last N days
   */
  async getRecentMetrics(days: number = 1): Promise<EmailMetrics> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    return this.calculateMetrics(startDate, endDate);
  }

  /**
   * Get daily metrics for a date range
   */
  async getDailyMetrics(startDate: Date, endDate: Date): Promise<Array<{ date: string; metrics: EmailMetrics }>> {
    try {
      const result = await db.query(
        `SELECT 
           DATE(occurred_at) as date,
           event_type,
           COUNT(*) as count
         FROM email_metrics
         WHERE occurred_at >= $1 AND occurred_at <= $2
         GROUP BY DATE(occurred_at), event_type
         ORDER BY DATE(occurred_at)`,
        [startDate, endDate]
      );

      // Group by date
      const metricsByDate = new Map<string, EmailMetrics>();

      for (const row of result.rows) {
        const date = row.date;
        const count = parseInt(row.count, 10);

        if (!metricsByDate.has(date)) {
          metricsByDate.set(date, {
            totalSent: 0,
            totalDelivered: 0,
            totalBounced: 0,
            totalComplaints: 0,
            bounceRate: 0,
            complaintRate: 0,
            deliveryRate: 0,
          });
        }

        const metrics = metricsByDate.get(date)!;
        switch (row.event_type) {
          case 'sent':
            metrics.totalSent = count;
            break;
          case 'delivered':
            metrics.totalDelivered = count;
            break;
          case 'bounced':
            metrics.totalBounced = count;
            break;
          case 'complained':
            metrics.totalComplaints = count;
            break;
        }
      }

      // Calculate rates for each day
      const dailyMetrics: Array<{ date: string; metrics: EmailMetrics }> = [];
      for (const [date, metrics] of metricsByDate.entries()) {
        if (metrics.totalSent > 0) {
          metrics.bounceRate = metrics.totalBounced / metrics.totalSent;
          metrics.complaintRate = metrics.totalComplaints / metrics.totalSent;
          metrics.deliveryRate = metrics.totalDelivered / metrics.totalSent;
        }
        dailyMetrics.push({ date, metrics });
      }

      return dailyMetrics;
    } catch (error) {
      loggingService.error('Error getting daily metrics', error as Error, {}, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      throw error;
    }
  }
}

export const emailMetricsService = new EmailMetricsService();
