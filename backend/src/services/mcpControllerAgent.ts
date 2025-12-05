// Note: LangChain integration will be completed when OpenAI API is configured
// For now, implementing core agent logic without LangChain dependency
import { z } from 'zod';

import {
  AgentRequest,
  AgentResponse,
  AgentStep,
  MCPServer,
  MCPTool,
  DecisionContext,
  WorkflowStep,
  WorkflowResult
} from '../types/agent.js';
import { FaxTemplate } from '../types/fax.js';
import { InterpretationResult } from '../types/vision';
import { auditLogService } from './auditLogService';
import { agentDecisionFramework } from './agentDecisionFramework';
import { agentStateManager } from './agentStateManager';
import { config } from '../config';
import { emailMCPServer } from '../mcp/emailMcpServer';
import { shoppingMCPServer } from '../mcp/shoppingMcpServer';
import { paymentMCPServer } from '../mcp/paymentMcpServer';
import { aiChatMCPServer } from '../mcp/aiChatMcpServer';
import { userProfileMCPServer } from '../mcp/userProfileMcpServer';
import { geminiPlannerService } from './geminiPlannerService';
import { loggingService } from './loggingService';
import {
  ExecutionPlan,
  ExecutionStep,
  StepCondition,
  toolToServerMap,
  toolNameMap
} from './toolDefinitions';

/**
 * MCP Controller Agent - Orchestrates complex workflows using MCP tools
 * 
 * This agent follows the design principle of minimizing round-trips by:
 * 1. Analyzing if requests can be completed immediately
 * 2. Bundling multiple actions into single responses
 * 3. Including proactive suggestions and payment options
 * 4. Creating actionable fax templates that require minimal follow-up
 */
export class MCPControllerAgent {
  private mcpServers: Map<string, MCPServer> = new Map();
  private tools: Map<string, MCPTool> = new Map();
  private systemPrompt: string;

  constructor() {
    this.systemPrompt = this.createSystemPrompt();
    this.initializeMCPServers();
  }

  /**
   * Initialize and register MCP servers
   */
  private initializeMCPServers(): void {
    // Register Email MCP Server
    this.registerMCPServer(emailMCPServer);

    // Register Shopping MCP Server
    this.registerMCPServer(shoppingMCPServer);

    // Register Payment MCP Server
    this.registerMCPServer(paymentMCPServer);

    // Register AI Chat MCP Server
    this.registerMCPServer(aiChatMCPServer);

    // Register User Profile MCP Server
    this.registerMCPServer(userProfileMCPServer);
  }

  /**
   * Register an MCP server with its tools
   */
  registerMCPServer(server: MCPServer): void {
    this.mcpServers.set(server.name, server);
    
    // Register tools with server prefix
    for (const mcpTool of server.tools) {
      const toolKey = `${server.name}_${mcpTool.name}`;
      this.tools.set(toolKey, mcpTool);
    }
  }

  /**
   * Get available tools for a specific server
   */
  getServerTools(serverName: string): MCPTool[] {
    const server = this.mcpServers.get(serverName);
    return server ? server.tools : [];
  }

  /**
   * Get all registered servers and their tools
   */
  getAllServersAndTools(): { serverName: string; tools: string[] }[] {
    const result: { serverName: string; tools: string[] }[] = [];
    
    for (const [serverName, server] of this.mcpServers) {
      result.push({
        serverName,
        tools: server.tools.map(tool => tool.name)
      });
    }
    
    return result;
  }

  /**
   * Verify all expected MCP servers are registered
   */
  verifyServerRegistration(): { success: boolean; registeredServers: string[]; missingServers: string[] } {
    const expectedServers = ['email', 'shopping', 'payment', 'ai_chat', 'user_profile'];
    const registeredServers = Array.from(this.mcpServers.keys());
    const missingServers = expectedServers.filter(server => !registeredServers.includes(server));
    
    return {
      success: missingServers.length === 0,
      registeredServers,
      missingServers
    };
  }

