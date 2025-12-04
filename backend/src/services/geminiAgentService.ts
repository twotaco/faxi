/**
 * Gemini Agent Service
 *
 * Orchestrates MCP tool calls using Gemini as a PLANNER.
 *
 * Architecture (Google ADK Pattern):
 * 1. User request → Gemini Planner creates ExecutionPlan
 * 2. ExecutionPlan → MCP Controller Agent executes workflow
 * 3. Results aggregated → Response generated
 *
 * This enables:
 * - Multiple tool calls per request
 * - Dependencies between steps
 * - Conditional execution (if X then Y)
 * - Parallel execution of independent steps
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { loggingService } from './loggingService';
import { mcpControllerAgent } from './mcpControllerAgent';
import { userRepository } from '../repositories/userRepository';
import {
  toolToServerMap,
  toolNameMap,
  ExecutionPlan,
  ExecutionStep,
  StepCondition,
  PLANNER_SYSTEM_INSTRUCTION,
  plannerResponseSchema
} from './geminiToolDefinitions';
import type { VisualAnnotation } from '../types/vision';

export interface AgentProcessResult {
  success: boolean;
  needsClarification: boolean;
  clarificationFax?: string;
  toolCalls: ToolCallResult[];
  aggregatedResponse?: string;
  error?: string;
  /** The execution plan that was created */
  plan?: ExecutionPlan;
}

export interface ToolCallResult {
  toolName: string;
  serverName: string;
  parameters: Record<string, any>;
  result: any;
  success: boolean;
  error?: string;
  /** Whether this step was skipped due to condition not being met */
  skipped?: boolean;
  /** The step ID from the execution plan */
  stepId?: string;
}

