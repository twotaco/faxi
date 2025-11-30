#!/usr/bin/env node

/**
 * Auto-Docs MCP Server
 * 
 * This MCP server autonomously generates and updates documentation by understanding
 * the app structure, navigating the UI, and capturing screenshots - all without
 * manual specification of URLs or selectors.
 * 
 * Tools provided:
 * - generate_feature_docs: Autonomously document a feature
 * - document_user_flow: Document a user goal in natural language
 * - discover_app_structure: Discover routes and navigation
 * - update_all_docs: Refresh all existing documentation
 * - check_docs_freshness: Compare docs against current UI
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Auto-Docs MCP Server
 * 
 * Autonomously generates and updates documentation using browser automation
 */
class AutoDocsMCPServer {
  private server: Server;
  private readonly version = '1.0.0';
  private readonly baseUrl: string;
  private readonly screenshotDir: string;
  private readonly helpDir: string;
  private readonly allowedDomains: string[];

  constructor() {
    // Read environment variables
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    this.screenshotDir = process.env.SCREENSHOT_DIR || 'docs/screenshots';
    this.helpDir = process.env.HELP_DIR || 'docs/help';
    this.allowedDomains = (process.env.ALLOWED_DOMAINS || 'localhost,127.0.0.1')
      .split(',')
      .map(d => d.trim());

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'faxi-auto-docs',
        version: this.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Set up error handling
    this.setupErrorHandling();

    // Register request handlers
    this.registerHandlers();

    // Log initialization
    this.log('Auto-Docs MCP Server initialized', {
      version: this.version,
      baseUrl: this.baseUrl,
      screenshotDir: this.screenshotDir,
      helpDir: this.helpDir,
      allowedDomains: this.allowedDomains,
    });
  }

