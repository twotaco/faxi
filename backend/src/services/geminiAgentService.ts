/**
 * Gemini Agent Service
 *
 * Orchestrates MCP tool calls using Gemini's native function calling capability.
 * Instead of regex-based intent extraction, Gemini intelligently:
 * 1. Analyzes the full OCR text for context
 * 2. Decides which tool(s) to call
 * 3. Extracts proper parameters automatically
 * 4. Returns confidence scores for clarification flow
 */

import { GoogleGenerativeAI, FunctionCallingMode } from '@google/generative-ai';
import { config } from '../config';
import { loggingService } from './loggingService';
import { mcpControllerAgent } from './mcpControllerAgent';
import {
  allGeminiTools,
  toolToServerMap,
  toolNameMap
} from './geminiToolDefinitions';
import type { VisualAnnotation } from '../types/vision';

export interface AgentProcessResult {
  success: boolean;
  needsClarification: boolean;
  clarificationFax?: string;
  toolCalls: ToolCallResult[];
  aggregatedResponse?: string;
  error?: string;
}

export interface ToolCallResult {
  toolName: string;
  serverName: string;
  parameters: Record<string, any>;
  result: any;
  success: boolean;
  error?: string;
}

const CONFIDENCE_THRESHOLD = 0.5;

const SYSTEM_INSTRUCTION = `You are Faxi, an AI assistant that helps elderly people in Japan interact with the internet through fax.

Your job is to interpret fax messages and call the appropriate tool to fulfill the user's request.

IMPORTANT GUIDELINES:
1. Extract the CORE request from the message - ignore fax headers, dates, and formatting
2. Be generous in interpretation - if someone says "I need shampoo", call shopping_search_products with query "shampoo"
3. For shopping requests, extract ONLY the product name as the query, not the entire message
4. For emails, extract the recipient (name or email) and the message content
5. For questions, extract the actual question being asked
6. If you're unsure what the user wants, call request_clarification

EXAMPLES:
- "FAX MESSAGE... I need shampoo" → shopping_search_products(query: "shampoo")
- "Send email to John about the meeting tomorrow" → email_send(recipientName: "John", body: "about the meeting tomorrow")
- "What's the weather in Tokyo?" → ai_chat_question(question: "What's the weather in Tokyo?")
- "Register my credit card" → payment_register(methodType: "credit_card")

Always call a tool - never respond with just text.`;

