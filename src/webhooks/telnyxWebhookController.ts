import { Request, Response } from 'express';
import { verifyTelnyxSignature } from './telnyxVerification';
import { TelnyxWebhookPayload } from './types';
import { webhookHandlerService } from '../services/webhookHandlerService';

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
          // These will be handled in future tasks
          console.log('Outbound fax event received (not yet implemented)', { eventType });
          break;

        default:
          console.log('Unknown Telnyx event type', { eventType });
      }
    } catch (error) {
      console.error('Error in async webhook processing:', error);
      // Error is logged but not thrown since response already sent
    }
  }
}

export const telnyxWebhookController = new TelnyxWebhookController();
