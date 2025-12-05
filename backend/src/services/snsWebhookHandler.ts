import { Request, Response } from 'express';
import crypto from 'crypto';
import https from 'https';
import { auditLogService } from './auditLogService';

/**
 * SNS Message Types
 */
export type SnsMessageType = 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation';

/**
 * SNS Message structure
 */
export interface SnsMessage {
  Type: SnsMessageType;
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  UnsubscribeURL?: string;
  SubscribeURL?: string;
  Token?: string;
}

/**
 * Parsed SNS notification types
 */
export type ParsedSnsMessageType = 'inbound_email' | 'delivery' | 'bounce' | 'complaint';

/**
 * Parsed SNS message
 */
export interface ParsedSnsMessage {
  type: ParsedSnsMessageType;
  data: any;
}

/**
 * SNS Webhook Handler
 * Handles AWS SNS notifications for email events
 */
export class SnsWebhookHandler {
  /**
   * Handle SNS notification
   */
  async handleSnsNotification(req: Request, res: Response): Promise<void> {
    try {
      const snsMessage = req.body as SnsMessage;

      // Log full body for debugging SNS issues
      console.log('SNS raw body type:', typeof req.body);
      console.log('SNS message keys:', Object.keys(snsMessage));
      console.log('Received SNS notification:', {
        type: snsMessage.Type,
        messageId: snsMessage.MessageId,
        topicArn: snsMessage.TopicArn,
        signingCertURL: snsMessage.SigningCertURL,
        hasToken: !!snsMessage.Token,
        hasSubscribeURL: !!snsMessage.SubscribeURL
      });

      // Verify SNS signature
      const isValid = await this.verifySnsSignature(snsMessage);
      
      if (!isValid) {
        console.error('Invalid SNS signature');
        await auditLogService.logSystemError({
          errorType: 'invalid_sns_signature',
          errorMessage: 'Received SNS message with invalid signature',
          context: { messageId: snsMessage.MessageId }
        });
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Handle subscription confirmation
      if (snsMessage.Type === 'SubscriptionConfirmation') {
        await this.handleSubscriptionConfirmation(snsMessage);
        res.status(200).json({ confirmed: true });
        return;
      }

      // Handle unsubscribe confirmation
      if (snsMessage.Type === 'UnsubscribeConfirmation') {
        console.log('SNS unsubscribe confirmation received');
        res.status(200).json({ acknowledged: true });
        return;
      }

      // Handle notification
      if (snsMessage.Type === 'Notification') {
        // Return 200 OK immediately (within 2 seconds requirement)
        res.status(200).json({ received: true });

        // Parse and route message asynchronously
        this.processNotificationAsync(snsMessage).catch((error) => {
          console.error('Error processing SNS notification asynchronously:', error);
        });
        return;
      }

      // Unknown message type
      console.warn('Unknown SNS message type:', snsMessage.Type);
      res.status(400).json({ error: 'Unknown message type' });

    } catch (error) {
      console.error('Error handling SNS notification:', error);
      
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  /**
   * Verify SNS message signature
   * Uses AWS certificate to verify authenticity
   */
  async verifySnsSignature(message: SnsMessage): Promise<boolean> {
    try {
      // Validate certificate URL
      if (!this.isValidCertificateUrl(message.SigningCertURL)) {
        console.error('Invalid certificate URL:', message.SigningCertURL);
        return false;
      }

      // Download certificate
      const certificate = await this.downloadCertificate(message.SigningCertURL);

      // Build string to sign based on message type
      const stringToSign = this.buildStringToSign(message);

      // Verify signature
      const verifier = crypto.createVerify('SHA1');
      verifier.update(stringToSign, 'utf8');
      
      const isValid = verifier.verify(certificate, message.Signature, 'base64');

      if (!isValid) {
        console.error('SNS signature verification failed');
      }

      return isValid;

    } catch (error) {
      console.error('Error verifying SNS signature:', error);
      return false;
    }
  }

  /**
   * Validate that certificate URL is from AWS
   */
  private isValidCertificateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Must be HTTPS
      if (parsed.protocol !== 'https:') {
        return false;
      }

      // Must be from amazonaws.com
      if (!parsed.hostname.endsWith('.amazonaws.com')) {
        return false;
      }

      // Must be sns subdomain
      if (!parsed.hostname.startsWith('sns.')) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Download certificate from AWS
   */
  private async downloadCertificate(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          if (response.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`Failed to download certificate: ${response.statusCode}`));
          }
        });

