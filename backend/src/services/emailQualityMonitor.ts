import { emailMetricsService } from './emailMetricsService';
import { alertingService } from './alertingService';
import { loggingService } from './loggingService';

/**
 * Email Quality Monitor
 * 
 * Scheduled service that calculates email quality metrics and sends alerts
 * when thresholds are exceeded.
 * 
 * Requirements: 17.5, 17.6, 17.7
 */
export class EmailQualityMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Start the email quality monitoring service
   */
  start(): void {
    if (this.monitoringInterval) {
      loggingService.warn('Email quality monitor already running');
      return;
    }

    loggingService.info('Starting email quality monitor');

    // Run immediately on start
    this.checkEmailQuality().catch(error => {
      loggingService.error('Error in initial email quality check', error as Error);
    });

    // Schedule daily checks
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkEmailQuality();
      } catch (error) {
        loggingService.error('Error in scheduled email quality check', error as Error);
      }
    }, this.CHECK_INTERVAL_MS);

    loggingService.info('Email quality monitor started', {}, {
      checkIntervalHours: this.CHECK_INTERVAL_MS / (60 * 60 * 1000),
    });
  }

  /**
   * Stop the email quality monitoring service
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      loggingService.info('Email quality monitor stopped');
    }
  }

  /**
   * Check email quality metrics and send alerts if thresholds exceeded
   */
  async checkEmailQuality(): Promise<void> {
    try {
      loggingService.info('Checking email quality metrics');

      // Calculate metrics for the last 24 hours
      const metrics = await emailMetricsService.getRecentMetrics(1);

      loggingService.info('Email quality metrics calculated', {}, {
        totalSent: metrics.totalSent,
        bounceRate: (metrics.bounceRate * 100).toFixed(2) + '%',
        complaintRate: (metrics.complaintRate * 100).toFixed(3) + '%',
        deliveryRate: (metrics.deliveryRate * 100).toFixed(2) + '%',
      });

      // Check thresholds and get alerts
      const alerts = await emailMetricsService.checkThresholds(metrics);

      // Send alerts to administrators
      for (const alert of alerts) {
        await this.sendAlert(alert, metrics);
      }

      if (alerts.length === 0) {
        loggingService.info('Email quality metrics within acceptable thresholds');
      }
    } catch (error) {
      loggingService.error('Error checking email quality', error as Error);
      throw error;
    }
  }

  /**
   * Send alert to administrators via alerting service
   */
  private async sendAlert(
    alert: { type: string; threshold: number; actual: number; severity: string; message: string },
    metrics: { totalSent: number; totalDelivered: number; totalBounced: number; totalComplaints: number }
  ): Promise<void> {
    try {
      // Map alert type to rule ID
      const ruleId = this.getAlertRuleId(alert.type);

      // Trigger alert via alerting service
      await alertingService.triggerAlert(
        ruleId,
        alert.message,
        {
          alertType: alert.type,
          threshold: alert.threshold,
          actual: alert.actual,
          severity: alert.severity,
          metrics: {
            totalSent: metrics.totalSent,
            totalDelivered: metrics.totalDelivered,
            totalBounced: metrics.totalBounced,
            totalComplaints: metrics.totalComplaints,
          },
          timestamp: new Date().toISOString(),
        }
      );

      loggingService.warn(`Email quality alert sent: ${alert.message}`, {}, {
        ruleId,
        severity: alert.severity,
        threshold: alert.threshold,
        actual: alert.actual,
      });
    } catch (error) {
      loggingService.error('Error sending email quality alert', error as Error, {}, {
        alertType: alert.type,
        message: alert.message,
      });
    }
  }

  /**
   * Get alert rule ID for alert type
   */
  private getAlertRuleId(alertType: string): string {
    switch (alertType) {
      case 'bounce_rate':
        return 'email-high-bounce-rate';
      case 'complaint_rate':
        return 'email-high-complaint-rate';
      case 'delivery_rate':
        return 'email-low-delivery-rate';
      default:
        return 'email-quality-issue';
    }
  }

  /**
   * Get current monitoring status
   */
  getStatus(): { running: boolean; checkIntervalHours: number } {
    return {
      running: this.monitoringInterval !== null,
      checkIntervalHours: this.CHECK_INTERVAL_MS / (60 * 60 * 1000),
    };
  }

  /**
   * Manually trigger a quality check (for testing or on-demand checks)
   */
  async triggerCheck(): Promise<void> {
    loggingService.info('Manual email quality check triggered');
    await this.checkEmailQuality();
  }
}

export const emailQualityMonitor = new EmailQualityMonitor();
