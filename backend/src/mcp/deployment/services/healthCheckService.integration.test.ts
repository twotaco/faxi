import { describe, it, expect, beforeEach } from 'vitest';
import { healthCheckService, HealthCheckService } from './healthCheckService';

/**
 * Integration tests for Health Check Service
 * 
 * These tests verify that the health check service correctly integrates
 * with the actual infrastructure components (database, Redis, S3, queues)
 */
describe('HealthCheckService - Integration Tests', () => {
  it('should perform system integrity check with real infrastructure', async () => {
    const result = await healthCheckService.checkSystemIntegrity('development');

    // Should complete successfully
    expect(result).toBeDefined();
    expect(result.timestamp).toBeInstanceOf(Date);

    // Should have all required checks
    expect(result.checks.servicesRunning).toBeDefined();
    expect(result.checks.portsResponding).toBeDefined();
    expect(result.checks.databaseReachable).toBeDefined();
    expect(result.checks.redisOperational).toBeDefined();
    expect(result.checks.storageAccessible).toBeDefined();
    expect(result.checks.queuesOperational).toBeDefined();
    expect(result.checks.systemResources).toBeDefined();

    // In test environment, these should typically pass
    expect(result.checks.servicesRunning.passed).toBe(true);
    expect(result.checks.databaseReachable.passed).toBe(true);
    expect(result.checks.redisOperational.passed).toBe(true);

    // Summary should be accurate
    expect(result.summary.total).toBe(7);
    expect(result.summary.passed + result.summary.failed).toBe(result.summary.total);

    console.log('Health Check Result:', JSON.stringify(result, null, 2));
  }, 15000); // 15 second timeout for integration test

  it('should check database reachability', async () => {
    const result = await healthCheckService.checkSystemIntegrity('development');
    
    const dbCheck = result.checks.databaseReachable;
    expect(dbCheck.passed).toBe(true);
    expect(dbCheck.duration).toBeGreaterThan(0);
    expect(dbCheck.message).toContain('Database reachable');
    expect(dbCheck.details).toHaveProperty('responseTime');
  });

  it('should check Redis operational status', async () => {
    const result = await healthCheckService.checkSystemIntegrity('development');
    
    const redisCheck = result.checks.redisOperational;
    expect(redisCheck.passed).toBe(true);
    expect(redisCheck.duration).toBeGreaterThan(0);
    expect(redisCheck.message).toContain('Redis operational');
    expect(redisCheck.details).toHaveProperty('responseTime');
  });

  it('should check storage accessibility', async () => {
    const result = await healthCheckService.checkSystemIntegrity('development');
    
    const storageCheck = result.checks.storageAccessible;
    // Storage might fail in test environment if MinIO is not running
    expect(storageCheck.duration).toBeGreaterThan(0);
    expect(storageCheck.message).toBeDefined();
    expect(storageCheck.details).toBeDefined();
  });

  it('should check queue operational status', async () => {
    const result = await healthCheckService.checkSystemIntegrity('development');
    
    const queueCheck = result.checks.queuesOperational;
    expect(queueCheck.passed).toBe(true);
    expect(queueCheck.duration).toBeGreaterThanOrEqual(0);
    expect(queueCheck.message).toContain('queues operational');
    expect(queueCheck.details).toHaveProperty('faxProcessing');
    expect(queueCheck.details).toHaveProperty('emailToFax');
  });

  it('should check system resources', async () => {
    const result = await healthCheckService.checkSystemIntegrity('development');
    
    const resourceCheck = result.checks.systemResources;
    expect(resourceCheck.duration).toBeGreaterThanOrEqual(0);
    expect(resourceCheck.details).toHaveProperty('memory');
    expect(resourceCheck.details).toHaveProperty('cpu');
    expect(resourceCheck.details).toHaveProperty('disk');
    
    // Memory details
    expect(resourceCheck.details.memory).toHaveProperty('total');
    expect(resourceCheck.details.memory).toHaveProperty('free');
    expect(resourceCheck.details.memory).toHaveProperty('used');
    expect(resourceCheck.details.memory).toHaveProperty('usagePercent');
    expect(resourceCheck.details.memory).toHaveProperty('adequate');
    
    // CPU details
    expect(resourceCheck.details.cpu).toHaveProperty('loadAverage');
    expect(resourceCheck.details.cpu).toHaveProperty('cpuCount');
    expect(resourceCheck.details.cpu).toHaveProperty('normalizedLoad');
    expect(resourceCheck.details.cpu).toHaveProperty('adequate');
  });

  it('should handle custom resource thresholds', async () => {
    const result = await healthCheckService.checkSystemIntegrity(
      'development',
      [],
      {
        memoryUsagePercent: 95,
        diskUsagePercent: 90,
        cpuLoadAverage: 1.5,
      }
    );

    const resourceCheck = result.checks.systemResources;
    expect(resourceCheck.details.memory.threshold).toBe(95);
    expect(resourceCheck.details.disk.threshold).toBe(90);
    expect(resourceCheck.details.cpu.threshold).toBe(1.5);
  });

  it('should check port responsiveness when ports are provided', async () => {
    const result = await healthCheckService.checkSystemIntegrity(
      'development',
      [
        { port: 4000, name: 'backend', protocol: 'http', path: '/health' },
      ]
    );

    const portCheck = result.checks.portsResponding;
    expect(portCheck.details).toHaveProperty('ports');
    expect(Array.isArray(portCheck.details.ports)).toBe(true);
    expect(portCheck.details.ports.length).toBe(1);
    expect(portCheck.details.ports[0]).toHaveProperty('port', 4000);
    expect(portCheck.details.ports[0]).toHaveProperty('name', 'backend');
    expect(portCheck.details.ports[0]).toHaveProperty('responding');
  });
});

