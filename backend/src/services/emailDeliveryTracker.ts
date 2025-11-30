import { db } from '../database/connection';
import { auditLogService } from './auditLogService';
import { FaxGenerator } from './faxGenerator';
import { faxSenderService } from './faxSenderService';
import { userRepository } from '../repositories/userRepository';
import { s3Storage } from '../storage/s3';
import { FaxTemplate } from '../types/fax';
import { emailMetricsService } from './emailMetricsService';

/**
 * Email Delivery Tracker Service
 * 
 * Tracks email delivery status and handles delivery events from AWS SES.
 * Updates email_messages table with delivery status and generates error notification faxes.
 */
export class EmailDeliveryTracker {
  /**
   * Handle successful email delivery
   */
  async handleDelivery(messageId: string, timestamp: Date): Promise<void> {
    try {
      // Update email message status
      await db.query(
        `UPDATE email_messages 
         SET delivery_status = 'delivered',
             delivery_timestamp = $2,
             delivery_details = 'Email delivered successfully'
         WHERE message_id = $1`,
        [messageId, timestamp]
      );

      // Log delivery event in audit log
      await auditLogService.log({
        eventType: 'email.delivered',
        eventData: {
          messageId,
          timestamp: timestamp.toISOString(),
          status: 'delivered',
        },
      });

      // Record 'delivered' event for metrics tracking (Requirement 17.1)
      await emailMetricsService.recordEmailEvent({
        eventType: 'delivered',
        messageId,
        occurredAt: timestamp,
      });

      console.log(`Email delivery tracked: ${messageId}`);
    } catch (error) {
      console.error('Error handling email delivery:', error);
      throw error;
    }
  }

  /**
   * Handle email bounce
   */
  async handleBounce(
    messageId: string,
    bounceType: 'Permanent' | 'Transient',
    reason: string,
    bouncedRecipients: string[]
  ): Promise<void> {
    try {
      const timestamp = new Date();

      // Update email message status
      await db.query(
        `UPDATE email_messages 
         SET delivery_status = 'bounced',
             delivery_timestamp = $2,
             delivery_details = $3
         WHERE message_id = $1`,
        [messageId, timestamp, `${bounceType} bounce: ${reason}`]
      );

      // Get email message details to find user
      const messageResult = await db.query(
        `SELECT em.from_address, em.to_addresses, em.subject, et.user_id
         FROM email_messages em
         JOIN email_threads et ON em.thread_id = et.id
         WHERE em.message_id = $1`,
        [messageId]
      );

      if (messageResult.rows.length > 0) {
        const message = messageResult.rows[0];
        const userId = message.user_id;

        // Log bounce event in audit log
        await auditLogService.log({
          userId,
          eventType: 'email.bounced',
          eventData: {
            messageId,
            bounceType,
            reason,
            bouncedRecipients,
            timestamp: timestamp.toISOString(),
          },
        });

        // Record 'bounced' event for metrics tracking (Requirement 17.1)
        await emailMetricsService.recordEmailEvent({
          eventType: 'bounced',
          userId,
          messageId,
          occurredAt: timestamp,
          details: {
            bounceType,
            reason,
            bouncedRecipients,
          },
        });

        // Generate error notification fax for user
        await this.generateBounceNotificationFax(
          userId,
          message.to_addresses,
          message.subject,
          bounceType,
          reason
        );
      }

      console.log(`Email bounce tracked: ${messageId} (${bounceType})`);
    } catch (error) {
      console.error('Error handling email bounce:', error);
      throw error;
    }
  }

  /**
   * Handle email complaint
   */
  async handleComplaint(
    messageId: string,
    complaintType: string,
    complainedRecipients: string[]
  ): Promise<void> {
    try {
      const timestamp = new Date();

      // Update email message status
      await db.query(
        `UPDATE email_messages 
         SET delivery_status = 'complained',
             delivery_timestamp = $2,
             delivery_details = $3
         WHERE message_id = $1`,
        [messageId, timestamp, `Complaint: ${complaintType}`]
      );

      // Get email message details to find user
      const messageResult = await db.query(
        `SELECT em.from_address, em.to_addresses, em.subject, et.user_id
         FROM email_messages em
         JOIN email_threads et ON em.thread_id = et.id
         WHERE em.message_id = $1`,
        [messageId]
      );

      if (messageResult.rows.length > 0) {
        const message = messageResult.rows[0];
        const userId = message.user_id;

        // Log complaint event in audit log
        await auditLogService.log({
          userId,
          eventType: 'email.complained',
          eventData: {
            messageId,
            complaintType,
            complainedRecipients,
            timestamp: timestamp.toISOString(),
          },
        });

        // Record 'complained' event for metrics tracking (Requirement 17.1)
        await emailMetricsService.recordEmailEvent({
          eventType: 'complained',
          userId,
          messageId,
          occurredAt: timestamp,
          details: {
            complaintType,
            complainedRecipients,
          },
        });

        console.log(`Email complaint tracked: ${messageId} (${complaintType})`);
      }
    } catch (error) {
      console.error('Error handling email complaint:', error);
      throw error;
    }
  }

