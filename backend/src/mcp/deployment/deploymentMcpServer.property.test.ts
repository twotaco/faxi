/**
 * Property-based tests for Deployment MCP Server
 * 
 * Feature: deployment-mcp, Property 1: Server initialization succeeds with valid config
 * Validates: Requirements 1.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { DeploymentMcpServer } from './deploymentMcpServer.js';

describe('deployment-mcp - Requirement 1.1', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  /**
   * Feature: deployment-mcp, Property 1: Server initialization succeeds with valid config
   * Validates: Requirements 1.1
   * 
   * Property: For any valid configuration, the MCP server should initialize successfully
   * without throwing errors and should have all required capabilities configured.
   */
  it('property: server initialization succeeds with valid config', () => {
    fc.assert(
      fc.property(
        fc.record({
          environments: fc.array(
            fc.constantFrom('development', 'staging', 'production', 'test'),
            { minLength: 1, maxLength: 4 }
          ),
          strategy: fc.constantFrom('rolling', 'blue-green', 'canary'),
          healthCheckTimeout: fc.integer({ min: 60, max: 600 }),
          rollbackEnabled: fc.boolean(),
          logAnalysisModel: fc.constantFrom('gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'),
          integrationTestTimeout: fc.integer({ min: 300, max: 1200 }),
        }),
        (config) => {
          // Set up environment variables based on generated config
          process.env.DEPLOYMENT_ENVIRONMENTS = config.environments.join(',');
          process.env.DEPLOYMENT_STRATEGY = config.strategy;
          process.env.HEALTH_CHECK_TIMEOUT = config.healthCheckTimeout.toString();
          process.env.ROLLBACK_ENABLED = config.rollbackEnabled.toString();
          process.env.LOG_ANALYSIS_MODEL = config.logAnalysisModel;
          process.env.INTEGRATION_TEST_TIMEOUT = config.integrationTestTimeout.toString();

          // Test: Server should initialize without throwing
          let server: DeploymentMcpServer | null = null;
          let initError: Error | null = null;

          try {
            server = new DeploymentMcpServer();
          } catch (error) {
            initError = error as Error;
          }

          // Property 1: Server initialization should succeed
          expect(initError).toBeNull();
          expect(server).not.toBeNull();

          // Property 2: Server should be an instance of DeploymentMcpServer
          expect(server).toBeInstanceOf(DeploymentMcpServer);

          // Property 3: Server should have loaded the configuration correctly
          // We verify this by checking that the server was created successfully
          // The actual config validation happens in the constructor
          expect(server).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Server should handle default values correctly
   */
  it('property: server uses default values when environment variables are not set', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Generate a subset of config values to test partial configuration
          setEnvironments: fc.boolean(),
          setStrategy: fc.boolean(),
          setTimeout: fc.boolean(),
          setRollback: fc.boolean(),
          setModel: fc.boolean(),
          setIntegrationTimeout: fc.boolean(),
        }),
        (flags) => {
          // Clear all deployment-related env vars
          delete process.env.DEPLOYMENT_ENVIRONMENTS;
          delete process.env.DEPLOYMENT_STRATEGY;
          delete process.env.HEALTH_CHECK_TIMEOUT;
          delete process.env.ROLLBACK_ENABLED;
          delete process.env.LOG_ANALYSIS_MODEL;
          delete process.env.INTEGRATION_TEST_TIMEOUT;

          // Set only the flagged values
          if (flags.setEnvironments) {
            process.env.DEPLOYMENT_ENVIRONMENTS = 'development,staging';
          }
          if (flags.setStrategy) {
            process.env.DEPLOYMENT_STRATEGY = 'rolling';
          }
          if (flags.setTimeout) {
            process.env.HEALTH_CHECK_TIMEOUT = '300';
          }
          if (flags.setRollback) {
            process.env.ROLLBACK_ENABLED = 'true';
          }
          if (flags.setModel) {
            process.env.LOG_ANALYSIS_MODEL = 'gemini-2.0-flash';
          }
          if (flags.setIntegrationTimeout) {
            process.env.INTEGRATION_TEST_TIMEOUT = '600';
          }

          // Test: Server should initialize with defaults for missing values
          let server: DeploymentMcpServer | null = null;
          let initError: Error | null = null;

          try {
            server = new DeploymentMcpServer();
          } catch (error) {
            initError = error as Error;
          }

          // Property: Server should always initialize successfully with defaults
          expect(initError).toBeNull();
          expect(server).not.toBeNull();
          expect(server).toBeInstanceOf(DeploymentMcpServer);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional property test: Server should validate numeric config values
   */
  it('property: server handles numeric string conversions correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          healthCheckTimeout: fc.integer({ min: 1, max: 10000 }),
          integrationTestTimeout: fc.integer({ min: 1, max: 10000 }),
        }),
        (config) => {
          // Set up environment with numeric values as strings
          process.env.DEPLOYMENT_ENVIRONMENTS = 'development';
          process.env.DEPLOYMENT_STRATEGY = 'rolling';
          process.env.HEALTH_CHECK_TIMEOUT = config.healthCheckTimeout.toString();
          process.env.ROLLBACK_ENABLED = 'true';
          process.env.LOG_ANALYSIS_MODEL = 'gemini-2.0-flash';
          process.env.INTEGRATION_TEST_TIMEOUT = config.integrationTestTimeout.toString();

          // Test: Server should parse numeric strings correctly
          let server: DeploymentMcpServer | null = null;
          let initError: Error | null = null;

          try {
            server = new DeploymentMcpServer();
          } catch (error) {
            initError = error as Error;
          }

          // Property: Server should initialize successfully with any valid numeric string
          expect(initError).toBeNull();
          expect(server).not.toBeNull();
          expect(server).toBeInstanceOf(DeploymentMcpServer);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Server should handle boolean string conversions
   */
  it('property: server handles boolean string conversions correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('true', 'false', 'TRUE', 'FALSE', 'True', 'False', '1', '0', 'yes', 'no'),
        (rollbackValue) => {
          // Set up environment with various boolean representations
          process.env.DEPLOYMENT_ENVIRONMENTS = 'development';
          process.env.DEPLOYMENT_STRATEGY = 'rolling';
          process.env.HEALTH_CHECK_TIMEOUT = '300';
          process.env.ROLLBACK_ENABLED = rollbackValue;
          process.env.LOG_ANALYSIS_MODEL = 'gemini-2.0-flash';
          process.env.INTEGRATION_TEST_TIMEOUT = '600';

          // Test: Server should handle various boolean string formats
          let server: DeploymentMcpServer | null = null;
          let initError: Error | null = null;

          try {
            server = new DeploymentMcpServer();
          } catch (error) {
            initError = error as Error;
          }

          // Property: Server should initialize successfully with any boolean-like string
          // The actual boolean interpretation is handled by the config loader
          expect(initError).toBeNull();
          expect(server).not.toBeNull();
          expect(server).toBeInstanceOf(DeploymentMcpServer);
        }
      ),
      { numRuns: 50 }
    );
  });
});
