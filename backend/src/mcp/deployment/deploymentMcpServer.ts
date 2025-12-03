/**
 * Deployment MCP Server
 * 
 * Provides intelligent, automated deployment capabilities for the Faxi application.
 * Orchestrates end-to-end deployments, performs health checks, provides AI-powered
 * log analysis, manages rollbacks, and ensures deployment safety.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { DeploymentConfig } from './types/index.js';
import { infrastructureProvisioner, InfrastructureConfig } from './services/infrastructureProvisioner.js';

// Environment variable validation schema
const configSchema = z.object({
  DEPLOYMENT_ENVIRONMENTS: z.string().default('development,staging,production'),
  DEPLOYMENT_STRATEGY: z.string().default('rolling'),
  HEALTH_CHECK_TIMEOUT: z.string().default('300'),
  ROLLBACK_ENABLED: z.string().default('true'),
  LOG_ANALYSIS_MODEL: z.string().default('gemini-2.0-flash'),
  INTEGRATION_TEST_TIMEOUT: z.string().default('600'),
});

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): DeploymentConfig {
  const env = configSchema.parse(process.env);
  
  return {
    environments: env.DEPLOYMENT_ENVIRONMENTS.split(',').map(e => e.trim()),
    defaultStrategy: env.DEPLOYMENT_STRATEGY,
    healthCheckTimeout: parseInt(env.HEALTH_CHECK_TIMEOUT, 10),
    rollbackEnabled: env.ROLLBACK_ENABLED === 'true',
    logAnalysisModel: env.LOG_ANALYSIS_MODEL,
    integrationTestTimeout: parseInt(env.INTEGRATION_TEST_TIMEOUT, 10),
  };
}

/**
 * Deployment MCP Server class
 */
export class DeploymentMcpServer {
  private server: Server;
  private config: DeploymentConfig;