  /**
   * Get delivery status for a message
   */
  async getDeliveryStatus(messageId: string): Promise<{
    messageId: string;
    status: 'pending' | 'delivered' | 'bounced' | 'complained';
    timestamp?: Date;
    details?: string;
  } | null> {
    try {
      const result = await db.query(
        `SELECT message_id as "messageId",
                delivery_status as status,
                delivery_timestamp as timestamp,
                delivery_details as details
         FROM email_messages
         WHERE message_id = $1`,
        [messageId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting delivery status:', error);
      throw error;
    }
  }

  /**
   * Generate bounce notification fax for user
   */
  private async generateBounceNotificationFax(
    userId: string,
    recipientAddresses: string[],
    subject: string,
    bounceType: 'Permanent' | 'Transient',
    reason: string
  ): Promise<void> {
    try {
      // Get user details
      const user = await userRepository.findById(userId);
      if (!user) {
        console.error(`User not found: ${userId}`);
        return;
      }

      // Parse recipient addresses (stored as JSONB array)
      const recipients = typeof recipientAddresses === 'string' 
        ? JSON.parse(recipientAddresses) 
        : recipientAddresses;
      const recipientList = Array.isArray(recipients) ? recipients.join(', ') : recipients;

      // Create error notification fax template
      const template: FaxTemplate = {
        type: 'confirmation', // Use confirmation type for error notifications
        referenceId: `ERR-${Date.now()}`,
        pages: [
          {
            content: [
              {
                type: 'header',
                text: 'Faxi - Email Delivery Failed',
                fontSize: 60,
                alignment: 'center',
                bold: true,
                marginBottom: 40,
              },
              {
                type: 'text',
                text: 'Your email could not be delivered.',
                fontSize: 50,
                bold: true,
                marginBottom: 30,
              },
              {
                type: 'text',
                text: `To: ${recipientList}`,
                fontSize: 45,
                marginBottom: 15,
              },
              {
                type: 'text',
                text: `Subject: ${subject}`,
                fontSize: 45,
                marginBottom: 30,
              },
              {
                type: 'text',
                text: `Error Type: ${bounceType === 'Permanent' ? 'Permanent Failure' : 'Temporary Failure'}`,
                fontSize: 45,
                marginBottom: 15,
              },
              {
                type: 'text',
                text: `Reason: ${reason}`,
                fontSize: 45,
                marginBottom: 40,
              },
              {
                type: 'text',
                text: bounceType === 'Permanent'
                  ? 'This email address is invalid or does not exist. Please check the address and try again.'
                  : 'The recipient\'s mailbox may be full or temporarily unavailable. The system will retry delivery automatically.',
                fontSize: 45,
                marginBottom: 30,
              },
              {
                type: 'footer',
                text: 'For assistance, please send a fax with your question.',
                fontSize: 40,
                alignment: 'center',
                marginTop: 40,
              },
            ],
            pageNumber: 1,
            totalPages: 1,
          },
        ],
        contextData: {
          userId,
          messageType: 'bounce_notification',
          bounceType,
        },
      };

      // Generate PDF
      const pdfBuffer = await FaxGenerator.generatePdf(template);

      // Upload PDF to S3
      const storageKey = `faxes/bounce-notifications/${userId}/${Date.now()}.pdf`;
      await s3Storage.uploadFile(storageKey, pdfBuffer, 'application/pdf');
      
      // Get presigned URL for the uploaded file (valid for 1 hour)
      const mediaUrl = await s3Storage.getPresignedUrl(storageKey, 3600);

      // Send fax to user
      await faxSenderService.sendFax({
        to: user.phoneNumber,
        from: process.env.TELNYX_FAX_NUMBER || '+18005551234',
        mediaUrl,
        referenceId: template.referenceId,
      });

      console.log(`Bounce notification fax sent to user ${userId}`);
    } catch (error) {
      console.error('Error generating bounce notification fax:', error);
      // Don't throw - we don't want to fail the bounce handling if fax generation fails
    }
  }
}

export const emailDeliveryTracker = new EmailDeliveryTracker();
