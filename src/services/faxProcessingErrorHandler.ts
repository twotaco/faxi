import { FaxJobData } from '../queue/faxQueue';
import { ResponseGenerator } from './responseGenerator';
import { faxSenderService } from './faxSenderService';
import { auditLogService } from './auditLogService';
import { faxJobRepository } from '../repositories/faxJobRepository';
import { config } from '../config';

export interface ErrorContext {
  faxJobId: string;
  faxData: FaxJobData;
  userId?: string;
  stage: 'download' | 'interpretation' | 'agent_processing' | 'response_generation' | 'fax_sending';
  originalError: Error;
  retryCount?: number;
}

export interface ErrorHandlingResult {
  shouldRetry: boolean;
  retryDelay?: number;
  userNotified: boolean;
  operatorAlerted: boolean;
  errorFaxSent: boolean;
}

export class FaxProcessingErrorHandler {
  /**
   * Main error handling function that determines appropriate response
   */
  static async handleError(context: ErrorContext): Promise<ErrorHandlingResult> {
    const { faxJobId, faxData, userId, stage, originalError, retryCount = 0 } = context;
    
    try {
      // Log the error
      await auditLogService.logOperation({
        entityType: 'fax_job',
        entityId: faxJobId,
        operation: 'processing_error',
        details: {
          stage,
          error: originalError.message,
          retryCount,
          fromNumber: faxData.fromNumber,
          toNumber: faxData.toNumber,
        },
      });

      // Determine error type and appropriate response
      const errorType = this.classifyError(originalError, stage);
      const shouldRetry = this.shouldRetryError(errorType, retryCount);
      
      let userNotified = false;
      let operatorAlerted = false;
      let errorFaxSent = false;

      // Handle based on error type
      switch (errorType) {
        case 'user_facing':
          // Send helpful error fax to user
          errorFaxSent = await this.sendUserErrorFax(faxData, originalError, stage);
          userNotified = errorFaxSent;
          break;

        case 'system_error':
          // Alert operators for system issues
          operatorAlerted = await this.alertOperators(context);
          
          // Send generic error fax to user if not retrying
          if (!shouldRetry) {
            errorFaxSent = await this.sendGenericErrorFax(faxData);
            userNotified = errorFaxSent;
          }
          break;

        case 'temporary':
          // Just retry, don't notify user yet
          if (!shouldRetry) {
            // If we've exhausted retries, treat as system error
            operatorAlerted = await this.alertOperators(context);
            errorFaxSent = await this.sendGenericErrorFax(faxData);
            userNotified = errorFaxSent;
          }
          break;

        case 'configuration':
          // Alert operators immediately
          operatorAlerted = await this.alertOperators(context);
          errorFaxSent = await this.sendGenericErrorFax(faxData);
          userNotified = errorFaxSent;
          break;
      }

      // Update fax job status if not retrying
      if (!shouldRetry) {
        await faxJobRepository.updateStatus(faxJobId, 'failed', {
          errorMessage: originalError.message,
          errorType,
          stage,
          retryCount,
        });
      }

      return {
        shouldRetry,
        retryDelay: shouldRetry ? this.calculateRetryDelay(retryCount) : undefined,
        userNotified,
        operatorAlerted,
        errorFaxSent,
      };

    } catch (handlingError) {
      console.error('Error in error handler:', handlingError);
      
      // Fallback: alert operators about both the original error and handling error
      await this.alertOperators({
        ...context,
        originalError: new Error(`Original: ${originalError.message}. Handler: ${handlingError instanceof Error ? handlingError.message : 'Unknown'}`),
      });

      return {
        shouldRetry: false,
        userNotified: false,
        operatorAlerted: true,
        errorFaxSent: false,
      };
    }
  }

  /**
   * Classify error type to determine appropriate response
   */
  private static classifyError(error: Error, stage: string): 'user_facing' | 'system_error' | 'temporary' | 'configuration' {
    const message = error.message.toLowerCase();

    // Configuration errors (API keys, missing services)
    if (message.includes('invalid api key') || 
        message.includes('unauthorized') || 
        message.includes('forbidden') ||
        message.includes('configuration')) {
      return 'configuration';
    }

    // User-facing errors (bad fax quality, unclear requests)
    if (stage === 'interpretation' && (
        message.includes('low confidence') ||
        message.includes('unclear') ||
        message.includes('cannot determine intent') ||
        message.includes('poor image quality')
    )) {
      return 'user_facing';
    }

    // Temporary errors (network issues, rate limiting, service unavailable)
    if (message.includes('timeout') ||
        message.includes('rate limit') ||
        message.includes('service unavailable') ||
        message.includes('connection') ||
        message.includes('network') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504')) {
      return 'temporary';
    }

    // Default to system error
    return 'system_error';
  }

