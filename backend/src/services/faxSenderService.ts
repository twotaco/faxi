import axios, { AxiosError } from 'axios';
import { config } from '../config';
import { s3Storage } from '../storage/s3';
import { auditLogService } from './auditLogService';
import { mockFaxSender } from './mockFaxSender';

export interface FaxSendRequest {
  to: string;
  from: string;
  mediaUrl: string;
  referenceId?: string;
  faxJobId?: string;
}

export interface FaxSendResponse {
  faxId: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  message?: string;
}

export interface TelnyxFaxRequest {
  to: string;
  from: string;
  media_url: string;
  quality?: 'normal' | 'high' | 'very_high';
  store_media?: boolean;
  webhook_url?: string;
}

export interface TelnyxFaxResponse {
  data: {
    id: string;
    record_type: string;
    to: string;
    from: string;
    media_url: string;
    quality: string;
    status: string;
    direction: string;
    created_at: string;
    updated_at: string;
  };
}

export class FaxSenderService {
  private readonly baseUrl = 'https://api.telnyx.com/v2';
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1 second

  /**
   * Send a fax via Telnyx API
   */
  async sendFax(request: FaxSendRequest): Promise<FaxSendResponse> {
    try {
      // Log the send attempt
      await auditLogService.logFaxTransmission({
        faxJobId: request.faxJobId,
        toNumber: request.to,
        fromNumber: request.from,
        mediaUrl: request.mediaUrl,
        referenceId: request.referenceId,
        status: 'attempting',
        attempt: 1,
      });

      // Prepare Telnyx API request
      const telnyxRequest: TelnyxFaxRequest = {
        to: request.to,
        from: request.from,
        media_url: request.mediaUrl,
        quality: 'normal',
        store_media: true,
        webhook_url: `${config.baseUrl}/webhooks/telnyx/fax/status`,
      };

      // In test mode, use mock sender
      if (config.app.testMode) {
        return this.mockSendFax(request);
      }

      // Make API call to Telnyx
      const response = await axios.post<TelnyxFaxResponse>(
        `${this.baseUrl}/faxes`,
        telnyxRequest,
        {
          headers: {
            'Authorization': `Bearer ${config.telnyx.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      const faxData = response.data.data;

      // Log successful send
      await auditLogService.logFaxTransmission({
        faxJobId: request.faxJobId,
        toNumber: request.to,
        fromNumber: request.from,
        mediaUrl: request.mediaUrl,
        referenceId: request.referenceId,
        status: 'queued',
        attempt: 1,
        telnyxFaxId: faxData.id,
      });

      return {
        faxId: faxData.id,
        status: faxData.status as any,
        message: 'Fax queued successfully',
      };
    } catch (error) {
      console.error('Error sending fax:', error);

      // Log the failure
      await auditLogService.logFaxTransmission({
        faxJobId: request.faxJobId,
        toNumber: request.to,
        fromNumber: request.from,
        mediaUrl: request.mediaUrl,
        referenceId: request.referenceId,
        status: 'failed',
        attempt: 1,
        errorMessage: this.getErrorMessage(error),
      });

      // Handle specific error types
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.response?.status === 429) {
          // Rate limiting - will be handled by retry logic
          throw new Error('Rate limited by Telnyx API');
        }
        
        if (axiosError.response?.status === 401) {
          throw new Error('Invalid Telnyx API credentials');
        }
        
        if (axiosError.response && axiosError.response.status >= 400 && axiosError.response.status < 500) {
          // Client error - don't retry
          throw new Error(`Telnyx API client error: ${axiosError.response.status}`);
        }
      }

      // Server error or network error - can be retried
      throw error;
    }
  }

  /**
   * Upload TIFF file to publicly accessible URL
   */
  async uploadTiffForFax(tiffBuffer: Buffer, faxJobId: string): Promise<string> {
    try {
      // Generate unique key for the TIFF file
      const key = s3Storage.generateFaxKey(`outbound-${faxJobId}`, 'tiff');

      // Upload to S3 with public read access
      await s3Storage.uploadFile(key, tiffBuffer, 'image/tiff');

      // Generate presigned URL with 24 hour expiration
      // This gives Telnyx enough time to download the file
      const publicUrl = await s3Storage.getPresignedUrl(key, 24 * 60 * 60);

      console.log('TIFF uploaded for fax sending', { key, faxJobId });
      return publicUrl;
    } catch (error) {
      console.error('Error uploading TIFF for fax:', error);
      throw new Error(`Failed to upload TIFF file: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Send fax with retry logic
   */
  async sendFaxWithRetry(request: FaxSendRequest): Promise<FaxSendResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Update request with current attempt info
        const attemptRequest = { ...request };
        
        const result = await this.sendFax(attemptRequest);
        
        // Success - log and return
        console.log('Fax sent successfully', { 
          faxId: result.faxId, 
          attempt, 
          to: request.to 
        });
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        console.warn(`Fax send attempt ${attempt} failed:`, {
          error: this.getErrorMessage(error),
          to: request.to,
          faxJobId: request.faxJobId,
        });

        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('client error')) {
          break;
        }

        // If this isn't the last attempt, wait before retrying
        if (attempt < this.maxRetries) {
          const delay = this.calculateBackoffDelay(attempt);
          console.log(`Waiting ${delay}ms before retry ${attempt + 1}`);
          await this.sleep(delay);
        }

        // Log retry attempt
        await auditLogService.logFaxTransmission({
          faxJobId: request.faxJobId,
          toNumber: request.to,
          fromNumber: request.from,
          mediaUrl: request.mediaUrl,
          referenceId: request.referenceId,
          status: 'retry',
          attempt: attempt + 1,
          errorMessage: this.getErrorMessage(error),
        });
      }
    }

    // All retries failed
    const finalError = new Error(
      `Failed to send fax after ${this.maxRetries} attempts. Last error: ${lastError?.message}`
    );

    // Log final failure
    await auditLogService.logFaxTransmission({
      faxJobId: request.faxJobId,
      toNumber: request.to,
      fromNumber: request.from,
      mediaUrl: request.mediaUrl,
      referenceId: request.referenceId,
      status: 'failed_final',
      attempt: this.maxRetries,
      errorMessage: finalError.message,
    });

    throw finalError;
  }

  /**
   * Mock fax sender for testing
   */
  private async mockSendFax(request: FaxSendRequest): Promise<FaxSendResponse> {
    try {
      // Use the mock fax sender service
      const result = await mockFaxSender.sendFax({
        toNumber: request.to,
        fromNumber: request.from,
        mediaUrl: request.mediaUrl,
        referenceId: request.referenceId,
        faxJobId: request.faxJobId,
      });

      if (result.success) {
        return {
          faxId: result.faxId,
          status: 'sent',
          message: 'Mock fax sent (test mode)',
        };
      } else {
        throw new Error(result.errorMessage || 'Mock fax delivery failed');
      }
    } catch (error) {
      console.error('Mock fax send failed:', error);
      throw error;
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, etc.
    return this.baseDelay * Math.pow(2, attempt - 1);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extract error message from various error types
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error';
  }
}

export const faxSenderService = new FaxSenderService();