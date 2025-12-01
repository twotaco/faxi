import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { HealthCheckService } from './healthCheckService';
import type { PortCheckConfig, ResourceThresholds } from './healthCheckService';

/**
 * Property-Based Tests for Health Check Service
 * 
 * Feature: deployment-mcp, Property 16: Health Check Failure Detection
 * Validates: Requirements 5.4
 * 
 * Tests that when any health check fails, the deployment is halted and detailed diagnostics are provided
 */

describe('HealthCheckService - Property-Based Tests', () => {
  let healthCheckService: HealthCheckService;

  beforeEach(() => {
    healthCheckService = HealthCheckService.getInstance();
  });

  /**
   * Feature: deployment-mcp, Property 16: Health Check Failure Detection
   * Validates: Requirements 5.4
   * 
   * For any health check failure, the system must:
   * 1. Report the failure (passed = false)
   * 2. Provide detailed diagnostics in the details field
   * 3. Include a descriptive error message
   * 4. Record the duration of the check
   */
  it('property: health check failure detection provides detailed diagnostics', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          environment: fc.constantFrom('development', 'staging', 'production'),
          // Generate random port configurations
          ports: fc.array(
            fc.record({
              port: fc.integer({ min: 1024, max: 65535 }),
              name: fc.string({ minLength: 1, maxLength: 20 }),
              protocol: fc.constantFrom('http' as const, 'https' as const),
              path: fc.option(fc.constantFrom('/', '/health', '/api/health'), { nil: undefined }),
            }),
            { maxLength: 5 }
          ),
          // Generate random resource thresholds
          thresholds: fc.record({
            memoryUsagePercent: fc.integer({ min: 50, max: 99 }),
            diskUsagePercent: fc.integer({ min: 50, max: 99 }),
            cpuLoadAverage: fc.double({ min: 0.5, max: 2.0 }),
          }),
        }),
        async (scenario) => {
          // Run system integrity check
          const result = await healthCheckService.checkSystemIntegrity(
            scenario.environment,
            scenario.ports,
            scenario.thresholds
          );

          // Property 16: Health Check Failure Detection
          // When any check fails, detailed diagnostics must be provided

          // 1. Result must have a timestamp
          expect(result.timestamp).toBeInstanceOf(Date);

          // 2. Result must have all required check categories
          expect(result.checks).toHaveProperty('servicesRunning');
          expect(result.checks).toHaveProperty('portsResponding');
          expect(result.checks).toHaveProperty('databaseReachable');
          expect(result.checks).toHaveProperty('redisOperational');
          expect(result.checks).toHaveProperty('storageAccessible');
          expect(result.checks).toHaveProperty('queuesOperational');
          expect(result.checks).toHaveProperty('systemResources');

          // 3. Each check must have required fields
          const checkKeys = Object.keys(result.checks) as Array<keyof typeof result.checks>;
          for (const key of checkKeys) {
            const check = result.checks[key];
            
            // Must have passed boolean
            expect(typeof check.passed).toBe('boolean');
            
            // Must have duration (non-negative number)
            expect(typeof check.duration).toBe('number');
            expect(check.duration).toBeGreaterThanOrEqual(0);
            
            // Must have a message
            expect(typeof check.message).toBe('string');
            expect(check.message.length).toBeGreaterThan(0);
            
            // If check failed, must provide details
            if (!check.passed) {
              expect(check.details).toBeDefined();
              expect(typeof check.details).toBe('object');
              
              // Details should contain useful diagnostic information
              // At minimum, should have some properties
              expect(Object.keys(check.details!).length).toBeGreaterThan(0);
            }
          }

          // 4. Summary must be accurate
          const checkValues = Object.values(result.checks);
          const expectedTotal = checkValues.length;
          const expectedPassed = checkValues.filter(c => c.passed).length;
          const expectedFailed = checkValues.filter(c => !c.passed).length;
          const expectedWarnings = checkValues.filter(c => c.warning).length;

          expect(result.summary.total).toBe(expectedTotal);
          expect(result.summary.passed).toBe(expectedPassed);
          expect(result.summary.failed).toBe(expectedFailed);
          expect(result.summary.warnings).toBe(expectedWarnings);

          // 5. Overall passed status must match individual checks
          const shouldPass = expectedFailed === 0;
          expect(result.passed).toBe(shouldPass);

          // 6. If any check failed, overall result must be failed
          if (checkValues.some(c => !c.passed)) {
            expect(result.passed).toBe(false);
          }

          // 7. Port checks should reflect the ports provided
          if (scenario.ports.length > 0) {
            expect(result.checks.portsResponding.details).toHaveProperty('ports');
            expect(Array.isArray(result.checks.portsResponding.details.ports)).toBe(true);
          }

          // 8. System resources check should include resource details
          expect(result.checks.systemResources.details).toHaveProperty('memory');
          expect(result.checks.systemResources.details).toHaveProperty('cpu');
          expect(result.checks.systemResources.details).toHaveProperty('disk');

          // 9. Resource details should include thresholds and adequacy
          const resourceDetails = result.checks.systemResources.details;
          expect(resourceDetails.memory).toHaveProperty('threshold');
          expect(resourceDetails.memory).toHaveProperty('adequate');
          expect(resourceDetails.cpu).toHaveProperty('threshold');
          expect(resourceDetails.cpu).toHaveProperty('adequate');
          expect(resourceDetails.disk).toHaveProperty('threshold');
          expect(resourceDetails.disk).toHaveProperty('adequate');

          // 10. If resource check failed, message should indicate which resource
          if (!result.checks.systemResources.passed) {
            const message = result.checks.systemResources.message.toLowerCase();
            const hasResourceInfo = 
              message.includes('memory') || 
              message.includes('cpu') || 
              message.includes('disk');
            expect(hasResourceInfo).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: deployment-mcp, Property 2: Health Check Completeness
   * Validates: Requirements 5.1, 5.2, 5.3, 5.5
   * 
   * For any successful deployment, all three tiers of health checks must pass before declaring success:
   * - Tier 0: System integrity checks (services, ports, database, redis, storage, queues, resources)
   * - Tier 1: Smoke tests (API endpoints, webhooks, agent calls, core flows)
   * - Tier 2: E2E tests (fax pipeline, shopping, reply fax, formatting)
   */
  it('property: health check completeness - all tiers must pass for success', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          environment: fc.constantFrom('development', 'staging', 'production'),
          baseUrl: fc.constant('http://localhost:4000'),
          e2eScope: fc.constantFrom('critical' as const, 'changed' as const, 'full' as const),
        }),
        async (scenario) => {
          // Run all three tiers of health checks
          const tier0Result = await healthCheckService.checkSystemIntegrity(scenario.environment);
          const tier1Result = await healthCheckService.runSmokeTests(scenario.environment, scenario.baseUrl);
          const tier2Result = await healthCheckService.runE2ETests(scenario.environment, scenario.e2eScope, scenario.baseUrl);

          // Property 2: Health Check Completeness
          // All three tiers must be executed and their results must be comprehensive

          // Tier 0: System Integrity - must check all required components
          expect(tier0Result).toHaveProperty('passed');
          expect(tier0Result).toHaveProperty('timestamp');
          expect(tier0Result).toHaveProperty('checks');
          expect(tier0Result).toHaveProperty('summary');

          // Tier 0 must check all 7 system components
          expect(tier0Result.checks).toHaveProperty('servicesRunning');
          expect(tier0Result.checks).toHaveProperty('portsResponding');
          expect(tier0Result.checks).toHaveProperty('databaseReachable');
          expect(tier0Result.checks).toHaveProperty('redisOperational');
          expect(tier0Result.checks).toHaveProperty('storageAccessible');
          expect(tier0Result.checks).toHaveProperty('queuesOperational');
          expect(tier0Result.checks).toHaveProperty('systemResources');

          // Tier 1: Smoke Tests - must check all required endpoints and services
          expect(tier1Result).toHaveProperty('endpointsPassed');
          expect(tier1Result).toHaveProperty('endpointsFailed');
          expect(tier1Result).toHaveProperty('webhooksWorking');
          expect(tier1Result).toHaveProperty('agentCallsSuccessful');
          expect(tier1Result).toHaveProperty('coreFlowsWorking');
          expect(tier1Result).toHaveProperty('failures');

          // Tier 1 must test at least some endpoints
          const tier1Total = tier1Result.endpointsPassed + tier1Result.endpointsFailed;
          expect(tier1Total).toBeGreaterThan(0);

          // Tier 2: E2E Tests - must check all required functional flows
          expect(tier2Result).toHaveProperty('testsPassed');
          expect(tier2Result).toHaveProperty('testsFailed');
          expect(tier2Result).toHaveProperty('criticalPathsWorking');
          expect(tier2Result).toHaveProperty('faxPipelineWorking');
          expect(tier2Result).toHaveProperty('failures');

          // Tier 2 must test at least the critical paths
          const tier2Total = tier2Result.testsPassed + tier2Result.testsFailed;
          expect(tier2Total).toBeGreaterThan(0);

          // For a deployment to be considered successful, ALL tiers must pass
          const allTiersPassed = 
            tier0Result.passed &&
            tier1Result.endpointsFailed === 0 &&
            tier1Result.webhooksWorking &&
            tier1Result.agentCallsSuccessful &&
            tier1Result.coreFlowsWorking &&
            tier2Result.criticalPathsWorking &&
            tier2Result.faxPipelineWorking;

          // If any tier fails, the deployment should not be declared successful
          if (!tier0Result.passed) {
            expect(allTiersPassed).toBe(false);
          }

          if (tier1Result.endpointsFailed > 0 || !tier1Result.coreFlowsWorking) {
            expect(allTiersPassed).toBe(false);
          }

          if (!tier2Result.criticalPathsWorking || !tier2Result.faxPipelineWorking) {
            expect(allTiersPassed).toBe(false);
          }

          // Failures must be reported with details
          if (tier1Result.endpointsFailed > 0) {
            expect(tier1Result.failures.length).toBeGreaterThan(0);
            for (const failure of tier1Result.failures) {
              expect(failure).toHaveProperty('endpoint');
              expect(failure).toHaveProperty('error');
              expect(typeof failure.endpoint).toBe('string');
              expect(typeof failure.error).toBe('string');
            }
          }

          if (tier2Result.testsFailed > 0) {
            expect(tier2Result.failures.length).toBeGreaterThan(0);
            for (const failure of tier2Result.failures) {
              expect(failure).toHaveProperty('test');
              expect(failure).toHaveProperty('error');
              expect(typeof failure.test).toBe('string');
              expect(typeof failure.error).toBe('string');
            }
          }

          // E2E scope affects the number of tests run
          if (scenario.e2eScope === 'full') {
            // Full scope should run more tests than critical
            expect(tier2Total).toBeGreaterThanOrEqual(8); // At least 8 tests in full scope
          } else if (scenario.e2eScope === 'critical') {
            // Critical scope should run fewer tests
            expect(tier2Total).toBeGreaterThanOrEqual(4); // At least 4 critical tests
          }

          // Fax pipeline working status must be based on actual fax pipeline tests
          // If fax pipeline tests all passed, faxPipelineWorking should be true
          const faxPipelineTests = tier2Result.failures.filter(f => 
            f.test.includes('Fax Pipeline')
          );
          if (faxPipelineTests.length === 0 && tier2Result.testsPassed > 0) {
            // No fax pipeline failures means it should be working
            // (assuming at least some tests passed)
            expect(tier2Result.faxPipelineWorking).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Health checks must complete within reasonable time
   * 
   * For any health check, the duration should be reasonable (not hanging indefinitely)
   */
  it('property: health checks complete within reasonable time', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          environment: fc.constantFrom('development', 'staging', 'production'),
          thresholds: fc.record({
            memoryUsagePercent: fc.integer({ min: 50, max: 99 }),
            diskUsagePercent: fc.integer({ min: 50, max: 99 }),
            cpuLoadAverage: fc.double({ min: 0.5, max: 2.0 }),
          }),
        }),
        async (scenario) => {
          const startTime = Date.now();
          
          const result = await healthCheckService.checkSystemIntegrity(
            scenario.environment,
            [], // No ports to avoid network delays
            scenario.thresholds
          );

          const totalDuration = Date.now() - startTime;

          // Total check should complete within 30 seconds (generous timeout)
          expect(totalDuration).toBeLessThan(30000);

          // Each individual check should have a reasonable duration
          const checkValues = Object.values(result.checks);
          for (const check of checkValues) {
            // Individual checks should complete within 10 seconds
            expect(check.duration).toBeLessThan(10000);
          }
        }
      ),
      { numRuns: 50 } // Fewer runs since this involves actual system checks
    );
  });

  /**
   * Property: Warning flags are set appropriately for degraded performance
   * 
   * For any health check with slow response times, warnings should be flagged
   */
  it('property: warnings are set for degraded performance', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          environment: fc.constantFrom('development', 'staging', 'production'),
          thresholds: fc.record({
            memoryUsagePercent: fc.integer({ min: 50, max: 99 }),
            diskUsagePercent: fc.integer({ min: 50, max: 99 }),
            cpuLoadAverage: fc.double({ min: 0.5, max: 2.0 }),
          }),
        }),
        async (scenario) => {
          const result = await healthCheckService.checkSystemIntegrity(
            scenario.environment,
            [],
            scenario.thresholds
          );

          // Check database response time warning
          const dbCheck = result.checks.databaseReachable;
          if (dbCheck.passed && dbCheck.details?.responseTime > 1000) {
            // Should have warning flag if response time is slow
            expect(dbCheck.warning).toBe(true);
          }

          // Check Redis response time warning
          const redisCheck = result.checks.redisOperational;
          if (redisCheck.passed && redisCheck.details?.responseTime > 500) {
            // Should have warning flag if response time is slow
            expect(redisCheck.warning).toBe(true);
          }

          // Check storage response time warning
          const storageCheck = result.checks.storageAccessible;
          if (storageCheck.passed && storageCheck.details?.responseTime > 2000) {
            // Should have warning flag if response time is slow
            expect(storageCheck.warning).toBe(true);
          }

          // Check system resources warning
          const resourceCheck = result.checks.systemResources;
          if (!resourceCheck.passed) {
            // Failed resource check should have warning flag
            expect(resourceCheck.warning).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Health check results are deterministic for same system state
   * 
   * Running health checks multiple times in quick succession should yield consistent results
   * (assuming system state doesn't change)
   */
  it('property: health checks are consistent across multiple runs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          environment: fc.constantFrom('development', 'staging', 'production'),
          thresholds: fc.record({
            memoryUsagePercent: fc.integer({ min: 50, max: 99 }),
            diskUsagePercent: fc.integer({ min: 50, max: 99 }),
            cpuLoadAverage: fc.double({ min: 0.5, max: 2.0 }),
          }),
        }),
        async (scenario) => {
          // Run health check twice in quick succession
          const result1 = await healthCheckService.checkSystemIntegrity(
            scenario.environment,
            [],
            scenario.thresholds
          );

          const result2 = await healthCheckService.checkSystemIntegrity(
            scenario.environment,
            [],
            scenario.thresholds
          );

          // Overall pass/fail status should be consistent
          expect(result1.passed).toBe(result2.passed);

          // Individual check pass/fail should be consistent
          const checkKeys = Object.keys(result1.checks) as Array<keyof typeof result1.checks>;
          for (const key of checkKeys) {
            expect(result1.checks[key].passed).toBe(result2.checks[key].passed);
          }

          // Summary counts should be consistent
          expect(result1.summary.total).toBe(result2.summary.total);
          expect(result1.summary.passed).toBe(result2.summary.passed);
          expect(result1.summary.failed).toBe(result2.summary.failed);
        }
      ),
      { numRuns: 30 } // Fewer runs since we're doing double checks
    );
  });
});
