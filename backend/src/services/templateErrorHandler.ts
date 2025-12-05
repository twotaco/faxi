import { loggingService } from './loggingService.js';
import { auditLogService } from './auditLogService.js';

/**
 * Error types for template rendering
 */
export enum TemplateErrorType {
  IMAGE_DOWNLOAD_FAILED = 'image_download_failed',
  IMAGE_PROCESSING_FAILED = 'image_processing_failed',
  IMAGE_INVALID_URL = 'image_invalid_url',
  IMAGE_TIMEOUT = 'image_timeout',
  IMAGE_TOO_LARGE = 'image_too_large',
  TEMPLATE_RENDERING_FAILED = 'template_rendering_failed',
  PDF_GENERATION_FAILED = 'pdf_generation_failed',
  CONTENT_OVERFLOW = 'content_overflow',
  UNKNOWN = 'unknown'
}

/**
 * Severity levels for template errors
 */
export enum TemplateErrorSeverity {
  WARNING = 'warning',  // Non-critical, fallback applied
  ERROR = 'error',      // Critical but recoverable
  CRITICAL = 'critical' // System-wide failure
}

/**
 * Structured error information
 */
export interface TemplateError {
  type: TemplateErrorType;
  severity: TemplateErrorSeverity;
  message: string;
  originalError?: Error;
  context: {
    userId?: string;
    faxJobId?: string;
    referenceId?: string;
    templateType?: string;
    contentType?: string;
    imageUrl?: string;
    [key: string]: any;
  };
  fallbackApplied: boolean;
  timestamp: Date;
}

/**
 * Template Error Handler
 * 
 * Centralized error handling for template rendering operations.
 * Provides structured error logging, metrics tracking, and fallback coordination.
 */
export class TemplateErrorHandler {
  /**
   * Handle image download error
   */
  static handleImageDownloadError(
    error: Error,
    imageUrl: string,
    context: TemplateError['context']
  ): TemplateError {
    const errorType = this.classifyImageError(error);
    const severity = TemplateErrorSeverity.WARNING; // Images are non-critical
    
    const templateError: TemplateError = {
      type: errorType,
      severity,
      message: `Failed to download image from ${imageUrl}: ${error.message}`,
      originalError: error,
      context: {
        ...context,
        imageUrl,
        errorDetails: error.message
      },
      fallbackApplied: true,
      timestamp: new Date()
    };

    this.logError(templateError);
    return templateError;
  }

  /**
   * Handle image processing error
   */
  static handleImageProcessingError(
    error: Error,
    imageUrl: string | undefined,
    context: TemplateError['context']
  ): TemplateError {
    const templateError: TemplateError = {
      type: TemplateErrorType.IMAGE_PROCESSING_FAILED,
      severity: TemplateErrorSeverity.WARNING,
      message: `Failed to process image: ${error.message}`,
      originalError: error,
      context: {
        ...context,
        imageUrl,
        errorDetails: error.message
      },
      fallbackApplied: true,
      timestamp: new Date()
    };

    this.logError(templateError);
    return templateError;
  }

  /**
   * Handle template rendering error
   */
  static handleTemplateRenderingError(
    error: Error,
    templateType: string,
    context: TemplateError['context']
  ): TemplateError {
    const templateError: TemplateError = {
      type: TemplateErrorType.TEMPLATE_RENDERING_FAILED,
      severity: TemplateErrorSeverity.ERROR,
      message: `Failed to render template ${templateType}: ${error.message}`,
      originalError: error,
      context: {
        ...context,
        templateType,
        errorDetails: error.message,
        stack: error.stack
      },
      fallbackApplied: false,
      timestamp: new Date()
    };

    this.logError(templateError);
    return templateError;
  }

  /**
   * Handle PDF generation error
   */
  static handlePDFGenerationError(
    error: Error,
    context: TemplateError['context']
  ): TemplateError {
    const templateError: TemplateError = {
      type: TemplateErrorType.PDF_GENERATION_FAILED,
      severity: TemplateErrorSeverity.CRITICAL,
      message: `Failed to generate PDF: ${error.message}`,
      originalError: error,
      context: {
        ...context,
        errorDetails: error.message,
        stack: error.stack
      },
      fallbackApplied: false,
      timestamp: new Date()
    };

    this.logError(templateError);
    return templateError;
  }

  /**
   * Classify image error based on error message
   */
  private static classifyImageError(error: Error): TemplateErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return TemplateErrorType.IMAGE_TIMEOUT;
    }
    
    if (message.includes('too large') || message.includes('size limit')) {
      return TemplateErrorType.IMAGE_TOO_LARGE;
    }
    
    if (message.includes('invalid') || message.includes('not allowed')) {
      return TemplateErrorType.IMAGE_INVALID_URL;
    }
    
    if (message.includes('download') || message.includes('fetch') || message.includes('network')) {
      return TemplateErrorType.IMAGE_DOWNLOAD_FAILED;
    }
    
    return TemplateErrorType.IMAGE_PROCESSING_FAILED;
  }

  /**
   * Log error to logging and audit services
   */
  private static logError(templateError: TemplateError): void {
    // Log to logging service with structured data
    loggingService.error(
      templateError.message,
      templateError.originalError,
      {
        userId: templateError.context.userId,
        faxJobId: templateError.context.faxJobId,
      },
      {
        errorType: templateError.type,
        severity: templateError.severity,
        fallbackApplied: templateError.fallbackApplied,
        ...templateError.context
      }
    );

    // Log to audit service if we have user/job context
    if (templateError.context.userId || templateError.context.faxJobId) {
      auditLogService.logSystemError({
        userId: templateError.context.userId,
        faxJobId: templateError.context.faxJobId,
        errorType: templateError.type,
        errorMessage: templateError.message,
        stackTrace: templateError.originalError?.stack,
        context: templateError.context
      }).catch(err => {
        console.error('Failed to log error to audit service:', err);
      });
    }
  }

  /**
   * Get fallback text for image errors
   */
  static getImageFallbackText(imageUrl?: string): string {
    if (imageUrl) {
      return `[Image unavailable: ${imageUrl.substring(0, 50)}...]`;
    }
    return '[Image unavailable]';
  }

  /**
   * Check if error is recoverable
   */
  static isRecoverableError(error: TemplateError): boolean {
    return error.severity !== TemplateErrorSeverity.CRITICAL;
  }

  /**
   * Format error for user display (if needed)
   */
  static formatErrorForUser(error: TemplateError): string {
    switch (error.type) {
      case TemplateErrorType.IMAGE_DOWNLOAD_FAILED:
      case TemplateErrorType.IMAGE_TIMEOUT:
        return 'Some images could not be loaded. The fax has been sent with available information.';
      
      case TemplateErrorType.PDF_GENERATION_FAILED:
        return 'Failed to generate fax document. Please try again.';
      
      default:
        return 'An error occurred while generating your fax. Please contact support if this persists.';
    }
  }
}
