import { Request, Response } from 'express';
import { EmailWebhookPayload, ParsedEmailData } from './types';
import { extractPhoneFromEmail, isFaxiUserEmail } from '../config/email';
import { userRepository } from '../repositories/userRepository';
import { addressBookRepository } from '../repositories/addressBookRepository';
import { emailThreadRepository, emailMessageRepository } from '../repositories/emailThreadRepository';
import { blocklistService } from '../services/blocklistService';
import { enqueueEmailToFax } from '../queue/faxQueue';
import { auditLogService } from '../services/auditLogService';
import { snsWebhookHandler } from '../services/snsWebhookHandler';
import crypto from 'crypto';
import { config } from '../config';

export class EmailWebhookController {
  /**
   * Handle SNS webhook for AWS SES notifications
   * POST /webhooks/email/sns
   */
  async handleSnsWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Delegate to SNS webhook handler
      await snsWebhookHandler.handleSnsNotification(req, res);
      
      // If response not already sent, the handler will have sent it
      // This method handles subscription confirmations and notifications
      
    } catch (error) {
      console.error('Error handling SNS webhook:', error);
      
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

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
      
      // Handle inbound email notifications
      if (message.notificationType === 'Received') {
        const mail = message.mail;
        const content = message.content;

        // Extract sender name from commonHeaders.from
        // Format: ["Name <email@example.com>"] or ["email@example.com"]
        let fromName: string | undefined;
        if (mail.commonHeaders?.from && mail.commonHeaders.from.length > 0) {
          const fromHeader = mail.commonHeaders.from[0];
          const nameMatch = fromHeader.match(/^(.+?)\s*<.+>$/);
          if (nameMatch) {
            fromName = nameMatch[1].trim();
          }
        }

        return {
          to: mail.destination?.[0] || '',
          from: mail.source || '',
          fromName,
          subject: mail.commonHeaders?.subject || '',
          body: content || '',
          html: undefined,
          attachments: [], // AWS SES attachments need special handling
          receivedAt: mail.timestamp,
          provider: 'ses',
          messageId: mail.messageId,
        };
      }

      // Handle delivery notifications (for future use)
      if (message.notificationType === 'Delivery') {
        console.log('Received delivery notification:', message);
        // Will be handled by EmailDeliveryTracker in future tasks
        return null;
      }

      // Handle bounce notifications (for future use)
      if (message.notificationType === 'Bounce') {
        console.log('Received bounce notification:', message);
        // Will be handled by BounceComplaintHandler in future tasks
        return null;
      }

      // Handle complaint notifications (for future use)
      if (message.notificationType === 'Complaint') {
        console.log('Received complaint notification:', message);
        // Will be handled by BounceComplaintHandler in future tasks
        return null;
      }
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

      // Find existing user only - do not create new users from incoming emails
      const user = await userRepository.findByPhoneNumber(phoneNumber);

      if (!user) {
        console.log('Email rejected - recipient not a registered user:', {
          to: emailData.to,
          from: emailData.from,
          phoneNumber
        });
        // Store rejected email for debugging
        await this.storeRejectedEmail(emailData, null, 'unregistered_recipient');
        await auditLogService.log({
          eventType: 'email.unregistered_recipient_rejected',
          eventData: {
            recipientEmail: emailData.to,
            senderEmail: emailData.from,
            phoneNumber,
            subject: emailData.subject
          }
        });
        return; // Silently reject - no bounce to sender
      }

      console.log('Found user:', {
        userId: user.id,
        phoneNumber: user.phoneNumber,
        faxNumberVerified: user.faxNumberVerified
      });

      // Check if fax number is verified (user must have sent a real fax TO Faxi)
      // This prevents test emails from triggering real faxes to fake/unverified numbers
      if (!user.faxNumberVerified) {
        console.log('Email rejected - recipient fax number not verified:', {
          to: emailData.to,
          from: emailData.from,
          phoneNumber,
          userId: user.id
        });
        // Store rejected email for debugging
        await this.storeRejectedEmail(emailData, user.id, 'unverified_recipient');
        await auditLogService.log({
          userId: user.id,
          eventType: 'email.unverified_recipient_rejected',
          eventData: {
            recipientEmail: emailData.to,
            senderEmail: emailData.from,
            phoneNumber,
            subject: emailData.subject
          }
        });
        return; // Silently reject - don't send fax to unverified numbers
      }

      // Check if sender is blocked (Requirements 15.2, 15.3)
      const isBlocked = await blocklistService.isBlocked(user.id, emailData.from);
      if (isBlocked) {
        console.log('Email from blocked sender rejected:', {
          userId: user.id,
          senderEmail: emailData.from
        });
        // Store rejected email for debugging
        await this.storeRejectedEmail(emailData, user.id, 'blocked_sender');
        await auditLogService.log({
          userId: user.id,
          eventType: 'email.blocked_sender_rejected',
          eventData: {
            senderEmail: emailData.from,
            subject: emailData.subject
          }
        });
        // Reject silently - no error response
        return;
      }

      // Register sender as contact automatically
      try {
        await addressBookRepository.addFromEmail(
          user.id,
          emailData.from,
          emailData.fromName // Use sender name if available
        );
        console.log('Contact registered/updated:', {
          userId: user.id,
          email: emailData.from,
          name: emailData.fromName
        });
      } catch (error) {
        console.error('Failed to register contact:', error);
        // Don't fail the whole process if contact registration fails
      }

      // Store accepted inbound email in database
      await this.storeInboundEmail(user.id, emailData);

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

  /**
   * Generate a thread ID from subject and participants
   * Uses same algorithm for inbound and outbound to enable thread matching
   */
  private generateThreadId(subject: string, participants: string[]): string {
    const normalized = `${(subject || '').toLowerCase().replace(/^re:\s*/i, '').trim()}|${participants.sort().join(',')}`;
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 32);
  }

  /**
   * Store an accepted inbound email in the database
   */
  private async storeInboundEmail(userId: string, emailData: ParsedEmailData): Promise<void> {
    try {
      // Generate thread ID (same logic as outbound for thread matching)
      const participants = [emailData.from, emailData.to].sort();
      const threadId = this.generateThreadId(emailData.subject, participants);

      // Find or create thread
      const thread = await emailThreadRepository.findOrCreate({
        threadId,
        userId,
        subject: emailData.subject || '(No Subject)',
        participants,
        lastMessageAt: new Date(emailData.receivedAt),
      });

      // Generate unique message ID if not provided
      const messageId = emailData.messageId || `inbound-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Store message
      await emailMessageRepository.create({
        threadId: thread.threadId,
        messageId,
        fromAddress: emailData.from,
        toAddresses: [emailData.to],
        subject: emailData.subject || '(No Subject)',
        body: emailData.body,
        htmlBody: emailData.html || undefined,
        direction: 'inbound',
        sentAt: new Date(emailData.receivedAt),
      });

      // Update thread message count
      await emailThreadRepository.updateWithNewMessage(thread.threadId, new Date(emailData.receivedAt));

      console.log('Stored inbound email:', {
        threadId: thread.threadId,
        messageId,
        from: emailData.from,
        to: emailData.to,
      });
    } catch (error) {
      console.error('Failed to store inbound email (non-fatal):', error);
      // Don't throw - email processing should continue even if storage fails
    }
  }

  /**
   * Store a rejected inbound email in the database for debugging
   */
  private async storeRejectedEmail(
    emailData: ParsedEmailData,
    userId: string | null,
    rejectionReason: 'unregistered_recipient' | 'unverified_recipient' | 'blocked_sender'
  ): Promise<void> {
    try {
      // Generate unique message ID if not provided
      const messageId = emailData.messageId || `rejected-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      if (!userId) {
        // For rejected emails without a user (unregistered recipient), store as orphan
        await emailMessageRepository.createOrphan({
          messageId,
          fromAddress: emailData.from,
          toAddresses: [emailData.to],
          subject: emailData.subject || '(No Subject)',
          body: emailData.body,
          htmlBody: emailData.html || undefined,
          direction: 'inbound',
          sentAt: new Date(emailData.receivedAt),
          rejectionReason,
        });

        console.log('Stored rejected orphan email:', {
          messageId,
          from: emailData.from,
          to: emailData.to,
          rejectionReason,
        });
        return;
      }

      // For rejected emails with a user, store with thread
      const participants = [emailData.from, emailData.to].sort();
      const threadId = this.generateThreadId(emailData.subject, participants);

      const thread = await emailThreadRepository.findOrCreate({
        threadId,
        userId,
        subject: emailData.subject || '(No Subject)',
        participants,
        lastMessageAt: new Date(emailData.receivedAt),
      });

      await emailMessageRepository.create({
        threadId: thread.threadId,
        messageId,
        fromAddress: emailData.from,
        toAddresses: [emailData.to],
        subject: emailData.subject || '(No Subject)',
        body: emailData.body,
        htmlBody: emailData.html || undefined,
        direction: 'inbound',
        sentAt: new Date(emailData.receivedAt),
        rejectionReason,
      });

      await emailThreadRepository.updateWithNewMessage(thread.threadId, new Date(emailData.receivedAt));

      console.log('Stored rejected email with thread:', {
        threadId: thread.threadId,
        messageId,
        from: emailData.from,
        to: emailData.to,
        rejectionReason,
      });
    } catch (error) {
      console.error('Failed to store rejected email (non-fatal):', error);
      // Don't throw - already logging to audit_logs
    }
  }
}

export const emailWebhookController = new EmailWebhookController();