  /**
   * Execute a specific MCP tool
   */
  async executeTool(serverName: string, toolName: string, input: any): Promise<any> {
    const toolKey = `${serverName}_${toolName}`;
    const tool = this.tools.get(toolKey);
    
    if (!tool) {
      throw new Error(`Tool not found: ${toolKey}`);
    }

    // Validate input against schema
    if (tool.inputSchema) {
      // Basic validation - could be enhanced with proper JSON schema validation
      const required = tool.inputSchema.required || [];
      for (const field of required) {
        if (!(field in input)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }

    return await tool.handler(input);
  }

  /**
   * Process a fax interpretation and execute the appropriate workflow
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    // Initialize execution state
    const executionId = await agentStateManager.initializeExecution(request);

    try {
      // Build decision context
      const decisionContext = await this.buildDecisionContext(request);

      // Determine the optimal workflow strategy
      const workflowStrategy = await this.determineWorkflowStrategy(decisionContext);

      // Execute the workflow with state management
      const workflowResult = await this.executeWorkflowWithStateManagement(
        executionId, 
        workflowStrategy, 
        decisionContext
      );

      // Generate the response fax template
      const faxTemplate = await this.generateFaxTemplate(workflowResult, request);

      // Complete execution and get summary
      const executionSummary = await agentStateManager.completeExecution(executionId, workflowResult);

      // Create the agent response
      const response: AgentResponse = {
        success: workflowResult.success,
        steps: await this.getExecutionSteps(executionId), // Always return steps
        finalResult: workflowResult.finalOutput,
        responseType: this.determineResponseType(workflowResult),
        faxTemplate,
        autoExecuteOnReply: this.shouldAutoExecuteOnReply(workflowResult),
        userMessage: executionSummary.humanReadableSummary || this.generateUserMessage(workflowResult)
      };

      return response;

    } catch (error) {
      // Handle execution error
      const errorResult: WorkflowResult = {
        success: false,
        steps: [],
        finalOutput: null,
        requiresUserInput: false
      };

      await agentStateManager.completeExecution(executionId, errorResult);

      // Return error response
      return this.createErrorResponse(error, request, []);
    }
  }

  /**
   * Build decision context by gathering user data
   */
  private async buildDecisionContext(request: AgentRequest): Promise<DecisionContext> {
    const context: DecisionContext = {
      interpretation: request.interpretation,
      userId: request.userId
    };

    // Gather user profile, payment methods, etc. via MCP tools
    // This would be implemented when the User Profile MCP Server is available
    
    return context;
  }

  /**
   * Determine the optimal workflow strategy based on the decision framework
   */
  private async determineWorkflowStrategy(context: DecisionContext): Promise<WorkflowStep[]> {
    // Check if request can be completed immediately
    const canCompleteImmediately = await agentDecisionFramework.canCompleteImmediately(context);
    
    console.log('[MCP Agent] Can complete immediately?', {
      canComplete: canCompleteImmediately,
      intent: context.interpretation.intent,
      hasQuestion: !!context.interpretation.parameters?.question,
      parameters: context.interpretation.parameters
    });
    
    if (canCompleteImmediately) {
      // Log decision reasoning
      await agentDecisionFramework.logDecisionReasoning(
        context,
        'immediate_completion',
        'Request has all required parameters and can be completed without user input'
      );
      
      // Create streamlined workflow for immediate completion
      const workflow = await this.createImmediateCompletionWorkflow(context);
      console.log('[MCP Agent] Created immediate workflow:', workflow.length, 'steps');
      return workflow;
    }

    // Generate proactive suggestions
    const suggestions = await agentDecisionFramework.generateProactiveSuggestions(context);
    
    // Determine payment strategy for shopping requests
    let paymentStrategy;
    if (context.interpretation.intent === 'shopping') {
      paymentStrategy = await agentDecisionFramework.determinePaymentStrategy(context);
      
      await agentDecisionFramework.logDecisionReasoning(
        context,
        'payment_strategy',
        `Selected ${paymentStrategy.strategy} based on payment methods available: ${paymentStrategy.hasPaymentMethod}`
      );
    }

    // Create multi-step workflow with bundling and proactive elements
    const workflow = await agentDecisionFramework.createMultiStepWorkflow(context);
    
    await agentDecisionFramework.logDecisionReasoning(
      context,
      'multi_step_workflow',
      `Created ${workflow.length} step workflow with ${suggestions.length} proactive suggestions`
    );

    return workflow;
  }



  /**
   * Execute a workflow with state management and error handling
   */
  private async executeWorkflowWithStateManagement(
    executionId: string,
    workflow: WorkflowStep[], 
    context: DecisionContext
  ): Promise<WorkflowResult> {
    console.log('[MCP Agent] Executing workflow:', workflow.length, 'steps');
    const results: Record<string, any> = {};
    let finalOutput: any = null;
    let hasErrors = false;

    for (const step of workflow) {
      console.log('[MCP Agent] Executing step:', step.id, step.type);
      // Check dependencies
      if (step.dependencies) {
        const missingDeps = step.dependencies.filter(dep => !(dep in results));
        if (missingDeps.length > 0) {
          throw new Error(`Missing dependencies for step ${step.id}: ${missingDeps.join(', ')}`);
        }
      }

      if (step.type === 'tool_call' && step.toolCall) {
        console.log('[MCP Agent] Calling tool:', step.toolCall.server, step.toolCall.tool);
        const agentStep = await this.executeToolCallWithRetry(executionId, step, context, results);
        
        console.log('[MCP Agent] Tool result:', {
          success: agentStep.success,
          hasOutput: !!agentStep.output,
          error: agentStep.error
        });
        
        // Track step in state manager
        await agentStateManager.trackStep(executionId, agentStep);
        
        if (agentStep.success) {
          results[step.id] = agentStep.output;
          finalOutput = agentStep.output;
        } else {
          hasErrors = true;
          // Continue with workflow even if step fails (graceful degradation)
        }
      }
    }

    // Determine final output based on intent and results
    // For shopping, we need to aggregate search results + payment info
    const aggregatedOutput = this.aggregateWorkflowResults(results, context);

    return {
      success: !hasErrors,
      steps: await this.getExecutionSteps(executionId),
      finalOutput: aggregatedOutput || finalOutput,
      requiresUserInput: this.workflowRequiresUserInput(workflow, results),
      nextAction: this.determineNextAction(workflow, results)
    };
  }

  /**
   * Aggregate workflow results based on intent
   */
  private aggregateWorkflowResults(results: Record<string, any>, context: DecisionContext): any {
    const intent = context.interpretation.intent;

    console.log('[MCP Agent] aggregateWorkflowResults called:', {
      intent,
      resultKeys: Object.keys(results),
      hasSearchProducts: !!results['search_products'],
      searchProductsKeys: results['search_products'] ? Object.keys(results['search_products']) : []
    });

    if (intent === 'shopping') {
      // Look for search_products result
      const searchResult = results['search_products'];
      console.log('[MCP Agent] Shopping search result:', {
        hasSearchResult: !!searchResult,
        hasProducts: !!searchResult?.products,
        productCount: searchResult?.products?.length,
        query: searchResult?.query
      });

      if (searchResult?.products) {
        const aggregated = {
          products: searchResult.products,
          query: searchResult.query || context.interpretation.parameters.productQuery,
          groupedResults: searchResult.groupedResults,
          referenceId: searchResult.referenceId,
          // Include payment info if available
          paymentMethods: results['payment_strategy']?.methods || [],
          hasPaymentMethod: (results['payment_strategy']?.methods?.length || 0) > 0
        };
        console.log('[MCP Agent] Returning aggregated shopping result:', {
          productCount: aggregated.products.length,
          query: aggregated.query,
          referenceId: aggregated.referenceId
        });
        return aggregated;
      }
    }

    // For other intents, return the most relevant result
    return null;
  }

  /**
   * Execute an ExecutionPlan created by the Gemini planner
   * Implements ADK-style multi-step orchestration with data chaining
   */
  async executePlan(
    plan: ExecutionPlan,
    userId: string,
    originalRequest: string
  ): Promise<{
    success: boolean;
    results: Array<{
      stepId: string;
      tool: string;
      description: string;
      params: Record<string, any>;
      result: any;
      success: boolean;
      skipped?: boolean;
      error?: string;
    }>;
    finalOutput: any;
    synthesizedResponse?: string;
  }> {
    const results: Array<{
      stepId: string;
      tool: string;
      description: string;
      params: Record<string, any>;
      result: any;
      success: boolean;
      skipped?: boolean;
      error?: string;
    }> = [];

    const stepResults: Map<string, any> = new Map();
    // ADK-style shared state for outputKey data chaining
    const sharedState: Map<string, any> = new Map();

    // Topologically sort steps based on dependencies
    const sortedSteps = this.topologicalSort(plan.steps);

    console.log('\n=== EXECUTING PLAN ===');
    console.log('Total steps:', sortedSteps.length);

    for (const step of sortedSteps) {
      console.log(`\n--- Step ${step.id}: ${step.tool} ---`);
      console.log('Description:', step.description);

      // Check dependencies are satisfied
      if (step.dependsOn && step.dependsOn.length > 0) {
        const unmetDeps = step.dependsOn.filter(depId => !stepResults.has(depId));
        if (unmetDeps.length > 0) {
          console.log('Skipping - unmet dependencies:', unmetDeps);
          loggingService.warn('Skipping step due to unmet dependencies', {
            stepId: step.id,
            unmetDeps
          });
          results.push({
            stepId: step.id,
            tool: step.tool,
            description: step.description,
            params: step.params,
            result: null,
            success: false,
            skipped: true,
            error: `Dependencies not met: ${unmetDeps.join(', ')}`
          });
          continue;
        }
      }

      // Check condition if present
      if (step.condition) {
        const conditionMet = this.evaluateCondition(step.condition, stepResults);
        if (!conditionMet) {
          console.log('Skipping - condition not met');
          loggingService.info('Skipping step due to condition not met', {
            stepId: step.id,
            condition: step.condition
          });
          results.push({
            stepId: step.id,
            tool: step.tool,
            description: step.description,
            params: step.params,
            result: null,
            success: true, // Condition skip is not a failure
            skipped: true
          });
          continue;
        }
      }

      // Resolve {variable} placeholders in params using shared state
      const resolvedParams = this.resolveStateVariables(step.params, sharedState);
      console.log('Resolved params:', JSON.stringify(resolvedParams, null, 2));

      // Execute the step
      const stepResult = await this.executeStepFromPlan(step, resolvedParams, userId);
      results.push(stepResult);

      // Store result for dependent steps
      if (stepResult.success) {
        stepResults.set(step.id, stepResult.result);

        // Store formatted result in shared state if outputKey specified
        if (step.outputKey) {
          const formattedOutput = geminiPlannerService.formatStepOutput(step.tool, stepResult.result);
          sharedState.set(step.outputKey, formattedOutput);
          console.log(`Stored output in shared state: ${step.outputKey}`, formattedOutput);
        }
      }
    }

    // Determine overall success
    const nonSkippedResults = results.filter(r => !r.skipped);
    const hasErrors = nonSkippedResults.some(r => !r.success);
    const successfulResults = results.filter(r => r.success && !r.skipped);

    // Synthesize response if we have multiple successful results
    let synthesizedResponse: string | undefined;
    if (successfulResults.length > 0) {
      const synthesisResult = await geminiPlannerService.synthesizeResponse(
        originalRequest,
        successfulResults.map(r => ({
          tool: r.tool,
          description: r.description,
          params: r.params,
          result: r.result,
          success: r.success
        })),
        plan.summary
      );
      if (synthesisResult.success) {
        synthesizedResponse = synthesisResult.response;
      }
    }

    // Get the most relevant final output
    const finalOutput = this.determineFinalOutput(results, sharedState);

    console.log('\n=== PLAN EXECUTION COMPLETE ===');
    console.log('Success:', !hasErrors);
    console.log('Results:', results.length);
    console.log('Successful:', successfulResults.length);

    return {
      success: !hasErrors,
      results,
      finalOutput,
      synthesizedResponse
    };
  }

  /**
   * Execute a single step from an ExecutionPlan
   */
  private async executeStepFromPlan(
    step: ExecutionStep,
    resolvedParams: Record<string, any>,
    userId: string
  ): Promise<{
    stepId: string;
    tool: string;
    description: string;
    params: Record<string, any>;
    result: any;
    success: boolean;
    error?: string;
  }> {
    const serverName = toolToServerMap[step.tool];
    const mcpToolName = toolNameMap[step.tool];

    if (!serverName || !mcpToolName) {
      console.error(`Unknown tool mapping for: ${step.tool}`);
      return {
        stepId: step.id,
        tool: step.tool,
        description: step.description,
        params: resolvedParams,
        result: null,
        success: false,
        error: `Unknown tool: ${step.tool}`
      };
    }

    try {
      // Map parameters to MCP format
      const mcpParams = this.mapParamsToMcp(serverName, mcpToolName, { ...resolvedParams, userId });
      console.log('MCP params:', JSON.stringify(mcpParams, null, 2));

      // Execute via MCP tool
      const result = await this.executeTool(serverName, mcpToolName, mcpParams);

      console.log('Tool result:', JSON.stringify(result, null, 2).substring(0, 500));

      const isSuccess = result && result.success !== false;

      return {
        stepId: step.id,
        tool: step.tool,
        description: step.description,
        params: resolvedParams,
        result,
        success: isSuccess
      };

    } catch (error: any) {
      console.error(`Step execution failed: ${error.message}`);
      return {
        stepId: step.id,
        tool: step.tool,
        description: step.description,
        params: resolvedParams,
        result: null,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Map Gemini function parameters to MCP tool parameters
   */
  private mapParamsToMcp(
    serverName: string,
    toolName: string,
    params: Record<string, any>
  ): Record<string, any> {
    const { userId, ...rest } = params;

    switch (`${serverName}_${toolName}`) {
      case 'shopping_search_products':
        return {
          userId,
          query: rest.query,
          filters: {
            priceMin: rest.minPrice,
            priceMax: rest.maxPrice,
            primeOnly: rest.primeOnly ?? true,
            minRating: 3.5
          }
        };

      case 'shopping_create_order':
        return {
          userId,
          productAsin: rest.productId,
          quantity: rest.quantity || 1,
          referenceId: rest.referenceId
        };

      case 'email_send_email':
        return {
          userId,
          to: rest.recipientEmail,
          recipientName: rest.recipientName,
          subject: rest.subject || 'Message from Faxi',
          body: rest.body
        };

      case 'ai_chat_chat':
        return {
          userId,
          message: rest.question,
          context: rest.context
        };

      case 'payment_register_payment_method':
        return {
          userId,
          methodType: rest.methodType
        };

      case 'user_profile_get_address_book':
        return { userId };

      case 'user_profile_add_contact':
        return {
          userId,
          name: rest.name,
          email: rest.email,
          relationship: rest.note
        };

      case 'user_profile_lookup_contact':
        return {
          userId,
          query: rest.query
        };

      case 'user_profile_update_contact':
        return {
          userId,
          contactId: rest.contactId,
          currentName: rest.currentName,
          currentEmail: rest.currentEmail,
          name: rest.name,
          email: rest.email,
          relationship: rest.note,
          notes: rest.notes
        };

      case 'user_profile_delete_contact':
        return {
          userId,
          contactId: rest.contactId
        };

      case 'user_profile_get_user_profile':
        return { userId };

      default:
        return { userId, ...rest };
    }
  }

  /**
   * Resolve {variable} and {variable.field} placeholders in params using shared state
   */
  private resolveStateVariables(
    params: Record<string, any>,
    sharedState: Map<string, any>
  ): Record<string, any> {
    const resolve = (value: any): any => {
      if (typeof value === 'string') {
        // Replace {key} or {key.field} patterns
        return value.replace(/\{(\w+)(?:\.(\w+))?\}/g, (match, key, field) => {
          const stored = sharedState.get(key);
          if (!stored) return match; // Keep original if not found
          if (field) {
            // Access specific field like {products.count}
            return stored[field] !== undefined ? String(stored[field]) : match;
          }
          // Return formatted output by default
          return stored.formatted ?? String(stored);
        });
      }
      if (Array.isArray(value)) {
        return value.map(resolve);
      }
      if (typeof value === 'object' && value !== null) {
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, resolve(v)])
        );
      }
      return value;
    };

    // Deep clone and resolve
    return resolve(JSON.parse(JSON.stringify(params)));
  }

  /**
   * Evaluate a step condition
   */
  private evaluateCondition(condition: StepCondition, stepResults: Map<string, any>): boolean {
    const dependentResult = stepResults.get(condition.step);

    if (!dependentResult) {
      console.log('Condition references non-existent step result:', condition.step);
      return false;
    }

    // Get the value to check
    let valueToCheck: string;
    if (condition.field) {
      valueToCheck = String(dependentResult[condition.field] || '');
    } else {
      // For ai_chat, check the response field
      valueToCheck = String(dependentResult.response || dependentResult.message || JSON.stringify(dependentResult));
    }

    const valueLower = valueToCheck.toLowerCase();
    const checkValueLower = (condition.value || '').toLowerCase();

    switch (condition.check) {
      case 'contains':
        return valueLower.includes(checkValueLower);

      case 'not_contains':
        return !valueLower.includes(checkValueLower);

      case 'equals':
        return valueLower === checkValueLower;

      case 'not_equals':
        return valueLower !== checkValueLower;

      case 'truthy':
        return !!dependentResult && dependentResult.success !== false;

      case 'falsy':
        return !dependentResult || dependentResult.success === false;

      default:
        console.log('Unknown condition check type:', condition.check);
        return true;
    }
  }

  /**
   * Topologically sort steps based on dependencies
   */
  private topologicalSort(steps: ExecutionStep[]): ExecutionStep[] {
    const stepMap = new Map(steps.map(s => [s.id, s]));
    const visited = new Set<string>();
    const result: ExecutionStep[] = [];

    const visit = (stepId: string) => {
      if (visited.has(stepId)) return;
      visited.add(stepId);

      const step = stepMap.get(stepId);
      if (!step) return;

      // Visit dependencies first
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          visit(depId);
        }
      }

      result.push(step);
    };

    // Visit all steps
    for (const step of steps) {
      visit(step.id);
    }

    return result;
  }

