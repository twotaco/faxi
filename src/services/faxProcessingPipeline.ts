import { FaxJobData } from '../queue/faxQueue';
import { aiVisionInterpreter } from './aiVisionInterpreter';
import { mcpControllerAgent } from './mcpControllerAgent';
import { ResponseGenerator } from './responseGenerator';
import { faxSenderService } from './faxSenderService';
import { conversationContextRepository } from '../repositories/conversationContextRepository';
import { userRepository } from '../repositories/userRepository';
import { s3Storage } from '../storage/s3';
import { auditLogService } from './auditLogService';
import { faxProcessingErrorHandler, ErrorContext } from './faxProcessingErrorHandler';
import { InterpretationRequest, InterpretationResult } from '../types/vision';
import { AgentRequest, AgentResponse } from '../types/agent';
import { config } from '../config';

export interface FaxProcessingOptions {
  onProgress?: (progress: number) => Promise<void>;
}

export interface FaxProcessingResult {
  success: boolean;
  responseReferenceId?: string;
  responseFaxId?: string;
  errorMessage?: string;
  interpretation?: InterpretationResult;
  agentResponse?: AgentResponse;
}

export class FaxProcessingPipeline {
  /**
   * Main processing pipeline that orchestrates the complete fax processing workflow
   */
  async processFax(
    faxData: FaxJobData,
    options: FaxProcessingOptions = {}
  ): Promise<FaxProcessingResult> {
    const { onProgress } = options;
    let user: any = null;
    
    try {
      // Step 1: Download and store fax image (if not already done)
      await onProgress?.(10);
      const imageBuffer = await this.downloadFaxImageWithErrorHandling(faxData);
      
      // Step 2: Get or create user
      await onProgress?.(20);
      user = await this.getOrCreateUserWithErrorHandling(faxData);
      
      // Step 3: AI Vision Interpretation
      await onProgress?.(30);
      const interpretation = await this.interpretFaxWithErrorHandling(imageBuffer, user.id, faxData);
      
      // Step 4: Context Recovery
      await onProgress?.(40);
      const contextualInterpretation = await this.recoverContext(interpretation, user.id);
      
      // Step 5: MCP Controller Agent Processing
      await onProgress?.(50);
      const agentResponse = await this.processWithAgentWithErrorHandling(
        contextualInterpretation,
        user.id,
        faxData
      );
      
      // Step 6: Generate Response Fax
      await onProgress?.(70);
      const responseTiffs = await this.generateResponseFaxWithErrorHandling(agentResponse, faxData);
      
      // Step 7: Send Response Fax
      await onProgress?.(90);
      const sendResult = await this.sendResponseFaxWithErrorHandling(
        responseTiffs,
        faxData,
        agentResponse.faxTemplate.referenceId
      );
      
      // Step 8: Check and send welcome fax for new users
      if (user && !user.preferences?.welcomeFaxSent) {
        await this.checkAndSendWelcomeFax(user.id, faxData.fromNumber);
      }
      
      // Step 9: Handle welcome fax replies (help topic requests)
      if (interpretation.intent === 'reply' && 
          interpretation.context?.contextData?.isWelcomeFax && 
          interpretation.parameters?.selectedOptions) {
        await this.handleWelcomeFaxReply(user.id, faxData.fromNumber, interpretation.parameters.selectedOptions);
      }
      
      // Step 10: Handle payment method registration requests
      if (interpretation.intent === 'payment_registration' || 
          (interpretation.parameters?.freeformText && 
           interpretation.parameters.freeformText.toLowerCase().includes('payment method'))) {
        await this.handlePaymentRegistrationRequest(user.id, faxData.fromNumber);
      }
      
      await onProgress?.(100);
      
      return {
        success: true,
        responseReferenceId: agentResponse.faxTemplate.referenceId,
        responseFaxId: sendResult.faxId,
        interpretation: contextualInterpretation,
        agentResponse,
      };
      
    } catch (error) {
      console.error('Fax processing pipeline failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Use error handler for comprehensive error handling
      const errorContext: ErrorContext = {
        faxJobId: faxData.faxId,
        faxData,
        userId: user?.id,
        stage: this.determineErrorStage(error instanceof Error ? error : new Error(errorMessage)),
        originalError: error instanceof Error ? error : new Error(errorMessage),
      };
      
      await faxProcessingErrorHandler.handleError(errorContext);
      
      return {
        success: false,
        errorMessage,
      };
    }
  }

  /**
   * Download fax image with error handling
   */
  private async downloadFaxImageWithErrorHandling(faxData: FaxJobData): Promise<Buffer> {
    try {
      return await this.downloadFaxImage(faxData);
    } catch (error) {
      const errorContext: ErrorContext = {
        faxJobId: faxData.faxId,
        faxData,
        stage: 'download',
        originalError: error instanceof Error ? error : new Error('Download failed'),
      };
      
      const result = await faxProcessingErrorHandler.handleError(errorContext);
      
      if (result.shouldRetry) {
        // Wait for retry delay if specified
        if (result.retryDelay) {
          await new Promise(resolve => setTimeout(resolve, result.retryDelay));
        }
        // Retry the download
        return await this.downloadFaxImage(faxData);
      }
      
      throw error;
    }
  }

  /**
   * Download fax image from Telnyx and store in S3
   */
  private async downloadFaxImage(faxData: FaxJobData): Promise<Buffer> {
    try {
      // Check if image is already stored in S3
      const s3Key = s3Storage.generateFaxKey(faxData.faxId, 'tiff');
      
      try {
        const existingImage = await s3Storage.downloadFile(s3Key);
        console.log('Using existing fax image from S3', { faxId: faxData.faxId });
        return existingImage;
      } catch (notFoundError) {
        // Image not in S3, download from Telnyx
      }
      
      // Download from Telnyx media URL
      console.log('Downloading fax image from Telnyx', { 
        faxId: faxData.faxId,
        mediaUrl: faxData.mediaUrl 
      });
      
      const response = await fetch(faxData.mediaUrl);
      if (!response.ok) {
        throw new Error(`Failed to download fax image: ${response.status} ${response.statusText}`);
      }
      
      const imageBuffer = Buffer.from(await response.arrayBuffer());
      
      // Store in S3 for future reference
      await s3Storage.uploadFile(s3Key, imageBuffer, 'image/tiff');
      
      // Log successful download
      await auditLogService.logOperation({
        entityType: 'fax_image',
        entityId: faxData.faxId,
        operation: 'image_downloaded',
        details: {
          mediaUrl: faxData.mediaUrl,
          s3Key,
          sizeBytes: imageBuffer.length,
        },
      });
      
      return imageBuffer;
      
    } catch (error) {
      console.error('Failed to download fax image:', error);
      throw new Error(`Failed to download fax image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get or create user with error handling
   */
  private async getOrCreateUserWithErrorHandling(faxData: FaxJobData) {
    try {
      return await this.getOrCreateUser(faxData.fromNumber);
    } catch (error) {
      const errorContext: ErrorContext = {
        faxJobId: faxData.faxId,
        faxData,
        stage: 'download', // User creation is part of initial setup
        originalError: error instanceof Error ? error : new Error('User creation failed'),
      };
      
      await faxProcessingErrorHandler.handleError(errorContext);
      throw error;
    }
  }

  /**
   * Get existing user or create new user for first-time fax senders
   */
  private async getOrCreateUser(phoneNumber: string) {
    try {
      // Use the repository's findOrCreate method which handles this logic
      const { user, isNew } = await userRepository.findOrCreate(phoneNumber);
      
      if (isNew) {
        console.log('Created new user', { 
          userId: user.id,
          phoneNumber,
          emailAddress: user.emailAddress,
          isFirstTime: true
        });
        
        // Log user creation
        await auditLogService.logOperation({
          entityType: 'user',
          entityId: user.id,
          operation: 'user_created',
          details: {
            phoneNumber,
            emailAddress: user.emailAddress,
            trigger: 'first_fax_received',
            isFirstTime: true,
          },
        });
      } else {
        console.log('Found existing user', { 
          userId: user.id,
          phoneNumber,
          emailAddress: user.emailAddress,
          isFirstTime: false
        });
      }
      
      return user;
      
    } catch (error) {
      console.error('Failed to get or create user:', error);
      throw new Error(`Failed to get or create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Interpret fax with error handling
   */
  private async interpretFaxWithErrorHandling(
    imageBuffer: Buffer,
    userId: string,
    faxData: FaxJobData
  ): Promise<InterpretationResult> {
    try {
      return await this.interpretFax(imageBuffer, userId, faxData);
    } catch (error) {
      const errorContext: ErrorContext = {
        faxJobId: faxData.faxId,
        faxData,
        userId,
        stage: 'interpretation',
        originalError: error instanceof Error ? error : new Error('Interpretation failed'),
      };
      
      const result = await faxProcessingErrorHandler.handleError(errorContext);
      
      if (result.shouldRetry) {
        if (result.retryDelay) {
          await new Promise(resolve => setTimeout(resolve, result.retryDelay));
        }
        return await this.interpretFax(imageBuffer, userId, faxData);
      }
      
      throw error;
    }
  }

  /**
   * Interpret fax using AI Vision
   */
  private async interpretFax(
    imageBuffer: Buffer,
    userId: string,
    faxData: FaxJobData
  ): Promise<InterpretationResult> {
    try {
      const interpretationRequest: InterpretationRequest = {
        imageData: imageBuffer,
        userId,
      };
      
      console.log('Starting AI vision interpretation', { 
        faxId: faxData.faxId,
        userId,
        imageSizeBytes: imageBuffer.length 
      });
      
      const interpretation = await aiVisionInterpreter.interpretFax(interpretationRequest);
      
      console.log('AI vision interpretation completed', {
        faxId: faxData.faxId,
        intent: interpretation.intent,
        confidence: interpretation.confidence,
        requiresClarification: interpretation.requiresClarification,
      });
      
      return interpretation;
      
    } catch (error) {
      console.error('AI vision interpretation failed:', error);
      throw new Error(`AI vision interpretation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Recover conversation context if this is a follow-up fax
   */
  private async recoverContext(
    interpretation: InterpretationResult,
    userId: string
  ): Promise<InterpretationResult> {
    try {
      // If we already have context recovery results from AI Vision, use them
      if (interpretation.contextRecovery?.matchedContextId) {
        const context = await conversationContextRepository.findById(
          interpretation.contextRecovery.matchedContextId
        );
        
        if (context) {
          console.log('Context recovered via AI Vision', {
            contextId: context.id,
            referenceId: context.referenceId,
            method: interpretation.contextRecovery.method,
          });
          
          // Update interpretation with context
          interpretation.context = context;
          return interpretation;
        }
      }
      
      // If reference ID was extracted, try to find matching context
      if (interpretation.referenceId) {
        const context = await conversationContextRepository.findByReferenceId(
          interpretation.referenceId
        );
        
        if (context && context.userId === userId) {
          console.log('Context recovered via reference ID', {
            referenceId: interpretation.referenceId,
            contextId: context.id,
          });
          
          interpretation.context = context;
          interpretation.contextRecovery = {
            method: 'reference_id',
            matchedContextId: context.id,
            confidence: 0.95,
          };
          
          return interpretation;
        }
      }
      
      // If this looks like a reply but no context found, check recent contexts
      if (interpretation.intent === 'reply' || interpretation.confidence < 0.7) {
        const recentContexts = await conversationContextRepository.findRecentByUser(
          userId,
          7 * 24 * 60 * 60 * 1000 // 7 days
        );
        
        if (recentContexts.length === 1) {
          // Single recent context - assume this is a continuation
          const context = recentContexts[0];
          
          console.log('Context recovered via temporal proximity', {
            contextId: context.id,
            referenceId: context.referenceId,
          });
          
          interpretation.context = context;
          interpretation.contextRecovery = {
            method: 'temporal_proximity',
            matchedContextId: context.id,
            confidence: 0.7,
          };
          
          return interpretation;
        } else if (recentContexts.length > 1) {
          // Multiple recent contexts - need disambiguation
          interpretation.requiresClarification = true;
          interpretation.clarificationQuestion = 'I see you have multiple recent conversations. Please include the reference number (Ref: FX-YYYY-NNNNNN) from the original fax.';
          interpretation.contextRecovery = {
            method: 'none',
            confidence: 0.0,
            ambiguousMatches: recentContexts.map(c => c.id),
          };
        }
      }
      
      return interpretation;
      
    } catch (error) {
      console.error('Context recovery failed:', error);
      // Don't fail the entire pipeline for context recovery errors
      return interpretation;
    }
  }

  /**
   * Process with agent with error handling
   */
  private async processWithAgentWithErrorHandling(
    interpretation: InterpretationResult,
    userId: string,
    faxData: FaxJobData
  ): Promise<AgentResponse> {
    try {
      return await this.processWithAgent(interpretation, userId, faxData.faxId);
    } catch (error) {
      const errorContext: ErrorContext = {
        faxJobId: faxData.faxId,
        faxData,
        userId,
        stage: 'agent_processing',
        originalError: error instanceof Error ? error : new Error('Agent processing failed'),
      };
      
      const result = await faxProcessingErrorHandler.handleError(errorContext);
      
      if (result.shouldRetry) {
        if (result.retryDelay) {
          await new Promise(resolve => setTimeout(resolve, result.retryDelay));
        }
        return await this.processWithAgent(interpretation, userId, faxData.faxId);
      }
      
      throw error;
    }
  }

  /**
   * Process interpretation with MCP Controller Agent
   */
  private async processWithAgent(
    interpretation: InterpretationResult,
    userId: string,
    faxJobId: string
  ): Promise<AgentResponse> {
    try {
      const agentRequest: AgentRequest = {
        interpretation,
        userId,
        faxJobId,
        conversationContext: interpretation.context,
      };
      
      console.log('Starting MCP Controller Agent processing', {
        faxJobId,
        userId,
        intent: interpretation.intent,
        confidence: interpretation.confidence,
      });
      
      const agentResponse = await mcpControllerAgent.processRequest(agentRequest);
      
      console.log('MCP Controller Agent processing completed', {
        faxJobId,
        success: agentResponse.success,
        responseType: agentResponse.responseType,
        stepsExecuted: agentResponse.steps.length,
      });
      
      return agentResponse;
      
    } catch (error) {
      console.error('MCP Controller Agent processing failed:', error);
      throw new Error(`Agent processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate response fax with error handling
   */
  private async generateResponseFaxWithErrorHandling(
    agentResponse: AgentResponse,
    faxData: FaxJobData
  ): Promise<Buffer[]> {
    try {
      return await this.generateResponseFax(agentResponse);
    } catch (error) {
      const errorContext: ErrorContext = {
        faxJobId: faxData.faxId,
        faxData,
        stage: 'response_generation',
        originalError: error instanceof Error ? error : new Error('Response generation failed'),
      };
      
      await faxProcessingErrorHandler.handleError(errorContext);
      throw error;
    }
  }

  /**
   * Generate response fax using Response Generator
   */
  private async generateResponseFax(agentResponse: AgentResponse): Promise<Buffer[]> {
    try {
      console.log('Generating response fax', {
        templateType: agentResponse.faxTemplate.type,
        referenceId: agentResponse.faxTemplate.referenceId,
      });
      
      const responseResult = await ResponseGenerator.generateResponse({
        type: agentResponse.faxTemplate.type,
        data: agentResponse.faxTemplate.contextData,
        referenceId: agentResponse.faxTemplate.referenceId,
      });
      
      console.log('Response fax generated', {
        referenceId: responseResult.referenceId,
        pageCount: responseResult.tiffBuffers.length,
      });
      
      return responseResult.tiffBuffers;
      
    } catch (error) {
      console.error('Response fax generation failed:', error);
      throw new Error(`Response generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send response fax with error handling
   */
  private async sendResponseFaxWithErrorHandling(
    tiffBuffers: Buffer[],
    faxData: FaxJobData,
    referenceId: string
  ): Promise<{ faxId: string }> {
    try {
      return await this.sendResponseFax(tiffBuffers, faxData.fromNumber, referenceId);
    } catch (error) {
      const errorContext: ErrorContext = {
        faxJobId: faxData.faxId,
        faxData,
        stage: 'fax_sending',
        originalError: error instanceof Error ? error : new Error('Fax sending failed'),
      };
      
      const result = await faxProcessingErrorHandler.handleError(errorContext);
      
      if (result.shouldRetry) {
        if (result.retryDelay) {
          await new Promise(resolve => setTimeout(resolve, result.retryDelay));
        }
        return await this.sendResponseFax(tiffBuffers, faxData.fromNumber, referenceId);
      }
      
      throw error;
    }
  }

  /**
   * Send response fax via Fax Sender Service
   */
  private async sendResponseFax(
    tiffBuffers: Buffer[],
    toNumber: string,
    referenceId: string
  ): Promise<{ faxId: string }> {
    try {
      // Combine multiple TIFF pages if needed
      const combinedTiff = tiffBuffers.length === 1 
        ? tiffBuffers[0] 
        : await this.combineTiffPages(tiffBuffers);
      
      // Upload TIFF to publicly accessible URL
      const mediaUrl = await faxSenderService.uploadTiffForFax(
        combinedTiff,
        `response_${referenceId}`
      );
      
      // Send fax with retry logic
      const sendResult = await faxSenderService.sendFaxWithRetry({
        to: toNumber,
        from: config.telnyx.faxNumber,
        mediaUrl,
        referenceId,
      });
      
      console.log('Response fax sent successfully', {
        faxId: sendResult.faxId,
        toNumber,
        referenceId,
      });
      
      return { faxId: sendResult.faxId };
      
    } catch (error) {
      console.error('Failed to send response fax:', error);
      throw new Error(`Failed to send response fax: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }



  /**
   * Combine multiple TIFF pages into a single multi-page TIFF
   */
  private async combineTiffPages(tiffBuffers: Buffer[]): Promise<Buffer> {
    // For now, just return the first page
    // In a full implementation, you would use a library like sharp or imagemagick
    // to combine multiple TIFF pages into a single multi-page TIFF
    console.warn('Multi-page TIFF combination not implemented, using first page only');
    return tiffBuffers[0];
  }

  /**
   * Determine error stage from error message
   */
  private determineErrorStage(error: Error): ErrorContext['stage'] {
    const message = error.message.toLowerCase();
    
    if (message.includes('download') || message.includes('media url') || message.includes('fetch')) {
      return 'download';
    }
    if (message.includes('interpretation') || message.includes('vision') || message.includes('gemini')) {
      return 'interpretation';
    }
    if (message.includes('agent') || message.includes('mcp') || message.includes('tool')) {
      return 'agent_processing';
    }
    if (message.includes('response') || message.includes('generation') || message.includes('tiff')) {
      return 'response_generation';
    }
    if (message.includes('send') || message.includes('fax') || message.includes('telnyx')) {
      return 'fax_sending';
    }
    
    // Default to interpretation if we can't determine
    return 'interpretation';
  }

  /**
   * Check if user needs welcome fax and send it (for new users)
   */
  async checkAndSendWelcomeFax(userId: string, phoneNumber: string): Promise<void> {
    try {
      const user = await userRepository.findById(userId);
      
      if (!user) {
        console.warn('User not found for welcome fax', { userId });
        return;
      }
      
      // Check if welcome fax has already been sent
      if (user.preferences?.welcomeFaxSent) {
        console.log('Welcome fax already sent for user', { userId });
        return;
      }
      
      console.log('Sending welcome fax to new user', { userId, phoneNumber, emailAddress: user.emailAddress });
      
      // Generate welcome fax using the dedicated welcome fax generator
      const welcomeFaxResult = await ResponseGenerator.generateWelcomeFax(
        phoneNumber,
        user.emailAddress
      );
      
      // Upload TIFF for fax sending
      const mediaUrl = await faxSenderService.uploadTiffForFax(
        welcomeFaxResult.tiffBuffers[0],
        `welcome_${userId}_${Date.now()}`
      );
      
      // Send welcome fax
      const sendResult = await faxSenderService.sendFaxWithRetry({
        to: phoneNumber,
        from: config.telnyx.faxNumber,
        mediaUrl,
        referenceId: welcomeFaxResult.referenceId,
      });
      
      // Update user preferences to mark welcome fax as sent
      const updatedPreferences = {
        ...user.preferences,
        welcomeFaxSent: true,
        welcomeFaxSentAt: new Date().toISOString(),
        welcomeFaxReferenceId: welcomeFaxResult.referenceId,
      };
      
      await userRepository.updatePreferences(userId, updatedPreferences);
      
      // Log welcome fax sending
      await auditLogService.logOperation({
        entityType: 'user',
        entityId: userId,
        operation: 'welcome_fax_sent',
        details: {
          phoneNumber,
          emailAddress: user.emailAddress,
          referenceId: welcomeFaxResult.referenceId,
          faxId: sendResult.faxId,
        },
      });
      
      console.log('Welcome fax sent successfully', { 
        userId, 
        phoneNumber, 
        referenceId: welcomeFaxResult.referenceId,
        faxId: sendResult.faxId 
      });
      
    } catch (error) {
      console.error('Failed to send welcome fax:', error);
      
      // Log the error but don't fail the main pipeline
      await auditLogService.logOperation({
        entityType: 'user',
        entityId: userId,
        operation: 'welcome_fax_failed',
        details: {
          phoneNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      
      // Don't throw - welcome fax failure shouldn't break the main processing
    }
  }

  /**
   * Handle welcome fax replies when users request detailed help on specific topics
   */
  async handleWelcomeFaxReply(userId: string, phoneNumber: string, selectedOptions: string[]): Promise<void> {
    try {
      console.log('Handling welcome fax reply', { userId, phoneNumber, selectedOptions });
      
      // Map selected options (A, B, C, D, E) to help topics
      const optionToTopic: Record<string, string> = {
        'A': 'email',
        'B': 'shopping', 
        'C': 'payment',
        'D': 'ai',
        'E': 'address_book'
      };
      
      const helpTopics = selectedOptions
        .map(option => optionToTopic[option.toUpperCase()])
        .filter(topic => topic !== undefined);
      
      if (helpTopics.length === 0) {
        console.log('No valid help topics selected', { selectedOptions });
        return;
      }
      
      // Import the WelcomeFaxGenerator
      const { WelcomeFaxGenerator } = await import('./welcomeFaxGenerator');
      
      // Send detailed help fax for each requested topic
      for (const topic of helpTopics) {
        const helpFaxBuffers = await WelcomeFaxGenerator.generateDetailedHelpFax(
          topic as 'email' | 'shopping' | 'payment' | 'ai' | 'address_book'
        );
        
        const mediaUrl = await faxSenderService.uploadTiffForFax(
          helpFaxBuffers[0],
          `help_${topic}_${userId}_${Date.now()}`
        );
        
        await faxSenderService.sendFaxWithRetry({
          to: phoneNumber,
          from: config.telnyx.faxNumber,
          mediaUrl,
          referenceId: `HELP-${topic.toUpperCase()}-${Date.now()}`,
        });
        
        console.log('Sent detailed help fax', { userId, phoneNumber, topic });
      }
      
      // Log help fax sending
      await auditLogService.logOperation({
        entityType: 'user',
        entityId: userId,
        operation: 'help_fax_sent',
        details: {
          phoneNumber,
          selectedOptions,
          helpTopics,
          topicCount: helpTopics.length,
        },
      });
      
    } catch (error) {
      console.error('Failed to send help fax:', error);
      
      // Log the error
      await auditLogService.logOperation({
        entityType: 'user',
        entityId: userId,
        operation: 'help_fax_failed',
        details: {
          phoneNumber,
          selectedOptions,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Handle payment method registration requests
   */
  async handlePaymentRegistrationRequest(userId: string, phoneNumber: string): Promise<void> {
    try {
      console.log('Handling payment registration request', { userId, phoneNumber });
      
      // Import the WelcomeFaxGenerator
      const { WelcomeFaxGenerator } = await import('./welcomeFaxGenerator');
      
      // Generate payment registration instructions fax
      const instructionsFaxBuffers = await WelcomeFaxGenerator.generatePaymentRegistrationInstructionsFax();
      
      const mediaUrl = await faxSenderService.uploadTiffForFax(
        instructionsFaxBuffers[0],
        `payment_instructions_${userId}_${Date.now()}`
      );
      
      await faxSenderService.sendFaxWithRetry({
        to: phoneNumber,
        from: config.telnyx.faxNumber,
        mediaUrl,
        referenceId: `PAYMENT-INSTRUCTIONS-${Date.now()}`,
      });
      
      // Log payment instructions sending
      await auditLogService.logOperation({
        entityType: 'user',
        entityId: userId,
        operation: 'payment_instructions_sent',
        details: {
          phoneNumber,
          trigger: 'user_request',
        },
      });
      
      console.log('Sent payment registration instructions', { userId, phoneNumber });
      
    } catch (error) {
      console.error('Failed to send payment registration instructions:', error);
      
      // Log the error
      await auditLogService.logOperation({
        entityType: 'user',
        entityId: userId,
        operation: 'payment_instructions_failed',
        details: {
          phoneNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
}