import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MCPServer, MCPTool } from '../types/agent';
import { addressBookRepository, AddressBookEntry } from '../repositories/addressBookRepository';
import { userRepository } from '../repositories/userRepository';
import { emailThreadRepository, emailMessageRepository } from '../repositories/emailThreadRepository';
import { auditLogService } from '../services/auditLogService';
import { emailService, EmailMessage } from '../services/emailService';
import { smartReplyService, EmailForReply } from '../services/smartReplyService';
import { config } from '../config';

/**
 * Email MCP Server - Provides email tools to the MCP Controller Agent
 * 
 * This server handles:
 * - Sending emails from user's Faxi email address
 * - Managing address book contacts
 * - Email thread and search functionality
 * - Spam filtering for incoming emails
 * - Smart reply generation
 */
export class EmailMCPServer implements MCPServer {
  name = 'email';
  description = 'Email management and communication tools';
  tools: MCPTool[] = [];
  private genAI: GoogleGenerativeAI;

  constructor() {
    // Initialize Google Gemini AI
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    
    this.initializeTools();
  }

  private initializeTools(): void {
    this.tools = [
      this.createEmailRequestTool(),
      this.createSendEmailTool(),
      this.createGetEmailThreadTool(),
      this.createSearchEmailsTool(),
      this.createGetAddressBookTool(),
      this.createAddContactTool(),
      this.createLookupContactTool(),
      this.createUpdateContactTool(),
      this.createDeleteContactTool(),
      this.createGenerateSmartRepliesTool(),
    ];
  }

