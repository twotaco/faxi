import {
  AgentStep,
  WorkflowResult,
  MCPToolCall,
  AgentRequest
} from '../types/agent';
import { auditLogService } from './auditLogService';

/**
 * Agent State Manager - Handles state tracking, error recovery, and audit trails
 * 
 * This service manages the execution state of agent workflows, providing:
 * - Step-by-step execution tracking
 * - Intermediate result storage
 * - Error handling with retry logic
 * - Human-readable action summaries
 * - Audit trail generation
 */
export class AgentStateManager {
  private executionStates: Map<string, ExecutionState> = new Map();
  private retryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2
  };

  /**
   * Initialize execution state for a new agent request
   */
  async initializeExecution(request: AgentRequest): Promise<string> {
    const executionId = this.generateExecutionId(request);
    
    const state: ExecutionState = {
      executionId,
      faxJobId: request.faxJobId,
      userId: request.userId,
      intent: request.interpretation.intent,
      status: 'initialized',
      steps: [],
      intermediateResults: new Map(),
      errors: [],
      startTime: new Date(),
      lastUpdateTime: new Date(),
      retryCount: 0
    };

    this.executionStates.set(executionId, state);

    // Log initialization
    await auditLogService.logOperation({
      entityType: 'agent_execution',
      entityId: executionId,
      operation: 'execution_initialized',
      details: {
        faxJobId: request.faxJobId,
        userId: request.userId,
        intent: request.interpretation.intent,
        confidence: request.interpretation.confidence
      }
    });

    return executionId;
  }

  /**
   * Track a tool execution step
   */
  async trackStep(executionId: string, step: AgentStep): Promise<void> {
    const state = this.executionStates.get(executionId);
    if (!state) {
      throw new Error(`Execution state not found: ${executionId}`);
    }

    // Add step to execution history
    state.steps.push(step);
    state.lastUpdateTime = new Date();

    // Store intermediate results
    if (step.success && step.output) {
      state.intermediateResults.set(step.toolName, step.output);
    }

    // Track errors
    if (!step.success && step.error) {
      state.errors.push({
        stepId: state.steps.length - 1,
        toolName: step.toolName,
        error: step.error,
        timestamp: step.timestamp,
        retryAttempt: state.retryCount
      });
    }

    // Update execution status
    if (!step.success) {
      state.status = 'error';
    } else if (state.status === 'initialized') {
      state.status = 'running';
    }

    // Log step execution
    await auditLogService.logOperation({
      entityType: 'agent_step',
      entityId: executionId,
      operation: step.success ? 'step_completed' : 'step_failed',
      details: {
        stepIndex: state.steps.length - 1,
        toolName: step.toolName,
        toolServer: step.toolServer,
        success: step.success,
        error: step.error,
        executionTimeMs: Date.now() - step.timestamp.getTime()
      }
    });
  }

  /**
   * Get intermediate result from a previous step
   */
  getIntermediateResult(executionId: string, toolName: string): any {
    const state = this.executionStates.get(executionId);
    if (!state) {
      throw new Error(`Execution state not found: ${executionId}`);
    }

    return state.intermediateResults.get(toolName);
  }

  /**
   * Get all intermediate results for an execution
   */
  getAllIntermediateResults(executionId: string): Record<string, any> {
    const state = this.executionStates.get(executionId);
    if (!state) {
      throw new Error(`Execution state not found: ${executionId}`);
    }

    const results: Record<string, any> = {};
    for (const [key, value] of state.intermediateResults) {
      results[key] = value;
    }
    return results;
  }

  /**
   * Handle tool execution errors with retry logic
   */
  async handleToolError(
    executionId: string, 
    step: AgentStep, 
    originalError: Error
  ): Promise<{ shouldRetry: boolean; retryDelay?: number }> {
    const state = this.executionStates.get(executionId);
    if (!state) {
      throw new Error(`Execution state not found: ${executionId}`);
    }

    state.retryCount++;
    
    // Determine if we should retry
    const shouldRetry = this.shouldRetryError(originalError, state.retryCount);
    
    if (shouldRetry) {
      const retryDelay = this.calculateRetryDelay(state.retryCount);
      
      await auditLogService.logOperation({
        entityType: 'agent_retry',
        entityId: executionId,
        operation: 'retry_scheduled',
        details: {
          toolName: step.toolName,
          error: originalError.message,
          retryAttempt: state.retryCount,
          retryDelayMs: retryDelay
        }
      });

      return { shouldRetry: true, retryDelay };
    }

    // Max retries exceeded
    await auditLogService.logOperation({
      entityType: 'agent_retry',
      entityId: executionId,
      operation: 'retry_exhausted',
      details: {
        toolName: step.toolName,
        error: originalError.message,
        totalRetries: state.retryCount,
        maxRetries: this.retryConfig.maxRetries
      }
    });

    return { shouldRetry: false };
  }

  /**
   * Complete execution and generate summary
   */
  async completeExecution(executionId: string, result: WorkflowResult): Promise<ExecutionSummary> {
    const state = this.executionStates.get(executionId);
    if (!state) {
      throw new Error(`Execution state not found: ${executionId}`);
    }

    state.status = result.success ? 'completed' : 'failed';
    state.endTime = new Date();
    state.lastUpdateTime = new Date();

    const summary = this.generateExecutionSummary(state, result);

    // Log completion
    await auditLogService.logOperation({
      entityType: 'agent_execution',
      entityId: executionId,
      operation: 'execution_completed',
      details: {
        success: result.success,
        totalSteps: state.steps.length,
        successfulSteps: state.steps.filter(s => s.success).length,
        failedSteps: state.steps.filter(s => !s.success).length,
        totalRetries: state.retryCount,
        executionTimeMs: state.endTime.getTime() - state.startTime.getTime(),
        summary: summary.humanReadableSummary
      }
    });

    // Clean up state after a delay (keep for debugging)
    setTimeout(() => {
      this.executionStates.delete(executionId);
    }, 300000); // 5 minutes

    return summary;
  }

  /**
   * Generate human-readable action summary
   */
  generateActionSummary(steps: AgentStep[]): string {
    if (steps.length === 0) {
      return 'No actions were performed.';
    }

    const successfulSteps = steps.filter(s => s.success);
    const failedSteps = steps.filter(s => !s.success);

    let summary = '';

    // Summarize successful actions
    if (successfulSteps.length > 0) {
      const actionSummaries = successfulSteps.map(step => {
        return this.summarizeStep(step);
      }).filter(Boolean);

      if (actionSummaries.length > 0) {
        summary += 'Completed actions:\n';
        actionSummaries.forEach((action, index) => {
          summary += `${index + 1}. ${action}\n`;
        });
      }
    }

    // Summarize failed actions
    if (failedSteps.length > 0) {
      summary += failedSteps.length > 0 && successfulSteps.length > 0 ? '\n' : '';
      summary += 'Failed actions:\n';
      failedSteps.forEach((step, index) => {
        const action = this.summarizeStep(step);
        summary += `${index + 1}. ${action} (Error: ${step.error})\n`;
      });
    }

    return summary.trim();
  }

  /**
   * Get execution state for debugging
   */
  getExecutionState(executionId: string): ExecutionState | undefined {
    return this.executionStates.get(executionId);
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): ExecutionState[] {
    return Array.from(this.executionStates.values())
      .filter(state => state.status === 'running' || state.status === 'initialized');
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(request: AgentRequest): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `exec_${request.faxJobId}_${timestamp}_${random}`;
  }

  /**
   * Determine if an error should be retried
   */
  private shouldRetryError(error: Error, retryCount: number): boolean {
    if (retryCount >= this.retryConfig.maxRetries) {
      return false;
    }

    // Don't retry validation errors or authentication errors
    const nonRetryableErrors = [
      'validation',
      'authentication',
      'authorization',
      'not_found',
      'invalid_input'
    ];

    const errorMessage = error.message.toLowerCase();
    if (nonRetryableErrors.some(type => errorMessage.includes(type))) {
      return false;
    }

    // Retry network errors, timeouts, and server errors
    const retryableErrors = [
      'network',
      'timeout',
      'connection',
      'server error',
      'service unavailable',
      'rate limit'
    ];

    return retryableErrors.some(type => errorMessage.includes(type));
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = this.retryConfig.baseDelayMs * 
      Math.pow(this.retryConfig.backoffMultiplier, retryCount - 1);
    
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  /**
   * Generate execution summary
   */
  private generateExecutionSummary(state: ExecutionState, result: WorkflowResult): ExecutionSummary {
    const executionTime = state.endTime 
      ? state.endTime.getTime() - state.startTime.getTime()
      : Date.now() - state.startTime.getTime();

    return {
      executionId: state.executionId,
      success: result.success,
      totalSteps: state.steps.length,
      successfulSteps: state.steps.filter(s => s.success).length,
      failedSteps: state.steps.filter(s => !s.success).length,
      totalRetries: state.retryCount,
      executionTimeMs: executionTime,
      humanReadableSummary: this.generateActionSummary(state.steps),
      errors: state.errors,
      finalResult: result.finalOutput
    };
  }

  /**
   * Summarize a single step for human readability
   */
  private summarizeStep(step: AgentStep): string {
    const { toolName, toolServer, input, output, success } = step;

    switch (toolServer) {
      case 'email':
        return this.summarizeEmailStep(toolName, input, output, success);
      
      case 'shopping':
        return this.summarizeShoppingStep(toolName, input, output, success);
      
      case 'ai_chat':
        return this.summarizeAIChatStep(toolName, input, output, success);
      
      case 'payment':
        return this.summarizePaymentStep(toolName, input, output, success);
      
      default:
        return `${toolServer}.${toolName}`;
    }
  }

  /**
   * Summarize email-related steps
   */
  private summarizeEmailStep(toolName: string, input: any, output: any, success: boolean): string {
    switch (toolName) {
      case 'send_email':
        if (success && output?.messageId) {
          return `Sent email to ${input.to} with subject "${input.subject}"`;
        }
        return `Attempted to send email to ${input.to}`;
      
      case 'lookup_contact':
        if (success && output?.email) {
          return `Found email address for ${input.name}: ${output.email}`;
        }
        return `Looked up contact: ${input.name}`;
      
      default:
        return `Email operation: ${toolName}`;
    }
  }

  /**
   * Summarize shopping-related steps
   */
  private summarizeShoppingStep(toolName: string, input: any, output: any, success: boolean): string {
    switch (toolName) {
      case 'search_products':
        if (success && output?.products) {
          return `Found ${output.products.length} products for "${input.query}"`;
        }
        return `Searched for products: ${input.query}`;
      
      case 'checkout':
        if (success && output?.orderId) {
          return `Completed purchase - Order ID: ${output.orderId}`;
        }
        return `Attempted to complete purchase`;
      
      case 'add_to_cart':
        if (success) {
          return `Added ${input.productIds?.length || 1} items to cart`;
        }
        return `Attempted to add items to cart`;
      
      default:
        return `Shopping operation: ${toolName}`;
    }
  }

  /**
   * Summarize AI chat steps
   */
  private summarizeAIChatStep(toolName: string, input: any, output: any, success: boolean): string {
    switch (toolName) {
      case 'chat':
        if (success && output?.response) {
          const responsePreview = output.response.substring(0, 50) + 
            (output.response.length > 50 ? '...' : '');
          return `AI responded to question: "${responsePreview}"`;
        }
        return `Asked AI: ${input.message?.substring(0, 30)}...`;
      
      default:
        return `AI chat operation: ${toolName}`;
    }
  }

  /**
   * Summarize payment-related steps
   */
  private summarizePaymentStep(toolName: string, input: any, output: any, success: boolean): string {
    switch (toolName) {
      case 'process_payment':
        if (success && output?.transactionId) {
          return `Payment processed - Transaction ID: ${output.transactionId}`;
        }
        return `Attempted to process payment`;

      case 'initiate_bank_transfer':
        if (success && output?.transferDetails) {
          return `Bank transfer initiated`;
        }
        return `Attempted to initiate bank transfer`;

      default:
        return `Payment operation: ${toolName}`;
    }
  }
}

// Types for state management
interface ExecutionState {
  executionId: string;
  faxJobId: string;
  userId: string;
  intent: string;
  status: 'initialized' | 'running' | 'completed' | 'failed' | 'error';
  steps: AgentStep[];
  intermediateResults: Map<string, any>;
  errors: ExecutionError[];
  startTime: Date;
  endTime?: Date;
  lastUpdateTime: Date;
  retryCount: number;
}

interface ExecutionError {
  stepId: number;
  toolName: string;
  error: string;
  timestamp: Date;
  retryAttempt: number;
}

interface ExecutionSummary {
  executionId: string;
  success: boolean;
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  totalRetries: number;
  executionTimeMs: number;
  humanReadableSummary: string;
  errors: ExecutionError[];
  finalResult: any;
}

// Export singleton instance
export const agentStateManager = new AgentStateManager();