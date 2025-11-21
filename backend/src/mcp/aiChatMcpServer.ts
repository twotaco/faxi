import { GoogleGenerativeAI } from '@google/generative-ai';
import { MCPServer, MCPTool } from '../types/agent';
import { conversationContextRepository, ConversationContext } from '../repositories/conversationContextRepository';
import { userRepository } from '../repositories/userRepository';
import { auditLogService } from '../services/auditLogService';
import { config } from '../config';

/**
 * AI Chat MCP Server - Provides AI conversation tools to the MCP Controller Agent
 * 
 * This server handles:
 * - AI chat conversations using Google Gemini 2.5 Flash
 * - Conversation context management and history
 * - Response formatting for fax readability
 * - Conversation summarization
 * - Context expiration (24 hours per requirements, 7 days per design)
 */
export class AIChatMCPServer implements MCPServer {
  name = 'ai_chat';
  description = 'AI conversation and chat tools';
  tools: MCPTool[] = [];
  private genAI: GoogleGenerativeAI;

  constructor() {
    // Initialize Google Gemini AI
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    
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

      // Create system prompt for fax-optimized responses
      const systemPrompt = this.createSystemPrompt();
      
      // Prepare conversation for Gemini with system instruction
      const model = this.genAI.getGenerativeModel({ 
        model: config.gemini.model,
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemPrompt }]
        }
      });
      
      // Build conversation history for Gemini
      const chatHistory = conversationHistory
        .filter((msg: any) => msg.role !== 'system')
        .map((msg: any) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));

      // Start chat session with history
      const chat = model.startChat({
        history: chatHistory.slice(0, -1) // Exclude the current message
      });

      // Send message and get response
      const result = await chat.sendMessage(message);
      const response = result.response;
      const aiResponse = response.text();

      // Format response for fax readability
      const formattedResponse = this.formatResponseForFax(aiResponse);

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

      return {
        success: true,
        response: formattedResponse,
        conversationId: conversation.id,
        referenceId: conversation.referenceId,
        messageCount: conversationHistory.length,
        expiresAt: conversation.expiresAt
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
      const model = this.genAI.getGenerativeModel({ model: config.gemini.model });
      
      const summaryPrompt = `Please provide a concise summary of this conversation. Focus on the main topics discussed and any important information or decisions. Keep it brief and clear for fax delivery:

${conversationText}`;

      const result = await model.generateContent(summaryPrompt);
      const response = result.response;
      const summary = this.formatResponseForFax(response.text());

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
   * Create system prompt for fax-optimized AI responses
   */
  private createSystemPrompt(): string {
    return `You are an AI assistant for Faxi, a fax-to-internet bridge service. Your responses will be converted to fax format and sent to users who prefer offline communication.

CRITICAL FORMATTING REQUIREMENTS:
- Keep responses concise and clear
- Use short paragraphs (2-3 sentences max)
- Use bullet points for lists
- Avoid complex formatting or special characters
- Limit total response to fit on 1-2 fax pages (approximately 500-800 words)
- Use simple, respectful language appropriate for all ages
- Break up long text with line breaks for readability

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

Remember: Your response will be printed on paper and faxed back to the user. Make it clear, helpful, and easy to read on paper.`;
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