  /**
   * Email request tool - High-level email assistant with structured outputs
   */
  private createEmailRequestTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        message: {
          type: 'string',
          description: 'User email request or message'
        },
        conversationHistory: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string' },
              content: { type: 'string' }
            }
          },
          description: 'Optional conversation history for context'
        }
      },
      required: ['userId', 'message']
    };

    return {
      name: 'email_request',
      description: 'Process email request with AI assistance and structured outputs',
      inputSchema,
      handler: this.handleEmailRequest.bind(this)
    };
  }

  /**
   * Send email tool - Sends email from user's Faxi email address
   */
  private createSendEmailTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID of the sender'
        },
        to: {
          type: 'string',
          description: 'Recipient email address or contact name'
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        body: {
          type: 'string',
          description: 'Email body content'
        },
        threadId: {
          type: 'string',
          description: 'Optional thread ID for replies',
          optional: true
        }
      },
      required: ['userId', 'to', 'subject', 'body']
    };

    return {
      name: 'send_email',
      description: 'Send an email from the user\'s Faxi email address',
      inputSchema,
      handler: this.handleSendEmail.bind(this)
    };
  }

  /**
   * Get email thread tool - Retrieves conversation history
   */
  private createGetEmailThreadTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        threadId: {
          type: 'string',
          description: 'Email thread identifier'
        }
      },
      required: ['userId', 'threadId']
    };

    return {
      name: 'get_email_thread',
      description: 'Retrieve email conversation history by thread ID',
      inputSchema,
      handler: this.handleGetEmailThread.bind(this)
    };
  }

  /**
   * Search emails tool - Searches user's email history
   */
  private createSearchEmailsTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        query: {
          type: 'string',
          description: 'Search query'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 10
        }
      },
      required: ['userId', 'query']
    };

    return {
      name: 'search_emails',
      description: 'Search user\'s email history by query',
      inputSchema,
      handler: this.handleSearchEmails.bind(this)
    };
  }

  /**
   * Get address book tool - Retrieves user's contacts
   */
  private createGetAddressBookTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        }
      },
      required: ['userId']
    };

    return {
      name: 'get_address_book',
      description: 'Retrieve user\'s address book contacts',
      inputSchema,
      handler: this.handleGetAddressBook.bind(this)
    };
  }

  /**
   * Add contact tool - Adds new contact to address book
   */
  private createAddContactTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        name: {
          type: 'string',
          description: 'Contact name'
        },
        email: {
          type: 'string',
          description: 'Contact email address'
        },
        relationship: {
          type: 'string',
          description: 'Relationship to user (optional)'
        },
        notes: {
          type: 'string',
          description: 'Additional notes (optional)'
        }
      },
      required: ['userId', 'name', 'email']
    };

    return {
      name: 'add_contact',
      description: 'Add new contact to address book',
      inputSchema,
      handler: this.handleAddContact.bind(this)
    };
  }

  /**
   * Lookup contact tool - Finds contact by name or relationship
   */
  private createLookupContactTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        query: {
          type: 'string',
          description: 'Name or relationship to search for'
        }
      },
      required: ['userId', 'query']
    };

    return {
      name: 'lookup_contact',
      description: 'Find contact by name or relationship',
      inputSchema,
      handler: this.handleLookupContact.bind(this)
    };
  }

  /**
   * Update contact tool - Updates existing contact
   */
  private createUpdateContactTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        contactId: {
          type: 'string',
          description: 'Contact ID to update'
        },
        name: {
          type: 'string',
          description: 'Updated name (optional)'
        },
        email: {
          type: 'string',
          description: 'Updated email address (optional)'
        },
        relationship: {
          type: 'string',
          description: 'Updated relationship (optional)'
        },
        notes: {
          type: 'string',
          description: 'Updated notes (optional)'
        }
      },
      required: ['userId', 'contactId']
    };

    return {
      name: 'update_contact',
      description: 'Update existing contact details',
      inputSchema,
      handler: this.handleUpdateContact.bind(this)
    };
  }

  /**
   * Delete contact tool - Removes contact from address book
   */
  private createDeleteContactTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        contactId: {
          type: 'string',
          description: 'Contact ID to delete'
        }
      },
      required: ['userId', 'contactId']
    };

    return {
      name: 'delete_contact',
      description: 'Delete contact from address book',
      inputSchema,
      handler: this.handleDeleteContact.bind(this)
    };
  }

  /**
   * Generate smart replies tool - Analyzes email and generates quick reply options
   */
  private createGenerateSmartRepliesTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        from: {
          type: 'string',
          description: 'Email sender address'
        },
        subject: {
          type: 'string',
          description: 'Email subject'
        },
        body: {
          type: 'string',
          description: 'Email body content'
        },
        threadId: {
          type: 'string',
          description: 'Thread ID for context (optional)'
        }
      },
      required: ['userId', 'from', 'subject', 'body']
    };

    return {
      name: 'generate_smart_replies',
      description: 'Generate quick reply options for an email',
      inputSchema,
      handler: this.handleGenerateSmartReplies.bind(this)
    };
  }

  /**
   * Handle send email request
   */
  private async handleSendEmail(params: any): Promise<any> {
    const { userId, to, subject, body, threadId } = params;
    
    try {
      // Get user information
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Parse recipient - could be email address or contact name
      const recipientInfo = emailService.parseRecipient(to);
      let recipientEmail: string;

      if (recipientInfo.email) {
        // Direct email address provided
        recipientEmail = recipientInfo.email;
      } else if (recipientInfo.name) {
        // Look up contact by name
        const contacts = await addressBookRepository.searchByNameOrRelationship(userId, recipientInfo.name);
        
        if (contacts.length === 0) {
          return {
            success: false,
            error: `Contact not found: ${recipientInfo.name}. Please provide email address or add contact to address book.`
          };
        }
        
        if (contacts.length > 1) {
          return {
            success: false,
            error: `Multiple contacts found for "${recipientInfo.name}". Please be more specific or use email address.`,
            suggestions: contacts.map(c => `${c.name} (${c.emailAddress})`)
          };
        }
        
        recipientEmail = contacts[0].emailAddress;
      } else {
        return {
          success: false,
          error: 'Invalid recipient format. Please provide email address or contact name.'
        };
      }

      // Validate recipient email
      if (!emailService.isValidEmail(recipientEmail)) {
        return {
          success: false,
          error: `Invalid email address: ${recipientEmail}`
        };
      }

      // Prepare email message
      const emailMessage: EmailMessage = {
        to: recipientEmail,
        from: user.emailAddress,
        subject: subject,
        body: body,
        threadId: threadId
      };

      console.log('[EmailMCP] Sending email:', {
        to: recipientEmail,
        from: user.emailAddress,
        subject: subject,
        userId: userId
      });

      // Send email
      const result = await emailService.sendEmail(emailMessage, userId);

      console.log('[EmailMCP] Send result:', result);
      
      if (result.success) {
        // Log successful email send
        await auditLogService.logEmailSent({
          userId: userId,
          faxJobId: '', // Will be provided by the calling context
          from: user.emailAddress,
          to: recipientEmail,
          subject: subject,
          messageId: result.messageId || emailService.generateMessageId()
        });

        // Auto-add recipient to address book if not already present
        if (recipientInfo.email) {
          try {
            await addressBookRepository.addFromEmail(userId, recipientEmail);
          } catch (error) {
            // Don't fail the email send if address book update fails
            console.warn('Failed to add contact to address book:', error);
          }
        }

        return {
          success: true,
          messageId: result.messageId,
          to: recipientEmail,
          from: user.emailAddress,
          subject: subject,
          sentAt: new Date().toISOString()
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to send email'
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred while sending email'
      };
    }
  }

  /**
   * Handle get email thread request
   */
  private async handleGetEmailThread(params: any): Promise<any> {
    const { userId, threadId } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get thread information
      const thread = await emailThreadRepository.findByThreadId(threadId);
      if (!thread) {
        return {
          success: false,
          error: 'Email thread not found'
        };
      }

      // Verify thread belongs to user
      if (thread.userId !== userId) {
        return {
          success: false,
          error: 'Access denied to email thread'
        };
      }

      // Get messages in the thread
      const messages = await emailMessageRepository.findByThreadId(threadId);

      return {
        success: true,
        thread: {
          threadId: thread.threadId,
          subject: thread.subject,
          participants: thread.participants,
          messageCount: thread.messageCount,
          lastMessageAt: thread.lastMessageAt,
          messages: messages.map(msg => ({
            messageId: msg.messageId,
            from: msg.fromAddress,
            to: msg.toAddresses,
            cc: msg.ccAddresses,
            subject: msg.subject,
            body: msg.body,
            direction: msg.direction,
            sentAt: msg.sentAt
          }))
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve email thread'
      };
    }
  }

  /**
   * Handle search emails request
   */
  private async handleSearchEmails(params: any): Promise<any> {
    const { userId, query, limit = 10 } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Search messages
      const messages = await emailMessageRepository.searchMessages(userId, query, limit);

      return {
        success: true,
        emails: messages.map(msg => ({
          messageId: msg.messageId,
          from: msg.fromAddress,
          to: msg.toAddresses,
          subject: msg.subject,
          snippet: this.generateSnippet(msg.body),
          direction: msg.direction,
          sentAt: msg.sentAt
        }))
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search emails'
      };
    }
  }

  /**
   * Handle generate smart replies request
   */
  private async handleGenerateSmartReplies(params: any): Promise<any> {
    const { userId, from, subject, body, threadId } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get previous messages in thread for context if threadId provided
      let previousMessages: string[] = [];
      if (threadId) {
        try {
          const messages = await emailMessageRepository.findByThreadId(threadId);
          previousMessages = messages.slice(-3).map(msg => 
            `From: ${msg.fromAddress}\nSubject: ${msg.subject}\n${msg.body}`
          );
        } catch (error) {
          // Continue without context if thread lookup fails
          console.warn('Failed to get thread context:', error);
        }
      }

      // Prepare email for analysis
      const emailForReply: EmailForReply = {
        from,
        subject,
        body,
        previousMessages: previousMessages.length > 0 ? previousMessages : undefined
      };

      // Generate smart replies
      const replyOptions = await smartReplyService.generateReplies(emailForReply);

      return {
        success: true,
        hasQuestions: replyOptions.hasQuestions,
        confidence: replyOptions.confidence,
        replies: replyOptions.replies,
        formattedForFax: smartReplyService.formatRepliesForFax(replyOptions.replies),
        needsReply: smartReplyService.needsReply(emailForReply)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate smart replies'
      };
    }
  }

  /**
   * Generate email snippet for search results
   */
  private generateSnippet(body: string, maxLength: number = 150): string {
    // Remove HTML tags if present
    const cleanBody = body.replace(/<[^>]*>/g, '');
    
    // Trim whitespace and limit length
    const trimmed = cleanBody.trim();
    if (trimmed.length <= maxLength) {
      return trimmed;
    }
    
    return trimmed.substring(0, maxLength - 3) + '...';
  }

  private async handleGetAddressBook(params: any): Promise<any> {
    const { userId } = params;
    
    try {
      const contacts = await addressBookRepository.findByUserId(userId);
      
      return {
        success: true,
        contacts: contacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          email: contact.emailAddress,
          relationship: contact.relationship,
          notes: contact.notes,
          createdAt: contact.createdAt
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve address book'
      };
    }
  }

  private async handleAddContact(params: any): Promise<any> {
    const { userId, name, email, relationship, notes } = params;
    
    try {
      const contact = await addressBookRepository.create({
        userId,
        name,
        emailAddress: email,
        relationship,
        notes
      });
      
      return {
        success: true,
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.emailAddress,
          relationship: contact.relationship,
          notes: contact.notes,
          createdAt: contact.createdAt
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add contact'
      };
    }
  }

  private async handleLookupContact(params: any): Promise<any> {
    const { userId, query } = params;
    
    try {
      const contacts = await addressBookRepository.searchByNameOrRelationship(userId, query);
      
      return {
        success: true,
        contacts: contacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          email: contact.emailAddress,
          relationship: contact.relationship,
          notes: contact.notes
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to lookup contact'
      };
    }
  }

  private async handleUpdateContact(params: any): Promise<any> {
    const { userId, contactId, name, email, relationship, notes } = params;
    
    try {
      // Verify contact belongs to user
      const existingContact = await addressBookRepository.findById(contactId);
      if (!existingContact || existingContact.userId !== userId) {
        return {
          success: false,
          error: 'Contact not found or access denied'
        };
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.emailAddress = email;
      if (relationship !== undefined) updateData.relationship = relationship;
      if (notes !== undefined) updateData.notes = notes;

      const updatedContact = await addressBookRepository.update(contactId, updateData);
      
      return {
        success: true,
        contact: {
          id: updatedContact.id,
          name: updatedContact.name,
          email: updatedContact.emailAddress,
          relationship: updatedContact.relationship,
          notes: updatedContact.notes,
          updatedAt: updatedContact.updatedAt
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update contact'
      };
    }
  }

  private async handleDeleteContact(params: any): Promise<any> {
    const { userId, contactId } = params;
    
    try {
      // Verify contact belongs to user
      const existingContact = await addressBookRepository.findById(contactId);
      if (!existingContact || existingContact.userId !== userId) {
        return {
          success: false,
          error: 'Contact not found or access denied'
        };
      }

      await addressBookRepository.delete(contactId);
      
      return {
        success: true,
        message: 'Contact deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete contact'
      };
    }
  }

  /**
   * Handle email request with AI assistance and structured outputs
   */
  private async handleEmailRequest(params: any): Promise<any> {
    const { userId, message, conversationHistory = [] } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get user's address book for context
      const contacts = await addressBookRepository.findByUserId(userId);
      const contactsContext = contacts.map(c => ({
        name: c.name,
        relationship: c.relationship,
        email: c.emailAddress
      }));

      // Build system prompt with email guidelines
      const systemPrompt = this.buildEmailSystemPrompt(contactsContext, user);
      
      // Create Gemini model with JSON schema
      const model = this.genAI.getGenerativeModel({ 
        model: config.gemini.model,
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: this.getEmailResponseSchema()
        }
      });
      
      // Build conversation history for Gemini
      const chatHistory = conversationHistory.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      // Start chat session with history
      const chat = model.startChat({
        history: chatHistory
      });

      // Send message and get response
      const result = await chat.sendMessage(message);
      const response = result.response;
      const aiResponseText = response.text();

      // Parse JSON response
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(aiResponseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response from Gemini:', parseError);
        return {
          success: false,
          error: 'Failed to parse AI response'
        };
      }

      // Execute email actions based on intent
      const executionResult = await this.executeEmailIntent(userId, parsedResponse);

      // Extract insights for processing
      const insights = parsedResponse.insights;

      // Process insights (async, don't block response)
      if (insights) {
        const { userInsightsService } = await import('../services/userInsightsService.js');
        userInsightsService.processInsights(userId, insights, `email-${Date.now()}`).catch(error => {
          console.error('Failed to process email insights:', error);
        });
      }

      // Log the email interaction
      await auditLogService.logMCPToolCall({
        userId,
        faxJobId: `email-${Date.now()}`,
        toolName: 'email_request',
        toolServer: 'email',
        input: { message },
        output: parsedResponse,
        success: true
      });

      return {
        success: true,
        intent: parsedResponse.intent,
        response: parsedResponse.response,
        recipient: parsedResponse.recipient,
        subject: parsedResponse.subject,
        body: parsedResponse.body,
        tone: parsedResponse.tone,
        requiresConfirmation: parsedResponse.requiresConfirmation,
        nextAction: parsedResponse.nextAction,
        metadata: parsedResponse.metadata,
        executionResult,
        insights: insights || null
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process email request'
      };
    }
  }

  /**
   * Execute email intent (compose, send, lookup, etc.)
   */
  private async executeEmailIntent(userId: string, emailResponse: any): Promise<any> {
    const { intent, recipient, subject, body } = emailResponse;
    
    try {
      switch (intent) {
        case 'compose':
          // Email is composed and ready for preview
          // No action needed, just return the composed email
          return { 
            action: 'email_composed', 
            recipientIdentified: recipient.identified,
            needsClarification: recipient.needsClarification
          };

        case 'send':
          // Send the email if recipient is identified
          if (recipient.identified && recipient.email && subject && body) {
            // Get user to get their email address
            const user = await userRepository.findById(userId);
            if (!user) {
              return { action: 'send_failed', error: 'User not found' };
            }
            
            const emailMessage: EmailMessage = {
              to: recipient.email,
              from: user.emailAddress,
              subject: subject,
              body: body
            };
            
            const result = await emailService.sendEmail(emailMessage, userId);
            
            if (result.success) {
              await auditLogService.logEmailSent({
                userId: userId,
                faxJobId: `email-${Date.now()}`,
                from: user.emailAddress,
                to: recipient.email,
                subject: subject,
                messageId: result.messageId || emailService.generateMessageId()
              });
              
              return { 
                action: 'email_sent', 
                messageId: result.messageId,
                sentAt: new Date().toISOString()
              };
            } else {
              return { 
                action: 'send_failed', 
                error: result.error 
              };
            }
          }
          return { action: 'send_pending', message: 'Missing required information' };

        case 'lookup':
          // Lookup contact in address book
          if (recipient.name) {
            const contacts = await addressBookRepository.searchByNameOrRelationship(userId, recipient.name);
            return { 
              action: 'contact_lookup', 
              found: contacts.length > 0,
              contacts: contacts.map(c => ({
                name: c.name,
                email: c.emailAddress,
                relationship: c.relationship
              }))
            };
          }
          return { action: 'lookup_failed', message: 'No name provided' };

        case 'clarify':
          // Need more information from user
          return { action: 'clarification_needed' };

        default:
          return { action: 'unknown_intent' };
      }
    } catch (error) {
      console.error('Failed to execute email intent:', error);
      return { 
        action: 'execution_failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Build email system prompt with context
   */
  private buildEmailSystemPrompt(contacts: any[], user: any): string {
    const contactsList = contacts.length > 0 
      ? contacts.map(c => `- ${c.name}${c.relationship ? ` (${c.relationship})` : ''}: ${c.email}`).join('\n')
      : 'No contacts in address book.';

    return `You are an AI email assistant for Faxi, helping elderly users in Japan compose and send emails via fax.

CRITICAL: You must respond with valid JSON matching the EmailResponseSchema.

FAX FORMATTING RULES:
- Keep responses concise (500-800 words max)
- Use short paragraphs (2-3 sentences each)
- Use bullet points for lists
- Simple, respectful language appropriate for all ages
- Clear, actionable information
- Your response will be printed and faxed to the user

EMAIL GUIDELINES:
- Identify recipient from address book or ask for email address
- Match tone to relationship (formal for doctors, casual for family)
- Show email preview before sending
- Never send without explicit user confirmation
- Keep emails concise and clear

USER'S ADDRESS BOOK:
${contactsList}

USER INFORMATION:
- Name: ${user.name || 'User'}
- Email: ${user.emailAddress}

TONE MATCHING:
- FORMAL: Doctors, government officials, business contacts
- CASUAL: Family members, close friends
- URGENT: Time-sensitive matters
- FRIENDLY: Acquaintances, neighbors

INSIGHTS EXTRACTION:
Extract relationship and communication insights from every interaction:

RELATIONSHIP PATTERNS:
- Family relationships: son, daughter, spouse, etc.
- Professional relationships: doctor, lawyer, etc.
- Social relationships: friend, neighbor, etc.

LIFE EVENTS:
- Moving: address updates, new area questions
- Family changes: gatherings, celebrations
- Health events: medical appointments, doctor communications

COMMUNICATION PATTERNS:
- Email frequency and style
- Support network (who they contact)
- Digital literacy level

DIGITAL PROFILE:
- Email literacy: 5=needs full assistance, 1=digitally savvy
- Assistance needs: composition, reply, formal-writing, tone-adjustment

PRIVACY RULES:
- NO email addresses in insights
- NO names in insights (use relationships)
- NO email content in insights
- Only include insights with confidence > 0.6

Your response must be valid JSON matching the EmailResponseSchema.`;
  }

  /**
   * Get Email response JSON schema for Gemini
   */
  private getEmailResponseSchema(): any {
    return {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: ['compose', 'send', 'clarify', 'lookup'],
          description: "User's email intent"
        },
        recipient: {
          type: 'object',
          properties: {
            identified: { type: 'boolean' },
            name: { type: 'string' },
            email: { type: 'string' },
            relationship: { type: 'string' },
            needsClarification: { type: 'boolean' }
          },
          required: ['identified', 'needsClarification']
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        body: {
          type: 'string',
          description: 'Email body content'
        },
        tone: {
          type: 'string',
          enum: ['formal', 'casual', 'urgent', 'friendly']
        },
        response: {
          type: 'string',
          description: 'Human-readable response for fax'
        },
        requiresConfirmation: {
          type: 'boolean',
          description: 'Whether user needs to confirm before sending'
        },
        nextAction: {
          type: 'string',
          enum: ['show_preview', 'confirm_send', 'request_clarification', 'complete']
        },
        metadata: {
          type: 'object',
          properties: {
            threadId: { type: 'string' },
            isReply: { type: 'boolean' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
          }
        },
        insights: {
          type: 'object',
          description: 'Strategic user insights',
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
      required: ['intent', 'recipient', 'response', 'requiresConfirmation']
    };
  }
}

// Export singleton instance
export const emailMCPServer = new EmailMCPServer();