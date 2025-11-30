/**
 * Rate Limit Monitoring Service
 *
 * Monitors rate limit metrics and sends alerts when thresholds are exceeded.
 * Tracks scraping rate limiting and admin dashboard rate limiting.
 */

import { loggingService } from './loggingService';
import { scrapingRateLimitService } from './scrapingRateLimitService';
import { redis } from '../queue/connection';

interface RateLimitAlert {
  service: string;
  metric: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  severity: 'warning' | 'critical';
}

interface RateLimitThresholds {
  scrapingUsagePercentage: number; // Alert if > X% of hourly limit is used
  adminDashboardRejectedPerMinute: number; // Alert if > X requests rejected per minute
}

class RateLimitMonitoringService {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60 * 1000; // Check every minute
  private readonly ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between alerts
  private lastAlerts: Map<string, number> = new Map();

  private thresholds: RateLimitThresholds = {
    scrapingUsagePercentage: 80, // Alert if more than 80% of hourly limit is used
    adminDashboardRejectedPerMinute: 10 // Alert if more than 10 requests rejected per minute
  };

  /**
   * Start monitoring rate limits
   */
  start(): void {
    if (this.monitoringInterval) {
      loggingService.warn('Rate limit monitoring already started');
      return;
    }

    loggingService.info('Starting rate limit monitoring service');

    this.monitoringInterval = setInterval(async () => {
      await this.checkRateLimits();
    }, this.CHECK_INTERVAL_MS);

    // Run initial check
    this.checkRateLimits().catch(error => {
      loggingService.error('Initial rate limit check failed', error as Error);
    });
  }

  /**
   * Stop monitoring rate limits
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      loggingService.info('Rate limit monitoring service stopped');
    }
  }

  /**
   * Check all rate limits and send alerts if thresholds exceeded
   */
  private async checkRateLimits(): Promise<void> {
    try {
      // Check scraping rate limits
      await this.checkScrapingRateLimits();

      // Check admin dashboard rate limits
      await this.checkAdminDashboardRateLimits();
    } catch (error) {
      loggingService.error('Rate limit check failed', error as Error);
    }
  }

  /**
   * Check scraping rate limits
   */
  private async checkScrapingRateLimits(): Promise<void> {
    try {
      const status = await scrapingRateLimitService.getStatus();

      if (status.maxSearchesPerHour === 0) {
        return; // No limit configured
      }

      // Calculate usage percentage
      const usagePercentage = (status.searchesInLastHour / status.maxSearchesPerHour) * 100;

      // Check if usage percentage exceeds threshold
      if (usagePercentage > this.thresholds.scrapingUsagePercentage) {
        await this.sendAlert({
          service: 'Scraping',
          metric: 'usage_percentage',
          threshold: this.thresholds.scrapingUsagePercentage,
          currentValue: usagePercentage,
          timestamp: new Date(),
          severity: usagePercentage > 95 ? 'critical' : 'warning'
        });
      }

      // Log metrics for monitoring
      loggingService.info('Scraping rate limit metrics', {
        searchesInLastHour: status.searchesInLastHour,
        maxSearchesPerHour: status.maxSearchesPerHour,
        usagePercentage: usagePercentage.toFixed(2),
        allowed: status.allowed
      });
    } catch (error) {
      loggingService.error('Failed to check scraping rate limits', error as Error);
    }
  }

  /**
   * Check admin dashboard rate limits
   */
  private async checkAdminDashboardRateLimits(): Promise<void> {
    try {
      const client = redis.getClient();
      
      // Get all admin rate limit keys
      const keys = await client.keys('rate-limit:admin:*');
      
      let totalRejected = 0;
      let totalRequests = 0;

      // Count rejected requests (those that hit the limit)
      for (const key of keys) {
        const count = await client.get(key);
        if (count) {
          const requestCount = parseInt(count, 10);
          totalRequests += requestCount;
          
          // If count >= 60 (the limit), these were rejected
          if (requestCount >= 60) {
            totalRejected += (requestCount - 60);
          }
        }
      }

      // Check if rejected requests exceed threshold
      if (totalRejected > this.thresholds.adminDashboardRejectedPerMinute) {
        await this.sendAlert({
          service: 'Admin Dashboard',
          metric: 'rejected_requests_per_minute',
          threshold: this.thresholds.adminDashboardRejectedPerMinute,
          currentValue: totalRejected,
          timestamp: new Date(),
          severity: totalRejected > 50 ? 'critical' : 'warning'
        });
      }

      // Log metrics
      if (totalRequests > 0) {
        loggingService.info('Admin dashboard rate limit metrics', {
          totalRequests,
          totalRejected,
          activeUsers: keys.length
        });
      }
    } catch (error) {
      loggingService.error('Failed to check admin dashboard rate limits', error as Error);
    }
  }

