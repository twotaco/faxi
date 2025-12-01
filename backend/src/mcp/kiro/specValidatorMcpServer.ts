#!/usr/bin/env node

/**
 * Spec Validator MCP Server
 * 
 * This MCP server provides tools for validating Kiro specifications, tracking task completion,
 * and generating tests from requirements. It's designed to be used by Kiro IDE's AI assistant
 * to help developers manage their .kiro specs.
 * 
 * Tools provided:
 * - find_incomplete_tasks: Find incomplete tasks in specs
 * - validate_spec: Validate spec structure and format
 * - get_spec_coverage: Get coverage overview of all specs
 * - generate_test_from_spec: Generate property test skeletons
 * - validate_implementation: Validate code against requirements (CODE REVIEW)
 * - find_implementation_files: Find source files for requirements
 * - check_test_coverage: Check test coverage for requirements
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Spec Validator MCP Server
 * 
 * Validates .kiro specifications and tracks task completion
 */
class SpecValidatorMCPServer {
  private server: Server;
  private readonly version = '1.0.0';

  constructor() {
    // Initialize MCP server
    this.server = new Server(
      {
        name: 'faxi-spec-validator',
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
    this.log('Spec Validator MCP Server initialized', { version: this.version });
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
        name: 'find_incomplete_tasks',
        description: 'Find all incomplete tasks in Kiro specs. If no spec_path is provided, scans all specs in .kiro/specs/ directory.',
        inputSchema: {
          type: 'object',
          properties: {
            spec_path: {
              type: 'string',
              description: 'Optional: Specific spec directory to check (e.g., ".kiro/specs/amazon-shopping-mcp")',
            },
          },
        },
      },
      {
        name: 'validate_spec',
        description: 'Validate spec structure for required files (requirements.md, design.md, tasks.md) and proper formatting.',
        inputSchema: {
          type: 'object',
          properties: {
            spec_path: {
              type: 'string',
              description: 'Path to spec directory to validate (e.g., ".kiro/specs/amazon-shopping-mcp")',
            },
          },
          required: ['spec_path'],
        },
      },
      {
        name: 'get_spec_coverage',
        description: 'Get coverage overview of all specs, showing completion percentage for each spec and overall project.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'generate_test_from_spec',
        description: 'Generate a property-based test skeleton from a requirement using fast-check.',
        inputSchema: {
          type: 'object',
          properties: {
            spec_path: {
              type: 'string',
              description: 'Path to spec directory (e.g., ".kiro/specs/amazon-shopping-mcp")',
            },
            requirement_id: {
              type: 'string',
              description: 'Requirement ID to generate test for (e.g., "1", "1.2", "NFR1")',
            },
          },
          required: ['spec_path', 'requirement_id'],
        },
      },
      {
        name: 'validate_implementation',
        description: 'CODE REVIEW: Validate that source code actually implements the requirements. Reads design.md for expected locations, analyzes actual code files, and checks if acceptance criteria are implemented.',
        inputSchema: {
          type: 'object',
          properties: {
            spec_path: {
              type: 'string',
              description: 'Path to spec directory (e.g., ".kiro/specs/amazon-shopping-mcp")',
            },
            scope: {
              type: 'object',
              description: 'Optional: Limit validation scope',
              properties: {
                requirement_id: {
                  type: 'string',
                  description: 'Validate only this specific requirement',
                },
                file_path: {
                  type: 'string',
                  description: 'Validate only requirements related to this file',
                },
              },
            },
          },
          required: ['spec_path'],
        },
      },
      {
        name: 'find_implementation_files',
        description: 'Find source code files that implement a requirement. Checks design.md for specified locations and searches codebase using function names and requirement references.',
        inputSchema: {
          type: 'object',
          properties: {
            spec_path: {
              type: 'string',
              description: 'Path to spec directory (e.g., ".kiro/specs/amazon-shopping-mcp")',
            },
            requirement_id: {
              type: 'string',
              description: 'Requirement ID to find implementation for (e.g., "1", "1.2")',
            },
          },
          required: ['spec_path', 'requirement_id'],
        },
      },
      {
        name: 'check_test_coverage',
        description: 'Check if tests exist for requirements. Searches for property tests and unit tests that cover acceptance criteria.',
        inputSchema: {
          type: 'object',
          properties: {
            spec_path: {
              type: 'string',
              description: 'Path to spec directory (e.g., ".kiro/specs/amazon-shopping-mcp")',
            },
            requirement_id: {
              type: 'string',
              description: 'Optional: Check coverage for specific requirement only',
            },
          },
          required: ['spec_path'],
        },
      },
      {
        name: 'run_acceptance_tests',
        description: 'Run Playwright and Vitest tests for acceptance criteria. Executes tests, captures results, and maps them to requirements.',
        inputSchema: {
          type: 'object',
          properties: {
            spec_path: {
              type: 'string',
              description: 'Path to spec directory (e.g., ".kiro/specs/shopping")',
            },
            requirement_id: {
              type: 'string',
              description: 'Optional: Run tests for specific requirement only',
            },
            capture_traces: {
              type: 'boolean',
              description: 'Optional: Capture Playwright traces for failed tests (default: false)',
            },
          },
          required: ['spec_path'],
        },
      },
      {
        name: 'analyze_validation_gaps',
        description: 'Analyze gaps between requirements, implementation, and tests. Creates traceability matrix and identifies missing pieces.',
        inputSchema: {
          type: 'object',
          properties: {
            spec_path: {
              type: 'string',
              description: 'Path to spec directory (e.g., ".kiro/specs/shopping")',
            },
            include_test_results: {
              type: 'boolean',
              description: 'Optional: Run tests as part of analysis (default: true)',
            },
          },
          required: ['spec_path'],
        },
      },
      {
        name: 'propose_fixes',
        description: 'Generate actionable fix proposals for validation gaps. Provides code examples and implementation guidance.',
        inputSchema: {
          type: 'object',
          properties: {
            spec_path: {
              type: 'string',
              description: 'Path to spec directory (e.g., ".kiro/specs/shopping")',
            },
            gap_types: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: Filter by gap types (missing_implementation, failing_tests, missing_tests, untested_criteria)',
            },
            max_proposals: {
              type: 'number',
              description: 'Optional: Maximum number of proposals to generate (default: 10)',
            },
          },
          required: ['spec_path'],
        },
      },
      {
        name: 'generate_validation_report',
        description: 'Generate comprehensive validation report with test results, gap analysis, and fix proposals.',
        inputSchema: {
          type: 'object',
          properties: {
            spec_path: {
              type: 'string',
              description: 'Path to spec directory (e.g., ".kiro/specs/shopping")',
            },
            include_test_results: {
              type: 'boolean',
              description: 'Optional: Include test execution results (default: true)',
            },
            include_fix_proposals: {
              type: 'boolean',
              description: 'Optional: Include fix proposals (default: true)',
            },
            output_path: {
              type: 'string',
              description: 'Optional: Custom output path for the report',
            },
          },
          required: ['spec_path'],
        },
      },
    ];
  }

  /**
   * Handle tool call by routing to appropriate handler
   */
  private async handleToolCall(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'find_incomplete_tasks':
        return this.handleFindIncompleteTasks(args);
      
      case 'validate_spec':
        return this.handleValidateSpec(args);
      
      case 'get_spec_coverage':
        return this.handleGetSpecCoverage(args);
      
      case 'generate_test_from_spec':
        return this.handleGenerateTestFromSpec(args);
      
      case 'validate_implementation':
        return this.handleValidateImplementation(args);
      
      case 'find_implementation_files':
        return this.handleFindImplementationFiles(args);
      
      case 'check_test_coverage':
        return this.handleCheckTestCoverage(args);
      
      case 'run_acceptance_tests':
        return this.handleRunAcceptanceTests(args);
      
      case 'analyze_validation_gaps':
        return this.handleAnalyzeValidationGaps(args);
      
      case 'propose_fixes':
        return this.handleProposeFixes(args);
      
      case 'generate_validation_report':
        return this.handleGenerateValidationReport(args);
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Handle find_incomplete_tasks tool call
   */
  private async handleFindIncompleteTasks(args: any): Promise<any> {
    const { spec_path } = args;

    // Import required modules
    const { specParserService } = await import('./services/specParserService.js');
    const fs = await import('fs');
    const path = await import('path');

    try {
      // If spec_path is provided, scan only that spec
      if (spec_path) {
        // Normalize spec path
        const normalizedSpecPath = path.resolve(spec_path);

        // Check if spec directory exists
        if (!fs.existsSync(normalizedSpecPath)) {
          throw new Error(`Spec directory does not exist: ${spec_path}`);
        }

        // Check if tasks.md exists
        const tasksPath = path.join(normalizedSpecPath, 'tasks.md');
        if (!fs.existsSync(tasksPath)) {
          throw new Error(
            `tasks.md not found in ${spec_path}. ` +
            `Expected file at: ${tasksPath}`
          );
        }

        // Parse tasks.md
        const content = fs.readFileSync(tasksPath, 'utf-8');
        const tasks = specParserService.parseTasks(content);

        // Filter incomplete tasks
        const incompleteTasks = tasks.filter(t => !t.completed);
        const completedTasks = tasks.filter(t => t.completed);

        return {
          spec_name: path.basename(normalizedSpecPath),
          spec_path: normalizedSpecPath,
          incomplete_tasks: incompleteTasks.map(t => ({
            task_number: t.number,
            title: t.title,
            parent_task: t.parentNumber,
            line_number: t.lineNumber,
            requirements: t.requirements,
          })),
          total_tasks: tasks.length,
          completed_tasks: completedTasks.length,
          completion_percentage: tasks.length > 0
            ? Math.round((completedTasks.length / tasks.length) * 100)
            : 0,
        };
      }

      // If no spec_path provided, scan all specs in .kiro/specs/
      const specsDir = path.resolve('.kiro/specs');

      // Check if specs directory exists
      if (!fs.existsSync(specsDir)) {
        throw new Error(
          `Specs directory does not exist: .kiro/specs. ` +
          `Please ensure you are running this command from the project root.`
        );
      }

      // Get all subdirectories in .kiro/specs/
      const entries = fs.readdirSync(specsDir, { withFileTypes: true });
      const specDirs = entries
        .filter(entry => entry.isDirectory())
        .map(entry => ({
          name: entry.name,
          path: path.join(specsDir, entry.name),
        }));

      // Collect results for all specs
      const results: Array<{
        spec_name: string;
        spec_path: string;
        incomplete_tasks: Array<{
          task_number: string;
          title: string;
          parent_task?: string;
          line_number: number;
          requirements?: string[];
        }>;
        total_tasks: number;
        completed_tasks: number;
        completion_percentage: number;
        has_tasks_file: boolean;
      }> = [];

      let totalTasksAcrossAllSpecs = 0;
      let totalCompletedTasksAcrossAllSpecs = 0;
      let totalIncompleteTasksAcrossAllSpecs = 0;

      // Process each spec directory
      for (const spec of specDirs) {
        const tasksPath = path.join(spec.path, 'tasks.md');

        // Check if tasks.md exists
        if (!fs.existsSync(tasksPath)) {
          results.push({
            spec_name: spec.name,
            spec_path: spec.path,
            incomplete_tasks: [],
            total_tasks: 0,
            completed_tasks: 0,
            completion_percentage: 0,
            has_tasks_file: false,
          });
          continue;
        }

        // Parse tasks.md
        try {
          const content = fs.readFileSync(tasksPath, 'utf-8');
          const tasks = specParserService.parseTasks(content);

          // Filter incomplete tasks
          const incompleteTasks = tasks.filter(t => !t.completed);
          const completedTasks = tasks.filter(t => t.completed);

          totalTasksAcrossAllSpecs += tasks.length;
          totalCompletedTasksAcrossAllSpecs += completedTasks.length;
          totalIncompleteTasksAcrossAllSpecs += incompleteTasks.length;

          results.push({
            spec_name: spec.name,
            spec_path: spec.path,
            incomplete_tasks: incompleteTasks.map(t => ({
              task_number: t.number,
              title: t.title,
              parent_task: t.parentNumber,
              line_number: t.lineNumber,
              requirements: t.requirements,
            })),
            total_tasks: tasks.length,
            completed_tasks: completedTasks.length,
            completion_percentage: tasks.length > 0
              ? Math.round((completedTasks.length / tasks.length) * 100)
              : 0,
            has_tasks_file: true,
          });
        } catch (error) {
          // If parsing fails, mark as having no tasks
          results.push({
            spec_name: spec.name,
            spec_path: spec.path,
            incomplete_tasks: [],
            total_tasks: 0,
            completed_tasks: 0,
            completion_percentage: 0,
            has_tasks_file: false,
          });
        }
      }

      // Calculate overall statistics
      const overallCompletionPercentage = totalTasksAcrossAllSpecs > 0
        ? Math.round((totalCompletedTasksAcrossAllSpecs / totalTasksAcrossAllSpecs) * 100)
        : 0;

      return {
        specs: results,
        summary: {
          total_specs: results.length,
          specs_with_tasks: results.filter(r => r.has_tasks_file).length,
          specs_without_tasks: results.filter(r => !r.has_tasks_file).length,
          total_tasks: totalTasksAcrossAllSpecs,
          completed_tasks: totalCompletedTasksAcrossAllSpecs,
          incomplete_tasks: totalIncompleteTasksAcrossAllSpecs,
          overall_completion_percentage: overallCompletionPercentage,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to find incomplete tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle validate_spec tool call
   */
  private async handleValidateSpec(args: any): Promise<any> {
    const { spec_path } = args;

    if (!spec_path) {
      throw new Error('spec_path parameter is required');
    }

    // Import the spec parser service
    const { specParserService } = await import('./services/specParserService.js');

    try {
      // Validate the spec structure
      const result = specParserService.validateStructure(spec_path);

      return {
        valid: result.valid,
        issues: result.issues,
        summary: {
          total_issues: result.issues.length,
          errors: result.issues.filter(i => i.severity === 'error').length,
          warnings: result.issues.filter(i => i.severity === 'warning').length,
        },
      };
    } catch (error) {
      throw new Error(`Failed to validate spec: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle get_spec_coverage tool call
   */
  private async handleGetSpecCoverage(args: any): Promise<any> {
    // Import the spec parser service
    const { specParserService } = await import('./services/specParserService.js');

    try {
      // Get coverage for all specs
      const result = specParserService.getSpecCoverage();

      return {
        specs: result.specs.map(spec => ({
          name: spec.name,
          total_tasks: spec.total_tasks,
          completed_tasks: spec.completed_tasks,
          percentage: spec.percentage,
          has_tasks: spec.has_tasks,
        })),
        overall_percentage: result.overall_percentage,
        summary: {
          total_specs: result.specs.length,
          specs_with_tasks: result.specs.filter(s => s.has_tasks).length,
          specs_without_tasks: result.specs.filter(s => !s.has_tasks).length,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get spec coverage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle generate_test_from_spec tool call
   */
  private async handleGenerateTestFromSpec(args: any): Promise<any> {
    const { spec_path, requirement_id } = args;

    if (!spec_path) {
      throw new Error('spec_path parameter is required');
    }

    if (!requirement_id) {
      throw new Error('requirement_id parameter is required');
    }

    // Import the spec parser service
    const { specParserService } = await import('./services/specParserService.js');
    const fs = await import('fs');
    const path = await import('path');

    try {
      // Normalize spec path
      const normalizedSpecPath = path.resolve(spec_path);

      // Check if spec directory exists
      if (!fs.existsSync(normalizedSpecPath)) {
        throw new Error(`Spec directory does not exist: ${spec_path}`);
      }

      // Read requirements.md
      const requirementsPath = path.join(normalizedSpecPath, 'requirements.md');
      if (!fs.existsSync(requirementsPath)) {
        throw new Error(`requirements.md not found in ${spec_path}`);
      }

      const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
      const requirements = specParserService.parseRequirements(requirementsContent);

      // Find the requested requirement
      const requirement = requirements.find(r => r.id === requirement_id);

      if (!requirement) {
        // Provide helpful error with available requirement IDs
        const availableIds = requirements.map(r => r.id).join(', ');
        throw new Error(
          `Requirement ${requirement_id} not found in ${spec_path}. ` +
          `Available requirement IDs: ${availableIds || 'none'}`
        );
      }

      // Check if design.md exists to get property format
      const designPath = path.join(normalizedSpecPath, 'design.md');
      let propertyFormat: string | null = null;

      if (fs.existsSync(designPath)) {
        const designContent = fs.readFileSync(designPath, 'utf-8');
        // Try to extract property format from design.md
        // Look for property definitions related to this requirement
        const propertyPattern = new RegExp(
          `Property \\d+:.*?\\*\\*Validates: Requirements? ${requirement_id}(?:\\.|,|\\*\\*)`,
          'i'
        );
        const propertyMatch = designContent.match(propertyPattern);
        if (propertyMatch) {
          propertyFormat = propertyMatch[0];
        }
      }

      // Generate test code
      const testCode = this.generatePropertyTestCode(
        requirement,
        path.basename(normalizedSpecPath),
        propertyFormat
      );

      return {
        test_code: testCode,
        requirement_summary: `${requirement.id}: ${requirement.title}`,
        user_story: requirement.userStory,
        acceptance_criteria: requirement.acceptanceCriteria.map(c => c.text),
        property_format: propertyFormat || 'No property format found in design.md',
      };
    } catch (error) {
      throw new Error(
        `Failed to generate test from spec: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate property-based test code using fast-check
   */
  private generatePropertyTestCode(
    requirement: any,
    specName: string,
    propertyFormat: string | null
  ): string {
    const { id, title, userStory, acceptanceCriteria } = requirement;

    // Generate test description
    const testDescription = `property: ${title.toLowerCase()}`;

    // Generate property comment header
    const propertyComment = [
      '/**',
      ` * Feature: ${specName}, Property: ${title}`,
      ` * Validates: Requirements ${id}`,
      ' */',
    ].join('\n');

    // Generate acceptance criteria comments
    const criteriaComments = acceptanceCriteria
      .map((c: any) => ` * - ${c.number}. ${c.text}`)
      .join('\n');

    // Generate test skeleton
    const testCode = `
import * as fc from 'fast-check';

describe('${specName} - Requirement ${id}', () => {
  ${propertyComment}
  it('${testDescription}', async () => {
    await fc.assert(
      fc.asyncProperty(
        // TODO: Define generators for test inputs
        fc.string(), // Replace with appropriate generators
        async (input) => {
          // TODO: Implement test logic
          
          // User Story: ${userStory}
          
          // Acceptance Criteria:
${criteriaComments}
          
          // TODO: Add assertions that verify the acceptance criteria
          expect(true).toBe(true); // Replace with actual assertions
        }
      ),
      { numRuns: 100 } // Run 100 iterations as per design doc
    );
  });
});
`.trim();

    return testCode;
  }

  /**
   * Handle validate_implementation tool call (CODE REVIEW)
   */
  private async handleValidateImplementation(args: any): Promise<any> {
    const { spec_path, scope } = args;

    if (!spec_path) {
      throw new Error('spec_path parameter is required');
    }

    // Import required services
    const { specParserService } = await import('./services/specParserService.js');
    const { codeAnalysisService } = await import('./services/codeAnalysisService.js');
    const fs = await import('fs');
    const path = await import('path');

    try {
      // Normalize spec path
      const normalizedSpecPath = path.resolve(spec_path);

      // Check if spec directory exists
      if (!fs.existsSync(normalizedSpecPath)) {
        throw new Error(`Spec directory does not exist: ${spec_path}`);
      }

      // Read requirements.md
      const requirementsPath = path.join(normalizedSpecPath, 'requirements.md');
      if (!fs.existsSync(requirementsPath)) {
        throw new Error(`requirements.md not found in ${spec_path}`);
      }

      const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
      const requirements = specParserService.parseRequirements(requirementsContent);

      if (requirements.length === 0) {
        throw new Error(`No requirements found in ${spec_path}/requirements.md`);
      }

      // Read design.md if it exists
      const designPath = path.join(normalizedSpecPath, 'design.md');
      let designContent = '';
      let designLocations: any[] = [];

      if (fs.existsSync(designPath)) {
        designContent = fs.readFileSync(designPath, 'utf-8');
        designLocations = codeAnalysisService.extractDesignLocations(designContent);
      }

      // Filter requirements based on scope
      let requirementsToValidate = requirements;

      if (scope?.requirement_id) {
        const requirement = requirements.find(r => r.id === scope.requirement_id);
        if (!requirement) {
          const availableIds = requirements.map(r => r.id).join(', ');
          throw new Error(
            `Requirement ${scope.requirement_id} not found. ` +
            `Available requirement IDs: ${availableIds}`
          );
        }
        requirementsToValidate = [requirement];
      } else if (scope?.file_path) {
        // Filter requirements related to this file
        // For now, validate all requirements and filter results later
        // This is a simplification - a more sophisticated approach would
        // analyze which requirements mention this file
        requirementsToValidate = requirements;
      }

      // Validate each requirement
      const validationResults = [];
      let totalCriteria = 0;
      let implementedCount = 0;
      let missingCount = 0;
      let partialCount = 0;
      let needsReviewCount = 0;

      for (const requirement of requirementsToValidate) {
        // Validate implementation for this requirement
        const criteriaResults = await codeAnalysisService.validateImplementation(
          requirement,
          designLocations
        );

        // Count statuses
        for (const result of criteriaResults) {
          totalCriteria++;
          switch (result.status) {
            case 'implemented':
              implementedCount++;
              break;
            case 'missing':
              missingCount++;
              break;
            case 'partial':
              partialCount++;
              break;
            case 'needs_manual_review':
              needsReviewCount++;
              break;
          }
        }

        // Filter by file_path if specified
        let filteredResults = criteriaResults;
        if (scope?.file_path) {
          filteredResults = criteriaResults.filter(cr =>
            cr.evidence.filePath?.includes(scope.file_path)
          );
        }

        if (filteredResults.length > 0 || !scope?.file_path) {
          validationResults.push({
            requirement_id: requirement.id,
            requirement_title: requirement.title,
            criteria_results: filteredResults.map(cr => ({
              criterion_number: cr.criterionNumber,
              criterion_text: cr.criterionText,
              status: cr.status,
              evidence: {
                file_path: cr.evidence.filePath,
                line_number: cr.evidence.lineNumber,
                code_snippet: cr.evidence.codeSnippet,
                reason: cr.evidence.reason,
              },
              suggested_fix: cr.suggestedFix,
            })),
          });
        }
      }

      // Calculate coverage percentage
      const coveragePercent = totalCriteria > 0
        ? Math.round((implementedCount / totalCriteria) * 100)
        : 0;

      // Determine if complete
      const complete = missingCount === 0 && partialCount === 0 && needsReviewCount === 0;

      return {
        complete,
        coverage_percent: coveragePercent,
        validation_results: validationResults,
        summary: {
          total_criteria: totalCriteria,
          implemented: implementedCount,
          missing: missingCount,
          partial: partialCount,
          needs_review: needsReviewCount,
        },
        metadata: {
          spec_path,
          requirements_validated: requirementsToValidate.length,
          design_locations_found: designLocations.length,
          scope: scope || 'all',
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to validate implementation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle find_implementation_files tool call
   */
  private async handleFindImplementationFiles(args: any): Promise<any> {
    const { spec_path, requirement_id } = args;

    if (!spec_path) {
      throw new Error('spec_path parameter is required');
    }

    if (!requirement_id) {
      throw new Error('requirement_id parameter is required');
    }

    // Import required services
    const { specParserService } = await import('./services/specParserService.js');
    const { codeAnalysisService } = await import('./services/codeAnalysisService.js');
    const fs = await import('fs');
    const path = await import('path');

    try {
      // Normalize spec path
      const normalizedSpecPath = path.resolve(spec_path);

      // Check if spec directory exists
      if (!fs.existsSync(normalizedSpecPath)) {
        throw new Error(`Spec directory does not exist: ${spec_path}`);
      }

      // Read requirements.md
      const requirementsPath = path.join(normalizedSpecPath, 'requirements.md');
      if (!fs.existsSync(requirementsPath)) {
        throw new Error(`requirements.md not found in ${spec_path}`);
      }

      const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
      const requirements = specParserService.parseRequirements(requirementsContent);

      // Find the requested requirement
      const requirement = requirements.find(r => r.id === requirement_id);

      if (!requirement) {
        // Provide helpful error with available requirement IDs
        const availableIds = requirements.map(r => r.id).join(', ');
        throw new Error(
          `Requirement ${requirement_id} not found in ${spec_path}. ` +
          `Available requirement IDs: ${availableIds || 'none'}`
        );
      }

      // Read design.md if it exists
      const designPath = path.join(normalizedSpecPath, 'design.md');
      let designContent = '';
      let designSpecifiedLocation: string | undefined;

      if (fs.existsSync(designPath)) {
        designContent = fs.readFileSync(designPath, 'utf-8');
        
        // Extract design locations to check if this requirement has a specified location
        const designLocations = codeAnalysisService.extractDesignLocations(designContent);
        
        // Try to find a location that matches this requirement
        // This is a heuristic - we look for locations in sections that mention the requirement
        const reqKeywords = requirement.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const matchingLocation = designLocations.find(loc => {
          const componentLower = loc.component.toLowerCase();
          return reqKeywords.some(keyword => componentLower.includes(keyword));
        });
        
        if (matchingLocation) {
          designSpecifiedLocation = matchingLocation.filePath;
        }
      }

      // Find implementation files using the code analysis service
      const implementationFiles = await codeAnalysisService.findImplementationFiles(
        requirement,
        designContent
      );

      // Format the results
      const files = implementationFiles.map(file => ({
        path: file.path,
        confidence: file.confidence,
        reason: file.reason,
        relevant_lines: file.relevantLines.length > 0 ? file.relevantLines : undefined,
      }));

      return {
        requirement_id,
        requirement_title: requirement.title,
        files,
        design_specified_location: designSpecifiedLocation,
        summary: {
          total_files_found: files.length,
          high_confidence: files.filter(f => f.confidence === 'high').length,
          medium_confidence: files.filter(f => f.confidence === 'medium').length,
          low_confidence: files.filter(f => f.confidence === 'low').length,
        },
        metadata: {
          spec_path,
          has_design_doc: designContent.length > 0,
          search_methods_used: [
            'design.md location extraction',
            'requirement ID comment search',
            'keyword matching from requirement title',
          ],
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to find implementation files: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle check_test_coverage tool call
   */
  private async handleCheckTestCoverage(args: any): Promise<any> {
    const { spec_path, requirement_id } = args;

    if (!spec_path) {
      throw new Error('spec_path parameter is required');
    }

    // Import required services
    const { specParserService } = await import('./services/specParserService.js');
    const { codeAnalysisService } = await import('./services/codeAnalysisService.js');
    const fs = await import('fs');
    const path = await import('path');

    try {
      // Normalize spec path
      const normalizedSpecPath = path.resolve(spec_path);

      // Check if spec directory exists
      if (!fs.existsSync(normalizedSpecPath)) {
        throw new Error(`Spec directory does not exist: ${spec_path}`);
      }

      // Read requirements.md
      const requirementsPath = path.join(normalizedSpecPath, 'requirements.md');
      if (!fs.existsSync(requirementsPath)) {
        throw new Error(`requirements.md not found in ${spec_path}`);
      }

      const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
      const requirements = specParserService.parseRequirements(requirementsContent);

      if (requirements.length === 0) {
        throw new Error(`No requirements found in ${spec_path}/requirements.md`);
      }

      // Filter requirements if requirement_id is specified
      let requirementsToCheck = requirements;

      if (requirement_id) {
        const requirement = requirements.find(r => r.id === requirement_id);
        if (!requirement) {
          const availableIds = requirements.map(r => r.id).join(', ');
          throw new Error(
            `Requirement ${requirement_id} not found. ` +
            `Available requirement IDs: ${availableIds}`
          );
        }
        requirementsToCheck = [requirement];
      }

      // Check test coverage for each requirement
      const requirementResults = [];
      let totalCriteria = 0;
      let criteriaWithTests = 0;

      for (const requirement of requirementsToCheck) {
        // Find tests for this requirement
        const testCoverage = await codeAnalysisService.findTestsForRequirement(
          requirement.id,
          normalizedSpecPath
        );

        // Count criteria
        const numCriteria = requirement.acceptanceCriteria.length;
        totalCriteria += numCriteria;
        criteriaWithTests += testCoverage.testFiles.reduce((sum, tf) => {
          return sum + tf.criteriaCovered.length;
        }, 0);

        // Identify missing criteria
        const coveredCriteria = new Set(
          testCoverage.testFiles.flatMap(tf => tf.criteriaCovered)
        );
        const missingCriteria = requirement.acceptanceCriteria
          .map((_, index) => index + 1)
          .filter(num => !coveredCriteria.has(num));

        requirementResults.push({
          requirement_id: requirement.id,
          requirement_title: requirement.title,
          has_tests: testCoverage.hasTests,
          test_files: testCoverage.testFiles.map(tf => ({
            path: tf.path,
            test_names: tf.testNames,
            criteria_covered: tf.criteriaCovered,
          })),
          missing_criteria: missingCriteria,
          coverage_percent: testCoverage.coveragePercent,
          total_criteria: numCriteria,
          tested_criteria: coveredCriteria.size,
        });
      }

      // Calculate overall coverage percentage
      const coveragePercent = totalCriteria > 0
        ? Math.round((criteriaWithTests / totalCriteria) * 100)
        : 0;

      // Generate recommendations
      const recommendations = [];

      // Find requirements with no tests
      const requirementsWithoutTests = requirementResults.filter(r => !r.has_tests);
      if (requirementsWithoutTests.length > 0) {
        recommendations.push(
          `Add tests for ${requirementsWithoutTests.length} requirement(s) with no test coverage: ` +
          requirementsWithoutTests.map(r => r.requirement_id).join(', ')
        );
      }

      // Find requirements with partial coverage
      const requirementsWithPartialCoverage = requirementResults.filter(
        r => r.has_tests && r.missing_criteria.length > 0
      );
      if (requirementsWithPartialCoverage.length > 0) {
        recommendations.push(
          `Improve test coverage for ${requirementsWithPartialCoverage.length} requirement(s) with partial coverage`
        );
      }

      // Suggest property-based tests if none found
      const hasPropertyTests = requirementResults.some(r =>
        r.test_files.some(tf => tf.path.includes('.property.test.'))
      );
      if (!hasPropertyTests && requirementResults.length > 0) {
        recommendations.push(
          'Consider adding property-based tests using fast-check for universal properties'
        );
      }

      return {
        coverage_percent: coveragePercent,
        requirements: requirementResults,
        recommendations,
        summary: {
          total_requirements: requirementsToCheck.length,
          requirements_with_tests: requirementResults.filter(r => r.has_tests).length,
          requirements_without_tests: requirementResults.filter(r => !r.has_tests).length,
          total_criteria: totalCriteria,
          tested_criteria: criteriaWithTests,
          untested_criteria: totalCriteria - criteriaWithTests,
        },
        metadata: {
          spec_path,
          requirement_id: requirement_id || 'all',
          test_file_patterns_searched: [
            '**/*.test.ts',
            '**/*.spec.ts',
            '**/*.property.test.ts',
            '**/__tests__/**/*.ts',
          ],
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to check test coverage: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle run_acceptance_tests tool call
   */
  private async handleRunAcceptanceTests(args: any): Promise<any> {
    const { spec_path, requirement_id, capture_traces } = args;

    if (!spec_path) {
      throw new Error('spec_path parameter is required');
    }

    const { testExecutionService } = await import('./services/testExecutionService.js');
    const path = await import('path');
    const fs = await import('fs');

    try {
      const normalizedSpecPath = path.resolve(spec_path);

      if (!fs.existsSync(normalizedSpecPath)) {
        throw new Error(`Spec directory does not exist: ${spec_path}`);
      }

      this.log('Running acceptance tests', {
        spec_path: normalizedSpecPath,
        requirement_id,
        capture_traces,
      });

      const testResults = await testExecutionService.runAcceptanceTests(
        normalizedSpecPath,
        requirement_id,
        {
          capture_traces,
          capture_screenshots: true,
          timeout: 60000,
        }
      );

      this.log('Test execution completed', {
        tests_run: testResults.tests_run,
        tests_passed: testResults.tests_passed,
        tests_failed: testResults.tests_failed,
      });

      return testResults;
    } catch (error) {
      this.logError('Failed to run acceptance tests', error);
      throw new Error(
        `Failed to run acceptance tests: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle analyze_validation_gaps tool call
   */
  private async handleAnalyzeValidationGaps(args: any): Promise<any> {
    const { spec_path, include_test_results = true } = args;

    if (!spec_path) {
      throw new Error('spec_path parameter is required');
    }

    const { specParserService } = await import('./services/specParserService.js');
    const { codeAnalysisService } = await import('./services/codeAnalysisService.js');
    const { testExecutionService } = await import('./services/testExecutionService.js');
    const { gapAnalysisService } = await import('./services/gapAnalysisService.js');
    const path = await import('path');
    const fs = await import('fs');

    try {
      const normalizedSpecPath = path.resolve(spec_path);

      if (!fs.existsSync(normalizedSpecPath)) {
        throw new Error(`Spec directory does not exist: ${spec_path}`);
      }

      this.log('Analyzing validation gaps', { spec_path: normalizedSpecPath });

      const requirementsPath = path.join(normalizedSpecPath, 'requirements.md');
      if (!fs.existsSync(requirementsPath)) {
        throw new Error(`requirements.md not found in ${spec_path}`);
      }

      const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
      const requirements = specParserService.parseRequirements(requirementsContent);

      const implementationResults = [];
      for (const requirement of requirements) {
        const result = await codeAnalysisService.validateImplementation(
          requirement,
          normalizedSpecPath
        );
        implementationResults.push(...result.criteria);
      }

      let testResults: any[] = [];
      if (include_test_results) {
        const testExecution = await testExecutionService.runAcceptanceTests(
          normalizedSpecPath
        );
        testResults = testExecution.test_results;
      }

      const gapAnalysis = await gapAnalysisService.analyzeGaps(
        requirements,
        implementationResults,
        testResults
      );

      this.log('Gap analysis completed', {
        total_gaps: gapAnalysis.summary.total_gaps,
        critical: gapAnalysis.summary.critical,
        high: gapAnalysis.summary.high,
      });

      return gapAnalysis;
    } catch (error) {
      this.logError('Failed to analyze validation gaps', error);
      throw new Error(
        `Failed to analyze validation gaps: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle propose_fixes tool call
   */
  private async handleProposeFixes(args: any): Promise<any> {
    const { spec_path, gap_types, max_proposals = 10 } = args;

    if (!spec_path) {
      throw new Error('spec_path parameter is required');
    }

    const { fixProposalService } = await import('./services/fixProposalService.js');
    const path = await import('path');

    try {
      const normalizedSpecPath = path.resolve(spec_path);

      this.log('Generating fix proposals', {
        spec_path: normalizedSpecPath,
        gap_types,
        max_proposals,
      });

      const gapAnalysis = await this.handleAnalyzeValidationGaps({
        spec_path,
        include_test_results: true,
      });

      let gaps = gapAnalysis.gaps;
      if (gap_types && gap_types.length > 0) {
        gaps = gaps.filter((gap: any) => gap_types.includes(gap.type));
      }

      const { specParserService } = await import('./services/specParserService.js');
      const fs = await import('fs');
      const requirementsPath = path.join(normalizedSpecPath, 'requirements.md');
      const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
      const requirements = specParserService.parseRequirements(requirementsContent);

      const proposals = await fixProposalService.generateProposals(
        gaps,
        requirements,
        normalizedSpecPath,
        max_proposals
      );

      this.log('Fix proposals generated', {
        total_proposals: proposals.summary.total_proposals,
        estimated_effort: proposals.summary.estimated_total_effort,
      });

      return proposals;
    } catch (error) {
      this.logError('Failed to generate fix proposals', error);
      throw new Error(
        `Failed to generate fix proposals: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle generate_validation_report tool call
   */
  private async handleGenerateValidationReport(args: any): Promise<any> {
    const {
      spec_path,
      include_test_results = true,
      include_fix_proposals = true,
      output_path,
    } = args;

    if (!spec_path) {
      throw new Error('spec_path parameter is required');
    }

    const { validationReportService } = await import('./services/validationReportService.js');
    const { specParserService } = await import('./services/specParserService.js');
    const path = await import('path');
    const fs = await import('fs');

    try {
      const normalizedSpecPath = path.resolve(spec_path);
      const specName = path.basename(normalizedSpecPath);

      this.log('Generating validation report', {
        spec_path: normalizedSpecPath,
        include_test_results,
        include_fix_proposals,
      });

      const requirementsPath = path.join(normalizedSpecPath, 'requirements.md');
      if (!fs.existsSync(requirementsPath)) {
        throw new Error(`requirements.md not found in ${spec_path}`);
      }
      const requirementsContent = fs.readFileSync(requirementsPath, 'utf-8');
      const requirements = specParserService.parseRequirements(requirementsContent);

      let testResults;
      if (include_test_results) {
        testResults = await this.handleRunAcceptanceTests({ spec_path });
      }

      const gapAnalysis = await this.handleAnalyzeValidationGaps({
        spec_path,
        include_test_results,
      });

      let fixProposals;
      if (include_fix_proposals) {
        fixProposals = await this.handleProposeFixes({ spec_path });
      }

      const report = await validationReportService.generateReport(
        normalizedSpecPath,
        requirements,
        testResults,
        gapAnalysis,
        fixProposals,
        {
          include_test_results,
          include_fix_proposals,
          output_path,
          spec_name: specName,
        }
      );

      this.log('Validation report generated', {
        report_path: report.report_path,
        coverage_percentage: report.summary.coverage_percentage,
        total_gaps: report.summary.gaps,
      });

      return report;
    } catch (error) {
      this.logError('Failed to generate validation report', error);
      throw new Error(
        `Failed to generate validation report: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    this.log('Spec Validator MCP Server started and listening on stdio');
  }
}

// Start the server
const server = new SpecValidatorMCPServer();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
