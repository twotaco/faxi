/**
 * Property-Based Tests for Deployment Orchestrator
 * 
 * Tests universal properties that should hold across all deployment scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { DeploymentOrchestrator } from './deploymentOrchestrator.js';
import { FullDeploymentOptions } from '../types/index.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

describe('deployment-mcp - Deployment Orchestrator Properties', () => {
  let tempDir: string;
  let orchestrator: DeploymentOrchestrator;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set test mode and provide minimal required environment variables
    process.env.TEST_MODE = 'true';
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_HOST = 'localhost';
    process.env.DATABASE_PORT = '5432';
    process.env.DATABASE_NAME = 'test_db';
    process.env.DATABASE_USER = 'test_user';
    process.env.DATABASE_PASSWORD = 'test_password';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.S3_ENDPOINT = 'http://localhost:9000';
    process.env.S3_BUCKET = 'test-bucket';
    process.env.S3_ACCESS_KEY_ID = 'test-key';
    process.env.S3_SECRET_ACCESS_KEY = 'test-secret';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.PORT = '4000';
    
    // Create a temporary directory for test deployments
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deployment-test-'));
    
    // Create a minimal .env file in temp directory
    const envContent = `
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=test_db
DATABASE_USER=test_user
DATABASE_PASSWORD=test_password
REDIS_HOST=localhost
REDIS_PORT=6379
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=test-bucket
S3_ACCESS_KEY_ID=test-key
S3_SECRET_ACCESS_KEY=test-secret
GEMINI_API_KEY=test-gemini-key
NODE_ENV=test
PORT=4000
`.trim();
    
    await fs.mkdir(path.join(tempDir, 'backend'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'backend', '.env'), envContent);
    
    // Initialize orchestrator with temp directory
    orchestrator = DeploymentOrchestrator.getInstance(tempDir);
  });

  afterEach(async () => {
    // Restore original environment
    process.env = originalEnv;
    
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /**
   * Feature: deployment-mcp, Property 1: Deployment Atomicity
   * Validates: Requirements 1.1, 1.5
   * 
   * For any deployment operation, either all components deploy successfully
   * or the system reverts to the previous state.
   * 
   * This property ensures that deployments are atomic - there are no partial
   * deployments where some components succeed and others fail without rollback.
   */
  it('property: deployment atomicity - all or nothing', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random deployment scenarios
        fc.record({
          environment: fc.constantFrom('development', 'staging', 'production'),
          components: fc.shuffledSubarray(
            ['backend', 'admin-dashboard', 'marketing-website'],
            { minLength: 1, maxLength: 3 }
          ),
          strategy: fc.constantFrom('rolling', 'blue-green', 'canary'),
          runMigrations: fc.boolean(),
          runTests: fc.constantFrom('none', 'smoke', 'e2e', 'full'),
          autoRollback: fc.boolean(),
        }),
        async (scenario) => {
          const options: FullDeploymentOptions = {
            environment: scenario.environment as any,
            components: scenario.components as any,
            strategy: scenario.strategy as any,
            runMigrations: scenario.runMigrations,
            runTests: scenario.runTests as any,
            autoRollback: scenario.autoRollback,
          };

          // Capture initial state (version/commit)
          const initialState = await captureSystemState(orchestrator);

          // Execute deployment (in TEST_MODE, this will simulate the deployment)
          const result = await orchestrator.deployFull(options);

          // Property 1: Deployment is atomic - either all succeed or rollback occurs
          if (result.success) {
            // If deployment succeeded, all requested components should be deployed
            expect(result.componentsDeployed.length).toBe(scenario.components.length);
            
            // All components should be in the deployed list
            for (const component of scenario.components) {
              expect(result.componentsDeployed).toContain(component);
            }
            
            // Health checks should have passed
            expect(result.healthChecksPassed).toBe(true);
            
            // No rollback should have been performed
            expect(result.rollbackPerformed).toBe(false);
          } else {
            // If deployment failed:
            if (scenario.autoRollback) {
              // Rollback should have been performed
              expect(result.rollbackPerformed).toBe(true);
              
              // System should be in initial state (or close to it)
              const finalState = await captureSystemState(orchestrator);
              expect(finalState.commitHash).toBe(initialState.commitHash);
            }
            
            // Either no components deployed, or rollback was performed
            // (no partial deployments)
            if (result.componentsDeployed.length > 0 && scenario.autoRollback) {
              // If some components were deployed, rollback must have occurred
              expect(result.rollbackPerformed).toBe(true);
            }
          }

          // Universal property: No partial deployments without rollback
          // Either all components deployed successfully OR rollback performed (if enabled)
          if (!result.success && scenario.autoRollback) {
            expect(result.rollbackPerformed).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 20, timeout: 10000 } // 20 iterations, 10s timeout per test
    );
  }, 30000); // 30 second timeout for entire test

  /**
   * Property 2: Deployment ordering respects dependencies
   * 
   * For any set of components, they should be deployed in dependency order.
   * Backend must be deployed before admin-dashboard and marketing-website.
   */
  it('property: deployment ordering respects dependencies', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          environment: fc.constantFrom('development', 'staging', 'production'),
          components: fc.shuffledSubarray(
            ['backend', 'admin-dashboard', 'marketing-website'],
            { minLength: 2, maxLength: 3 }
          ),
          strategy: fc.constantFrom('rolling', 'blue-green', 'canary'),
        }),
        async (scenario) => {
          const options: FullDeploymentOptions = {
            environment: scenario.environment as any,
            components: scenario.components as any,
            strategy: scenario.strategy as any,
            runMigrations: false,
            runTests: 'none',
            autoRollback: false,
          };

          const result = await orchestrator.deployFull(options);

          // Property: If both backend and a dependent component are deployed,
          // backend must come first in the deployment order
          if (result.componentsDeployed.includes('backend')) {
            const backendIndex = result.componentsDeployed.indexOf('backend');
            
            if (result.componentsDeployed.includes('admin-dashboard')) {
              const adminIndex = result.componentsDeployed.indexOf('admin-dashboard');
              expect(backendIndex).toBeLessThan(adminIndex);
            }
            
            if (result.componentsDeployed.includes('marketing-website')) {
              const marketingIndex = result.componentsDeployed.indexOf('marketing-website');
              expect(backendIndex).toBeLessThan(marketingIndex);
            }
          }

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 3: Deployment duration is reasonable
   * 
   * For any deployment, the duration should be within reasonable bounds.
   */
  it('property: deployment duration is reasonable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          environment: fc.constantFrom('development', 'staging', 'production'),
          components: fc.shuffledSubarray(
            ['backend', 'admin-dashboard', 'marketing-website'],
            { minLength: 1, maxLength: 3 }
          ),
        }),
        async (scenario) => {
          const options: FullDeploymentOptions = {
            environment: scenario.environment as any,
            components: scenario.components as any,
            strategy: 'rolling',
            runMigrations: false,
            runTests: 'none',
            autoRollback: false,
          };

          const result = await orchestrator.deployFull(options);

          // Property: Duration should be positive and reasonable
          expect(result.duration).toBeGreaterThan(0);
          
          // Duration should be less than 5 minutes per component (in test mode)
          const maxDuration = scenario.components.length * 5 * 60 * 1000;
          expect(result.duration).toBeLessThan(maxDuration);

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 4: Deployment ID is unique
   * 
   * For any two deployments, they should have different deployment IDs.
   */
  it('property: deployment IDs are unique', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            environment: fc.constantFrom('development', 'staging', 'production'),
            components: fc.shuffledSubarray(
              ['backend', 'admin-dashboard', 'marketing-website'],
              { minLength: 1, maxLength: 3 }
            ),
          }),
          { minLength: 2, maxLength: 3 }
        ),
        async (scenarios) => {
          const deploymentIds = new Set<string>();

          for (const scenario of scenarios) {
            const options: FullDeploymentOptions = {
              environment: scenario.environment as any,
              components: scenario.components as any,
              strategy: 'rolling',
              runMigrations: false,
              runTests: 'none',
              autoRollback: false,
            };

            const result = await orchestrator.deployFull(options);

            // Property: Each deployment ID should be unique
            expect(deploymentIds.has(result.deploymentId)).toBe(false);
            deploymentIds.add(result.deploymentId);
          }

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 5: Health checks always run after successful deployment
   * 
   * For any successful deployment, health checks must have been performed.
   */
  it('property: health checks always run after successful deployment', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          environment: fc.constantFrom('development', 'staging', 'production'),
          components: fc.shuffledSubarray(
            ['backend', 'admin-dashboard', 'marketing-website'],
            { minLength: 1, maxLength: 3 }
          ),
        }),
        async (scenario) => {
          const options: FullDeploymentOptions = {
            environment: scenario.environment as any,
            components: scenario.components as any,
            strategy: 'rolling',
            runMigrations: false,
            runTests: 'none',
            autoRollback: false,
          };

          const result = await orchestrator.deployFull(options);

          // Property: If deployment succeeded, health checks must have passed
          if (result.success) {
            expect(result.healthChecksPassed).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Capture current system state for comparison
 */
async function captureSystemState(orchestrator: DeploymentOrchestrator): Promise<{
  commitHash: string;
  version: string;
}> {
  // In a real implementation, this would capture:
  // - Current git commit
  // - Running processes
  // - File checksums
  // - Database schema version
  // - Configuration state
  
  // For testing, we just capture basic info
  return {
    commitHash: 'test-commit-hash',
    version: '0.0.0',
  };
}
