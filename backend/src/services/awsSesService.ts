import { 
  SESClient, 
  SendEmailCommand, 
  SendRawEmailCommand,
  VerifyEmailIdentityCommand,
  GetSendStatisticsCommand,
  GetSendQuotaCommand,
  type SendEmailCommandInput,
  type GetSendStatisticsCommandOutput,
  type GetSendQuotaCommandOutput
} from '@aws-sdk/client-ses';
import { config } from '../config';
import { auditLogService } from './auditLogService';

export interface AwsSesEmailParams {
  from: string;
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
}

export interface AwsSesSendResult {
  messageId: string;
}

export interface SesStatistics {
  sendDataPoints: Array<{
    timestamp: Date;
    deliveryAttempts: number;
    bounces: number;
    complaints: number;
    rejects: number;
  }>;
  max24HourSend: number;
  maxSendRate: number;
  sentLast24Hours: number;
}

/**
 * AWS SES Service - Handles email sending via Amazon Simple Email Service
 * 
 * Features:
 * - Email sending with retry logic
 * - Rate limiting and throttling handling
 * - Email identity verification
 * - Sending statistics retrieval
 * - Support for both text and HTML email bodies
 */
export class AwsSesService {
  private client: SESClient;
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

  constructor() {
    // Initialize SES client with configuration
    const region = config.email.sesRegion || process.env.AWS_REGION || 'us-east-1';
    const accessKeyId = config.email.sesAccessKeyId || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = config.email.sesSecretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;

    const sesConfig: any = { region };

    // Only set explicit credentials if provided (otherwise use IAM role)
    if (accessKeyId && secretAccessKey) {
      sesConfig.credentials = {
        accessKeyId,
        secretAccessKey
      };
      console.log(`AWS SES Service initialized with explicit credentials for region: ${region}`);
    } else {
      console.log(`AWS SES Service initialized with IAM role for region: ${region}`);
    }

    this.client = new SESClient(sesConfig);
  }

  /**
   * Send an email via AWS SES
   * Includes retry logic for transient failures
   */
  async sendEmail(params: AwsSesEmailParams): Promise<AwsSesSendResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.sendEmailAttempt(params);
        
        // Log successful send
        await auditLogService.log({
          eventType: 'email.sent_via_ses',
          eventData: {
            to: params.to,
            from: params.from,
            subject: params.subject,
            messageId: result.messageId,
            attempt,
            timestamp: new Date().toISOString()
          }
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw lastError;
        }

        // Log retry attempt
        console.warn(`AWS SES send attempt ${attempt} failed, retrying...`, {
          error: lastError.message,
          to: params.to
        });

        // Wait before retry with exponential backoff
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelayMs * Math.pow(2, attempt - 1));
        }
      }
    }

    // All retries exhausted
    await auditLogService.log({
      eventType: 'email.send_failed',
      eventData: {
        to: params.to,
        from: params.from,
        subject: params.subject,
        error: lastError?.message,
        attempts: this.maxRetries,
        timestamp: new Date().toISOString()
      }
    });

    throw lastError || new Error('Failed to send email after retries');
  }

  /**
   * Attempt to send email (single attempt)
   */
  private async sendEmailAttempt(params: AwsSesEmailParams): Promise<AwsSesSendResult> {
    const input: SendEmailCommandInput = {
      Source: params.from,
      ReplyToAddresses: [params.from],
      Destination: {
        ToAddresses: [params.to]
      },
      Message: {
        Subject: {
          Data: params.subject,
          Charset: 'UTF-8'
        },
        Body: params.htmlBody ? {
          Html: {
            Data: params.htmlBody,
            Charset: 'UTF-8'
          },
          Text: {
            Data: params.body,
            Charset: 'UTF-8'
          }
        } : {
          Text: {
            Data: params.body,
            Charset: 'UTF-8'
          }
        }
      }
    };

    const command = new SendEmailCommand(input);
    const response = await this.client.send(command);

    if (!response.MessageId) {
      throw new Error('AWS SES did not return a message ID');
    }

    return {
      messageId: response.MessageId
    };
  }

  /**
   * Verify an email identity (email address or domain)
   */
  async verifyEmailIdentity(email: string): Promise<void> {
    try {
      const command = new VerifyEmailIdentityCommand({
        EmailAddress: email
      });

      await this.client.send(command);

      await auditLogService.log({
        eventType: 'email.identity_verification_requested',
        eventData: { 
          email,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`Verification email sent to: ${email}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to verify email identity:', errorMessage);
      throw new Error(`Failed to verify email identity: ${errorMessage}`);
    }
  }

  /**
   * Get sending statistics from AWS SES
   */
  async getSendingStatistics(): Promise<SesStatistics> {
    try {
      // Get send statistics (last 2 weeks of data points)
      const statsCommand = new GetSendStatisticsCommand({});
      const statsResponse: GetSendStatisticsCommandOutput = await this.client.send(statsCommand);

      // Get send quota
      const quotaCommand = new GetSendQuotaCommand({});
      const quotaResponse: GetSendQuotaCommandOutput = await this.client.send(quotaCommand);

      return {
        sendDataPoints: (statsResponse.SendDataPoints || []).map(point => ({
          timestamp: point.Timestamp || new Date(),
          deliveryAttempts: point.DeliveryAttempts || 0,
          bounces: point.Bounces || 0,
          complaints: point.Complaints || 0,
          rejects: point.Rejects || 0
        })),
        max24HourSend: quotaResponse.Max24HourSend || 0,
        maxSendRate: quotaResponse.MaxSendRate || 0,
        sentLast24Hours: quotaResponse.SentLast24Hours || 0
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to get sending statistics:', errorMessage);
      throw new Error(`Failed to get sending statistics: ${errorMessage}`);
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // AWS SDK error codes that should be retried
    const retryableErrorCodes = [
      'Throttling',
      'TooManyRequestsException',
      'ServiceUnavailable',
      'RequestTimeout',
      'NetworkingError'
    ];

    // Check error code
    if (error?.name && retryableErrorCodes.includes(error.name)) {
      return true;
    }

    // Check error message for throttling indicators
    const errorMessage = error?.message?.toLowerCase() || '';
    if (errorMessage.includes('throttl') || 
        errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests')) {
      return true;
    }

    return false;
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if SES is properly configured
   */
  isConfigured(): boolean {
    const accessKeyId = config.email.sesAccessKeyId || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = config.email.sesSecretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
    return !!(accessKeyId && secretAccessKey);
  }
}

// Export singleton instance
export const awsSesService = new AwsSesService();
