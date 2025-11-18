import { Worker, Job } from 'bullmq';
import { redis } from '../queue/connection';
import { EmailToFaxJobData } from '../queue/faxQueue';
import { EmailToFaxConverter } from './emailToFaxConverter';
import { faxSenderService } from './faxSenderService';
import { userRepository } from '../repositories/userRepository';
import { faxJobRepository } from '../repositories/faxJobRepository';
import { auditLogService } from './auditLogService';
import { config } from '../config';

export class EmailToFaxWorker {
  private worker: Worker<EmailToFaxJobData>;

  constructor() {
    this.worker = new Worker<EmailToFaxJobData>(
      'email-to-fax',
      this.processEmailToFax.bind(this),
      {
        connection: redis.getClient(),
        concurrency: 5, // Process up to 5 emails simultaneously
        removeOnComplete: {
          count: 100,
          age: 24 * 3600, // 24 hours
        },
        removeOnFail: {
          count: 500,
          age: 7 * 24 * 3600, // 7 days
        },
      }
    );

    this.worker.on('completed', (job) => {
      console.log('Email-to-fax job completed:', {
        jobId: job.id,
        to: job.data.to,
        from: job.data.from,
        subject: job.data.subject
      });
    });

    this.worker.on('failed', (job, err) => {
      console.error('Email-to-fax job failed:', {
        jobId: job?.id,
        to: job?.data.to,
        from: job?.data.from,
        error: err.message
      });
    });

    this.worker.on('error', (err) => {
      console.error('Email-to-fax worker error:', err);
    });
  }

  /**
   * Process email-to-fax conversion job
   */
  private async processEmailToFax(job: Job<EmailToFaxJobData>): Promise<void> {
    const { to, from, subject, body, receivedAt } = job.data;

    console.log('Processing email-to-fax job:', {
      jobId: job.id,
      to,
      from,
      subject: subject.substring(0, 50) + (subject.length > 50 ? '...' : '')
    });

    try {
      // Find user by phone number
      const user = await userRepository.findByPhoneNumber(to);
      if (!user) {
        throw new Error(`User not found for phone number: ${to}`);
      }

      // Create fax job record
      const faxJob = await faxJobRepository.create({
        faxId: `email-${job.id}`,
        fromNumber: config.telnyx.faxNumber, // Our fax number
        toNumber: to,
        direction: 'outbound',
        status: 'pending',
        userId: user.id,
        webhookPayload: {
          type: 'email_to_fax',
          originalEmail: {
            from,
            subject,
            receivedAt
          }
        }
      });

      // Update fax job status to processing
      await faxJobRepository.update(faxJob.id, { status: 'processing' });

      // Convert email to fax format
      const convertedFax = await EmailToFaxConverter.convertEmailToFax({
        from,
        subject,
        body,
        attachments: [] // Attachments are handled separately
      });

      console.log('Email converted to fax:', {
        jobId: job.id,
        faxJobId: faxJob.id,
        referenceId: convertedFax.referenceId,
        pageCount: convertedFax.pageCount,
        hasAttachments: convertedFax.hasAttachments
      });

      // Combine all TIFF pages into a single buffer
      const combinedTiff = this.combineTiffPages(convertedFax.tiffPages);

      // Upload TIFF to publicly accessible URL
      const mediaUrl = await faxSenderService.uploadTiffForFax(combinedTiff, faxJob.id);

      // Send fax with retry logic
      const sendResult = await faxSenderService.sendFaxWithRetry({
        to: to,
        from: config.telnyx.faxNumber,
        mediaUrl: mediaUrl,
        referenceId: convertedFax.referenceId,
        faxJobId: faxJob.id
      });

      // Update fax job with results
      await faxJobRepository.update(faxJob.id, {
        status: 'completed',
        actionResults: {
          referenceId: convertedFax.referenceId,
          pageCount: convertedFax.pageCount,
          telnyxFaxId: sendResult.faxId,
          mediaUrl: mediaUrl
        },
        telnyxFaxId: sendResult.faxId,
        completedAt: new Date()
      });

      // Log successful email-to-fax conversion
      await auditLogService.logOperation({
        entityType: 'email_to_fax',
        entityId: user.id,
        operation: 'converted_and_sent',
        details: {
          faxJobId: faxJob.id,
          originalEmail: {
            from,
            subject,
            bodyLength: body.length
          },
          faxResult: {
            referenceId: convertedFax.referenceId,
            pageCount: convertedFax.pageCount,
            telnyxFaxId: sendResult.faxId
          },
          processingTime: Date.now() - new Date(receivedAt).getTime()
        }
      });

      console.log('Email-to-fax processing completed:', {
        jobId: job.id,
        faxJobId: faxJob.id,
        telnyxFaxId: sendResult.faxId,
        referenceId: convertedFax.referenceId
      });

    } catch (error) {
      console.error('Error processing email-to-fax:', error);

      // Log the error
      await auditLogService.logSystemError({
        errorType: 'email_to_fax_processing_error',
        errorMessage: `Failed to process email-to-fax: ${error}`,
        context: {
          jobId: job.id,
          emailData: { to, from, subject, bodyLength: body.length }
        }
      });

      // Re-throw to mark job as failed
      throw error;
    }
  }

  /**
   * Combine multiple TIFF pages into a single multi-page TIFF
   */
  private combineTiffPages(tiffPages: Buffer[]): Buffer {
    if (tiffPages.length === 1) {
      return tiffPages[0];
    }

    // For now, return the first page
    // In a production system, you would use a library like sharp or imagemagick
    // to properly combine multiple TIFF pages into a single multi-page TIFF
    console.warn('Multi-page TIFF combination not implemented, using first page only');
    return tiffPages[0];
  }

  /**
   * Start the worker
   */
  start(): void {
    console.log('Email-to-fax worker started');
  }

  /**
   * Stop the worker gracefully
   */
  async stop(): Promise<void> {
    console.log('Stopping email-to-fax worker...');
    await this.worker.close();
    console.log('Email-to-fax worker stopped');
  }

  /**
   * Get worker status
   */
  getStatus(): {
    isRunning: boolean;
    concurrency: number;
  } {
    return {
      isRunning: !this.worker.closing,
      concurrency: this.worker.opts.concurrency || 1
    };
  }
}

export const emailToFaxWorker = new EmailToFaxWorker();