  /**
   * Determine if error should be retried
   */
  private static shouldRetryError(errorType: string, retryCount: number): boolean {
    const maxRetries = 3;

    if (retryCount >= maxRetries) {
      return false;
    }

    switch (errorType) {
      case 'temporary':
        return true;
      case 'system_error':
        return retryCount < 2; // Retry system errors fewer times
      case 'user_facing':
      case 'configuration':
        return false; // Don't retry these
      default:
        return false;
    }
  }

  /**
   * Calculate exponential backoff delay for retries
   */
  private static calculateRetryDelay(retryCount: number): number {
    // Exponential backoff: 2s, 4s, 8s
    return Math.min(2000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
  }

  /**
   * Send helpful error fax to user for user-facing errors
   */
  private static async sendUserErrorFax(
    faxData: FaxJobData,
    error: Error,
    stage: string
  ): Promise<boolean> {
    try {
      let errorMessage: string;
      let suggestedActions: string[];

      if (stage === 'interpretation') {
        errorMessage = 'I had trouble reading your fax clearly.';
        suggestedActions = [
          'Please write more clearly or use larger text',
          'Make sure your fax machine is producing clear images',
          'Try writing your request in simple, clear sentences',
          'Include specific details about what you need',
        ];
      } else if (stage === 'agent_processing') {
        errorMessage = 'I couldn\'t complete your request as written.';
        suggestedActions = [
          'Please provide more specific details',
          'Check that email addresses are correct',
          'Make sure product names are spelled correctly',
          'Include all required information in your request',
        ];
      } else {
        errorMessage = 'I encountered an issue processing your request.';
        suggestedActions = [
          'Please try sending your request again',
          'Contact support if the problem continues',
        ];
      }

      const errorFaxResult = await ResponseGenerator.generateErrorFax(
        errorMessage,
        suggestedActions
      );

      const mediaUrl = await faxSenderService.uploadTiffForFax(
        errorFaxResult.tiffBuffers[0],
        `user_error_${faxData.faxId}`
      );

      await faxSenderService.sendFaxWithRetry({
        to: faxData.fromNumber,
        from: config.telnyx.faxNumber,
        mediaUrl,
        referenceId: errorFaxResult.referenceId,
      });

      console.log('User error fax sent successfully', {
        faxId: faxData.faxId,
        toNumber: faxData.fromNumber,
        stage,
      });

      return true;

    } catch (sendError) {
      console.error('Failed to send user error fax:', sendError);
      return false;
    }
  }

  /**
   * Send generic error fax for system errors
   */
  private static async sendGenericErrorFax(faxData: FaxJobData): Promise<boolean> {
    try {
      const errorFaxResult = await ResponseGenerator.generateErrorFax(
        'We\'re experiencing technical difficulties and couldn\'t process your request.',
        [
          'Please try again in a few minutes',
          'If the problem continues, contact support:',
          'Email: help@faxi.jp',
          'Phone: +81-3-1234-5678',
        ]
      );

      const mediaUrl = await faxSenderService.uploadTiffForFax(
        errorFaxResult.tiffBuffers[0],
        `system_error_${faxData.faxId}`
      );

      await faxSenderService.sendFaxWithRetry({
        to: faxData.fromNumber,
        from: config.telnyx.faxNumber,
        mediaUrl,
        referenceId: errorFaxResult.referenceId,
      });

      console.log('Generic error fax sent successfully', {
        faxId: faxData.faxId,
        toNumber: faxData.fromNumber,
      });

      return true;

    } catch (sendError) {
      console.error('Failed to send generic error fax:', sendError);
      return false;
    }
  }

  /**
   * Alert operators about system errors
   */
  private static async alertOperators(context: ErrorContext): Promise<boolean> {
    try {
      const { faxJobId, faxData, stage, originalError, retryCount = 0 } = context;

      // Log high-priority alert
      await auditLogService.logOperation({
        entityType: 'system_alert',
        entityId: faxJobId,
        operation: 'operator_alert',
        details: {
          priority: 'high',
          stage,
          error: originalError.message,
          retryCount,
          fromNumber: faxData.fromNumber,
          toNumber: faxData.toNumber,
          faxId: faxData.faxId,
          timestamp: new Date().toISOString(),
        },
      });

      // In a production system, this would:
      // 1. Send email/SMS to on-call operators
      // 2. Create tickets in monitoring system (PagerDuty, etc.)
      // 3. Post to Slack/Teams channels
      // 4. Update system status page

      console.error('OPERATOR ALERT: Fax processing system error', {
        faxJobId,
        faxId: faxData.faxId,
        stage,
        error: originalError.message,
        retryCount,
        fromNumber: faxData.fromNumber,
      });

      // For now, just log the alert
      // TODO: Implement actual alerting mechanism
      
      return true;

    } catch (alertError) {
      console.error('Failed to alert operators:', alertError);
      return false;
    }
  }

  /**
   * Handle specific error types with custom logic
   */
  static async handleSpecificError(
    errorType: 'vision_api_quota' | 'telnyx_rate_limit' | 'storage_full' | 'payment_failed',
    context: ErrorContext
  ): Promise<ErrorHandlingResult> {
    switch (errorType) {
      case 'vision_api_quota':
        return this.handleVisionAPIQuotaError(context);
      
      case 'telnyx_rate_limit':
        return this.handleTelnyxRateLimitError(context);
      
      case 'storage_full':
        return this.handleStorageFullError(context);
      
      case 'payment_failed':
        return this.handlePaymentFailedError(context);
      
      default:
        return this.handleError(context);
    }
  }

  /**
   * Handle Vision API quota exceeded
   */
  private static async handleVisionAPIQuotaError(context: ErrorContext): Promise<ErrorHandlingResult> {
    // Alert operators immediately
    await this.alertOperators({
      ...context,
      originalError: new Error('Vision API quota exceeded - immediate attention required'),
    });

    // Send user fax explaining delay
    const errorFaxSent = await this.sendUserErrorFax(
      context.faxData,
      new Error('We\'re experiencing high volume and your request is queued for processing.'),
      context.stage
    );

    return {
      shouldRetry: true,
      retryDelay: 60000, // 1 minute delay
      userNotified: errorFaxSent,
      operatorAlerted: true,
      errorFaxSent,
    };
  }

  /**
   * Handle Telnyx rate limiting
   */
  private static async handleTelnyxRateLimitError(context: ErrorContext): Promise<ErrorHandlingResult> {
    return {
      shouldRetry: true,
      retryDelay: 30000, // 30 second delay
      userNotified: false,
      operatorAlerted: false,
      errorFaxSent: false,
    };
  }

  /**
   * Handle storage full errors
   */
  private static async handleStorageFullError(context: ErrorContext): Promise<ErrorHandlingResult> {
    // Alert operators immediately
    await this.alertOperators({
      ...context,
      originalError: new Error('Storage full - immediate cleanup required'),
    });

    return {
      shouldRetry: false,
      userNotified: false,
      operatorAlerted: true,
      errorFaxSent: false,
    };
  }

  /**
   * Handle payment processing failures
   */
  private static async handlePaymentFailedError(context: ErrorContext): Promise<ErrorHandlingResult> {
    // Send specific payment error fax
    const errorFaxSent = await this.sendUserErrorFax(
      context.faxData,
      new Error('Payment processing failed. Please check your payment method or try a different payment option.'),
      context.stage
    );

    return {
      shouldRetry: false,
      userNotified: errorFaxSent,
      operatorAlerted: false,
      errorFaxSent,
    };
  }

  /**
   * Get error statistics for monitoring
   */
  static async getErrorStatistics(timeRange: { start: Date; end: Date }): Promise<{
    totalErrors: number;
    errorsByStage: Record<string, number>;
    errorsByType: Record<string, number>;
    retrySuccessRate: number;
  }> {
    // This would query the audit logs to get error statistics
    // For now, return mock data
    return {
      totalErrors: 0,
      errorsByStage: {},
      errorsByType: {},
      retrySuccessRate: 0,
    };
  }
}

// Export for use in the pipeline
export const faxProcessingErrorHandler = FaxProcessingErrorHandler;