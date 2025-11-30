import { Request, Response } from 'express';
import { verifyTelnyxSignature } from './telnyxVerification';
import { TelnyxWebhookPayload } from './types';
import { webhookHandlerService } from '../services/webhookHandlerService';
import { faxJobRepository } from '../repositories/faxJobRepository';
import { auditLogService } from '../services/auditLogService';
import { loggingService } from '../services/loggingService';

export class TelnyxWebhookController {
  /**
   * Handle all Telnyx fax webhooks (single endpoint for all event types)
   * POST /webhooks/telnyx/fax
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Extract signature headers
      const signature = req.headers['telnyx-signature-ed25519'] as string;
      const timestamp = req.headers['telnyx-timestamp'] as string;

      if (!signature || !timestamp) {
        loggingService.warn('Missing Telnyx signature headers', undefined, {
          hasSignature: !!signature,
          hasTimestamp: !!timestamp,
        });
        res.status(401).json({ error: 'Missing signature headers' });
        return;
      }

      // Get raw body for signature verification
      const rawBody = JSON.stringify(req.body);

      // Verify signature
      const isValid = verifyTelnyxSignature(signature, timestamp, rawBody);
      if (!isValid) {
        loggingService.warn('Invalid Telnyx webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Parse webhook payload
      const payload: TelnyxWebhookPayload = req.body;

      // Validate payload structure
      if (!payload.data || !payload.data.payload) {
        loggingService.warn('Invalid webhook payload structure', undefined, {
          hasData: !!payload.data,
          hasPayload: !!(payload.data?.payload),
        });
        res.status(400).json({ error: 'Invalid payload structure' });
        return;
      }

      const eventType = payload.data.event_type;
      const faxId = payload.data.payload.fax_id;

      loggingService.info('Telnyx webhook received', undefined, {
        eventType,
        faxId,
        from: payload.data.payload.from,
        to: payload.data.payload.to,
        occurredAt: payload.data.occurred_at,
      });

      // Return 200 OK immediately (within 5 seconds requirement)
      res.status(200).json({ received: true, eventType });

      // Process webhook asynchronously
      // Don't await - let it run in background
      this.processWebhookAsync(payload).catch((error) => {
        loggingService.error('Error processing webhook asynchronously', error as Error, {
          eventType,
          faxId,
        });
      });
    } catch (error) {
      loggingService.error('Error handling Telnyx webhook', error as Error);

      // Still return 200 to prevent retries if we've already started processing
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  /**
   * Legacy handler for backward compatibility
   * @deprecated Use handleWebhook instead
   */
  async handleFaxReceived(req: Request, res: Response): Promise<void> {
    return this.handleWebhook(req, res);
  }

  /**
   * Handle fax delivery status webhook from Telnyx
   * @deprecated Use handleWebhook instead - kept for backward compatibility
   * POST /webhooks/telnyx/fax/status
   */
  async handleFaxStatus(req: Request, res: Response): Promise<void> {
    return this.handleWebhook(req, res);
  }

