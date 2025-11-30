/**
 * Rate Limiting Integration Tests
 *
 * Tests for scraping rate limiting and admin dashboard rate limiting
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scrapingRateLimitService } from '../../services/scrapingRateLimitService';
import { rateLimitMonitoringService } from '../../services/rateLimitMonitoringService';

describe('Rate Limiting', () => {
  beforeEach(async () => {
    // Clear rate limit state before each test
    await scrapingRateLimitService.reset();
  });

  afterEach(async () => {
    // Clean up after tests
    await scrapingRateLimitService.reset();
  });

  describe('Scraping Rate Limiter', () => {
    it('should allow first request when under limit', async () => {
      const status = await scrapingRateLimitService.checkRateLimit();

      // First request should be allowed
      expect(status.allowed).toBe(true);
      expect(status.searchesInLastHour).toBe(0);
    });

    it('should track search count after recording', async () => {
      // Record a search
      await scrapingRateLimitService.recordSearch();

      // Check status
      const status = await scrapingRateLimitService.getStatus();

      expect(status.searchesInLastHour).toBe(1);
    });

    it('should track multiple searches', async () => {
      // Record multiple searches
      await scrapingRateLimitService.recordSearch();
      await scrapingRateLimitService.recordSearch();
      await scrapingRateLimitService.recordSearch();

      // Check status
      const status = await scrapingRateLimitService.getStatus();

      expect(status.searchesInLastHour).toBe(3);
    });

    it('should reset metrics', async () => {
      // Record some searches
      await scrapingRateLimitService.recordSearch();
      await scrapingRateLimitService.recordSearch();

      // Reset
      await scrapingRateLimitService.reset();

      // Check metrics are reset
      const status = await scrapingRateLimitService.getStatus();
      expect(status.searchesInLastHour).toBe(0);
    });

    it('should provide max searches per hour', async () => {
      const status = await scrapingRateLimitService.getStatus();

      expect(status.maxSearchesPerHour).toBeGreaterThan(0);
    });
  });

  describe('Rate Limit Monitoring Service', () => {
    it('should get comprehensive status', async () => {
      // Record a search to have some data
      await scrapingRateLimitService.recordSearch();

      // Get status
      const status = await rateLimitMonitoringService.getStatus();

      expect(status).toHaveProperty('scraping');
      expect(status).toHaveProperty('adminDashboard');
      expect(status).toHaveProperty('recentAlerts');

      expect(status.scraping).toHaveProperty('searchesInLastHour');
      expect(status.scraping).toHaveProperty('maxSearchesPerHour');
      expect(status.scraping).toHaveProperty('usagePercentage');
      expect(status.scraping).toHaveProperty('status');

      expect(['healthy', 'warning', 'critical']).toContain(status.scraping.status);
    });

    it('should track thresholds', () => {
      const thresholds = rateLimitMonitoringService.getThresholds();

      expect(thresholds).toHaveProperty('scrapingUsagePercentage');
      expect(thresholds).toHaveProperty('adminDashboardRejectedPerMinute');

      expect(thresholds.scrapingUsagePercentage).toBeGreaterThan(0);
      expect(thresholds.adminDashboardRejectedPerMinute).toBeGreaterThan(0);
    });

    it('should update thresholds', () => {
      const newThresholds = {
        scrapingUsagePercentage: 90
      };

      rateLimitMonitoringService.updateThresholds(newThresholds);

      const thresholds = rateLimitMonitoringService.getThresholds();
      expect(thresholds.scrapingUsagePercentage).toBe(90);

      // Reset to default
      rateLimitMonitoringService.updateThresholds({ scrapingUsagePercentage: 80 });
    });

    it('should clear alerts', async () => {
      await rateLimitMonitoringService.clearAlerts();

      const alerts = await rateLimitMonitoringService.getRecentAlerts();
      expect(alerts).toHaveLength(0);
    });
  });
});