  /**
   * Set up error handling for the server
   */
  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      this.logError('Server error', error);
    };

    process.on('SIGINT', async () => {
      this.log('Received SIGINT, shutting down gracefully');
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      this.log('Received SIGTERM, shutting down gracefully');
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Register MCP request handlers
   */
  private registerHandlers(): void {
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
        this.log('Tool called', { tool: name, args });

        // Route to appropriate handler
        const result = await this.handleToolCall(name, args || {});

        this.log('Tool completed', { tool: name, success: true });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        this.logError('Tool execution failed', error, { tool: name });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Get list of available tools
   */
  private getTools(): Tool[] {
    return [
      {
        name: 'generate_feature_docs',
        description: 'Autonomously generate documentation for a feature. Just provide the feature name (e.g., "shopping") and the MCP will discover routes, navigate the UI, take screenshots, and write the help guide.',
        inputSchema: {
          type: 'object',
          properties: {
            feature_name: {
              type: 'string',
              description: 'Feature name (e.g., "shopping", "login", "fax-sending")',
            },
            base_url: {
              type: 'string',
              description: 'Optional: Base URL of the application (default: http://localhost:3000)',
            },
            output_dir: {
              type: 'string',
              description: 'Optional: Output directory for documentation (default: docs/help/)',
            },
          },
          required: ['feature_name'],
        },
      },
      {
        name: 'document_user_flow',
        description: 'Document a user flow from a natural language goal. Describe what the user wants to do (e.g., "show how a user places an order") and the MCP will figure out the navigation and capture screenshots.',
        inputSchema: {
          type: 'object',
          properties: {
            goal: {
              type: 'string',
              description: 'Natural language description of the user goal',
            },
            base_url: {
              type: 'string',
              description: 'Optional: Base URL of the application',
            },
          },
          required: ['goal'],
        },
      },
      {
        name: 'discover_app_structure',
        description: 'Discover the application structure by analyzing the codebase. Returns routes, navigation, and detected features.',
        inputSchema: {
          type: 'object',
          properties: {
            frontend_dir: {
              type: 'string',
              description: 'Optional: Frontend directory to analyze (default: auto-detect)',
            },
          },
        },
      },
      {
        name: 'update_all_docs',
        description: 'Update all existing documentation by re-executing flows and capturing fresh screenshots.',
        inputSchema: {
          type: 'object',
          properties: {
            base_url: {
              type: 'string',
              description: 'Optional: Base URL of the application',
            },
          },
        },
      },
      {
        name: 'check_docs_freshness',
        description: 'Check which documentation is outdated by comparing screenshots to current UI.',
        inputSchema: {
          type: 'object',
          properties: {
            base_url: {
              type: 'string',
              description: 'Optional: Base URL of the application',
            },
            threshold: {
              type: 'number',
              description: 'Optional: Visual difference threshold percentage (default: 10)',
            },
          },
        },
      },
    ];
  }

  /**
   * Handle tool call by routing to appropriate handler
   */
  private async handleToolCall(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'generate_feature_docs':
        return this.handleGenerateFeatureDocs(args);
      
      case 'document_user_flow':
        return this.handleDocumentUserFlow(args);
      
      case 'discover_app_structure':
        return this.handleDiscoverAppStructure(args);
      
      case 'update_all_docs':
        return this.handleUpdateAllDocs(args);
      
      case 'check_docs_freshness':
        return this.handleCheckDocsFreshness(args);
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Handle generate_feature_docs tool call
   */
  private async handleGenerateFeatureDocs(args: any): Promise<any> {
    const { feature_name, base_url, output_dir } = args;

    if (!feature_name) {
      throw new Error('feature_name parameter is required');
    }

    // Import required services
    const { appDiscoveryService } = await import('./services/appDiscoveryService.js');
    const { autonomousNavigatorService } = await import('./services/autonomousNavigatorService.js');
    const { docGeneratorService } = await import('./services/docGeneratorService.js');
    const fs = await import('fs');
    const path = await import('path');

    try {
      const effectiveBaseUrl = base_url || this.baseUrl;
      const effectiveOutputDir = output_dir || this.helpDir;
      const screenshotDir = this.screenshotDir;

      this.log('Starting feature documentation generation', {
        feature: feature_name,
        baseUrl: effectiveBaseUrl,
      });

      // Step 1: Discover app structure
      this.log('Discovering app structure...');
      const appStructure = await appDiscoveryService.discoverStructure();

      // Step 2: Read spec if it exists
      let spec = null;
      const specPath = path.join('.kiro/specs', feature_name);
      if (fs.existsSync(specPath)) {
        const requirementsPath = path.join(specPath, 'requirements.md');
        if (fs.existsSync(requirementsPath)) {
          const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
          // Extract introduction section
          const introMatch = requirementsContent.match(/## Introduction\s+([\s\S]*?)(?=\n##|$)/);
          spec = {
            introduction: introMatch ? introMatch[1].trim() : null,
          };
        }
      }

      // Step 3: Plan documentation flow
      this.log('Planning documentation flow...');
      const plan = await appDiscoveryService.planDocumentationFlow(
        feature_name,
        appStructure
      );

      this.log('Documentation plan created', {
        steps: plan.steps.length,
        estimatedScreenshots: plan.estimatedScreenshots,
      });

      // Step 4: Execute flow with autonomous navigator
      this.log('Executing documentation flow...');
      const executionResult = await autonomousNavigatorService.executeDocumentationPlan(
        plan,
        effectiveBaseUrl,
        screenshotDir
      );

      this.log('Flow execution completed', {
        stepsCompleted: executionResult.stepsCompleted,
        totalSteps: executionResult.totalSteps,
        screenshots: executionResult.screenshots.length,
        errors: executionResult.errors.length,
      });

      // Step 5: Generate markdown documentation
      this.log('Generating documentation...');
      const docContent = docGeneratorService.generateHelpDoc(
        feature_name,
        spec,
        executionResult
      );

      // Step 6: Save documentation
      const docPath = path.join(effectiveOutputDir, `${feature_name}.md`);

      // Check if doc already exists and preserve manual sections
      const existingDoc = docGeneratorService.readExistingDoc(docPath);
      const finalContent = existingDoc
        ? docGeneratorService.updateDoc(existingDoc, docContent)
        : docContent;

      docGeneratorService.saveDoc(finalContent, docPath);

      this.log('Documentation saved', { path: docPath });

      return {
        success: executionResult.success,
        doc_path: docPath,
        screenshots: executionResult.screenshots.map(s => s.path),
        steps_documented: executionResult.stepsCompleted,
        warnings: executionResult.errors,
        metadata: {
          feature: feature_name,
          base_url: effectiveBaseUrl,
          routes_discovered: appStructure.routes.length,
          navigation_items: appStructure.navigation.length,
          spec_found: spec !== null,
        },
      };
    } catch (error) {
      this.logError('Failed to generate feature docs', error);
      throw new Error(
        `Failed to generate feature documentation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle document_user_flow tool call
   */
  private async handleDocumentUserFlow(args: any): Promise<any> {
    const { goal, base_url } = args;

    if (!goal) {
      throw new Error('goal parameter is required');
    }

    // Import required services
    const { appDiscoveryService } = await import('./services/appDiscoveryService.js');
    const { autonomousNavigatorService } = await import('./services/autonomousNavigatorService.js');
    const { docGeneratorService } = await import('./services/docGeneratorService.js');
    const path = await import('path');

    try {
      const effectiveBaseUrl = base_url || this.baseUrl;
      const screenshotDir = this.screenshotDir;

      this.log('Starting user flow documentation', { goal });

      // Step 1: Parse the goal to understand what the user wants
      const parsedGoal = this.parseUserGoal(goal);

      this.log('Parsed user goal', parsedGoal);

      // Step 2: Discover app structure to find relevant routes
      const appStructure = await appDiscoveryService.discoverStructure();

      // Step 3: Create a simple plan based on the goal
      // For now, we'll create a basic plan that navigates to the home page
      // In a more sophisticated implementation, this would use NLP to understand the goal
      const plan = {
        feature: parsedGoal.feature || 'user-flow',
        steps: [
          {
            order: 0,
            description: `Navigate to starting point for: ${goal}`,
            url: parsedGoal.startingRoute || '/',
            actions: [],
            screenshotName: 'user-flow-start',
          },
        ],
        estimatedScreenshots: 1,
      };

      // If we found related routes, add them to the plan
      if (parsedGoal.relatedRoutes.length > 0) {
        parsedGoal.relatedRoutes.forEach((route, index) => {
          plan.steps.push({
            order: index + 1,
            description: `Navigate to ${route}`,
            url: route,
            actions: [],
            screenshotName: `user-flow-step-${index + 1}`,
          });
        });
        plan.estimatedScreenshots = plan.steps.length;
      }

      this.log('User flow plan created', {
        steps: plan.steps.length,
      });

      // Step 4: Execute the flow
      const executionResult = await autonomousNavigatorService.executeDocumentationPlan(
        plan,
        effectiveBaseUrl,
        screenshotDir
      );

      this.log('User flow execution completed', {
        stepsCompleted: executionResult.stepsCompleted,
        screenshots: executionResult.screenshots.length,
      });

      // Step 5: Generate documentation
      const docPath = path.join(this.helpDir, `user-flow-${Date.now()}.md`);
      const docContent = docGeneratorService.generateHelpDoc(
        parsedGoal.feature || 'user-flow',
        { introduction: `This guide shows: ${goal}` },
        executionResult
      );

      docGeneratorService.saveDoc(docContent, docPath);

      return {
        success: executionResult.success,
        doc_path: docPath,
        steps: executionResult.screenshots.map((screenshot, index) => ({
          description: plan.steps[index]?.description || `Step ${index + 1}`,
          screenshot: screenshot.path,
          action_taken: 'Navigation',
        })),
        partial_reason: executionResult.errors.length > 0
          ? `Some steps failed: ${executionResult.errors.join(', ')}`
          : undefined,
        metadata: {
          goal,
          steps_completed: executionResult.stepsCompleted,
          total_steps: plan.steps.length,
        },
      };
    } catch (error) {
      this.logError('Failed to document user flow', error);
      throw new Error(
        `Failed to document user flow: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse user goal to extract feature and routes
   */
  private parseUserGoal(goal: string): {
    feature: string;
    startingRoute: string;
    relatedRoutes: string[];
  } {
    const goalLower = goal.toLowerCase();

    // Extract keywords
    const keywords = goalLower.split(/\s+/).filter(word => word.length > 3);

    // Try to identify feature
    let feature = 'user-flow';
    const featureKeywords = ['shopping', 'login', 'signup', 'checkout', 'profile', 'settings'];
    for (const keyword of featureKeywords) {
      if (goalLower.includes(keyword)) {
        feature = keyword;
        break;
      }
    }

    // Try to identify starting route
    let startingRoute = '/';
    if (goalLower.includes('login')) {
      startingRoute = '/login';
    } else if (goalLower.includes('signup') || goalLower.includes('register')) {
      startingRoute = '/signup';
    } else if (goalLower.includes('shop') || goalLower.includes('product')) {
      startingRoute = '/shop';
    }

    // Identify related routes based on keywords
    const relatedRoutes: string[] = [];
    if (goalLower.includes('order') || goalLower.includes('purchase')) {
      relatedRoutes.push('/shop', '/cart', '/checkout');
    } else if (goalLower.includes('profile')) {
      relatedRoutes.push('/profile', '/settings');
    }

    return {
      feature,
      startingRoute,
      relatedRoutes,
    };
  }

  /**
   * Handle discover_app_structure tool call
   */
  private async handleDiscoverAppStructure(args: any): Promise<any> {
    const { frontend_dir } = args;

    const { appDiscoveryService } = await import('./services/appDiscoveryService.js');

    try {
      this.log('Discovering app structure', { frontend_dir });

      // Discover the application structure
      const appStructure = await appDiscoveryService.discoverStructure(frontend_dir);

      this.log('App structure discovered', {
        routes: appStructure.routes.length,
        navigation: appStructure.navigation.length,
        features: Object.keys(appStructure.features).length,
      });

      return {
        routes: appStructure.routes.map(route => ({
          path: route.path,
          name: route.name,
          file_path: route.filePath,
          params: route.params,
          metadata: route.metadata,
        })),
        navigation: appStructure.navigation,
        features_detected: Object.keys(appStructure.features),
        feature_details: appStructure.features,
        summary: {
          total_routes: appStructure.routes.length,
          total_navigation_items: appStructure.navigation.length,
          total_features: Object.keys(appStructure.features).length,
          base_url: appStructure.baseUrl,
        },
      };
    } catch (error) {
      this.logError('Failed to discover app structure', error);
      throw new Error(
        `Failed to discover app structure: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle update_all_docs tool call
   */
  private async handleUpdateAllDocs(args: any): Promise<any> {
    const { base_url } = args;

    const fs = await import('fs');
    const path = await import('path');

    try {
      const effectiveBaseUrl = base_url || this.baseUrl;
      const helpDir = this.helpDir;

      this.log('Starting update of all documentation', { helpDir });

      // Check if help directory exists
      if (!fs.existsSync(helpDir)) {
        return {
          updated: [],
          failed: [],
          screenshots_refreshed: 0,
          message: `Help directory does not exist: ${helpDir}`,
        };
      }

      // Find all markdown files in help directory
      const files = fs.readdirSync(helpDir)
        .filter(file => file.endsWith('.md'));

      if (files.length === 0) {
        return {
          updated: [],
          failed: [],
          screenshots_refreshed: 0,
          message: 'No documentation files found to update',
        };
      }

      this.log(`Found ${files.length} documentation files to update`);

      const updated: string[] = [];
      const failed: Array<{ doc: string; reason: string }> = [];
      let totalScreenshots = 0;

      // Update each documentation file
      for (const file of files) {
        try {
          // Extract feature name from filename
          const featureName = file.replace('.md', '');

          this.log(`Updating documentation for: ${featureName}`);

          // Re-generate the documentation
          const result = await this.handleGenerateFeatureDocs({
            feature_name: featureName,
            base_url: effectiveBaseUrl,
            output_dir: helpDir,
          });

          if (result.success) {
            updated.push(file);
            totalScreenshots += result.screenshots?.length || 0;
          } else {
            failed.push({
              doc: file,
              reason: result.warnings?.join(', ') || 'Unknown error',
            });
          }
        } catch (error) {
          failed.push({
            doc: file,
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
          this.logError(`Failed to update ${file}`, error);
        }
      }

      this.log('Documentation update completed', {
        updated: updated.length,
        failed: failed.length,
        screenshots: totalScreenshots,
      });

      return {
        updated,
        failed,
        screenshots_refreshed: totalScreenshots,
        summary: {
          total_docs: files.length,
          updated_successfully: updated.length,
          failed_updates: failed.length,
        },
      };
    } catch (error) {
      this.logError('Failed to update all docs', error);
      throw new Error(
        `Failed to update all documentation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle check_docs_freshness tool call
   */
  private async handleCheckDocsFreshness(args: any): Promise<any> {
    const { base_url, threshold } = args;

    const fs = await import('fs');
    const path = await import('path');
    const { autonomousNavigatorService } = await import('./services/autonomousNavigatorService.js');
    const { appDiscoveryService } = await import('./services/appDiscoveryService.js');

    try {
      const effectiveBaseUrl = base_url || this.baseUrl;
      const effectiveThreshold = threshold || 10; // 10% difference threshold
      const helpDir = this.helpDir;
      const screenshotDir = this.screenshotDir;

      this.log('Checking documentation freshness', {
        threshold: effectiveThreshold,
      });

      // Check if help directory exists
      if (!fs.existsSync(helpDir)) {
        return {
          docs: [],
          summary: { total: 0, fresh: 0, needs_update: 0, broken: 0 },
          message: `Help directory does not exist: ${helpDir}`,
        };
      }

      // Find all markdown files
      const files = fs.readdirSync(helpDir)
        .filter(file => file.endsWith('.md'));

      if (files.length === 0) {
        return {
          docs: [],
          summary: { total: 0, fresh: 0, needs_update: 0, broken: 0 },
          message: 'No documentation files found',
        };
      }

      const docs: Array<{
        path: string;
        status: 'fresh' | 'needs_update' | 'broken';
        difference_percent?: number;
        issues?: string[];
      }> = [];

      let fresh = 0;
      let needsUpdate = 0;
      let broken = 0;

      // Check each documentation file
      for (const file of files) {
        const docPath = path.join(helpDir, file);
        const issues: string[] = [];

        try {
          // Read the documentation
          const content = fs.readFileSync(docPath, 'utf-8');

          // Extract screenshot references
          const screenshotRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
          const screenshots: string[] = [];
          let match;

          while ((match = screenshotRegex.exec(content)) !== null) {
            screenshots.push(match[2]);
          }

          if (screenshots.length === 0) {
            issues.push('No screenshots found in documentation');
          }

          // Check if screenshots exist
          let missingScreenshots = 0;
          for (const screenshot of screenshots) {
            const screenshotPath = path.join(helpDir, screenshot);
            if (!fs.existsSync(screenshotPath)) {
              missingScreenshots++;
              issues.push(`Screenshot not found: ${screenshot}`);
            }
          }

          // Determine status
          let status: 'fresh' | 'needs_update' | 'broken';
          if (issues.length === 0) {
            status = 'fresh';
            fresh++;
          } else if (missingScreenshots > screenshots.length / 2) {
            status = 'broken';
            broken++;
          } else {
            status = 'needs_update';
            needsUpdate++;
          }

          docs.push({
            path: docPath,
            status,
            issues: issues.length > 0 ? issues : undefined,
          });
        } catch (error) {
          docs.push({
            path: docPath,
            status: 'broken',
            issues: [`Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`],
          });
          broken++;
        }
      }

      this.log('Freshness check completed', {
        total: files.length,
        fresh,
        needsUpdate,
        broken,
      });

      return {
        docs,
        summary: {
          total: files.length,
          fresh,
          needs_update: needsUpdate,
          broken,
        },
        recommendations: needsUpdate > 0 || broken > 0
          ? [`Run update_all_docs to refresh ${needsUpdate + broken} outdated documentation files`]
          : ['All documentation is up to date!'],
      };
    } catch (error) {
      this.logError('Failed to check docs freshness', error);
      throw new Error(
        `Failed to check documentation freshness: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Log message to stderr (stdout is reserved for MCP protocol)
   */
  private log(message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      ...(data && { data }),
    };
    console.error(JSON.stringify(logEntry));
  }

  /**
   * Log error to stderr
   */
  private logError(message: string, error: unknown, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      ...(data && { data }),
    };
    console.error(JSON.stringify(logEntry));
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.log('Auto-Docs MCP Server started and listening on stdio');
  }
}

// Start the server
const server = new AutoDocsMCPServer();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