  /**
   * Process webhook asynchronously after responding to Telnyx
   */
  private async processWebhookAsync(payload: TelnyxWebhookPayload): Promise<void> {
    const eventType = payload.data.event_type;
    const faxId = payload.data.payload.fax_id;
    const occurredAt = payload.data.occurred_at;

    try {
      // Handle different event types
      switch (eventType) {
        // === Inbound fax events ===
        case 'fax.received':
          loggingService.info('Processing inbound fax', undefined, { faxId, occurredAt });
          await webhookHandlerService.processInboundFax(payload);
          break;

        case 'fax.receiving.started':
          loggingService.info('Fax receiving started', undefined, {
            faxId,
            from: payload.data.payload.from,
            to: payload.data.payload.to,
            occurredAt,
          });
          // Log to audit for tracking
          await auditLogService.log({
            eventType: 'fax.receiving.started',
            eventData: {
              faxId,
              from: payload.data.payload.from,
              to: payload.data.payload.to,
              occurredAt,
            },
          });
          break;

        // === Media processing events ===
        case 'fax.media.processing.started':
          loggingService.info('Fax media processing started', undefined, { faxId, occurredAt });
          await auditLogService.log({
            eventType: 'fax.media.processing.started',
            eventData: { faxId, occurredAt },
          });
          break;

        case 'fax.media.processed':
          loggingService.info('Fax media processed', undefined, { faxId, occurredAt });
          await auditLogService.log({
            eventType: 'fax.media.processed',
            eventData: { faxId, occurredAt },
          });
          break;

        // === Outbound fax events ===
        case 'fax.queued':
          loggingService.info('Fax queued for sending', undefined, {
            faxId,
            to: payload.data.payload.to,
            occurredAt,
          });
          await auditLogService.log({
            eventType: 'fax.queued',
            eventData: {
              faxId,
              to: payload.data.payload.to,
              occurredAt,
            },
          });
          break;

        case 'fax.sending.started':
          loggingService.info('Fax sending started', undefined, {
            faxId,
            to: payload.data.payload.to,
            occurredAt,
          });
          await this.handleFaxDeliveryStatus(payload);
          break;

        case 'fax.sending':
          loggingService.info('Fax sending in progress', undefined, { faxId, occurredAt });
          await this.handleFaxDeliveryStatus(payload);
          break;

        case 'fax.sent':
          loggingService.info('Fax sent successfully', undefined, {
            faxId,
            to: payload.data.payload.to,
            pageCount: payload.data.payload.page_count,
            callDuration: payload.data.payload.call_duration_secs,
            occurredAt,
          });
          await this.handleFaxDeliveryStatus(payload);
          break;

        case 'fax.delivered':
          loggingService.info('Fax delivered', undefined, {
            faxId,
            to: payload.data.payload.to,
            occurredAt,
          });
          await this.handleFaxDeliveryStatus(payload);
          break;

        case 'fax.failed':
          loggingService.error('Fax failed', undefined, {
            faxId,
            from: payload.data.payload.from,
            to: payload.data.payload.to,
            status: payload.data.payload.status,
            failureReason: payload.data.payload.failure_reason,
            connectionId: payload.data.payload.connection_id,
            occurredAt,
          });
          await this.handleFaxDeliveryStatus(payload);
          break;

        // === Email notification events ===
        case 'fax.email.delivered':
          loggingService.info('Fax email notification delivered', undefined, { faxId, occurredAt });
          await auditLogService.log({
            eventType: 'fax.email.delivered',
            eventData: { faxId, occurredAt },
          });
          break;

        default:
          loggingService.warn('Unknown Telnyx event type', undefined, {
            eventType,
            faxId,
            occurredAt,
          });
          // Still log unknown events for debugging
          await auditLogService.log({
            eventType: 'fax.unknown',
            eventData: {
              originalEventType: eventType,
              faxId,
              payload: payload.data.payload,
              occurredAt,
            },
          });
      }
    } catch (error) {
      loggingService.error('Error in async webhook processing', error as Error, {
        eventType,
        faxId,
        occurredAt,
      });
      // Error is logged but not thrown since response already sent
    }
  }