  constructor() {
    this.config = loadConfig();
    this.server = new Server(
      {
        name: 'deployment-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Set up MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getTools(),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'deploy_full':
            return await this.handleDeployFull(args);
          case 'deploy_partial':
            return await this.handleDeployPartial(args);
          case 'deploy_cross_environment':
            return await this.handleDeployCrossEnvironment(args);
          case 'plan_deployment':
            return await this.handlePlanDeployment(args);
          case 'simulate_deployment':
            return await this.handleSimulateDeployment(args);
          case 'check_health':
            return await this.handleCheckHealth(args);
          case 'run_smoke_tests':
            return await this.handleRunSmokeTests(args);
          case 'run_e2e_tests':
            return await this.handleRunE2ETests(args);
          case 'verify_secrets':
            return await this.handleVerifySecrets(args);
          case 'detect_drift':
            return await this.handleDetectDrift(args);
          case 'analyze_logs':
            return await this.handleAnalyzeLogs(args);
          case 'test_integrations':
            return await this.handleTestIntegrations(args);
          case 'audit_scripts':
            return await this.handleAuditScripts(args);
          case 'analyze_dependencies':
            return await this.handleAnalyzeDependencies(args);
          case 'generate_release_notes':
            return await this.handleGenerateReleaseNotes(args);
          case 'rollback':
            return await this.handleRollback(args);
          case 'get_last_stable_version':
            return await this.handleGetLastStableVersion(args);
          case 'create_snapshot':
            return await this.handleCreateSnapshot(args);
          case 'restore_snapshot':
            return await this.handleRestoreSnapshot(args);
          case 'provision_infrastructure':
            return await this.handleProvisionInfrastructure(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: errorMessage,
              }, null, 2),
            },
          ],
        };
      }
    });
  }

  /**
   * Get list of available tools
   */
  private getTools(): Tool[] {
    return [
      // Deployment operations
      {
        name: 'deploy_full',
        description: 'Deploy all components with full orchestration',
        inputSchema: {
          type: 'object',
          properties: {
            environment: {
              type: 'string',
              enum: this.config.environments,
              description: 'Target environment',
            },
            components: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['backend', 'admin-dashboard', 'marketing-website'],
              },
              description: 'Components to deploy',
            },
            strategy: {
              type: 'string',
              enum: ['rolling', 'blue-green', 'canary'],
              description: 'Deployment strategy',
            },
            runMigrations: {
              type: 'boolean',
              description: 'Execute database migrations',
            },
            runTests: {
              type: 'string',
              enum: ['none', 'smoke', 'e2e', 'full'],
              description: 'Test suite to run',
            },
            autoRollback: {
              type: 'boolean',
              description: 'Enable automatic rollback on failure',
            },
          },
          required: ['environment', 'components'],
        },
      },
      {
        name: 'deploy_partial',
        description: 'Deploy only changed components based on git analysis',
        inputSchema: {
          type: 'object',
          properties: {
            environment: {
              type: 'string',
              enum: this.config.environments,
            },
            fromCommit: {
              type: 'string',
              description: 'Starting commit for change detection',
            },
            toCommit: {
              type: 'string',
              description: 'Ending commit for change detection',
            },
            detectBreakingChanges: {
              type: 'boolean',
              description: 'Detect and highlight breaking changes',
            },
          },
          required: ['environment'],
        },
      },
      {
        name: 'deploy_cross_environment',
        description: 'Promote deployment from one environment to another',
        inputSchema: {
          type: 'object',
          properties: {
            sourceEnvironment: {
              type: 'string',
              enum: this.config.environments,
            },
            targetEnvironment: {
              type: 'string',
              enum: this.config.environments,
            },
            verifySecrets: {
              type: 'boolean',
              description: 'Verify secrets match target environment',
            },
            createDiffReport: {
              type: 'boolean',
              description: 'Generate environment diff report',
            },
          },
          required: ['sourceEnvironment', 'targetEnvironment'],
        },
      },
      {
        name: 'plan_deployment',
        description: 'Generate deployment plan without executing',
        inputSchema: {
          type: 'object',
          properties: {
            environment: {
              type: 'string',
              enum: this.config.environments,
            },
            components: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['environment', 'components'],
        },
      },
      {
        name: 'simulate_deployment',
        description: 'Dry-run deployment to validate without changes',
        inputSchema: {
          type: 'object',
          properties: {
            plan: {
              type: 'object',
              description: 'Deployment plan to simulate',
            },
          },
          required: ['plan'],
        },
      },
      // Health and validation
      {
        name: 'check_health',
        description: 'Perform multi-tier health checks',
        inputSchema: {
          type: 'object',
          properties: {
            tier: {
              type: 'number',
              enum: [0, 1, 2],
              description: 'Health check tier (0=system, 1=smoke, 2=e2e)',
            },
            environment: {
              type: 'string',
              enum: this.config.environments,
            },
          },
          required: ['tier', 'environment'],
        },
      },
      {
        name: 'run_smoke_tests',
        description: 'Run API-level smoke tests',
        inputSchema: {
          type: 'object',
          properties: {
            environment: {
              type: 'string',
              enum: this.config.environments,
            },
          },
          required: ['environment'],
        },
      },
      {
        name: 'run_e2e_tests',
        description: 'Run end-to-end functional tests',
        inputSchema: {
          type: 'object',
          properties: {
            environment: {
              type: 'string',
              enum: this.config.environments,
            },
            scope: {
              type: 'string',
              enum: ['critical', 'changed', 'full'],
            },
          },
          required: ['environment'],
        },
      },
      {
        name: 'verify_secrets',
        description: 'Validate environment variables and secrets',
        inputSchema: {
          type: 'object',
          properties: {
            environment: {
              type: 'string',
              enum: this.config.environments,
            },
          },
          required: ['environment'],
        },
      },
      {
        name: 'detect_drift',
        description: 'Detect configuration drift between environments',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              enum: this.config.environments,
            },
            target: {
              type: 'string',
              enum: this.config.environments,
            },
          },
          required: ['source', 'target'],
        },
      },
      // Analysis and maintenance
      {
        name: 'analyze_logs',
        description: 'AI-powered log analysis and error diagnosis',
        inputSchema: {
          type: 'object',
          properties: {
            sources: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['build', 'deployment', 'service', 'docker', 'systemd'],
              },
            },
            environment: {
              type: 'string',
              enum: this.config.environments,
            },
            timeRange: {
              type: 'object',
              properties: {
                start: { type: 'string' },
                end: { type: 'string' },
              },
            },
          },
          required: ['sources', 'environment'],
        },
      },
      {
        name: 'test_integrations',
        description: 'Test external service connectivity',
        inputSchema: {
          type: 'object',
          properties: {
            environment: {
              type: 'string',
              enum: this.config.environments,
            },
            services: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['telnyx', 'stripe', 'aws-ses', 's3', 'gemini'],
              },
            },
          },
          required: ['environment'],
        },
      },
      {
        name: 'audit_scripts',
        description: 'Audit deployment scripts for issues',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'analyze_dependencies',
        description: 'Analyze dependency health and vulnerabilities',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'generate_release_notes',
        description: 'Generate release notes from git history',
        inputSchema: {
          type: 'object',
          properties: {
            fromVersion: { type: 'string' },
            toVersion: { type: 'string' },
            format: {
              type: 'string',
              enum: ['markdown', 'html', 'json'],
            },
          },
          required: ['fromVersion', 'toVersion'],
        },
      },
      // Rollback and recovery
      {
        name: 'rollback',
        description: 'Rollback to previous stable version',
        inputSchema: {
          type: 'object',
          properties: {
            environment: {
              type: 'string',
              enum: this.config.environments,
            },
            targetVersion: {
              type: 'string',
              description: 'Specific version to rollback to',
            },
            rollbackMigrations: {
              type: 'boolean',
              description: 'Rollback database migrations',
            },
          },
          required: ['environment'],
        },
      },
      {
        name: 'get_last_stable_version',
        description: 'Get last known stable version',
        inputSchema: {
          type: 'object',
          properties: {
            environment: {
              type: 'string',
              enum: this.config.environments,
            },
          },
          required: ['environment'],
        },
      },
      {
        name: 'create_snapshot',
        description: 'Create deployment snapshot',
        inputSchema: {
          type: 'object',
          properties: {
            environment: {
              type: 'string',
              enum: this.config.environments,
            },
          },
          required: ['environment'],
        },
      },
      {
        name: 'restore_snapshot',
        description: 'Restore from deployment snapshot',
        inputSchema: {
          type: 'object',
          properties: {
            snapshotId: {
              type: 'string',
              description: 'Snapshot ID to restore',
            },
          },
          required: ['snapshotId'],
        },
      },
      {
        name: 'provision_infrastructure',
        description: 'Provision AWS infrastructure (RDS, Redis, S3, ECR, ECS, ALB). Checks for existing resources and creates missing ones.',
        inputSchema: {
          type: 'object',
          properties: {
            environment: {
              type: 'string',
              enum: this.config.environments,
              description: 'Target environment',
            },
            region: {
              type: 'string',
              default: 'us-east-1',
              description: 'AWS region',
            },
            domains: {
              type: 'object',
              properties: {
                marketing: { type: 'string', description: 'Marketing website domain (e.g., qa.faxi.jp)' },
                admin: { type: 'string', description: 'Admin dashboard domain (e.g., qa-admin.faxi.jp)' },
                backend: { type: 'string', description: 'Backend API domain (e.g., qa-fax.faxi.jp)' },
              },
              required: ['marketing', 'admin', 'backend'],
            },
          },
          required: ['environment', 'domains'],
        },
      },
    ];
  }

  // Tool handlers
  private async handleDeployFull(args: any) {
    const { environment, components, strategy, runMigrations, runTests, autoRollback } = args;

    try {
      // Use the deployment orchestrator
      const { deploymentOrchestrator } = await import('./services/deploymentOrchestrator.js');

      const result = await deploymentOrchestrator.deployFull({
        environment,
        components: components || ['backend', 'admin-dashboard', 'marketing-website'],
        strategy: strategy || 'rolling',
        runMigrations: runMigrations ?? true,
        runTests: runTests || 'smoke',
        autoRollback: autoRollback ?? true,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: result.success,
              deploymentId: result.deploymentId,
              componentsDeployed: result.componentsDeployed,
              duration: result.duration,
              healthChecksPassed: result.healthChecksPassed,
              warnings: result.warnings,
              errors: result.errors,
              rollbackPerformed: result.rollbackPerformed,
              failureAnalysis: result.failureAnalysis,
              nextSteps: result.success
                ? ['Run ./scripts/deploy-qa.sh health to verify', 'Check http://qa.faxi.jp']
                : ['Run ./scripts/deploy-qa.sh troubleshoot', 'Check CloudWatch logs'],
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
              troubleshooting: {
                command: './scripts/deploy-qa.sh troubleshoot',
                manualDeploy: './scripts/deploy-qa.sh full',
              },
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleDeployPartial(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handleDeployCrossEnvironment(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handlePlanDeployment(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handleSimulateDeployment(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handleCheckHealth(args: any) {
    const { tier, environment } = args;
    const results: any = {
      tier,
      environment,
      timestamp: new Date().toISOString(),
      checks: {},
    };

    try {
      // Tier 0: System-level checks (can we reach the services?)
      if (tier >= 0) {
        const endpoints = this.getEnvironmentEndpoints(environment);

        for (const [service, url] of Object.entries(endpoints)) {
          try {
            const response = await fetch(url, {
              method: 'GET',
              signal: AbortSignal.timeout(10000),
            });
            results.checks[service] = {
              url,
              status: response.status,
              healthy: response.ok,
              responseTime: 'N/A',
            };
          } catch (error: any) {
            results.checks[service] = {
              url,
              status: 0,
              healthy: false,
              error: error.message,
            };
          }
        }
      }

      // Calculate overall health
      const allHealthy = Object.values(results.checks).every((c: any) => c.healthy);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              healthy: allHealthy,
              ...results,
              troubleshooting: allHealthy ? null : {
                command: './scripts/deploy-qa.sh troubleshoot',
                commonIssues: [
                  'Check target group health in AWS Console',
                  'Verify ECS tasks are running: aws ecs describe-services --cluster faxi-qa-cluster --services faxi-qa-backend faxi-qa-admin faxi-qa-marketing',
                  'Check CloudWatch logs: aws logs tail /ecs/faxi-qa-<service> --since 10m',
                ],
              },
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
            }, null, 2),
          },
        ],
      };
    }
  }

  private getEnvironmentEndpoints(environment: string): Record<string, string> {
    const envDomains: Record<string, Record<string, string>> = {
      qa: {
        backend: 'http://qa-fax.faxi.jp/health',
        admin: 'http://qa-admin.faxi.jp/',
        marketing: 'http://qa.faxi.jp/en',
      },
      staging: {
        backend: 'http://staging-fax.faxi.jp/health',
        admin: 'http://staging-admin.faxi.jp/',
        marketing: 'http://staging.faxi.jp/en',
      },
      production: {
        backend: 'https://fax.faxi.jp/health',
        admin: 'https://admin.faxi.jp/',
        marketing: 'https://faxi.jp/en',
      },
    };
    return envDomains[environment] || envDomains.qa;
  }

  private async handleRunSmokeTests(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handleRunE2ETests(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handleVerifySecrets(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handleDetectDrift(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handleAnalyzeLogs(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handleTestIntegrations(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handleAuditScripts(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handleAnalyzeDependencies(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handleGenerateReleaseNotes(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handleRollback(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetLastStableVersion(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handleCreateSnapshot(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handleRestoreSnapshot(args: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Not yet implemented',
          }, null, 2),
        },
      ],
    };
  }

  private async handleProvisionInfrastructure(args: any) {
    try {
      const config: InfrastructureConfig = {
        environment: args.environment,
        region: args.region || 'us-east-1',
        projectName: 'faxi',
        domains: args.domains,
      };

      const result = await infrastructureProvisioner.provisionInfrastructure(config);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: result.success,
              resourcesCreated: result.resourcesCreated,
              resourcesExisting: result.resourcesExisting,
              endpoints: result.endpoints,
              errors: result.errors,
              warnings: result.warnings,
              message: result.success 
                ? `Infrastructure provisioned successfully. Created ${result.resourcesCreated.length} resources, found ${result.resourcesExisting.length} existing.`
                : 'Infrastructure provisioning completed with errors.',
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
            }, null, 2),
          },
        ],
      };
    }
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Deployment MCP server running on stdio');
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new DeploymentMcpServer();
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