class GeminiAgentService {
  private genAI: GoogleGenerativeAI;
  private plannerModel: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);

    // Planner model - creates execution plans
    // Note: Using JSON mode without strict schema for better compatibility
    this.plannerModel = this.genAI.getGenerativeModel({
      model: config.gemini.model,
      systemInstruction: PLANNER_SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });
  }

  /**
   * Process a fax request using the Planner pattern
   *
   * Flow:
   * 1. Gemini analyzes request and creates ExecutionPlan
   * 2. Plan is executed by MCP Controller Agent
   * 3. Results are aggregated into final response
   */
  async processRequest(
    ocrText: string,
    visualAnnotations: VisualAnnotation[] = [],
    userId: string
  ): Promise<AgentProcessResult> {
    try {
      loggingService.info('Gemini Agent processing request (Planner Mode)', {
        textLength: ocrText.length,
        annotationCount: visualAnnotations.length
      });

      // Fetch user info for personalization
      const user = await userRepository.findById(userId);
      const userName = user?.name || 'User';

      // Build context from annotations if present
      let contextText = ocrText;
      if (visualAnnotations.length > 0) {
        const annotationSummary = visualAnnotations
          .filter(a => a.confidence > 0.5)
          .map(a => `${a.type}: "${a.associatedText || 'unknown'}"`)
          .join(', ');
        if (annotationSummary) {
          contextText += `\n\n[Visual annotations detected: ${annotationSummary}]`;
        }
      }

      // Step 1: Create execution plan using Gemini Planner
      const plan = await this.createExecutionPlan(contextText, userName);

      if (!plan || !plan.steps || plan.steps.length === 0) {
        loggingService.warn('Planner returned empty plan - requesting clarification');
        return this.createClarificationResponse('ご依頼の内容を確認させてください。');
      }

      loggingService.info('Execution plan created', {
        stepCount: plan.steps.length,
        summary: plan.summary,
        steps: plan.steps.map(s => ({ id: s.id, tool: s.tool, hasDeps: !!s.dependsOn?.length, hasCondition: !!s.condition }))
      });

      // Step 2: Execute the plan
      const toolCallResults = await this.executePlan(plan, userId);

      // Step 3: Check results and aggregate response
      const successfulResults = toolCallResults.filter(r => r.success && !r.skipped);
      const failedResults = toolCallResults.filter(r => !r.success && !r.skipped);
      const skippedResults = toolCallResults.filter(r => r.skipped);

      loggingService.info('Plan execution complete', {
        total: toolCallResults.length,
        successful: successfulResults.length,
        failed: failedResults.length,
        skipped: skippedResults.length
      });

      // If all non-skipped steps failed, return error
      const nonSkippedResults = toolCallResults.filter(r => !r.skipped);
      if (nonSkippedResults.length > 0 && nonSkippedResults.every(r => !r.success)) {
        return {
          success: false,
          needsClarification: false,
          toolCalls: toolCallResults,
          plan,
          error: 'All tool calls failed'
        };
      }

      return {
        success: true,
        needsClarification: false,
        toolCalls: toolCallResults,
        plan,
        aggregatedResponse: this.aggregateResponses(toolCallResults, plan)
      };

    } catch (error: any) {
      loggingService.error('Gemini Agent failed', error);
      return {
        success: false,
        needsClarification: true,
        toolCalls: [],
        clarificationFax: this.generateClarificationFax(
          'システムエラーが発生しました。もう一度お試しください。',
          []
        ),
        error: error.message
      };
    }
  }

  /**
   * Create an execution plan using Gemini
   */
  private async createExecutionPlan(userRequest: string, userName: string = 'User'): Promise<ExecutionPlan | null> {
    try {
      loggingService.info('Creating execution plan', { requestPreview: userRequest.substring(0, 200) });

      // Add user context to the request
      const contextualRequest = `[SENDER INFO: The user's name is "${userName}". Use this name when signing emails or messages on their behalf.]

${userRequest}`;

      const result = await this.plannerModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: contextualRequest }] }]
      });

      const response = result.response;
      const text = response.text();

      // Parse JSON response
      let parsed: { plan: ExecutionPlan };
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        console.error('[Planner] JSON parse error:', parseError, 'Response:', text.substring(0, 200));
        loggingService.error('Failed to parse planner response', parseError as Error, undefined, {
          responseText: text.substring(0, 500)
        });
        return null;
      }

      if (!parsed.plan || !parsed.plan.steps) {
        console.error('[Planner] Invalid plan structure - missing plan or steps');
        loggingService.warn('Invalid plan structure', { parsed });
        return null;
      }

      // Validate steps have required fields
      const validSteps = parsed.plan.steps.filter(step =>
        step.id && step.tool && step.params
      );

      if (validSteps.length === 0) {
        console.error('[Planner] No valid steps in plan');
        loggingService.warn('No valid steps in plan');
        return null;
      }

      loggingService.info('Execution plan created', {
        stepCount: validSteps.length,
        steps: validSteps.map(s => ({ id: s.id, tool: s.tool, hasDeps: !!s.dependsOn, hasCondition: !!s.condition })),
        summary: parsed.plan.summary
      });

      return {
        steps: validSteps,
        summary: parsed.plan.summary
      };

    } catch (error: any) {
      console.error('=== PLANNER ERROR ===');
      console.error('Error:', error.message);
      console.error('Stack:', error.stack?.substring(0, 500));
      loggingService.error('Failed to create execution plan', error);
      return null;
    }
  }

  /**
   * Execute an execution plan with dependency and condition handling
   */
  private async executePlan(plan: ExecutionPlan, userId: string): Promise<ToolCallResult[]> {
    const results: ToolCallResult[] = [];
    const stepResults: Map<string, any> = new Map();

    // Topologically sort steps based on dependencies
    const sortedSteps = this.topologicalSort(plan.steps);

    for (const step of sortedSteps) {
      loggingService.info('Executing step', { stepId: step.id, tool: step.tool });

      // Check dependencies are satisfied
      if (step.dependsOn && step.dependsOn.length > 0) {
        const unmetDeps = step.dependsOn.filter(depId => !stepResults.has(depId));
        if (unmetDeps.length > 0) {
          loggingService.warn('Skipping step due to unmet dependencies', {
            stepId: step.id,
            unmetDeps
          });
          results.push({
            stepId: step.id,
            toolName: step.tool,
            serverName: toolToServerMap[step.tool] || 'unknown',
            parameters: step.params,
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
          loggingService.info('Skipping step due to condition not met', {
            stepId: step.id,
            condition: step.condition
          });
          results.push({
            stepId: step.id,
            toolName: step.tool,
            serverName: toolToServerMap[step.tool] || 'unknown',
            parameters: step.params,
            result: null,
            success: true, // Condition skip is not a failure
            skipped: true
          });
          continue;
        }
      }

      // Execute the step
      const result = await this.executeStep(step, userId, stepResults);
      results.push(result);

      // Store result for dependent steps
      if (result.success) {
        stepResults.set(step.id, result.result);
      }
    }

    return results;
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: ExecutionStep,
    userId: string,
    previousResults: Map<string, any>
  ): Promise<ToolCallResult> {
    const serverName = toolToServerMap[step.tool];
    const mcpToolName = toolNameMap[step.tool];

    if (!serverName || !mcpToolName) {
      loggingService.error('Unknown tool mapping', new Error(`Unknown tool: ${step.tool}`));
      return {
        stepId: step.id,
        toolName: step.tool,
        serverName: 'unknown',
        parameters: step.params,
        result: null,
        success: false,
        error: `Unknown tool: ${step.tool}`
      };
    }

    try {
      // Map parameters to MCP format
      const mcpParams = this.mapParamsToMcp(serverName, mcpToolName, { ...step.params, userId });

      // Execute via MCP Controller Agent
      const mcpResult = await mcpControllerAgent.executeTool(serverName, mcpToolName, mcpParams);

      loggingService.info('Step execution result', {
        stepId: step.id,
        tool: step.tool,
        hasResult: !!mcpResult,
        success: mcpResult?.success !== false,
        error: mcpResult?.error || null,
        result: mcpResult
      });

      const isSuccess = mcpResult && mcpResult.success !== false;

      return {
        stepId: step.id,
        toolName: step.tool,
        serverName,
        parameters: step.params,
        result: mcpResult,
        success: isSuccess
      };

    } catch (error: any) {
      loggingService.error('Step execution failed', error, undefined, {
        stepId: step.id,
        tool: step.tool
      });

      return {
        stepId: step.id,
        toolName: step.tool,
        serverName,
        parameters: step.params,
        result: null,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Evaluate a step condition
   */
  private evaluateCondition(condition: StepCondition, stepResults: Map<string, any>): boolean {
    const dependentResult = stepResults.get(condition.step);

    if (!dependentResult) {
      loggingService.warn('Condition references non-existent step result', { condition });
      return false;
    }

    // Get the value to check - defaults to response text
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
        loggingService.warn('Unknown condition check type', { check: condition.check });
        return true; // Default to true for unknown checks
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

      default:
        return { userId, ...rest };
    }
  }

  /**
   * Create a clarification response
   */
  private createClarificationResponse(
    question: string,
    possibleIntents: string[] = []
  ): AgentProcessResult {
    return {
      success: false,
      needsClarification: true,
      toolCalls: [],
      clarificationFax: this.generateClarificationFax(question, possibleIntents)
    };
  }

  /**
   * Generate a clarification fax content
   */
  private generateClarificationFax(
    question: string,
    possibleIntents: string[]
  ): string {
    const defaultIntents = [
      '商品を探す (Shopping)',
      'メールを送る (Send Email)',
      '質問する (Ask a Question)',
      'その他 (Other)'
    ];

    const intents = possibleIntents.length > 0
      ? possibleIntents.map((intent, i) => `${i + 1}. ${intent}`)
      : defaultIntents.map((intent, i) => `${i + 1}. ${intent}`);

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ご確認のお願い / Clarification Needed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${question}

何をご希望ですか？
What would you like to do?

${intents.join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
番号に○をつけてFAXでご返信ください。
Circle your choice and fax back.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
  }

  /**
   * Aggregate multiple tool call results into a single response
   */
  private aggregateResponses(toolCalls: ToolCallResult[], plan: ExecutionPlan): string {
    const responses: string[] = [];

    for (const call of toolCalls) {
      // Skip failed or skipped calls
      if (!call.success || call.skipped) continue;

      // Find the step description for context
      const step = plan.steps.find(s => s.id === call.stepId);
      const stepDescription = step?.description || '';

      switch (call.serverName) {
        case 'shopping':
          if (call.result?.products?.length > 0) {
            const products = call.result.products.slice(0, 4);
            responses.push(this.formatShoppingResponse(products, call.result.referenceId));
          }
          break;

        case 'email':
          if (call.result?.success !== false) {
            const recipient = call.parameters.recipientName || call.parameters.recipientEmail || 'recipient';
            responses.push(`✓ メール送信完了 / Email sent to ${recipient}`);
          }
          break;

        case 'ai_chat':
          if (call.result?.response) {
            // For multiple AI chat responses, add a label if there are multiple
            const aiChatCalls = toolCalls.filter(c => c.serverName === 'ai_chat' && c.success && !c.skipped);
            if (aiChatCalls.length > 1 && stepDescription) {
              responses.push(`【${stepDescription}】\n${call.result.response}`);
            } else {
              responses.push(call.result.response);
            }
          }
          break;

        case 'payment':
          responses.push(`✓ 支払い処理完了 / Payment processed`);
          break;

        default:
          // Generic response for unknown server types
          if (call.result) {
            responses.push(`✓ ${stepDescription || call.toolName} completed`);
          }
      }
    }

    // Add summary of skipped conditional steps
    const skippedConditional = toolCalls.filter(c => c.skipped && !c.error);
    if (skippedConditional.length > 0) {
      const skippedDescs = skippedConditional
        .map(c => {
          const step = plan.steps.find(s => s.id === c.stepId);
          return step?.description || c.toolName;
        })
        .join(', ');
      responses.push(`\n※ 条件が満たされなかったため実行されませんでした: ${skippedDescs}`);
    }

    return responses.join('\n\n---\n\n');
  }

  /**
   * Format shopping results for fax response
   */
  private formatShoppingResponse(products: any[], referenceId?: string): string {
    console.log('\n=== PRODUCT DATA DEBUG ===');
    products.forEach((p, i) => {
      console.log(`Product ${i + 1}:`, {
        productName: p.productName,
        brand: p.brand,
        quantity: p.quantity,
        price: p.price,
        asin: p.asin,
        rating: p.rating,
        primeEligible: p.primeEligible,
        description: p.description?.substring(0, 50),
        allKeys: Object.keys(p)
      });
    });

    const productList = products.map((p: any, i: number) => {
      const brand = p.brand ? `【${p.brand}】` : '';
      const name = p.productName || p.title?.substring(0, 40) || 'Unknown';
      const qty = p.quantity ? ` ${p.quantity}` : '';
      const displayName = `${brand}${name}${qty}`;

      const price = p.price > 0 ? `¥${p.price.toLocaleString()}` : '価格確認中';
      const prime = p.primeEligible ? '✓Prime' : '';
      const rating = p.rating ? `${p.rating}★` : '';

      let entry = `${i + 1}. ${displayName}\n   ${price} ${prime} ${rating}`.trim();

      if (p.description) {
        entry += `\n   ${p.description}`;
      }

      return entry;
    }).join('\n\n');

    return `
商品検索結果 / Product Search Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${productList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ご希望の商品番号に○をつけてFAXでご返信ください。
Circle your choice and fax back.
${referenceId ? `\n参照番号 / Reference: ${referenceId}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
  }
}

// Export singleton instance
export const geminiAgentService = new GeminiAgentService();