  /**
   * Determine the final output from execution results
   */
  private determineFinalOutput(
    results: Array<{ stepId: string; tool: string; result: any; success: boolean; skipped?: boolean }>,
    sharedState: Map<string, any>
  ): any {
    // Look for specific output types in order of priority

    // 1. Shopping products
    for (const [key, value] of sharedState) {
      if (value.products) {
        return {
          products: value.products,
          query: value.query || key,
          referenceId: value.referenceId,
          count: value.count
        };
      }
    }

    // 2. Email send result
    const emailResult = results.find(r => r.tool === 'email_send' && r.success);
    if (emailResult) {
      return emailResult.result;
    }

    // 3. AI chat response
    const chatResult = results.find(r => r.tool === 'ai_chat_question' && r.success);
    if (chatResult) {
      return chatResult.result;
    }

    // 4. Contact operations
    const contactResult = results.find(r =>
      r.tool.startsWith('user_profile_') && r.success
    );
    if (contactResult) {
      return contactResult.result;
    }

    // 5. Default - return last successful result
    const successfulResults = results.filter(r => r.success && !r.skipped);
    if (successfulResults.length > 0) {
      return successfulResults[successfulResults.length - 1].result;
    }

    return null;
  }

  /**
   * Execute a tool call with retry logic
   */
  private async executeToolCallWithRetry(
    executionId: string,
    step: WorkflowStep,
    context: DecisionContext,
    previousResults: Record<string, any>
  ): Promise<AgentStep> {
    let lastError: Error | null = null;
    
    // Try executing the tool call
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.executeToolCall(step, context, previousResults);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Create failed step for state tracking
        const failedStep: AgentStep = {
          toolName: step.toolCall?.tool || 'unknown',
          toolServer: step.toolCall?.server || 'unknown',
          input: step.toolCall?.input || {},
          output: null,
          timestamp: new Date(),
          success: false,
          error: lastError.message
        };

        // Check if we should retry
        const retryDecision = await agentStateManager.handleToolError(
          executionId, 
          failedStep, 
          lastError
        );

        if (!retryDecision.shouldRetry || attempt === 3) {
          return failedStep;
        }

        // Wait before retry
        if (retryDecision.retryDelay) {
          await new Promise(resolve => setTimeout(resolve, retryDecision.retryDelay));
        }
      }
    }

    // This should never be reached, but just in case
    throw lastError || new Error('Tool execution failed after retries');
  }

  /**
   * Get execution steps from state manager
   */
  private async getExecutionSteps(executionId: string): Promise<AgentStep[]> {
    const state = agentStateManager.getExecutionState(executionId);
    return state ? state.steps : [];
  }

  /**
   * Execute a single tool call
   */
  private async executeToolCall(
    step: WorkflowStep,
    context: DecisionContext,
    previousResults: Record<string, any>
  ): Promise<AgentStep> {
    const startTime = new Date();
    
    try {
      if (!step.toolCall) {
        throw new Error('No tool call defined for step');
      }

      // Find the tool
      const toolKey = `${step.toolCall.server}_${step.toolCall.tool}`;
      const tool = this.tools.get(toolKey);
      
      if (!tool) {
        throw new Error(`Tool not found: ${toolKey}`);
      }

      // Prepare input (may reference previous results)
      const input = this.prepareToolInput(step.toolCall.input, previousResults);

      // Execute the tool directly (since we have the MCP tool, not LangChain tool)
      const output = await tool.handler(input);

      return {
        toolName: step.toolCall.tool,
        toolServer: step.toolCall.server,
        input,
        output,
        timestamp: startTime,
        success: true
      };

    } catch (error) {
      return {
        toolName: step.toolCall?.tool || 'unknown',
        toolServer: step.toolCall?.server || 'unknown',
        input: step.toolCall?.input || {},
        output: null,
        timestamp: startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create streamlined workflow for immediate completion
   */
  private async createImmediateCompletionWorkflow(context: DecisionContext): Promise<WorkflowStep[]> {
    const { interpretation } = context;
    
    switch (interpretation.intent) {
      case 'email':
        return [{
          id: 'send_email_immediate',
          type: 'tool_call',
          description: 'Send email immediately',
          toolCall: {
            server: 'email',
            tool: 'send_email',
            input: {
              to: interpretation.parameters.recipientEmail,
              subject: interpretation.parameters.subject || 'Message from Faxi',
              body: interpretation.parameters.body || '',
              userId: context.userId
            }
          }
        }];
      
      case 'shopping':
        return await this.createShoppingWorkflow(context);
      
      case 'ai_chat':
        return [{
          id: 'chat_immediate',
          type: 'tool_call',
          description: 'Process AI chat immediately',
          toolCall: {
            server: 'ai_chat',
            tool: 'chat',
            input: {
              message: interpretation.parameters.question,
              userId: context.userId
            }
          }
        }];
      
      case 'contact_management':
        return await this.createContactManagementWorkflow(context);

      case 'blocklist_management':
        // Handle block/unblock requests
        const action = interpretation.parameters.blocklistAction;
        const targetEmail = interpretation.parameters.targetEmail;
        const targetName = interpretation.parameters.targetName;

        if (!action || (!targetEmail && !targetName)) {
          // Missing required parameters - need clarification
          return [];
        }
        
        return [{
          id: 'blocklist_action',
          type: 'custom',
          description: `${action === 'block' ? 'Block' : 'Unblock'} email sender`,
          handler: async () => {
            const { blocklistService } = await import('./blocklistService');
            const { addressBookRepository } = await import('../repositories/addressBookRepository');
            const { FaxGenerator } = await import('./faxGenerator');
            const { FaxTemplateEngine } = await import('./faxTemplateEngine');
            const { faxSenderService } = await import('./faxSenderService');
            const { userRepository } = await import('../repositories/userRepository');
            
            let emailToProcess = targetEmail;
            
            // If target is a name, look it up in address book
            if (!emailToProcess && targetName) {
              const contacts = await addressBookRepository.searchByNameOrRelationship(
                context.userId,
                targetName
              );
              
              if (contacts.length === 0) {
                // No contact found - send error fax
                return {
                  success: false,
                  error: 'Contact not found',
                  requiresClarification: true
                };
              } else if (contacts.length > 1) {
                // Multiple contacts found - send clarification fax
                return {
                  success: false,
                  error: 'Multiple contacts found',
                  requiresClarification: true,
                  contacts
                };
              }
              
              emailToProcess = contacts[0].emailAddress;
            }
            
            // Perform block/unblock action
            if (action === 'block') {
              await blocklistService.blockSender(context.userId, emailToProcess!);
            } else {
              await blocklistService.unblockSender(context.userId, emailToProcess!);
            }
            
            // Log the action (confirmation fax generation would be handled by the response generator)
            const confirmationText = action === 'block'
              ? `Email address ${emailToProcess} has been blocked. You will no longer receive emails from this sender.`
              : `Email address ${emailToProcess} has been unblocked. You will now receive emails from this sender.`;
            
            console.log('Blocklist action completed:', {
              userId: context.userId,
              action,
              email: emailToProcess,
              confirmationText
            });
            
            return {
              success: true,
              action,
              email: emailToProcess
            };
          }
        }];
      
      default:
        return [];
    }
  }

  /**
   * Create shopping workflow based on sub-intent
   * Handles: product_search, product_selection, order_status
   */
  private async createShoppingWorkflow(context: DecisionContext): Promise<WorkflowStep[]> {
    const { interpretation } = context;
    const subIntent = interpretation.parameters.shoppingSubIntent;
    
    console.log('[MCP Agent] Creating shopping workflow:', {
      subIntent,
      parameters: interpretation.parameters
    });

    switch (subIntent) {
      case 'product_search':
        // Check if we have multiple product queries (multi-product request)
        const productQueries = interpretation.parameters.productQueries;

        if (productQueries && productQueries.length > 1) {
          // Multi-product search - use parallel search tool
          console.log('[MCP Agent] Multi-product search detected:', productQueries);
          return [{
            id: 'search_multiple_products',
            type: 'tool_call',
            description: `Search for ${productQueries.length} products on Amazon`,
            toolCall: {
              server: 'shopping',
              tool: 'search_multiple_products',
              input: {
                queries: productQueries,
                filters: {
                  primeOnly: true,
                  minRating: 3.5,
                  priceMin: interpretation.parameters.priceRange?.min,
                  priceMax: interpretation.parameters.priceRange?.max
                },
                userId: context.userId
              }
            }
          }];
        }

        // Single product search - use standard tool
        return [{
          id: 'search_products',
          type: 'tool_call',
          description: 'Search for products on Amazon',
          toolCall: {
            server: 'shopping',
            tool: 'search_products',
            input: {
              query: interpretation.parameters.productQuery || (productQueries && productQueries[0]),
              filters: {
                primeOnly: true,
                minRating: 3.5,
                priceMin: interpretation.parameters.priceRange?.min,
                priceMax: interpretation.parameters.priceRange?.max
              },
              userId: context.userId
            }
          }
        }];
      
      case 'product_selection':
        // User selected a product - create order
        return await this.createProductSelectionWorkflow(context);
      
      case 'order_status':
        // Check order status
        return [{
          id: 'get_order_status',
          type: 'tool_call',
          description: 'Get order status',
          toolCall: {
            server: 'shopping',
            tool: 'get_order_status',
            input: {
              referenceId: interpretation.parameters.referenceId,
              userId: context.userId
            }
          }
        }];
      
      default:
        // Generic shopping - treat as product search
        return [{
          id: 'search_products',
          type: 'tool_call',
          description: 'Search for products on Amazon',
          toolCall: {
            server: 'shopping',
            tool: 'search_products',
            input: {
              query: interpretation.parameters.productQuery || 'general products',
              filters: {
                primeOnly: true,
                minRating: 3.5
              },
              userId: context.userId
            }
          }
        }];
    }
  }

  /**
   * Create workflow for product selection
   * Retrieves shopping context and creates orders for ALL selected products
   */
  private async createProductSelectionWorkflow(context: DecisionContext): Promise<WorkflowStep[]> {
    const { conversationContextRepository } = await import('../repositories/conversationContextRepository');

    // Find recent shopping context
    const recentContexts = await conversationContextRepository.findRecentByUser(context.userId, 7);
    const shoppingContext = recentContexts.find(ctx => ctx.contextType === 'shopping');

    if (!shoppingContext) {
      console.log('[MCP Agent] No shopping context found for product selection');
      return [];
    }

    const contextData = shoppingContext.contextData;
    const selectedMarkers = context.interpretation.parameters.selectedProductIds || [];

    console.log('[MCP Agent] Found shopping context:', {
      referenceId: shoppingContext.referenceId,
      selectedMarkers,
      isMultiProductSearch: contextData.isMultiProductSearch,
      availableProducts: contextData.searchResults?.length || contextData.groupedSearchResults?.length
    });

    // Map selection markers to ASINs - handle both single and multi-product search results
    let selectedProducts: string[] = [];

    if (contextData.isMultiProductSearch && contextData.groupedSearchResults) {
      // Multi-product search - look through all grouped results
      for (const group of contextData.groupedSearchResults) {
        for (const product of group.products) {
          if (selectedMarkers.includes(product.selectionMarker)) {
            selectedProducts.push(product.asin);
          }
        }
      }
    } else if (contextData.searchResults) {
      // Single product search - standard lookup
      selectedProducts = selectedMarkers
        .map((marker: string) => {
          const product = contextData.searchResults?.find((p: any) => p.selectionMarker === marker);
          return product ? product.asin : null;
        })
        .filter((asin: string | null): asin is string => asin !== null);
    }

    if (selectedProducts.length === 0) {
      console.log('[MCP Agent] No valid products found for selection markers');
      return [];
    }

    console.log('[MCP Agent] Creating orders for products:', selectedProducts);

    // Create order workflow steps for ALL selected products
    const orderSteps: WorkflowStep[] = selectedProducts.map((asin, index) => ({
      id: `create_order_${index}`,
      type: 'tool_call' as const,
      description: `Create order for selected product ${index + 1}`,
      toolCall: {
        server: 'shopping',
        tool: 'create_order',
        input: {
          userId: context.userId,
          productAsin: asin,
          quantity: context.interpretation.parameters.quantity || 1,
          referenceId: shoppingContext.referenceId
        }
      }
    }));

    return orderSteps;
  }

  /**
   * Create workflow for contact management
   * Handles: add, update, delete, list contacts
   */
  private async createContactManagementWorkflow(context: DecisionContext): Promise<WorkflowStep[]> {
    const { interpretation } = context;
    const contactAction = interpretation.parameters.contactAction;

    console.log('[MCP Agent] Creating contact management workflow:', {
      action: contactAction,
      parameters: interpretation.parameters
    });

    switch (contactAction) {
      case 'add':
        // Add new contact
        return [{
          id: 'add_contact',
          type: 'tool_call',
          description: 'Add new contact to address book',
          toolCall: {
            server: 'user_profile',
            tool: 'add_contact',
            input: {
              userId: context.userId,
              name: interpretation.parameters.newName,
              email: interpretation.parameters.email,
              relationship: interpretation.parameters.note
            }
          }
        }];

      case 'update':
        // Update existing contact
        return [{
          id: 'update_contact',
          type: 'tool_call',
          description: 'Update contact in address book',
          toolCall: {
            server: 'user_profile',
            tool: 'update_contact',
            input: {
              userId: context.userId,
              currentName: interpretation.parameters.currentName,
              name: interpretation.parameters.newName,
              email: interpretation.parameters.email,
              relationship: interpretation.parameters.note
            }
          }
        }];

      case 'delete':
        // Delete contact
        return [{
          id: 'delete_contact',
          type: 'tool_call',
          description: 'Delete contact from address book',
          toolCall: {
            server: 'user_profile',
            tool: 'delete_contact',
            input: {
              userId: context.userId,
              currentName: interpretation.parameters.currentName
            }
          }
        }];

      case 'list':
        // List all contacts
        return [{
          id: 'list_contacts',
          type: 'tool_call',
          description: 'Get address book contacts',
          toolCall: {
            server: 'user_profile',
            tool: 'get_address_book',
            input: {
              userId: context.userId
            }
          }
        }];

      default:
        console.log('[MCP Agent] Unknown contact action:', contactAction);
        return [];
    }
  }

  /**
   * Prepare tool input by resolving references to previous results
   */
  private prepareToolInput(input: any, previousResults: Record<string, any>): any {
    // Simple implementation - could be enhanced to support complex references
    return input;
  }

  /**
   * Determine if workflow requires user input
   */
  private workflowRequiresUserInput(workflow: WorkflowStep[], results: Record<string, any>): boolean {
    // Check if any step failed or if we need user selection
    return Object.values(results).some(result => 
      result && typeof result === 'object' && result.requiresUserSelection
    );
  }

  /**
   * Determine next action based on workflow results
   */
  private determineNextAction(workflow: WorkflowStep[], results: Record<string, any>): string | undefined {
    // Implementation would analyze results to determine what happens next
    return undefined;
  }

  /**
   * Generate fax template based on workflow results
   */
  private async generateFaxTemplate(result: WorkflowResult, request: AgentRequest): Promise<FaxTemplate> {
    const referenceId = result.finalOutput?.referenceId || `FX-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    console.log('[MCP Agent] generateFaxTemplate:', {
      intent: request.interpretation.intent,
      hasFinalOutput: !!result.finalOutput,
      finalOutputKeys: result.finalOutput ? Object.keys(result.finalOutput) : [],
      hasProducts: !!result.finalOutput?.products,
      productCount: result.finalOutput?.products?.length,
      hasGroupedResults: !!result.finalOutput?.groupedResults,
      referenceId
    });

    // For shopping responses, use product_selection template
    if (request.interpretation.intent === 'shopping') {
      // Handle multi-product search (grouped results)
      if (result.finalOutput?.groupedResults) {
        return {
          type: 'product_selection',
          referenceId,
          contextData: {
            groupedResults: result.finalOutput.groupedResults
          },
          pages: [] // Will be generated by ProductSelectionFaxGenerator
        };
      }
      
      // Handle single product search
      if (result.finalOutput?.products) {
        const searchQuery = result.finalOutput.query || request.interpretation.parameters.productQuery || '';
        
        console.log('[MCP Agent] Generating product selection fax template:', {
          hasQuery: !!result.finalOutput.query,
          queryValue: result.finalOutput.query,
          hasProductQuery: !!request.interpretation.parameters.productQuery,
          productQueryValue: request.interpretation.parameters.productQuery,
          finalSearchQuery: searchQuery,
          productCount: result.finalOutput.products.length
        });
        
        return {
          type: 'product_selection',
          referenceId,
          contextData: {
            products: result.finalOutput.products,
            searchQuery
          },
          pages: [] // Will be generated by ProductSelectionFaxGenerator
        };
      }
    }

    // For contact management responses, use confirmation template
    if (request.interpretation.intent === 'contact_management' && result.finalOutput) {
      const contactOutput = result.finalOutput;
      const action = request.interpretation.parameters.contactAction;

      let responseText = '';
      if (action === 'list') {
        // Format contact list
        const contacts = contactOutput.contacts || [];
        if (contacts.length === 0) {
          responseText = 'Your address book is empty.\n\nTo add a contact, fax:\n"Add contact: [Name], [Email], [Note]"';
        } else {
          responseText = `Your Contact List (${contacts.length} contacts):\n\n`;
          contacts.forEach((contact: any, index: number) => {
            const note = contact.relationship ? ` (${contact.relationship})` : '';
            responseText += `${index + 1}. ${contact.name}${note}\n   Email: ${contact.email}\n\n`;
          });
          responseText += '\nTo update a contact, fax:\n"Update contact [name] name to [new name]. Note: [note]"';
        }
      } else if (action === 'add') {
        const name = contactOutput.contact?.name || request.interpretation.parameters.newName;
        responseText = `Contact added successfully!\n\nName: ${name}\nEmail: ${contactOutput.contact?.email || request.interpretation.parameters.email}`;
        if (contactOutput.contact?.relationship) {
          responseText += `\nNote: ${contactOutput.contact.relationship}`;
        }
      } else if (action === 'update') {
        const name = contactOutput.contact?.name || request.interpretation.parameters.newName;
        responseText = `Contact updated successfully!\n\nName: ${name}`;
        if (contactOutput.contact?.email) {
          responseText += `\nEmail: ${contactOutput.contact.email}`;
        }
        if (contactOutput.contact?.relationship) {
          responseText += `\nNote: ${contactOutput.contact.relationship}`;
        }
      } else if (action === 'delete') {
        responseText = contactOutput.message || 'Contact deleted successfully.';
      }

      return {
        type: 'confirmation',
        referenceId,
        contextData: {
          type: 'contact_management',
          actionType: action,
          description: `Contact ${action} completed`,
          result: responseText
        },
        pages: [{
          content: [{
            type: 'text',
            text: responseText,
            fontSize: 12
          }],
          pageNumber: 1,
          totalPages: 1
        }]
      };
    }

    // For AI chat responses, use email_reply template type
    if (request.interpretation.intent === 'ai_chat' && result.finalOutput) {
      const chatOutput = result.finalOutput;
      
      return {
        type: 'email_reply',
        referenceId,
        contextData: {
          subject: 'Response from Faxi',
          body: chatOutput.response || chatOutput.message || 'Your request has been processed.',
          from: 'Faxi Support',
          to: 'You',
          hasQuickReplies: false,
          quickReplies: [], // Explicitly set to empty to prevent auto-detection
          conversationId: chatOutput.conversationId,
          messageCount: chatOutput.messageCount || 1
        },
        pages: [] // Will be generated by EmailFaxGenerator
      };
    }

    // For other intents, use confirmation template
    let responseText = 'Your request has been processed.';
    if (result.finalOutput) {
      responseText = result.finalOutput.response || result.finalOutput.message || responseText;
    }

    return {
      type: 'confirmation',
      referenceId,
      contextData: {
        type: 'general',
        actionType: request.interpretation.intent,
        description: `Processed your ${request.interpretation.intent} request`,
        result: responseText,
        nextSteps: []
      },
      pages: [{
        content: [{
          type: 'text',
          text: responseText,
          fontSize: 12
        }],
        pageNumber: 1,
        totalPages: 1
      }]
    };
  }

  /**
   * Determine response type based on workflow results
   */
  private determineResponseType(result: WorkflowResult): AgentResponse['responseType'] {
    if (!result.success) return 'clarification';
    if (result.requiresUserInput) return 'selection_required';
    return 'completion';
  }

  /**
   * Determine if reply should auto-execute
   */
  private shouldAutoExecuteOnReply(result: WorkflowResult): boolean {
    return result.requiresUserInput && result.nextAction !== undefined;
  }

  /**
   * Generate user message
   */
  private generateUserMessage(result: WorkflowResult): string {
    if (!result.success) {
      return 'I encountered an issue processing your request. Please try again or contact support.';
    }
    
    if (result.requiresUserInput) {
      return 'Please make your selections and fax back to complete your request.';
    }
    
    return 'Your request has been completed successfully.';
  }

  /**
   * Create error response
   */
  private createErrorResponse(error: any, request: AgentRequest, steps: AgentStep[]): AgentResponse {
    const referenceId = `FX-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    return {
      success: false,
      steps,
      finalResult: null,
      responseType: 'clarification',
      faxTemplate: {
        type: 'clarification',
        referenceId,
        pages: [{
          content: [{
            type: 'text',
            text: 'I encountered an error processing your request. Please try again or contact support.',
            fontSize: 12
          }],
          pageNumber: 1,
          totalPages: 1
        }],
        contextData: { error: error.message }
      },
      userMessage: 'An error occurred while processing your request.'
    };
  }

  /**
   * Create the system prompt emphasizing round-trip minimization
   */
  private createSystemPrompt(): string {
    return `
You are the MCP Controller Agent for Faxi, a fax-to-internet bridge service. Your primary goal is to minimize round-trips by completing user requests in as few fax exchanges as possible.

CORE PRINCIPLES:
1. **Minimize Round-Trips**: Every fax costs money and time. Design for single-fax completion whenever possible.
2. **Be Proactive**: Anticipate next steps and include them in responses (payment options, complementary items, etc.)
3. **Bundle Actions**: If user requests multiple things, handle them all in one response.
4. **Include Context**: Always include reference IDs and actionable elements in responses.
5. **Assume Intent**: Make reasonable assumptions to avoid asking obvious questions.

DECISION FRAMEWORK:
1. **Can we complete immediately?** 
   - User has payment method + clear intent → Execute and confirm
   - Email with clear recipient → Send immediately
   - Simple question → Answer directly

2. **Do we need user selection?**
   - Multiple options → Send ALL options with payment methods included
   - Include suggested add-ons as optional checkboxes
   - Make forms actionable: circle + fax back = done

3. **Bundle multiple requests**
   - Create multi-page forms handling all requests
   - Single fax back completes all actions

4. **Proactive suggestions**
   - Include complementary items (batteries with flashlight)
   - Show bundle deals and savings
   - Limit to 2-3 suggestions to avoid overwhelming

AVAILABLE MCP TOOLS:
- Email: send_email, get_email_thread, search_emails
- Shopping: search_products, get_product_details, add_to_cart, get_cart, update_cart_item, remove_from_cart, checkout, get_complementary_products, get_bundle_deals
- Payment: get_payment_methods, register_payment_method, process_payment, generate_konbini_barcode, check_payment_status
- AI Chat: chat (has Google Search grounding for real-time info), get_conversation, summarize_conversation
- User Profile: get_user_profile, update_delivery_address, get_address_book, add_contact, update_contact, delete_contact, lookup_contact, get_order_history, track_order

Always log your reasoning and tool calls for audit purposes.
`;
  }
}

// Export singleton instance
export const mcpControllerAgent = new MCPControllerAgent();