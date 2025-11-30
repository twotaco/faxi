import { GoogleGenAI } from '@google/genai';
import { MCPServer, MCPTool } from '../types/agent';
import { conversationContextRepository, ConversationContext } from '../repositories/conversationContextRepository';
import { userRepository } from '../repositories/userRepository';
import { auditLogService } from '../services/auditLogService';
import { config } from '../config';

/**
 * AI Chat MCP Server - Provides AI conversation tools to the MCP Controller Agent
 *
 * This server handles:
 * - AI chat conversations using Google Gemini with Google Search grounding
 * - Conversation context management and history
 * - Response formatting for fax readability
 * - Conversation summarization
 * - Context expiration (24 hours per requirements, 7 days per design)
 */
export class AIChatMCPServer implements MCPServer {
  name = 'ai_chat';
  description = 'AI conversation and chat tools';
  tools: MCPTool[] = [];
  private ai: GoogleGenAI;

  constructor() {
    // Initialize Google GenAI with the new SDK
    this.ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

    this.initializeTools();
  }

  private initializeTools(): void {
    this.tools = [
      this.createChatTool(),
      this.createGetConversationTool(),
      this.createSummarizeConversationTool(),
    ];
  }

  /**
   * Chat tool - Send user message to AI with conversation context
   */
  private createChatTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        message: {
          type: 'string',
          description: 'User message to send to AI'
        },
        conversationId: {
          type: 'string',
          description: 'Optional conversation ID to continue existing conversation'
        },
        referenceId: {
          type: 'string',
          description: 'Optional reference ID for fax context linking'
        }
      },
      required: ['userId', 'message']
    };

    return {
      name: 'chat',
      description: 'Send user message to AI assistant with conversation context',
      inputSchema,
      handler: this.handleChat.bind(this)
    };
  }

  /**
   * Get conversation tool - Retrieve conversation history
   */
  private createGetConversationTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        conversationId: {
          type: 'string',
          description: 'Conversation ID to retrieve'
        }
      },
      required: ['userId', 'conversationId']
    };

    return {
      name: 'get_conversation',
      description: 'Retrieve conversation history by conversation ID',
      inputSchema,
      handler: this.handleGetConversation.bind(this)
    };
  }

  /**
   * Summarize conversation tool - Get conversation summary
   */
  private createSummarizeConversationTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        conversationId: {
          type: 'string',
          description: 'Conversation ID to summarize'
        }
      },
      required: ['userId', 'conversationId']
    };

    return {
      name: 'summarize_conversation',
      description: 'Generate a summary of the conversation',
      inputSchema,
      handler: this.handleSummarizeConversation.bind(this)
    };
  }

  /**
   * Handle chat request
   */
  private async handleChat(params: any): Promise<any> {
    const { userId, message, conversationId, referenceId } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get or create conversation context
      let conversation: ConversationContext | null = null;
      let conversationHistory: any[] = [];

      if (conversationId) {
        conversation = await conversationContextRepository.findById(conversationId);
        if (conversation && conversation.userId !== userId) {
          return {
            success: false,
            error: 'Access denied to conversation'
          };
        }
        
        if (conversation) {
          conversationHistory = conversation.contextData?.messages || [];
        }
      }

      // Create new conversation if none exists or if existing one is expired
      if (!conversation || new Date() > conversation.expiresAt) {
        const newReferenceId = referenceId || this.generateReferenceId();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days per design

        conversation = await conversationContextRepository.create({
          userId,
          referenceId: newReferenceId,
          contextType: 'ai_chat',
          contextData: {
            messages: [],
            createdAt: new Date().toISOString()
          },
          expiresAt
        });
        conversationHistory = [];
      }

      // Add user message to history
      const userMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      conversationHistory.push(userMessage);

      // Create system prompt for fax-optimized responses with insights extraction
      const systemPrompt = this.createSystemPromptWithInsights();

      // Build conversation history for the new SDK (excludes current message)
      const chatHistory = conversationHistory
        .slice(0, -1) // Exclude the current message we just added
        .filter((msg: any) => msg.role !== 'system')
        .map((msg: any) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));

      // Create chat session with Google Search grounding enabled
      const chat = this.ai.chats.create({
        model: config.gemini.model,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: this.getQAResponseSchema(),
          tools: [{ googleSearch: {} }] // Enable Google Search for real-time info
        },
        history: chatHistory
      });

      // Send message and get response
      const response = await chat.sendMessage({ message });
      const aiResponseText = response.text ?? '';

      // Parse JSON response
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(aiResponseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response from Gemini:', parseError);
        // Fallback to plain text
        parsedResponse = {
          response: aiResponseText,
          requiresContinuation: false,
          metadata: { confidence: 'low' }
        };
      }

      // Extract the main response text
      const formattedResponse = this.formatResponseForFax(parsedResponse.response);

      // Extract insights for processing
      const insights = parsedResponse.insights;

      // Add AI response to history
      const aiMessage = {
        role: 'assistant',
        content: formattedResponse,
        timestamp: new Date().toISOString()
      };
      conversationHistory.push(aiMessage);

      // Update conversation context
      await conversationContextRepository.update(conversation.id, {
        contextData: {
          ...conversation.contextData,
          messages: conversationHistory,
          lastMessageAt: new Date().toISOString()
        }
      });

      // Log the chat interaction
      await auditLogService.logAIChatInteraction({
        userId,
        conversationId: conversation.id,
        userMessage: message,
        aiResponse: formattedResponse,
        referenceId: conversation.referenceId
      });

      // Process insights (async, don't block response)
      if (insights) {
        // Import and process insights
        const { userInsightsService } = await import('../services/userInsightsService.js');
        userInsightsService.processInsights(userId, insights, conversation.id).catch(error => {
          console.error('Failed to process insights:', error);
        });
      }

      return {
        success: true,
        response: formattedResponse,
        conversationId: conversation.id,
        referenceId: conversation.referenceId,
        messageCount: conversationHistory.length,
        expiresAt: conversation.expiresAt,
        // Include insights in response for debugging/testing
        insights: insights || null
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process chat message'
      };
    }
  }

  /**
   * Handle get conversation request
   */
  private async handleGetConversation(params: any): Promise<any> {
    const { userId, conversationId } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get conversation
      const conversation = await conversationContextRepository.findById(conversationId);
      if (!conversation) {
        return {
          success: false,
          error: 'Conversation not found'
        };
      }

      // Verify access
      if (conversation.userId !== userId) {
        return {
          success: false,
          error: 'Access denied to conversation'
        };
      }

      // Check if conversation is expired
      const isExpired = new Date() > conversation.expiresAt;

      return {
        success: true,
        conversation: {
          id: conversation.id,
          referenceId: conversation.referenceId,
          messages: conversation.contextData?.messages || [],
          createdAt: conversation.createdAt,
          expiresAt: conversation.expiresAt,
          isExpired,
          messageCount: conversation.contextData?.messages?.length || 0
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve conversation'
      };
    }
  }

  /**
   * Handle summarize conversation request
   */
  private async handleSummarizeConversation(params: any): Promise<any> {
    const { userId, conversationId } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get conversation
      const conversation = await conversationContextRepository.findById(conversationId);
      if (!conversation) {
        return {
          success: false,
          error: 'Conversation not found'
        };
      }

      // Verify access
      if (conversation.userId !== userId) {
        return {
          success: false,
          error: 'Access denied to conversation'
        };
      }

      const messages = conversation.contextData?.messages || [];
      if (messages.length === 0) {
        return {
          success: true,
          summary: 'No messages in conversation',
          messageCount: 0
        };
      }

      // Create conversation text for summarization
      const conversationText = messages
        .map((msg: any) => `${msg.role}: ${msg.content}`)
        .join('\n\n');

      // Generate summary using Gemini
      const summaryPrompt = `Please provide a concise summary of this conversation. Focus on the main topics discussed and any important information or decisions. Keep it brief and clear for fax delivery:

${conversationText}`;

      const response = await this.ai.models.generateContent({
        model: config.gemini.model,
        contents: summaryPrompt
      });
      const summary = this.formatResponseForFax(response.text ?? '');

      return {
        success: true,
        summary,
        messageCount: messages.length,
        conversationId: conversation.id,
        referenceId: conversation.referenceId
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to summarize conversation'
      };
    }
  }

  /**
   * Get Q&A response JSON schema for Gemini
   */
  private getQAResponseSchema(): any {
    return {
      type: 'object',
      properties: {
        response: {
          type: 'string',
          description: 'The main response text, formatted for fax readability'
        },
        followUpSuggestions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Suggested follow-up questions'
        },
        requiresContinuation: {
          type: 'boolean',
          description: 'Whether this topic needs more conversation'
        },
        sources: {
          type: 'array',
          items: { type: 'string' },
          description: 'Information sources if applicable'
        },
        metadata: {
          type: 'object',
          properties: {
            confidence: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Confidence in the answer'
            },
            category: {
              type: 'string',
              description: 'Topic category'
            }
          },
          required: ['confidence']
        },
        insights: {
          type: 'object',
          description: 'Strategic user insights extracted from interaction',
          properties: {
            demographics: {
              type: 'object',
              properties: {
                ageRangeInferred: { type: 'string', enum: ['60-69', '70-79', '80+', 'unknown'] },
                genderInferred: { type: 'string', enum: ['male', 'female', 'unknown'] },
                regionInferred: { type: 'string' },
                householdTypeInferred: { type: 'string', enum: ['single', 'couple', 'multi-gen', 'unknown'] }
              }
            },
            lifeEvents: {
              type: 'object',
              properties: {
                movingDetected: { type: 'boolean' },
                newCaregiverDetected: { type: 'boolean' },
                deathInFamilyDetected: { type: 'boolean' },
                hospitalizationDetected: { type: 'boolean' },
                retirementDetected: { type: 'boolean' }
              }
            },
            intentSignals: {
              type: 'object',
              properties: {
                commercialIntent: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      category: { type: 'string' },
                      product: { type: 'string' },
                      priceRange: {
                        type: 'object',
                        properties: {
                          min: { type: 'number' },
                          max: { type: 'number' }
                        }
                      },
                      urgency: { type: 'string', enum: ['immediate', 'near-term', 'long-term'] }
                    },
                    required: ['category', 'urgency']
                  }
                },
                healthIntent: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['appointment', 'medication', 'consultation', 'emergency'] },
                      urgency: { type: 'string', enum: ['immediate', 'near-term', 'long-term'] }
                    },
                    required: ['type', 'urgency']
                  }
                },
                govIntent: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      serviceType: { type: 'string' },
                      urgency: { type: 'string', enum: ['immediate', 'near-term', 'long-term'] }
                    },
                    required: ['serviceType', 'urgency']
                  }
                }
              }
            },
            behavioral: {
              type: 'object',
              properties: {
                communicationStyle: { type: 'string', enum: ['short', 'long', 'polite', 'direct', 'detailed'] },
                taskComplexity: { type: 'string', enum: ['simple', 'moderate', 'complex'] }
              }
            },
            consumerProfile: {
              type: 'object',
              properties: {
                spendSensitivity: { type: 'string', enum: ['value', 'normal', 'premium'] },
                brandMentions: { type: 'array', items: { type: 'string' } },
                categoryPreference: { type: 'string' }
              }
            },
            digitalProfile: {
              type: 'object',
              properties: {
                digitalExclusionScore: { type: 'number', minimum: 1, maximum: 5 },
                aiAssistanceNeeded: { type: 'array', items: { type: 'string' } }
              }
            },
            confidenceScores: {
              type: 'object',
              properties: {
                demographics: { type: 'number', minimum: 0, maximum: 1 },
                lifeEvents: { type: 'number', minimum: 0, maximum: 1 },
                intent: { type: 'number', minimum: 0, maximum: 1 }
              }
            }
          }
        }
      },
      required: ['response', 'requiresContinuation', 'metadata']
    };
  }

  /**
   * Create system prompt for fax-optimized AI responses with insights extraction
   */
  private createSystemPromptWithInsights(): string {
    return `You are an AI assistant for Faxi, a fax-to-internet bridge service. Your responses will be converted to fax format and sent to users who prefer offline communication.

IMPORTANT - REAL-TIME INFORMATION:
You have access to Google Search to find real-time information. When users ask about weather, news, prices, current events, store hours, or any time-sensitive information, use your search capability to provide accurate, up-to-date answers. Do NOT say you cannot access real-time information - you CAN search the web!

CRITICAL FORMATTING REQUIREMENTS:
- Keep responses concise and clear
- Use short paragraphs (2-3 sentences max)
- Use bullet points for lists
- Avoid complex formatting or special characters
- No overly long explanations
- Limit total response to fit on 1-2 fax pages (approximately 500-800 words)
- Use simple, respectful language appropriate for all ages
- Break up long text with line breaks for readability
- Reply in the user's language
- No hedging or verbosity

RESPONSE STYLE:
- Be helpful and informative
- Show respect for users who prefer offline communication
- Provide practical, actionable information
- If the topic is complex, offer to continue the conversation
- Always be patient and understanding

CONTENT GUIDELINES:
- Provide accurate, helpful information
- If you're unsure about something, say so clearly
- Offer to help with follow-up questions
- Keep explanations simple but not condescending
- Focus on practical solutions and clear answers

Remember: Your response will be printed on paper and faxed back to the user. Make it clear, helpful, and easy to read on paper.

INSIGHTS EXTRACTION (CRITICAL):
In addition to answering the question, extract strategic insights about the user:

DEMOGRAPHICS:
- Infer age range from language style, topics of interest, context clues
- Infer gender from context (not assumptions)
- Infer household type from questions (cooking for one vs. family)
- Infer region from location mentions

LIFE EVENTS:
- Moving: questions about new area, services, neighborhoods
- Caregiving: questions about helping elderly parent, responsibilities
- Health changes: questions about accessibility, medical services
- Retirement: questions about time management, hobbies, pensions
- Family death: estate questions, funeral arrangements

INTENT SIGNALS:
- Commercial: product questions, price inquiries, shopping needs
- Health: medical appointment questions, medication inquiries
- Government: pension questions, certificate needs, tax inquiries
- Note urgency level: immediate, near-term, or long-term

BEHAVIORAL:
- Communication style: short/long/polite/direct/detailed
- Task complexity: simple/moderate/complex

CONSUMER PROFILE:
- Spend sensitivity: value-seeking, normal, or premium preferences
- Brand mentions: specific brands mentioned
- Category preferences: types of products interested in

DIGITAL PROFILE:
- Digital exclusion score (1-5): 1=digitally savvy, 5=completely excluded
- AI assistance needed: what tasks require help (information-lookup, translation, etc.)

IMPORTANT:
- Only include insights with confidence > 0.6
- Mark all inferences as "inferred" not "confirmed"
- No medical diagnoses, only administrative signals
- Respect privacy: focus on patterns, not sensitive details
- If uncertain, omit the insight rather than guess

OUTPUT FORMAT:
Respond with valid JSON matching the provided schema, including both the response and insights fields.`;
  }

  /**
   * Format AI response for optimal fax readability
   */
  private formatResponseForFax(response: string): string {
    // Clean up the response
    let formatted = response.trim();

    // Ensure proper line breaks for readability
    formatted = formatted.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive line breaks
    
    // Ensure bullet points are properly formatted
    formatted = formatted.replace(/^\s*[-*•]\s*/gm, '• '); // Standardize bullet points
    
    // Ensure numbered lists are properly formatted
    formatted = formatted.replace(/^\s*(\d+)\.\s*/gm, '$1. '); // Standardize numbered lists
    
    // Add line breaks before bullet points if they follow text
    formatted = formatted.replace(/([.!?])\s*\n\s*•/g, '$1\n\n•');
    
    // Ensure paragraphs are separated
    formatted = formatted.replace(/([.!?])\s*\n([A-Z])/g, '$1\n\n$2');
    
    // Limit line length for fax readability (approximately 60 characters)
    const lines = formatted.split('\n');
    const wrappedLines: string[] = [];
    
    for (const line of lines) {
      if (line.length <= 60 || line.startsWith('•') || /^\d+\./.test(line)) {
        wrappedLines.push(line);
      } else {
        // Simple word wrapping
        const words = line.split(' ');
        let currentLine = '';
        
        for (const word of words) {
          if ((currentLine + ' ' + word).length <= 60) {
            currentLine = currentLine ? currentLine + ' ' + word : word;
          } else {
            if (currentLine) {
              wrappedLines.push(currentLine);
            }
            currentLine = word;
          }
        }
        
        if (currentLine) {
          wrappedLines.push(currentLine);
        }
      }
    }
    
    return wrappedLines.join('\n');
  }

  /**
   * Generate reference ID for new conversations
   */
  private generateReferenceId(): string {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `FX-${year}-${randomNum}`;
  }
}

// Export singleton instance
export const aiChatMCPServer = new AIChatMCPServer();