  /**
   * Handle fax delivery status updates
   */
  private async handleFaxDeliveryStatus(payload: TelnyxWebhookPayload): Promise<void> {
    try {
      const {
        fax_id,
        status,
        from,
        to,
        failure_reason,
        call_duration_secs,
        connection_id,
      } = payload.data.payload;
      const eventType = payload.data.event_type;
      const occurredAt = payload.data.occurred_at;

      loggingService.info('Processing fax delivery status', undefined, {
        faxId: fax_id,
        status,
        eventType,
        from,
        to,
        failureReason: failure_reason,
        callDuration: call_duration_secs,
        occurredAt,
      });

      // Find the fax job by Telnyx fax ID
      // We need to search audit logs since we store the Telnyx fax ID there
      const auditLogs = await auditLogService.queryLogs({
        eventType: 'fax.transmitted',
        limit: 100, // Search recent transmissions
      });

      let matchingFaxJobId: string | null = null;
      let matchingUserId: string | null = null;

      // Find the matching fax job from audit logs
      for (const log of auditLogs) {
        const eventData = log.eventData as any;
        if (eventData.telnyxFaxId === fax_id) {
          matchingFaxJobId = log.faxJobId;
          matchingUserId = log.userId;
          break;
        }
      }

      if (!matchingFaxJobId) {
        loggingService.warn('No matching fax job found for Telnyx fax ID', undefined, {
          faxId: fax_id,
          eventType,
          from,
          to,
        });
        return;
      }

      // Map Telnyx status to our internal status
      let internalStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'sending' | 'delivered';
      let isDelivered = false;
      let isFailed = false;

      switch (eventType) {
        case 'fax.sending.started':
        case 'fax.sending':
          internalStatus = 'sending';
          break;
        case 'fax.sent':
        case 'fax.delivered':
          internalStatus = 'delivered';
          isDelivered = true;
          break;
        case 'fax.failed':
          internalStatus = 'failed';
          isFailed = true;
          break;
        default:
          // Fallback to processing for unknown statuses
          internalStatus = 'processing';
      }

      // Build detailed error message for failures
      let errorMessage: string | undefined;
      if (isFailed) {
        const failureDetails = [
          failure_reason ? `Reason: ${failure_reason}` : null,
          status ? `Status: ${status}` : null,
          connection_id ? `Connection: ${connection_id}` : null,
          occurredAt ? `Time: ${occurredAt}` : null,
        ].filter(Boolean).join(', ');

        errorMessage = `Fax delivery failed. ${failureDetails}`;
      }

      // Update fax job status
      await faxJobRepository.update(matchingFaxJobId, {
        status: internalStatus,
        deliveredAt: isDelivered ? new Date() : undefined,
        errorMessage,
      });

      // Log the delivery status update
      const auditStatus: 'attempting' | 'queued' | 'sent' | 'failed' | 'retry' | 'failed_final' | 'mock_sent' =
        internalStatus === 'delivered' ? 'sent' :
        internalStatus === 'failed' ? 'failed' :
        internalStatus === 'sending' ? 'queued' : 'sent';

      await auditLogService.logFaxTransmission({
        userId: matchingUserId || undefined,
        faxJobId: matchingFaxJobId,
        fromNumber: from,
        toNumber: to,
        status: auditStatus,
        telnyxFaxId: fax_id,
        errorMessage: isFailed ? errorMessage : undefined,
      });

      // Check for repeated failures and alert operators
      if (isFailed) {
        await this.checkForRepeatedFailures(to, matchingUserId || undefined);
      }

      loggingService.info('Fax delivery status updated', undefined, {
        faxJobId: matchingFaxJobId,
        telnyxFaxId: fax_id,
        status: internalStatus,
        isDelivered,
        isFailed,
        failureReason: failure_reason,
      });
    } catch (error) {
      loggingService.error('Error handling fax delivery status', error as Error, {
        faxId: payload.data.payload.fax_id,
        eventType: payload.data.event_type,
      });

      // Log the error for monitoring
      await auditLogService.logSystemError({
        errorType: 'fax_delivery_status_error',
        errorMessage: `Failed to process fax delivery status: ${error}`,
        context: {
          payload: payload.data.payload,
          eventType: payload.data.event_type,
          occurredAt: payload.data.occurred_at,
        },
      });
    }
  }

  /**
   * Check for repeated delivery failures and alert operators
   */
  private async checkForRepeatedFailures(toNumber: string, userId?: string): Promise<void> {
    try {
      // Query recent failed transmissions to this number
      const recentLogs = await auditLogService.queryLogs({
        userId: userId,
        eventType: 'fax.transmitted',
        limit: 10,
      });

      // Count failures in the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentFailures = recentLogs.filter(log => {
        const eventData = log.eventData as any;
        const logTime = new Date(eventData.timestamp);
        return (
          logTime > oneDayAgo &&
          eventData.toNumber === toNumber &&
          (eventData.status === 'failed' || eventData.status === 'failed_final')
        );
      });

      // Alert if 3 or more failures in 24 hours
      if (recentFailures.length >= 3) {
        loggingService.error('ALERT: Repeated fax delivery failures detected', undefined, {
          toNumber,
          userId,
          failureCount: recentFailures.length,
          timeWindow: '24 hours',
        });

        // Log operator alert
        await auditLogService.logSystemError({
          userId: userId,
          errorType: 'repeated_fax_delivery_failures',
          errorMessage: `${recentFailures.length} fax delivery failures to ${toNumber} in the last 24 hours`,
          context: {
            toNumber,
            failureCount: recentFailures.length,
            recentFailures: recentFailures.map(log => ({
              timestamp: (log.eventData as any).timestamp,
              errorMessage: (log.eventData as any).errorMessage,
            })),
          },
        });

        // In a production system, this would trigger:
        // - Email/SMS alerts to operators
        // - Slack/Discord notifications
        // - Dashboard alerts
        // - Automatic escalation procedures
      }
    } catch (error) {
      loggingService.error('Error checking for repeated failures', error as Error, {
        toNumber,
        userId,
      });
    }
  }
}

export const telnyxWebhookController = new TelnyxWebhookController();
