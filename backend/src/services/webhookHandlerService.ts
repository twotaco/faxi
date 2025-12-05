import { TelnyxWebhookPayload } from '../webhooks/types';
import { userRepository } from '../repositories/userRepository';
import { faxJobRepository } from '../repositories/faxJobRepository';
import { auditLogRepository } from '../repositories/auditLogRepository';
import { faxDownloadService } from './faxDownloadService';
import { s3Storage } from '../storage/s3';
import { enqueueFaxProcessing } from '../queue/faxQueue';
import { loggingService } from './loggingService';

export class WebhookHandlerService {
  /**
   * Process incoming fax webhook from Telnyx
   */
  async processInboundFax(payload: TelnyxWebhookPayload): Promise<void> {
    const { fax_id, from, to, media_url, page_count, call_duration_secs, connection_id } = payload.data.payload;
    const occurredAt = payload.data.occurred_at; // Telnyx event timestamp

    // Check for duplicate delivery (idempotency)
    const existingJob = await faxJobRepository.findByFaxId(fax_id);
    if (existingJob) {
      loggingService.info('Duplicate fax delivery detected, skipping', undefined, {
        faxId: fax_id,
        existingJobId: existingJob.id,
      });
      return;
    }

    // Find or create user (automatic registration)
    const { user, isNew } = await userRepository.findOrCreate(from);

    if (isNew) {
      loggingService.info('New user registered via fax', undefined, {
        userId: user.id,
        phoneNumber: user.phoneNumber,
        emailAddress: user.emailAddress,
      });
    }

    // Create fax job record
    const faxJob = await faxJobRepository.create({
      faxId: fax_id,
      userId: user.id,
      direction: 'inbound',
      fromNumber: from,
      toNumber: to,
      status: 'pending',
      pageCount: page_count,
      mediaUrl: media_url,
      webhookPayload: payload,
    });

    loggingService.info('Fax job created', undefined, {
      faxJobId: faxJob.id,
      faxId: fax_id,
      userId: user.id,
      from,
      to,
      pageCount: page_count,
      occurredAt,
    });

    // Log webhook receipt in audit log with occurred_at timestamp
    await auditLogRepository.create({
      userId: user.id,
      faxJobId: faxJob.id,
      eventType: 'fax.received',
      eventData: {
        faxId: fax_id,
        fromNumber: from,
        toNumber: to,
        pageCount: page_count,
        callDurationSecs: call_duration_secs,
        connectionId: connection_id,
        isNewUser: isNew,
        occurredAt, // Telnyx event timestamp for accurate timing
      },
    });

    // Download fax image from Telnyx
    let faxImageBuffer: Buffer;
    try {
      faxImageBuffer = await faxDownloadService.downloadFaxImage(media_url);
      loggingService.info('Fax image downloaded', undefined, {
        faxJobId: faxJob.id,
        size: faxImageBuffer.length,
        faxId: fax_id,
      });
    } catch (error) {
      loggingService.error('Failed to download fax image', error as Error, {
        faxJobId: faxJob.id,
        faxId: fax_id,
        mediaUrl: media_url,
      });
      await faxJobRepository.update(faxJob.id, {
        status: 'failed',
        errorMessage: 'Failed to download fax image from Telnyx',
      });
      throw error;
    }

    // Upload fax image to S3
    const storageKey = s3Storage.generateFaxKey(fax_id);
    try {
      await s3Storage.uploadFile(storageKey, faxImageBuffer, 'application/pdf');
      loggingService.info('Fax image uploaded to S3', undefined, {
        faxJobId: faxJob.id,
        storageKey,
        faxId: fax_id,
      });

      // Update fax job with storage key
      await faxJobRepository.update(faxJob.id, {
        storageKey,
      });
    } catch (error) {
      loggingService.error('Failed to upload fax image to S3', error as Error, {
        faxJobId: faxJob.id,
        faxId: fax_id,
        storageKey,
      });
      await faxJobRepository.update(faxJob.id, {
        status: 'failed',
        errorMessage: 'Failed to upload fax image to storage',
      });
      throw error;
    }

    // Enqueue processing job
    try {
      await enqueueFaxProcessing({
        faxId: fax_id,
        faxJobId: faxJob.id, // Internal database UUID for audit logs
        fromNumber: from,
        toNumber: to,
        mediaUrl: media_url,
        pageCount: page_count,
        receivedAt: occurredAt, // Use extracted occurred_at
        webhookPayload: payload,
      });

      loggingService.info('Fax processing job enqueued', undefined, {
        faxJobId: faxJob.id,
        faxId: fax_id,
        occurredAt,
      });

      // Log job enqueued with occurred_at for timing analysis
      await auditLogRepository.create({
        userId: user.id,
        faxJobId: faxJob.id,
        eventType: 'fax.enqueued',
        eventData: {
          faxId: fax_id,
          storageKey,
          occurredAt,
        },
      });
    } catch (error) {
      loggingService.error('Failed to enqueue fax processing', error as Error, {
        faxJobId: faxJob.id,
        faxId: fax_id,
      });
      await faxJobRepository.update(faxJob.id, {
        status: 'failed',
        errorMessage: 'Failed to enqueue processing job',
      });
      throw error;
    }
  }
}

export const webhookHandlerService = new WebhookHandlerService();
