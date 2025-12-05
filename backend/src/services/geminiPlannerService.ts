/**
 * Gemini Planner Service
 *
 * Uses Gemini as an LLM planner to create execution plans from user requests.
 * Implements ADK-style multi-step workflow orchestration.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { loggingService } from './loggingService';
import {
  ExecutionPlan,
  ExecutionStep,
  PLANNER_SYSTEM_INSTRUCTION,
  RESPONSE_SYNTHESIZER_INSTRUCTION
} from './toolDefinitions';

export interface PlannerResult {
  success: boolean;
  plan: ExecutionPlan | null;
  error?: string;
}

export interface SynthesisResult {
  success: boolean;
  response: string;
  error?: string;
}

class GeminiPlannerService {
  private genAI: GoogleGenerativeAI;
  private plannerModel: any;
  private synthesizerModel: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);

    // Planner model - creates execution plans
    this.plannerModel = this.genAI.getGenerativeModel({
      model: config.gemini.model,
      systemInstruction: PLANNER_SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    // Synthesizer model - composes natural responses from tool results
    this.synthesizerModel = this.genAI.getGenerativeModel({
      model: config.gemini.model,
      systemInstruction: RESPONSE_SYNTHESIZER_INSTRUCTION
    });
  }

  /**
   * Create an execution plan from a user request
   */
  async createExecutionPlan(
    userRequest: string,
    userName: string = 'User'
  ): Promise<PlannerResult> {
    try {
      loggingService.info('Creating execution plan', {
        requestPreview: userRequest.substring(0, 200)
      });

      // Add user context to the request
      const contextualRequest = `[SENDER INFO: The user's name is "${userName}". Use this name when signing emails or messages on their behalf.]

${userRequest}`;

      console.log('\n=== GEMINI PLANNER REQUEST ===');
      console.log('User request:', userRequest.substring(0, 300));

      const result = await this.plannerModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: contextualRequest }] }]
      });

      const response = result.response;
      const text = response.text();

      console.log('=== GEMINI PLANNER RESPONSE ===');
      console.log('Raw response:', text.substring(0, 500));

      // Parse JSON response
      let parsed: { plan: ExecutionPlan };
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        console.error('[Planner] JSON parse error:', parseError);
        loggingService.error('Failed to parse planner response', parseError as Error, undefined, {
          responseText: text.substring(0, 500)
        });
        return {
          success: false,
          plan: null,
          error: 'Failed to parse planner response'
        };
      }

      if (!parsed.plan || !parsed.plan.steps) {
        console.error('[Planner] Invalid plan structure - missing plan or steps');
        loggingService.warn('Invalid plan structure', { parsed });
        return {
          success: false,
          plan: null,
          error: 'Invalid plan structure'
        };
      }

      // Validate steps have required fields
      const validSteps = parsed.plan.steps.filter(step =>
        step.id && step.tool && step.params
      );

      if (validSteps.length === 0) {
        console.error('[Planner] No valid steps in plan');
        loggingService.warn('No valid steps in plan');
        return {
          success: false,
          plan: null,
          error: 'No valid steps in plan'
        };
      }

      const plan: ExecutionPlan = {
        steps: validSteps,
        summary: parsed.plan.summary
      };

      console.log('=== EXECUTION PLAN CREATED ===');
      console.log('Steps:', JSON.stringify(plan.steps, null, 2));
      console.log('Summary:', plan.summary);

      loggingService.info('Execution plan created', {
        stepCount: validSteps.length,
        steps: validSteps.map(s => ({
          id: s.id,
          tool: s.tool,
          hasDeps: !!s.dependsOn,
          hasCondition: !!s.condition,
          hasOutputKey: !!s.outputKey
        })),
        summary: plan.summary
      });

      return {
        success: true,
        plan
      };

    } catch (error: any) {
      console.error('=== PLANNER ERROR ===');
      console.error('Error:', error.message);
      loggingService.error('Failed to create execution plan', error);
      return {
        success: false,
        plan: null,
        error: error.message
      };
    }
  }

  /**
   * Synthesize a natural response from tool execution results
   */
  async synthesizeResponse(
    originalRequest: string,
    toolResults: Array<{
      tool: string;
      description: string;
      params: Record<string, any>;
      result: any;
      success: boolean;
    }>,
    planSummary?: string
  ): Promise<SynthesisResult> {
    try {
      // Build a summary of what was done
      const toolSummaries = toolResults
        .filter(call => call.success)
        .map(call => ({
          tool: call.tool,
          description: call.description,
          params: call.params,
          result: call.result
        }));

      if (toolSummaries.length === 0) {
        return {
          success: false,
          response: '',
          error: 'No successful tool calls to synthesize'
        };
      }

      const prompt = `
USER'S ORIGINAL REQUEST:
${originalRequest}

ACTIONS COMPLETED:
${JSON.stringify(toolSummaries, null, 2)}

Based on the above, compose a friendly fax response to send back to the user. Tell them what you did and include relevant details (email content, product list, etc.). End with next steps if applicable.
`;

      console.log('\n=== SYNTHESIZING RESPONSE ===');

      const result = await this.synthesizerModel.generateContent(prompt);
      const response = result.response.text();

      console.log('Synthesized response:', response.substring(0, 300));

      return {
        success: true,
        response
      };

    } catch (error: any) {
      loggingService.error('Response synthesis failed', error);
      return {
        success: false,
        response: '',
        error: error.message
      };
    }
  }

  /**
   * Format step output for storage in shared state
   * Creates standardized output with 'formatted' text and raw data
   */
  formatStepOutput(tool: string, result: any): { formatted: string; [key: string]: any } {
    switch (tool) {
      case 'shopping_search_products': {
        const products = result?.products || [];
        return {
          formatted: products.length > 0
            ? products.map((p: any, i: number) =>
                `${i + 1}. ${p.productName || p.title || 'Unknown'} - ¥${p.price?.toLocaleString() || 'N/A'}`
              ).join('\n')
            : 'No products found',
          products,
          count: products.length,
          referenceId: result?.referenceId
        };
      }

      case 'user_profile_get_contacts': {
        const contacts = result?.contacts || [];
        return {
          formatted: contacts.length > 0
            ? contacts.map((c: any) =>
                `• ${c.name}${c.relationship ? ` (${c.relationship})` : ''}: ${c.email}`
              ).join('\n')
            : 'No contacts found',
          contacts,
          count: contacts.length
        };
      }

      case 'ai_chat_question':
        return {
          formatted: result?.response || '',
          response: result?.response
        };

      case 'email_send':
        return {
          formatted: result?.success ? 'Email sent successfully' : 'Failed to send email',
          success: result?.success,
          messageId: result?.messageId
        };

      case 'user_profile_lookup_contact': {
        const contacts = result?.contacts || [];
        if (contacts.length === 1) {
          const c = contacts[0];
          return {
            formatted: `${c.name}: ${c.email}`,
            contact: c,
            email: c.email,
            name: c.name
          };
        }
        return {
          formatted: contacts.map((c: any) => `${c.name}: ${c.email}`).join('\n'),
          contacts,
          count: contacts.length,
          // Also provide first contact's email for convenience
          email: contacts[0]?.email,
          name: contacts[0]?.name
        };
      }

      default:
        // Generic fallback
        if (typeof result === 'string') {
          return { formatted: result };
        }
        if (result?.message) {
          return { formatted: result.message, ...result };
        }
        if (result?.response) {
          return { formatted: result.response, ...result };
        }
        return {
          formatted: JSON.stringify(result, null, 2),
          ...result
        };
    }
  }
}

// Export singleton instance
export const geminiPlannerService = new GeminiPlannerService();
