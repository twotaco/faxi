import { Request, Response } from 'express';
import { EmailWebhookPayload, ParsedEmailData } from './types';
import { extractPhoneFromEmail, isFaxiUserEmail } from '../config/email';
import { userRepository } from '../repositories/userRepository';
import { enqueueEmailToFax } from '../queue/faxQueue';
import { auditLogService } from '../services/auditLogService';
import crypto from 'crypto';
import { config } from '../config';

export class EmailWebhookController {
  /**
   * Handle incoming email webhook
   * POST /webhooks/email/received
   */
  async handleEmailReceived(req: Request, res: Response): Promise<void> {
    try {
      console.log('Received email webhook:', {
        headers: req.headers,
        bodySize: JSON.stringify(req.body).length
      });

      // Verify webhook signature if configured
      if (!this.verifyWebhookSignature(req)) {
        console.error('Invalid email webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Parse email data based on provider
      const emailData = this.parseEmailWebhook(req.body);
      
      if (!emailData) {
        console.error('Failed to parse email webhook payload');
        res.status(400).json({ error: 'Invalid email payload' });
        return;
      }

      // Return 200 OK immediately (within 2 minutes requirement)
      res.status(200).json({ received: true });

      // Process email asynchronously
      this.processEmailAsync(emailData).catch((error) => {
        console.error('Error processing email asynchronously:', error);
      });

    } catch (error) {
      console.error('Error handling email webhook:', error);
      
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  /**
   * Verify webhook signature based on email provider
   */
  private verifyWebhookSignature(req: Request): boolean {
    const provider = config.email?.provider || 'postfix';

    switch (provider) {
      case 'sendgrid':
        return this.verifySendGridSignature(req);
      case 'ses':
        return this.verifyAwsSesSignature(req);
      case 'postfix':
        // For self-hosted Postfix, we might use a shared secret
        return this.verifyPostfixSignature(req);
      default:
        console.warn('No signature verification configured for email provider:', provider);
        return true; // Allow in development/testing
    }
  }

  /**
   * Verify SendGrid webhook signature
   */
  private verifySendGridSignature(req: Request): boolean {
    const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
    const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;
    
    if (!signature || !timestamp || !config.email?.webhookSecret) {
      return false;
    }

    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', config.email.webhookSecret)
      .update(timestamp + payload)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Verify AWS SES signature (SNS message signature)
   */
  private verifyAwsSesSignature(req: Request): boolean {
    // AWS SNS signature verification would go here
    // For now, return true in development
    return true;
  }

  /**
   * Verify Postfix signature (custom implementation)
   */
  private verifyPostfixSignature(req: Request): boolean {
    const signature = req.headers['x-faxi-signature'] as string;
    
    if (!signature || !config.email?.webhookSecret) {
      return false;
    }

    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', config.email.webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Parse email webhook payload based on provider
   */
  private parseEmailWebhook(payload: any): ParsedEmailData | null {
    const provider = config.email?.provider || 'postfix';

    try {
      switch (provider) {
        case 'sendgrid':
          return this.parseSendGridWebhook(payload);
        case 'ses':
          return this.parseAwsSesWebhook(payload);
        case 'postfix':
          return this.parsePostfixWebhook(payload);
        default:
          console.error('Unknown email provider:', provider);
          return null;
      }
    } catch (error) {
      console.error('Error parsing email webhook:', error);
      return null;
    }
  }

  /**
   * Parse SendGrid Inbound Parse webhook
   */
  private parseSendGridWebhook(payload: any): ParsedEmailData | null {
    // SendGrid Inbound Parse sends form data
    const to = payload.to;
    const from = payload.from;
    const subject = payload.subject || '';
    const text = payload.text || '';
    const html = payload.html || '';
    const attachments = payload.attachments || {};

    if (!to || !from) {
      return null;
    }

    return {
      to,
      from,
      subject,
      body: text || this.stripHtml(html),
      html,
      attachments: this.parseAttachments(attachments),
      receivedAt: new Date().toISOString(),
      provider: 'sendgrid'
    };
  }

  /**
   * Parse AWS SES webhook (SNS notification)
   */
  private parseAwsSesWebhook(payload: any): ParsedEmailData | null {
    // AWS SES sends SNS notifications
    if (payload.Type === 'Notification') {
      const message = JSON.parse(payload.Message);
      const mail = message.mail;
      const content = message.content;

      return {
        to: mail.destination?.[0] || '',
        from: mail.source || '',
        subject: content?.subject || '',
        body: content?.textPart || this.stripHtml(content?.htmlPart || ''),
        html: content?.htmlPart,
        attachments: [], // AWS SES attachments need special handling
        receivedAt: mail.timestamp,
        provider: 'ses'
      };
    }

    return null;
  }

  /**
   * Parse Postfix webhook (custom format)
   */
  private parsePostfixWebhook(payload: EmailWebhookPayload): ParsedEmailData | null {
    return {
      to: payload.to,
      from: payload.from,
      subject: payload.subject || '',
      body: payload.body || '',
      html: payload.html,
      attachments: payload.attachments || [],
      receivedAt: payload.receivedAt || new Date().toISOString(),
      provider: 'postfix'
    };
  }

  /**
   * Process email asynchronously after webhook response
   */
  private async processEmailAsync(emailData: ParsedEmailData): Promise<void> {
    try {
      console.log('Processing email:', {
        to: emailData.to,
        from: emailData.from,
        subject: emailData.subject,
        provider: emailData.provider
      });

      // Extract recipient phone number from email address
      const phoneNumber = extractPhoneFromEmail(emailData.to);
      
      if (!phoneNumber) {
        console.error('Invalid Faxi email address:', emailData.to);
        await auditLogService.logSystemError({
          errorType: 'invalid_email_address',
          errorMessage: `Received email for invalid Faxi address: ${emailData.to}`,
          context: { emailData }
        });
        return;
      }

      // Validate that this is a Faxi user email
      if (!isFaxiUserEmail(emailData.to)) {
        console.error('Email not for Faxi user:', emailData.to);
        return;
      }

      // Find or create user
      const { user, isNew } = await userRepository.findOrCreate(phoneNumber);
      
      console.log('Found/created user:', {
        userId: user.id,
        phoneNumber: user.phoneNumber,
        isNew
      });

      // Log email receipt
      await auditLogService.logEmailReceived({
        userId: user.id,
        fromEmail: emailData.from,
        toEmail: emailData.to,
        subject: emailData.subject,
        bodyLength: emailData.body.length,
        hasAttachments: emailData.attachments.length > 0,
        provider: emailData.provider
      });

      // Enqueue email-to-fax conversion
      const jobId = await enqueueEmailToFax({
        to: user.phoneNumber,
        from: emailData.from,
        subject: emailData.subject,
        body: emailData.body,
        receivedAt: emailData.receivedAt
      });

      console.log('Email-to-fax job enqueued:', {
        jobId,
        userId: user.id,
        phoneNumber: user.phoneNumber
      });

    } catch (error) {
      console.error('Error in async email processing:', error);
      
      await auditLogService.logSystemError({
        errorType: 'email_processing_error',
        errorMessage: `Failed to process email: ${error}`,
        context: { emailData }
      });
    }
  }

  /**
   * Parse attachments from various formats
   */
  private parseAttachments(attachments: any): Array<{ filename: string; size: number; contentType: string }> {
    if (!attachments) return [];

    // Handle SendGrid format (object with filename keys)
    if (typeof attachments === 'object' && !Array.isArray(attachments)) {
      return Object.keys(attachments).map(filename => ({
        filename,
        size: attachments[filename]?.length || 0,
        contentType: 'application/octet-stream'
      }));
    }

    // Handle array format
    if (Array.isArray(attachments)) {
      return attachments.map(att => ({
        filename: att.filename || 'attachment',
        size: att.size || 0,
        contentType: att.contentType || 'application/octet-stream'
      }));
    }

    return [];
  }

  /**
   * Strip HTML tags from content
   */
  private stripHtml(html: string): string {
    if (!html) return '';
    
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/&#39;/g, "'") // Replace &#39; with '
      .replace(/\s+/g, ' ') // Collapse multiple whitespace
      .trim();
  }
}

export const emailWebhookController = new EmailWebhookController();