class GeminiAgentService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: config.gemini.model,
      systemInstruction: SYSTEM_INSTRUCTION,
    });
  }

  /**
   * Process a fax request using Gemini's native function calling
   */
  async processRequest(
    ocrText: string,
    visualAnnotations: VisualAnnotation[] = [],
    userId: string
  ): Promise<AgentProcessResult> {
    try {
      loggingService.info('Gemini Agent processing request', {
        textLength: ocrText.length,
        annotationCount: visualAnnotations.length
      });

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

      // Call Gemini with function calling enabled
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: contextText }] }],
        tools: [{ functionDeclarations: allGeminiTools }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingMode.AUTO
          }
        }
      });

      const response = result.response;
      const candidates = response.candidates;

      // DEBUG: Log the raw Gemini response
      console.log('\n=== GEMINI RESPONSE ===');
      console.log('Has candidates:', !!candidates);
      console.log('Candidate count:', candidates?.length || 0);
      console.log('Finish reason:', candidates?.[0]?.finishReason);
      console.log('Parts count:', candidates?.[0]?.content?.parts?.length || 0);
      const partTypes = candidates?.[0]?.content?.parts?.map((p: any) =>
        p.functionCall ? `functionCall:${p.functionCall.name}` : p.text ? 'text' : 'unknown'
      );
      console.log('Part types:', partTypes);

      loggingService.info('Gemini raw response', {
        hasCandidates: !!candidates,
        candidateCount: candidates?.length || 0,
        finishReason: candidates?.[0]?.finishReason,
        partsCount: candidates?.[0]?.content?.parts?.length || 0,
        partTypes
      });

      if (!candidates || candidates.length === 0) {
        loggingService.warn('Gemini returned no candidates');
        return this.createClarificationResponse('リクエストを理解できませんでした。');
      }

      const content = candidates[0].content;
      const parts = content.parts;

      // DEBUG: Log any text parts
      const textParts = parts.filter((p: any) => p.text);
      if (textParts.length > 0) {
        loggingService.info('Gemini returned text instead of function call', {
          textContent: textParts[0].text?.substring(0, 200)
        });
      }

      // Check for function calls
      const functionCalls = parts.filter((p: any) => p.functionCall);

      if (functionCalls.length === 0) {
        // No function call - Gemini wasn't confident enough
        loggingService.info('Gemini did not call any function - requesting clarification');
        return this.createClarificationResponse(
          'ご依頼の内容を確認させてください。',
          ['商品を探す', 'メールを送る', '質問する']
        );
      }

      // Process each function call
      const toolCallResults: ToolCallResult[] = [];

      for (const part of functionCalls) {
        const functionCall = part.functionCall;
        const toolName = functionCall.name;
        const args = functionCall.args || {};

        loggingService.info('Gemini called function', { toolName, args });

        // Check for clarification request
        if (toolName === 'request_clarification') {
          return this.createClarificationResponse(
            args.clarificationQuestion || 'ご依頼の内容を確認させてください。',
            args.possibleIntents || []
          );
        }

        // Map to MCP server and tool
        const serverName = toolToServerMap[toolName];
        const mcpToolName = toolNameMap[toolName];

        if (!serverName || !mcpToolName) {
          loggingService.error('Unknown tool mapping', new Error(`Unknown tool: ${toolName}`));
          continue;
        }

        // Execute the MCP tool
        try {
          const mcpResult = await this.executeMcpTool(
            serverName,
            mcpToolName,
            { ...args, userId }
          );

          loggingService.info('MCP tool result received', {
            toolName,
            serverName,
            hasResult: !!mcpResult,
            resultSuccess: mcpResult?.success,
            resultProductCount: mcpResult?.products?.length,
            resultKeys: mcpResult ? Object.keys(mcpResult) : []
          });

          const isSuccess = mcpResult && mcpResult.success !== false;

          toolCallResults.push({
            toolName,
            serverName,
            parameters: args,
            result: mcpResult,
            success: isSuccess
          });

          if (!isSuccess) {
            loggingService.warn('MCP tool call marked as failed', {
              toolName,
              mcpResultSuccess: mcpResult?.success,
              mcpResultError: mcpResult?.error
            });
          }
        } catch (error: any) {
          loggingService.error('MCP tool execution failed', error, undefined, {
            toolName,
            serverName
          });

          toolCallResults.push({
            toolName,
            serverName,
            parameters: args,
            result: null,
            success: false,
            error: error.message
          });
        }
      }

      // Check if all tools failed
      const allFailed = toolCallResults.every(r => !r.success);

      loggingService.info('Tool call results summary', {
        totalCalls: toolCallResults.length,
        successfulCalls: toolCallResults.filter(r => r.success).length,
        failedCalls: toolCallResults.filter(r => !r.success).length,
        allFailed
      });

      if (allFailed && toolCallResults.length > 0) {
        return {
          success: false,
          needsClarification: false,
          toolCalls: toolCallResults,
          error: 'All tool calls failed'
        };
      }

      return {
        success: true,
        needsClarification: false,
        toolCalls: toolCallResults,
        aggregatedResponse: this.aggregateResponses(toolCallResults)
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
   * Execute an MCP tool with the given parameters
   */
  private async executeMcpTool(
    serverName: string,
    toolName: string,
    params: Record<string, any>
  ): Promise<any> {
    loggingService.info('Executing MCP tool', { serverName, toolName, params });

    // Map parameters to MCP expected format
    const mcpParams = this.mapParamsToMcp(serverName, toolName, params);

    return await mcpControllerAgent.executeTool(serverName, toolName, mcpParams);
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
  private aggregateResponses(toolCalls: ToolCallResult[]): string {
    const responses: string[] = [];

    for (const call of toolCalls) {
      if (!call.success) continue;

      switch (call.serverName) {
        case 'shopping':
          if (call.result?.products?.length > 0) {
            const products = call.result.products.slice(0, 4);
            responses.push(this.formatShoppingResponse(products, call.result.referenceId));
          }
          break;

        case 'email':
          responses.push(`メール送信完了 / Email sent successfully`);
          break;

        case 'ai_chat':
          if (call.result?.response) {
            responses.push(call.result.response);
          }
          break;

        case 'payment':
          responses.push(`支払い処理完了 / Payment processed`);
          break;
      }
    }

    return responses.join('\n\n---\n\n');
  }

  /**
   * Format shopping results for fax response
   */
  private formatShoppingResponse(products: any[], referenceId?: string): string {
    // DEBUG: Log product data to see what's actually being returned
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
      // Build display name: brand + product name + quantity
      const brand = p.brand ? `【${p.brand}】` : '';
      const name = p.productName || p.title?.substring(0, 40) || 'Unknown';
      const qty = p.quantity ? ` ${p.quantity}` : '';
      const displayName = `${brand}${name}${qty}`;

      // Format price (show "価格確認中" if 0)
      const price = p.price > 0 ? `¥${p.price.toLocaleString()}` : '価格確認中';
      const prime = p.primeEligible ? '✓Prime' : '';
      const rating = p.rating ? `${p.rating}★` : '';

      // Build the product entry
      let entry = `${i + 1}. ${displayName}\n   ${price} ${prime} ${rating}`.trim();

      // Add description if available
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
