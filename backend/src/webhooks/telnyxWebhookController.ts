import { Request, Response } from 'express';
import { verifyTelnyxSignature } from './telnyxVerification';
import { TelnyxWebhookPayload } from './types';
import { webhookHandlerService } from '../services/webhookHandlerService';
import { faxJobRepository } from '../repositories/faxJobRepository';
import { auditLogService } from '../services/auditLogService';

export class TelnyxWebhookController {
  /**
   * Handle incoming fax webhook from Telnyx
   * POST /webhooks/telnyx/fax/received
   */
  async handleFaxReceived(req: Request, res: Response): Promise<void> {
    try {
      // Extract signature headers
      const signature = req.headers['telnyx-signature-ed25519'] as string;
      const timestamp = req.headers['telnyx-timestamp'] as string;

      if (!signature || !timestamp) {
        console.error('Missing Telnyx signature headers');
        res.status(401).json({ error: 'Missing signature headers' });
        return;
      }

      // Get raw body for signature verification
      const rawBody = JSON.stringify(req.body);

      // Verify signature
      const isValid = verifyTelnyxSignature(signature, timestamp, rawBody);
      if (!isValid) {
        console.error('Invalid Telnyx webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Parse webhook payload
      const payload: TelnyxWebhookPayload = req.body;

      // Validate payload structure
      if (!payload.data || !payload.data.payload) {
        console.error('Invalid webhook payload structure');
        res.status(400).json({ error: 'Invalid payload structure' });
        return;
      }

      // Return 200 OK immediately (within 5 seconds requirement)
      res.status(200).json({ received: true });

      // Process webhook asynchronously
      // Don't await - let it run in background
      this.processWebhookAsync(payload).catch((error) => {
        console.error('Error processing webhook asynchronously:', error);
      });
    } catch (error) {
      console.error('Error handling Telnyx webhook:', error);
      
      // Still return 200 to prevent retries if we've already started processing
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  /**
   * Handle fax delivery status webhook from Telnyx
   * POST /webhooks/telnyx/fax/status
   */
  async handleFaxStatus(req: Request, res: Response): Promise<void> {
    try {
      // Extract signature headers
      const signature = req.headers['telnyx-signature-ed25519'] as string;
      const timestamp = req.headers['telnyx-timestamp'] as string;

      if (!signature || !timestamp) {
        console.error('Missing Telnyx signature headers');
        res.status(401).json({ error: 'Missing signature headers' });
        return;
      }

      // Get raw body for signature verification
      const rawBody = JSON.stringify(req.body);

      // Verify signature
      const isValid = verifyTelnyxSignature(signature, timestamp, rawBody);
      if (!isValid) {
        console.error('Invalid Telnyx webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Parse webhook payload
      const payload: TelnyxWebhookPayload = req.body;

      // Validate payload structure
      if (!payload.data || !payload.data.payload) {
        console.error('Invalid webhook payload structure');
        res.status(400).json({ error: 'Invalid payload structure' });
        return;
      }

      // Return 200 OK immediately
      res.status(200).json({ received: true });

      // Process webhook asynchronously
      this.handleFaxDeliveryStatus(payload).catch((error) => {
        console.error('Error processing fax status webhook:', error);
      });
    } catch (error) {
      console.error('Error handling Telnyx fax status webhook:', error);
      
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  /**
   * Process webhook asynchronously after responding to Telnyx
   */
  private async processWebhookAsync(payload: TelnyxWebhookPayload): Promise<void> {
    try {
      const eventType = payload.data.event_type;

      // Handle different event types
      switch (eventType) {
        case 'fax.received':
          await webhookHandlerService.processInboundFax(payload);
          break;

        case 'fax.sending':
        case 'fax.sent':
        case 'fax.failed':
          await this.handleFaxDeliveryStatus(payload);
          break;

        default:
          console.log('Unknown Telnyx event type', { eventType });
      }
    } catch (error) {
      console.error('Error in async webhook processing:', error);
      // Error is logged but not thrown since response already sent
    }
  }

  /**
   * Handle fax delivery status updates
   */
  private async handleFaxDeliveryStatus(payload: TelnyxWebhookPayload): Promise<void> {
    try {
      const { fax_id, status, from, to } = payload.data.payload;
      const eventType = payload.data.event_type;

      console.log('Processing fax delivery status', { 
        faxId: fax_id, 
        status, 
        eventType,
        from,
        to 
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
        console.warn('No matching fax job found for Telnyx fax ID', { faxId: fax_id });
        return;
      }

      // Map Telnyx status to our internal status
      let internalStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'sending' | 'delivered';
      let isDelivered = false;
      let isFailed = false;

      switch (eventType) {
        case 'fax.sending':
          internalStatus = 'sending';
          break;
        case 'fax.sent':
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

      // Update fax job status
      await faxJobRepository.update(matchingFaxJobId, {
        status: internalStatus,
        deliveredAt: isDelivered ? new Date() : undefined,
        errorMessage: isFailed ? `Delivery failed: ${status}` : undefined,
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
        errorMessage: isFailed ? `Telnyx delivery failed: ${status}` : undefined,
      });

      // Check for repeated failures and alert operators
      if (isFailed) {
        await this.checkForRepeatedFailures(to, matchingUserId || undefined);
      }

      console.log('Fax delivery status updated', {
        faxJobId: matchingFaxJobId,
        telnyxFaxId: fax_id,
        status: internalStatus,
        isDelivered,
        isFailed,
      });
    } catch (error) {
      console.error('Error handling fax delivery status:', error);
      
      // Log the error for monitoring
      await auditLogService.logSystemError({
        errorType: 'fax_delivery_status_error',
        errorMessage: `Failed to process fax delivery status: ${error}`,
        context: {
          payload: payload.data.payload,
          eventType: payload.data.event_type,
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
        console.error('ALERT: Repeated fax delivery failures detected', {
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
      console.error('Error checking for repeated failures:', error);
    }
  }
}

export const telnyxWebhookController = new TelnyxWebhookController();