  /**
   * Send alert for rate limit threshold exceeded
   */
  private async sendAlert(alert: RateLimitAlert): Promise<void> {
    const alertKey = `${alert.service}:${alert.metric}`;
    const now = Date.now();
    const lastAlert = this.lastAlerts.get(alertKey);

    // Check cooldown period
    if (lastAlert && (now - lastAlert) < this.ALERT_COOLDOWN_MS) {
      return; // Skip alert during cooldown
    }

    // Update last alert time
    this.lastAlerts.set(alertKey, now);

    // Log alert
    loggingService.warn('Rate limit threshold exceeded', {
      service: alert.service,
      metric: alert.metric,
      threshold: alert.threshold,
      currentValue: alert.currentValue,
      severity: alert.severity
    });

    // Store alert in Redis for admin dashboard
    try {
      const client = redis.getClient();
      const alertData = JSON.stringify(alert);
      await client.lpush('rate-limit:alerts', alertData);
      await client.ltrim('rate-limit:alerts', 0, 99); // Keep last 100 alerts
      await client.expire('rate-limit:alerts', 24 * 60 * 60); // Expire after 24 hours
    } catch (error) {
      loggingService.error('Failed to store rate limit alert', error as Error);
    }

    // In a production system, you would also:
    // - Send email/SMS notifications
    // - Post to Slack/PagerDuty
    // - Trigger automated scaling
  }

  /**
   * Get recent rate limit alerts
   */
  async getRecentAlerts(limit: number = 20): Promise<RateLimitAlert[]> {
    try {
      const client = redis.getClient();
      const alerts = await client.lrange('rate-limit:alerts', 0, limit - 1);
      
      return alerts.map(alert => JSON.parse(alert));
    } catch (error) {
      loggingService.error('Failed to get recent rate limit alerts', error as Error);
      return [];
    }
  }

  /**
   * Clear all rate limit alerts
   */
  async clearAlerts(): Promise<void> {
    try {
      const client = redis.getClient();
      await client.del('rate-limit:alerts');
      this.lastAlerts.clear();
      loggingService.info('Rate limit alerts cleared');
    } catch (error) {
      loggingService.error('Failed to clear rate limit alerts', error as Error);
    }
  }

  /**
   * Update rate limit thresholds
   */
  updateThresholds(thresholds: Partial<RateLimitThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds
    };
    
    loggingService.info('Rate limit thresholds updated', this.thresholds);
  }

  /**
   * Get current thresholds
   */
  getThresholds(): RateLimitThresholds {
    return { ...this.thresholds };
  }

  /**
   * Get comprehensive rate limit status
   */
  async getStatus(): Promise<{
    scraping: {
      searchesInLastHour: number;
      maxSearchesPerHour: number;
      usagePercentage: number;
      status: 'healthy' | 'warning' | 'critical';
    };
    adminDashboard: {
      activeUsers: number;
      status: 'healthy' | 'warning' | 'critical';
    };
    recentAlerts: RateLimitAlert[];
  }> {
    const scrapingStatus = await scrapingRateLimitService.getStatus();
    const usagePercentage = scrapingStatus.maxSearchesPerHour > 0
      ? (scrapingStatus.searchesInLastHour / scrapingStatus.maxSearchesPerHour) * 100
      : 0;

    const scrapingHealthStatus =
      usagePercentage > 95 ? 'critical' :
      usagePercentage > this.thresholds.scrapingUsagePercentage ? 'warning' :
      'healthy';

    // Get admin dashboard active users
    const client = redis.getClient();
    const adminKeys = await client.keys('rate-limit:admin:*');

    const recentAlerts = await this.getRecentAlerts(10);

    return {
      scraping: {
        searchesInLastHour: scrapingStatus.searchesInLastHour,
        maxSearchesPerHour: scrapingStatus.maxSearchesPerHour,
        usagePercentage,
        status: scrapingHealthStatus
      },
      adminDashboard: {
        activeUsers: adminKeys.length,
        status: 'healthy' // Could be enhanced with more metrics
      },
      recentAlerts
    };
  }
}

// Export singleton instance
export const rateLimitMonitoringService = new RateLimitMonitoringService();
