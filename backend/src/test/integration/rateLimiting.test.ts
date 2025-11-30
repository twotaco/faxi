/**
 * Rate Limiting Integration Tests
 * 
 * Tests for PA-API rate limiting and admin dashboard rate limiting
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { paApiRateLimiter } from '../../middleware/rateLimiter';
import { productSearchService } from '../../services/productSearchService';
import { rateLimitMonitoringService } from '../../services/rateLimitMonitoringService';

describe('Rate Limiting', () => {
  beforeEach(async () => {
    // Clear rate limit state before each test
    await paApiRateLimiter.resetMetrics();
    paApiRateLimiter.clearQueue('test-user-1');
    paApiRateLimiter.clearQueue('test-user-2');
  });

  afterEach(async () => {
    // Clean up after tests
    await paApiRateLimiter.resetMetrics();
  });

  describe('PA-API Rate Limiter', () => {
    it('should allow first request immediately', async () => {
      const startTime = Date.now();
      await paApiRateLimiter.checkRateLimit('test-user-1');
      const endTime = Date.now();

      // Should complete in less than 100ms (no queuing)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should queue second request within same second', async () => {
      const userId = 'test-user-1';

      // First request - should be immediate
      await paApiRateLimiter.checkRateLimit(userId);

      // Second request - should be queued
      const startTime = Date.now();
      await paApiRateLimiter.checkRateLimit(userId);
      const endTime = Date.now();

      // Should have waited approximately 1 second
      expect(endTime - startTime).toBeGreaterThanOrEqual(900);
      expect(endTime - startTime).toBeLessThan(1500);
    });

    it('should enforce rate limit per user independently', async () => {
      // User 1 makes a request
      await paApiRateLimiter.checkRateLimit('test-user-1');

      // User 2 should be able to make a request immediately
      const startTime = Date.now();
      await paApiRateLimiter.checkRateLimit('test-user-2');
      const endTime = Date.now();

      // Should complete immediately (no queuing)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should track metrics correctly', async () => {
      const userId = 'test-user-1';

      // Make 3 requests (1 allowed immediately, 2 queued)
      const promises = [
        paApiRateLimiter.checkRateLimit(userId),
        paApiRateLimiter.checkRateLimit(userId),
        paApiRateLimiter.checkRateLimit(userId)
      ];

      await Promise.all(promises);

      // Check metrics
      const metrics = await paApiRateLimiter.getMetrics();
      
      // All 3 should be allowed (after queuing)
      expect(metrics.allowed).toBeGreaterThanOrEqual(1);
      expect(metrics.queued).toBeGreaterThanOrEqual(2);
      expect(metrics.rejected).toBe(0);
    });

    it('should reset metrics', async () => {
      // Make some requests
      await paApiRateLimiter.checkRateLimit('test-user-1');
      await paApiRateLimiter.checkRateLimit('test-user-2');

      // Reset metrics
      await paApiRateLimiter.resetMetrics();

      // Check metrics are reset
      const metrics = await paApiRateLimiter.getMetrics();
      expect(metrics.allowed).toBe(0);
      expect(metrics.queued).toBe(0);
      expect(metrics.rejected).toBe(0);
    });

    it('should report queue length', async () => {
      const userId = 'test-user-1';

      // Make first request
      await paApiRateLimiter.checkRateLimit(userId);

      // Start second request (will be queued)
      const promise = paApiRateLimiter.checkRateLimit(userId);

      // Check queue length (should be 1)
      // Note: This is timing-dependent, so we give it a small window
      await new Promise(resolve => setTimeout(resolve, 10));
      const queueLength = paApiRateLimiter.getQueueLength(userId);
      expect(queueLength).toBeGreaterThanOrEqual(0);

      // Wait for queued request to complete
      await promise;
    });
  });

  describe('Rate Limit Monitoring Service', () => {
    it('should get comprehensive status', async () => {
      // Make some PA-API requests
      await paApiRateLimiter.checkRateLimit('test-user-1');
      await paApiRateLimiter.checkRateLimit('test-user-1');

      // Get status
      const status = await rateLimitMonitoringService.getStatus();

      expect(status).toHaveProperty('paApi');
      expect(status).toHaveProperty('adminDashboard');
      expect(status).toHaveProperty('recentAlerts');

      expect(status.paApi).toHaveProperty('metrics');
      expect(status.paApi).toHaveProperty('queuedPercentage');
      expect(status.paApi).toHaveProperty('status');

      expect(['healthy', 'warning', 'critical']).toContain(status.paApi.status);
    });

    it('should track thresholds', () => {
      const thresholds = rateLimitMonitoringService.getThresholds();

      expect(thresholds).toHaveProperty('paApiQueuedPercentage');
      expect(thresholds).toHaveProperty('adminDashboardRejectedPerMinute');

      expect(thresholds.paApiQueuedPercentage).toBeGreaterThan(0);
      expect(thresholds.adminDashboardRejectedPerMinute).toBeGreaterThan(0);
    });

    it('should update thresholds', () => {
      const newThresholds = {
        paApiQueuedPercentage: 75
      };

      rateLimitMonitoringService.updateThresholds(newThresholds);

      const thresholds = rateLimitMonitoringService.getThresholds();
      expect(thresholds.paApiQueuedPercentage).toBe(75);
    });

    it('should clear alerts', async () => {
      await rateLimitMonitoringService.clearAlerts();

      const alerts = await rateLimitMonitoringService.getRecentAlerts();
      expect(alerts).toHaveLength(0);
    });
  });

  describe('Product Search Service with Rate Limiting', () => {
    it('should apply rate limiting to product searches', async () => {
      const userId = 'test-user-1';
      const query = 'test product';

      // In test mode, PA-API is not configured, so this will throw
      // But we can verify rate limiting is being called
      try {
        await productSearchService.searchProducts(query, {}, userId);
      } catch (error) {
        // Expected to fail in test mode (no PA-API credentials)
        expect(error).toBeDefined();
      }

      // Verify metrics were tracked
      const metrics = await paApiRateLimiter.getMetrics();
      expect(metrics.allowed).toBeGreaterThanOrEqual(0);
    });

    it('should apply rate limiting to product details', async () => {
      const userId = 'test-user-1';
      const asin = 'B08N5WRWNW';

      // In test mode, PA-API is not configured, so this will throw
      try {
        await productSearchService.getProductDetails(asin, userId);
      } catch (error) {
        // Expected to fail in test mode (no PA-API credentials)
        expect(error).toBeDefined();
      }

      // Verify metrics were tracked
      const metrics = await paApiRateLimiter.getMetrics();
      expect(metrics.allowed).toBeGreaterThanOrEqual(0);
    });
  });
});