        response.on('error', (error) => {
          reject(error);
        });
      });
    });
  }

  /**
   * Build string to sign for signature verification
   */
  private buildStringToSign(message: SnsMessage): string {
    const fields: string[] = [];

    if (message.Type === 'Notification') {
      fields.push('Message', message.Message);
      fields.push('MessageId', message.MessageId);
      if (message.Subject) {
        fields.push('Subject', message.Subject);
      }
      fields.push('Timestamp', message.Timestamp);
      fields.push('TopicArn', message.TopicArn);
      fields.push('Type', message.Type);
    } else if (message.Type === 'SubscriptionConfirmation' || message.Type === 'UnsubscribeConfirmation') {
      fields.push('Message', message.Message);
      fields.push('MessageId', message.MessageId);
      fields.push('SubscribeURL', message.SubscribeURL || '');
      fields.push('Timestamp', message.Timestamp);
      fields.push('Token', message.Token || '');
      fields.push('TopicArn', message.TopicArn);
      fields.push('Type', message.Type);
    }

    return fields.join('\n') + '\n';
  }

  /**
   * Handle subscription confirmation
   */
  private async handleSubscriptionConfirmation(message: SnsMessage): Promise<void> {
    try {
      console.log('Confirming SNS subscription:', {
        topicArn: message.TopicArn,
        subscribeUrl: message.SubscribeURL
      });

      if (!message.SubscribeURL) {
        throw new Error('No SubscribeURL in confirmation message');
      }

      // Confirm subscription by visiting the SubscribeURL
      await new Promise<void>((resolve, reject) => {
        https.get(message.SubscribeURL!, (response) => {
          let data = '';

          response.on('data', (chunk) => {
            data += chunk;
          });

          response.on('end', () => {
            if (response.statusCode === 200) {
              console.log('SNS subscription confirmed successfully');
              resolve();
            } else {
              reject(new Error(`Failed to confirm subscription: ${response.statusCode}`));
            }
          });

          response.on('error', (error) => {
            reject(error);
          });
        });
      });

      await auditLogService.logOperation({
        entityType: 'system',
        entityId: 'sns',
        operation: 'subscription_confirmed',
        details: {
          topicArn: message.TopicArn,
          messageId: message.MessageId
        }
      });

    } catch (error) {
      console.error('Error confirming SNS subscription:', error);
      
      await auditLogService.logSystemError({
        errorType: 'sns_subscription_error',
        errorMessage: `Failed to confirm SNS subscription: ${error}`,
        context: { topicArn: message.TopicArn }
      });
      
      throw error;
    }
  }

  /**
   * Process notification asynchronously
   */
  private async processNotificationAsync(message: SnsMessage): Promise<void> {
    try {
      // Parse the notification
      const parsed = this.parseSnsMessage(message);

      if (!parsed) {
        console.error('Failed to parse SNS notification');
        return;
      }

      console.log('Parsed SNS notification:', {
        type: parsed.type,
        messageId: message.MessageId
      });

      // Log the notification
      await auditLogService.logOperation({
        entityType: 'system',
        entityId: 'sns',
        operation: parsed.type,
        details: {
          messageId: message.MessageId,
          topicArn: message.TopicArn,
          type: parsed.type
        }
      });

      // Route to appropriate handler based on type
      await this.routeNotification(parsed);

    } catch (error) {
      console.error('Error processing SNS notification:', error);
      
      await auditLogService.logSystemError({
        errorType: 'sns_processing_error',
        errorMessage: `Failed to process SNS notification: ${error}`,
        context: { messageId: message.MessageId }
      });
    }
  }

  /**
   * Route notification to appropriate handler
   */
  private async routeNotification(parsed: ParsedSnsMessage): Promise<void> {
    const { emailDeliveryTracker } = await import('./emailDeliveryTracker.js');
    const { bounceComplaintHandler } = await import('./bounceComplaintHandler.js');

    switch (parsed.type) {
      case 'delivery':
        await this.handleDeliveryNotification(parsed.data, emailDeliveryTracker);
        break;

      case 'bounce':
        await this.handleBounceNotification(parsed.data, emailDeliveryTracker, bounceComplaintHandler);
        break;

      case 'complaint':
        await this.handleComplaintNotification(parsed.data, emailDeliveryTracker, bounceComplaintHandler);
        break;

      case 'inbound_email':
        // Process inbound email
        await this.handleInboundEmailNotification(parsed.data);
        break;

      default:
        console.warn('Unknown notification type:', parsed.type);
    }
  }

  /**
   * Handle delivery notification
   */
  private async handleDeliveryNotification(data: any, tracker: any): Promise<void> {
    try {
      const messageId = data.mail?.messageId;
      const timestamp = new Date(data.delivery?.timestamp || data.mail?.timestamp);

      if (!messageId) {
        console.error('No message ID in delivery notification');
        return;
      }

      await tracker.handleDelivery(messageId, timestamp);
    } catch (error) {
      console.error('Error handling delivery notification:', error);
      throw error;
    }
  }

  /**
   * Handle bounce notification
   */
  private async handleBounceNotification(data: any, tracker: any, bounceHandler: any): Promise<void> {
    try {
      const messageId = data.mail?.messageId;
      const bounceType = data.bounce?.bounceType || 'Permanent';
      const bouncedRecipients = data.bounce?.bouncedRecipients?.map((r: any) => r.emailAddress) || [];
      
      // Extract bounce reason
      let reason = 'Unknown bounce reason';
      if (data.bounce?.bouncedRecipients?.[0]?.diagnosticCode) {
        reason = data.bounce.bouncedRecipients[0].diagnosticCode;
      } else if (data.bounce?.bouncedRecipients?.[0]?.status) {
        reason = data.bounce.bouncedRecipients[0].status;
      }

      if (!messageId) {
        console.error('No message ID in bounce notification');
        return;
      }

      // Update delivery status in database
      await tracker.handleBounce(messageId, bounceType, reason, bouncedRecipients);

      // Get user ID from the email message
      const { db } = await import('../database/connection.js');
      const result = await db.query(
        'SELECT user_id FROM email_messages WHERE message_id = $1',
        [messageId]
      );

      if (result.rows.length > 0) {
        const userId = result.rows[0].user_id;
        
        // Generate and send bounce notification fax
        await bounceHandler.handleBounce({
          userId,
          messageId,
          bounceType,
          bouncedRecipients,
          reason,
        });
      } else {
        console.warn(`No email message found for message ID: ${messageId}`);
      }
    } catch (error) {
      console.error('Error handling bounce notification:', error);
      throw error;
    }
  }

  /**
   * Handle complaint notification
   */
  private async handleComplaintNotification(data: any, tracker: any, complaintHandler: any): Promise<void> {
    try {
      const messageId = data.mail?.messageId;
      const complaintType = data.complaint?.complaintFeedbackType || 'abuse';
      const complainedRecipients = data.complaint?.complainedRecipients?.map((r: any) => r.emailAddress) || [];

      if (!messageId) {
        console.error('No message ID in complaint notification');
        return;
      }

      // Update delivery status in database
      await tracker.handleComplaint(messageId, complaintType, complainedRecipients);

      // Get user ID from the email message
      const { db } = await import('../database/connection.js');
      const result = await db.query(
        'SELECT user_id FROM email_messages WHERE message_id = $1',
        [messageId]
      );

      if (result.rows.length > 0) {
        const userId = result.rows[0].user_id;
        
        // Generate and send complaint notification fax
        await complaintHandler.handleComplaint({
          userId,
          messageId,
          complainedRecipients,
          complaintFeedbackType: complaintType,
        });
      } else {
        console.warn(`No email message found for message ID: ${messageId}`);
      }
    } catch (error) {
      console.error('Error handling complaint notification:', error);
      throw error;
    }
  }

  /**
   * Handle inbound email notification from SES
   */
  private async handleInboundEmailNotification(data: any): Promise<void> {
    try {
      const mail = data.mail;
      const content = data.content;

      if (!mail) {
        console.error('No mail data in inbound email notification');
        return;
      }

      const destination = mail.destination?.[0] || '';
      const source = mail.source || '';
      const subject = mail.commonHeaders?.subject || '';

      console.log('Processing inbound email:', {
        to: destination,
        from: source,
        subject: subject
      });

      // Extract sender name from commonHeaders.from
      let fromName: string | undefined;
      if (mail.commonHeaders?.from && mail.commonHeaders.from.length > 0) {
        const fromHeader = mail.commonHeaders.from[0];
        const nameMatch = fromHeader.match(/^(.+?)\s*<.+>$/);
        if (nameMatch) {
          fromName = nameMatch[1].trim();
        }
      }

      // Import necessary services
      const { extractPhoneFromEmail, isFaxiUserEmail } = await import('../config/email.js');
      const { userRepository } = await import('../repositories/userRepository.js');
      const { addressBookRepository } = await import('../repositories/addressBookRepository.js');
      const { blocklistService } = await import('./blocklistService.js');
      const { enqueueEmailToFax } = await import('../queue/faxQueue.js');

      // Extract recipient phone number from email address
      const phoneNumber = extractPhoneFromEmail(destination);

      if (!phoneNumber) {
        console.error('Invalid Faxi email address:', destination);
        await auditLogService.logSystemError({
          errorType: 'invalid_email_address',
          errorMessage: `Received email for invalid Faxi address: ${destination}`,
          context: { to: destination, from: source }
        });
        return;
      }

      // Validate that this is a Faxi user email
      if (!isFaxiUserEmail(destination)) {
        console.error('Email not for Faxi user:', destination);
        return;
      }

      // Find existing user
      const user = await userRepository.findByPhoneNumber(phoneNumber);

      if (!user) {
        console.log('Email rejected - recipient not a registered user:', {
          to: destination,
          from: source,
          phoneNumber
        });
        await auditLogService.log({
          eventType: 'email.unregistered_recipient_rejected',
          eventData: {
            recipientEmail: destination,
            senderEmail: source,
            phoneNumber,
            subject
          }
        });
        return;
      }

      console.log('Found user:', {
        userId: user.id,
        phoneNumber: user.phoneNumber
      });

      // Check if sender is blocked
      const isBlocked = await blocklistService.isBlocked(user.id, source);
      if (isBlocked) {
        console.log('Email from blocked sender rejected:', {
          userId: user.id,
          senderEmail: source
        });
        await auditLogService.log({
          userId: user.id,
          eventType: 'email.blocked_sender_rejected',
          eventData: {
            senderEmail: source,
            subject
          }
        });
        return;
      }

      // Register sender as contact automatically
      try {
        await addressBookRepository.addFromEmail(
          user.id,
          source,
          fromName
        );
        console.log('Contact registered/updated:', {
          userId: user.id,
          email: source,
          name: fromName
        });
      } catch (error) {
        console.error('Failed to register contact:', error);
      }

      // Log email receipt
      await auditLogService.logEmailReceived({
        userId: user.id,
        fromEmail: source,
        toEmail: destination,
        subject,
        bodyLength: content?.length || 0,
        hasAttachments: false,
        provider: 'ses'
      });

      // Enqueue email-to-fax conversion
      const jobId = await enqueueEmailToFax({
        to: user.phoneNumber,
        from: source,
        subject,
        body: content || '',
        receivedAt: mail.timestamp || new Date().toISOString()
      });

      console.log('Email-to-fax job enqueued:', {
        jobId,
        userId: user.id,
        phoneNumber: user.phoneNumber
      });

    } catch (error) {
      console.error('Error handling inbound email notification:', error);

      await auditLogService.logSystemError({
        errorType: 'inbound_email_processing_error',
        errorMessage: `Failed to process inbound email: ${error}`,
        context: { data }
      });
    }
  }

  /**
   * Parse SNS notification message
   */
  parseSnsMessage(message: SnsMessage): ParsedSnsMessage | null {
    try {
      const payload = JSON.parse(message.Message);

      // Determine message type based on notificationType
      if (payload.notificationType === 'Received') {
        return {
          type: 'inbound_email',
          data: payload
        };
      }

      if (payload.notificationType === 'Delivery') {
        return {
          type: 'delivery',
          data: payload
        };
      }

      if (payload.notificationType === 'Bounce') {
        return {
          type: 'bounce',
          data: payload
        };
      }

      if (payload.notificationType === 'Complaint') {
        return {
          type: 'complaint',
          data: payload
        };
      }

      console.warn('Unknown SNS notification type:', payload.notificationType);
      return null;

    } catch (error) {
      console.error('Error parsing SNS message:', error);
      return null;
    }
  }
}

export const snsWebhookHandler = new SnsWebhookHandler();