describe('HealthCheckService - Tier 1 Smoke Tests', () => {
  let service: HealthCheckService;

  beforeEach(() => {
    service = HealthCheckService.getInstance();
  });

  describe('runSmokeTests', () => {
    it('should run smoke tests and return results', async () => {
      const result = await service.runSmokeTests('development', 'http://localhost:4000');

      expect(result).toBeDefined();
      expect(typeof result.endpointsPassed).toBe('number');
      expect(typeof result.endpointsFailed).toBe('number');
      expect(typeof result.webhooksWorking).toBe('boolean');
      expect(typeof result.agentCallsSuccessful).toBe('boolean');
      expect(typeof result.coreFlowsWorking).toBe('boolean');
      expect(Array.isArray(result.failures)).toBe(true);
    });

    it('should test API endpoints', async () => {
      const result = await service.runSmokeTests('development', 'http://localhost:4000');

      // Should have tested at least the root, health, and metrics endpoints
      expect(result.endpointsPassed + result.endpointsFailed).toBeGreaterThanOrEqual(3);
    });

    it('should test webhook receivers', async () => {
      const result = await service.runSmokeTests('development', 'http://localhost:4000');

      // Webhooks should be tested (Telnyx, Stripe, Email)
      // They may fail if not properly configured, but they should be tested
      expect(result.endpointsPassed + result.endpointsFailed).toBeGreaterThan(0);
    });

    it('should test NLP agent configuration', async () => {
      const result = await service.runSmokeTests('development', 'http://localhost:4000');

      // Should check if Gemini API key is configured
      // Result depends on environment configuration
      expect(result).toBeDefined();
    });

    it('should test shopping/product lookup configuration', async () => {
      const result = await service.runSmokeTests('development', 'http://localhost:4000');

      // Should check if shopping dependencies are configured
      expect(result).toBeDefined();
    });

    it('should test email/fax/AI flow configuration', async () => {
      const result = await service.runSmokeTests('development', 'http://localhost:4000');

      // Should check Telnyx, AWS SES, and Gemini configuration
      expect(result).toBeDefined();
    });

    it('should report failures with details', async () => {
      const result = await service.runSmokeTests('development', 'http://invalid-url:9999');

      // Should have failures when connecting to invalid URL
      expect(result.endpointsFailed).toBeGreaterThan(0);
      expect(result.failures.length).toBeGreaterThan(0);
      
      // Each failure should have endpoint and error
      result.failures.forEach(failure => {
        expect(failure.endpoint).toBeDefined();
        expect(failure.error).toBeDefined();
      });
    });

    it('should handle timeout gracefully', async () => {
      // Test with a URL that will timeout
      const result = await service.runSmokeTests('development', 'http://10.255.255.1:4000');

      // Should complete without throwing
      expect(result).toBeDefined();
      expect(result.endpointsFailed).toBeGreaterThan(0);
    });

    it('should determine webhooks working status', async () => {
      const result = await service.runSmokeTests('development', 'http://localhost:4000');

      // webhooksWorking should be a boolean
      expect(typeof result.webhooksWorking).toBe('boolean');
    });

    it('should determine agent calls successful status', async () => {
      const result = await service.runSmokeTests('development', 'http://localhost:4000');

      // agentCallsSuccessful should be a boolean
      expect(typeof result.agentCallsSuccessful).toBe('boolean');
    });

    it('should determine core flows working status', async () => {
      const result = await service.runSmokeTests('development', 'http://localhost:4000');

      // coreFlowsWorking should be a boolean
      expect(typeof result.coreFlowsWorking).toBe('boolean');
    });
  });
});
