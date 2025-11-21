import { TelnyxWebhookPayload } from '../webhooks/types';
import { userRepository } from '../repositories/userRepository';
import { faxJobRepository } from '../repositories/faxJobRepository';
import { auditLogRepository } from '../repositories/auditLogRepository';
import { faxDownloadService } from './faxDownloadService';
import { s3Storage } from '../storage/s3';
import { enqueueFaxProcessing } from '../queue/faxQueue';

export class WebhookHandlerService {
  /**
   * Process incoming fax webhook from Telnyx
   */
  async processInboundFax(payload: TelnyxWebhookPayload): Promise<void> {
    const { fax_id, from, to, media_url, page_count } = payload.data.payload;

    // Check for duplicate delivery (idempotency)
    const existingJob = await faxJobRepository.findByFaxId(fax_id);
    if (existingJob) {
      console.log('Duplicate fax delivery detected, skipping', { faxId: fax_id });
      return;
    }

    // Find or create user (automatic registration)
    const { user, isNew } = await userRepository.findOrCreate(from);
    
    if (isNew) {
      console.log('New user registered', { 
        userId: user.id, 
        phoneNumber: user.phoneNumber,
        emailAddress: user.emailAddress 
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

    console.log('Fax job created', { 
      faxJobId: faxJob.id, 
      faxId: fax_id,
      userId: user.id 
    });

    // Log webhook receipt in audit log
    await auditLogRepository.create({
      userId: user.id,
      faxJobId: faxJob.id,
      eventType: 'fax.received',
      eventData: {
        faxId: fax_id,
        fromNumber: from,
        toNumber: to,
        pageCount: page_count,
        isNewUser: isNew,
      },
    });

    // Download fax image from Telnyx
    let faxImageBuffer: Buffer;
    try {
      faxImageBuffer = await faxDownloadService.downloadFaxImage(media_url);
      console.log('Fax image downloaded', { 
        faxJobId: faxJob.id, 
        size: faxImageBuffer.length 
      });
    } catch (error) {
      console.error('Failed to download fax image', { faxJobId: faxJob.id, error });
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
      console.log('Fax image uploaded to S3', { 
        faxJobId: faxJob.id, 
        storageKey 
      });

      // Update fax job with storage key
      await faxJobRepository.update(faxJob.id, {
        storageKey,
      });
    } catch (error) {
      console.error('Failed to upload fax image to S3', { faxJobId: faxJob.id, error });
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
        fromNumber: from,
        toNumber: to,
        mediaUrl: media_url,
        pageCount: page_count,
        receivedAt: payload.data.occurred_at,
        webhookPayload: payload,
      });

      console.log('Fax processing job enqueued', { 
        faxJobId: faxJob.id,
        faxId: fax_id 
      });

      // Log job enqueued
      await auditLogRepository.create({
        userId: user.id,
        faxJobId: faxJob.id,
        eventType: 'fax.enqueued',
        eventData: {
          faxId: fax_id,
          storageKey,
        },
      });
    } catch (error) {
      console.error('Failed to enqueue fax processing', { faxJobId: faxJob.id, error });
      await faxJobRepository.update(faxJob.id, {
        status: 'failed',
        errorMessage: 'Failed to enqueue processing job',
      });
      throw error;
    }
  }
}

export const webhookHandlerService = new WebhookHandlerService();
