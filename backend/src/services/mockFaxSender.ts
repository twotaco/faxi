import { v4 as uuidv4 } from 'uuid';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { auditLogService } from './auditLogService';
import { config } from '../config';

export interface MockFaxDeliveryResult {
  success: boolean;
  faxId: string;
  deliveryStatus: 'sent' | 'failed';
  errorMessage?: string;
  localFilePath?: string;
}

export interface MockFaxSendRequest {
  toNumber: string;
  fromNumber: string;
  mediaUrl: string;
  mediaBuffer?: Buffer;
  referenceId?: string;
  userId?: string;
  faxJobId?: string;
}

export class MockFaxSender {
  private mockDeliveryDelay: number;
  private mockFailureRate: number;
  private storageDir: string;

  constructor(options: {
    deliveryDelay?: number;
    failureRate?: number;
    storageDir?: string;
  } = {}) {
    this.mockDeliveryDelay = options.deliveryDelay || 2000; // 2 seconds
    this.mockFailureRate = options.failureRate || 0.0; // 0% failure rate for testing
    this.storageDir = options.storageDir || join(process.cwd(), 'test-faxes');

    // Ensure storage directory exists
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }

    // Initialize global storage for test response faxes
    if (!(global as any).testResponseFaxes) {
      (global as any).testResponseFaxes = new Map();
    }
  }

  /**
   * Send a fax using mock Telnyx service (saves to local storage instead)
   */
  async sendFax(request: MockFaxSendRequest): Promise<MockFaxDeliveryResult> {
    const mockFaxId = `mock_fax_${uuidv4()}`;
    
    try {
      // Log the send attempt
      await auditLogService.logFaxTransmission({
        userId: request.userId,
        faxJobId: request.faxJobId,
        fromNumber: request.fromNumber,
        toNumber: request.toNumber,
        status: 'attempting',
        telnyxFaxId: mockFaxId,
      });

      // Simulate network delay
      await this.delay(this.mockDeliveryDelay);

      // Simulate random failures
      const shouldFail = Math.random() < this.mockFailureRate;
      
      if (shouldFail) {
        const errorMessage = 'Mock delivery failure (simulated network error)';
        
        await auditLogService.logFaxTransmission({
          userId: request.userId,
          faxJobId: request.faxJobId,
          fromNumber: request.fromNumber,
          toNumber: request.toNumber,
          status: 'failed',
          telnyxFaxId: mockFaxId,
          errorMessage,
        });

        return {
          success: false,
          faxId: mockFaxId,
          deliveryStatus: 'failed',
          errorMessage,
        };
      }

      // Download media if URL provided
      let mediaBuffer = request.mediaBuffer;
      if (!mediaBuffer && request.mediaUrl) {
        mediaBuffer = await this.downloadMedia(request.mediaUrl);
      }

      if (!mediaBuffer) {
        throw new Error('No media buffer or URL provided');
      }

      // Detect file format from media buffer or default to PDF (Telnyx format)
      // Check magic bytes to determine file type
      const fileExt = this.detectFileFormat(mediaBuffer);

      // Save fax to local storage
      const filename = `${mockFaxId}_${Date.now()}.${fileExt}`;
      const localFilePath = join(this.storageDir, filename);

      writeFileSync(localFilePath, mediaBuffer);

      // Also upload to S3 for admin dashboard access
      try {
        const { s3Storage } = await import('../storage/s3');
        const s3Key = s3Storage.generateFaxKey(mockFaxId, fileExt);
        const contentType = fileExt === 'pdf' ? 'application/pdf' : `image/${fileExt}`;
        await s3Storage.uploadFile(s3Key, mediaBuffer, contentType);
        console.log('Mock fax uploaded to S3', { faxId: mockFaxId, s3Key, fileExt });
      } catch (s3Error) {
        console.error('Failed to upload mock fax to S3:', s3Error);
        // Don't fail the whole operation if S3 upload fails
      }

      // Store in global test storage for UI access
      const testResponseFaxes = (global as any).testResponseFaxes as Map<string, any>;
      testResponseFaxes.set(mockFaxId, {
        faxId: mockFaxId,
        toNumber: request.toNumber,
        fromNumber: request.fromNumber,
        referenceId: request.referenceId,
        localFilePath,
        filename,
        timestamp: new Date().toISOString(),
        mediaBuffer,
        deliveryStatus: 'sent',
      });

      // Log successful delivery
      await auditLogService.logFaxTransmission({
        userId: request.userId,
        faxJobId: request.faxJobId,
        fromNumber: request.fromNumber,
        toNumber: request.toNumber,
        status: 'mock_sent',
        telnyxFaxId: mockFaxId,
      });

      console.log('Mock fax sent successfully', {
        faxId: mockFaxId,
        toNumber: request.toNumber,
        fromNumber: request.fromNumber,
        localFilePath,
        referenceId: request.referenceId,
      });

      return {
        success: true,
        faxId: mockFaxId,
        deliveryStatus: 'sent',
        localFilePath,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await auditLogService.logFaxTransmission({
        userId: request.userId,
        faxJobId: request.faxJobId,
        fromNumber: request.fromNumber,
        toNumber: request.toNumber,
        status: 'failed',
        telnyxFaxId: mockFaxId,
        errorMessage,
      });

      return {
        success: false,
        faxId: mockFaxId,
        deliveryStatus: 'failed',
        errorMessage,
      };
    }
  }

  /**
   * Get all mock sent faxes
   */
  getMockSentFaxes(): Array<{
    faxId: string;
    toNumber: string;
    fromNumber: string;
    referenceId?: string;
    filename: string;
    timestamp: string;
    deliveryStatus: string;
    localFilePath: string;
  }> {
    const testResponseFaxes = (global as any).testResponseFaxes as Map<string, any>;
    if (!testResponseFaxes) {
      return [];
    }

    return Array.from(testResponseFaxes.values());
  }

  /**
   * Get a specific mock fax by ID
   */
  getMockFax(faxId: string): {
    faxId: string;
    toNumber: string;
    fromNumber: string;
    referenceId?: string;
    filename: string;
    timestamp: string;
    deliveryStatus: string;
    localFilePath: string;
    mediaBuffer: Buffer;
  } | null {
    const testResponseFaxes = (global as any).testResponseFaxes as Map<string, any>;
    if (!testResponseFaxes) {
      return null;
    }

    return testResponseFaxes.get(faxId) || null;
  }

  /**
   * Clear all mock faxes
   */
  clearMockFaxes(): void {
    const testResponseFaxes = (global as any).testResponseFaxes as Map<string, any>;
    if (testResponseFaxes) {
      testResponseFaxes.clear();
    }
  }

  /**
   * Detect file format from buffer magic bytes
   */
  private detectFileFormat(buffer: Buffer): string {
    // PDF magic bytes: %PDF
    if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return 'pdf';
    }

    // PNG magic bytes
    if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return 'png';
    }

    // JPEG magic bytes
    if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'jpeg';
    }

    // Default to PDF (Telnyx format)
    return 'pdf';
  }

  /**
   * Download media from URL
   */
  private async downloadMedia(mediaUrl: string): Promise<Buffer> {
    // If it's a local test URL, get from test storage
    if (mediaUrl.includes('/test/fax/media/')) {
      const faxId = mediaUrl.split('/').pop();
      const testFaxFiles = (global as any).testFaxFiles as Map<string, Buffer>;
      
      if (testFaxFiles && faxId && testFaxFiles.has(faxId)) {
        return testFaxFiles.get(faxId)!;
      }
      
      throw new Error(`Test fax file not found: ${faxId}`);
    }

    // For external URLs, use fetch
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Simulate network delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set mock failure rate for testing
   */
  setFailureRate(rate: number): void {
    this.mockFailureRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * Set mock delivery delay for testing
   */
  setDeliveryDelay(delayMs: number): void {
    this.mockDeliveryDelay = Math.max(0, delayMs);
  }

  /**
   * Get mock sender statistics
   */
  getStatistics(): {
    totalSent: number;
    totalFailed: number;
    successRate: number;
    averageDeliveryTime: number;
    storageDir: string;
  } {
    const testResponseFaxes = (global as any).testResponseFaxes as Map<string, any>;
    const faxes = testResponseFaxes ? Array.from(testResponseFaxes.values()) : [];
    
    const totalSent = faxes.filter(f => f.deliveryStatus === 'sent').length;
    const totalFailed = faxes.filter(f => f.deliveryStatus === 'failed').length;
    const total = totalSent + totalFailed;
    
    return {
      totalSent,
      totalFailed,
      successRate: total > 0 ? totalSent / total : 0,
      averageDeliveryTime: this.mockDeliveryDelay,
      storageDir: this.storageDir,
    };
  }
}

// Export singleton instance
export const mockFaxSender = new MockFaxSender({
  deliveryDelay: config.app.testMode ? 1000 : 2000, // Faster in test mode
  failureRate: 0.05, // 5% failure rate
  storageDir: join(process.cwd(), 'test-faxes'),
});