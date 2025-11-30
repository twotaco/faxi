import axios from 'axios';
import { config } from '../config';
import { auditLogService } from './auditLogService';
import { emailThreadRepository, emailMessageRepository } from '../repositories/emailThreadRepository';
import { awsSesService } from './awsSesService';
import { emailMetricsService } from './emailMetricsService';

export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  body: string;
  threadId?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailThread {
  threadId: string;
  emails: EmailMessage[];
}

export interface EmailSearchResult {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  timestamp: Date;
}

/**
 * Email Service - Handles email sending and management
 * 
 * Supports multiple email providers:
 * - SendGrid (recommended for production)
 * - AWS SES (for AWS-based deployments)
 * - Postfix (for self-hosted solutions)
 */
export class EmailService {
  /**
   * Send an email using the configured provider
   */
  async sendEmail(message: EmailMessage, userId?: string): Promise<EmailSendResult> {
    try {
      let result: EmailSendResult;
      
      switch (config.email.provider) {
        case 'sendgrid':
          result = await this.sendViaSendGrid(message);
          break;
        case 'ses':
          result = await this.sendViaSES(message);
          break;
        case 'postfix':
          result = await this.sendViaPostfix(message);
          break;
        default:
          throw new Error(`Unsupported email provider: ${config.email.provider}`);
      }

      // Store sent email in database if successful and userId provided
      if (result.success && userId && result.messageId) {
        await this.storeEmailInDatabase(message, result.messageId, userId, 'outbound');
      }

      // Log successful send
      if (result.success) {
        await auditLogService.log({
          userId,
          eventType: 'email.sent',
          eventData: {
            messageId: result.messageId,
            to: message.to,
            from: message.from,
            subject: message.subject,
            provider: config.email.provider
          }
        });

        // Record 'sent' event for metrics tracking (Requirement 17.1)
        await emailMetricsService.recordEmailEvent({
          eventType: 'sent',
          userId,
          messageId: result.messageId,
          details: {
            to: message.to,
            from: message.from,
            provider: config.email.provider
          }
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown email error';
      
      // Log error with full context (Requirement 12.1)
      await auditLogService.log({
        userId,
        eventType: 'email.send_failed',
        eventData: {
          error: errorMessage,
          to: message.to,
          from: message.from,
          subject: message.subject,
          provider: config.email.provider,
          timestamp: new Date().toISOString()
        }
      });

      // Check if this is a critical error that requires admin alert (Requirement 12.7)
      if (this.isCriticalError(errorMessage)) {
        console.error(`CRITICAL EMAIL ERROR: ${errorMessage}`);
        // In production, this would trigger alertingService.sendAlert()
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Determine if an error is critical and requires admin notification
   */
  private isCriticalError(errorMessage: string): boolean {
    const criticalPatterns = [
      'suspended',
      'database connection',
      'queue system',
      'storage service',
      'authentication failed',
      'credentials invalid'
    ];
    
    const lowerMessage = errorMessage.toLowerCase();
    return criticalPatterns.some(pattern => lowerMessage.includes(pattern));
  }

  /**
   * Store email in database for thread tracking
   */
  async storeEmailInDatabase(
    message: EmailMessage, 
    messageId: string, 
    userId: string, 
    direction: 'inbound' | 'outbound'
  ): Promise<void> {
    try {
      // Generate thread ID if not provided
      const threadId = message.threadId || this.generateThreadId(message.subject, [message.from, message.to]);
      
      // Find or create email thread
      const thread = await emailThreadRepository.findOrCreate({
        userId,
        threadId,
        subject: message.subject,
        participants: [message.from, message.to],
        lastMessageAt: new Date()
      });

      // Store the message
      await emailMessageRepository.create({
        threadId,
        messageId,
        fromAddress: message.from,
        toAddresses: [message.to],
        subject: message.subject,
        body: message.body,
        direction,
        sentAt: new Date()
      });

      // Update thread with new message
      await emailThreadRepository.updateWithNewMessage(threadId, new Date());
      
    } catch (error) {
      // Don't fail email sending if database storage fails
      console.warn('Failed to store email in database:', error);
    }
  }

  /**
   * Generate thread ID for email conversation
   */
  generateThreadId(subject: string, participants: string[]): string {
    // Simple thread ID generation - could be enhanced
    const sortedParticipants = participants.sort().join(',');
    const cleanSubject = subject.replace(/^(Re:|Fwd?:)\s*/i, '').trim();
    return `thread_${Buffer.from(cleanSubject + sortedParticipants).toString('base64').substring(0, 16)}`;
  }

  /**
   * Get user's Faxi email address
   */
  getUserEmailAddress(phoneNumber: string): string {
    // Remove any non-digit characters and format as email
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    return `${cleanPhone}@${config.email.fromDomain}`;
  }

  /**
   * Parse recipient - can be email address or contact name
   */
  parseRecipient(recipient: string): { email?: string; name?: string } {
    // Check if it's an email address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(recipient)) {
      return { email: recipient };
    }
    
    // Otherwise treat as contact name
    return { name: recipient };
  }

  /**
   * Get email thread (placeholder - would integrate with email provider's API)
   */
  async getEmailThread(threadId: string): Promise<EmailThread | null> {
    // This would integrate with the email provider's API to retrieve thread history
    // For now, return null as this requires provider-specific implementation
    return null;
  }

  /**
   * Search emails (placeholder - would integrate with email provider's API)
   */
  async searchEmails(userId: string, query: string, limit: number = 10): Promise<EmailSearchResult[]> {
    // This would integrate with the email provider's API to search emails
    // For now, return empty array as this requires provider-specific implementation
    return [];
  }

  /**
   * Send email via SendGrid
   */
  private async sendViaSendGrid(message: EmailMessage): Promise<EmailSendResult> {
    if (!config.email.sendgridApiKey) {
      throw new Error('SendGrid API key not configured');
    }

    const payload = {
      personalizations: [{
        to: [{ email: message.to }],
        subject: message.subject
      }],
      from: { email: message.from },
      content: [{
        type: 'text/plain',
        value: message.body
      }]
    };

    const response = await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${config.email.sendgridApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // SendGrid returns 202 for success
    if (response.status === 202) {
      const messageId = response.headers['x-message-id'] || `sg_${Date.now()}`;
      return {
        success: true,
        messageId
      };
    }

    throw new Error(`SendGrid API error: ${response.status}`);
  }

  /**
   * Send email via AWS SES
   */
  private async sendViaSES(message: EmailMessage): Promise<EmailSendResult> {
    try {
      // Check if AWS SES is configured
      if (!awsSesService.isConfigured()) {
        throw new Error('AWS SES is not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
      }

      // Send email via AWS SES
      const result = await awsSesService.sendEmail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        body: message.body
      });

      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      // Handle AWS-specific error codes
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log AWS SES specific error
      await auditLogService.log({
        eventType: 'email.aws_ses_error',
        eventData: {
          error: errorMessage,
          to: message.to,
          from: message.from,
          subject: message.subject
        }
      });
      
      // Check for specific AWS error types
      if (errorMessage.includes('Throttling') || errorMessage.includes('rate limit')) {
        return {
          success: false,
          error: 'Email sending rate limit exceeded. Please try again later.'
        };
      }
      
      if (errorMessage.includes('InvalidParameterValue') || errorMessage.includes('invalid')) {
        return {
          success: false,
          error: 'Invalid email address or parameters'
        };
      }
      
      if (errorMessage.includes('MessageRejected')) {
        return {
          success: false,
          error: 'Email was rejected by AWS SES. Check sender verification.'
        };
      }

      // Generic error
      return {
        success: false,
        error: `Failed to send email via AWS SES: ${errorMessage}`
      };
    }
  }

  /**
   * Send email via Postfix/SMTP
   */
  private async sendViaPostfix(message: EmailMessage): Promise<EmailSendResult> {
    // This would use nodemailer or similar to send via SMTP
    // For now, throw error as nodemailer is not included in dependencies
    throw new Error('Postfix/SMTP integration not yet implemented - requires nodemailer');
  }

  /**
   * Validate email address format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate message ID for tracking
   */
  generateMessageId(): string {
    return `faxi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const emailService = new EmailService();