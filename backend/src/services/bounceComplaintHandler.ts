import { db } from '../database/connection.js';
import { FaxGenerator } from './faxGenerator.js';
import { FaxTemplateEngine } from './faxTemplateEngine.js';
import { faxSenderService } from './faxSenderService.js';
import { AuditLogService } from './auditLogService.js';
import { userRepository } from '../repositories/userRepository.js';

export interface BounceDetails {
  messageId: string;
  bounceType: 'Permanent' | 'Transient';
  bouncedRecipients: string[];
  reason: string;
  timestamp: Date;
}

export interface ComplaintDetails {
  messageId: string;
  complainedRecipients: string[];
  complaintFeedbackType?: string;
  timestamp: Date;
}

/**
 * Bounce and Complaint Handler Service
 * 
 * Processes bounce and complaint notifications from AWS SES.
 * Generates user-friendly fax notifications and logs events.
 */
export class BounceComplaintHandler {
  private auditLogService: AuditLogService;

  constructor() {
    this.auditLogService = new AuditLogService();
  }

  /**
   * Handle bounce notification
   * 
   * Processes bounce events from AWS SES, distinguishing between hard and soft bounces.
   * Generates notification fax for users and logs the event.
   */
  async handleBounce(params: {
    userId: string;
    messageId: string;
    bounceType: 'Permanent' | 'Transient';
    bouncedRecipients: string[];
    reason: string;
  }): Promise<void> {
    const { userId, messageId, bounceType, bouncedRecipients, reason } = params;

    console.log(`Handling ${bounceType} bounce for message ${messageId}, user ${userId}`);

    // Get user details
    const user = await userRepository.findById(userId);
    if (!user) {
      console.error(`User ${userId} not found for bounce notification`);
      return;
    }

    // Log the bounce event
    await this.auditLogService.logEmailEvent({
      userId,
      eventType: 'email.bounced',
      messageId,
      details: {
        bounceType,
        bouncedRecipients,
        reason,
        timestamp: new Date().toISOString(),
      },
    });

    // Generate and send bounce notification fax
    const bounceDetails: BounceDetails = {
      messageId,
      bounceType,
      bouncedRecipients,
      reason,
      timestamp: new Date(),
    };

    await this.generateBounceNotificationFax(userId, user.phoneNumber, bounceDetails);
  }

  /**
   * Handle complaint notification
   * 
   * Processes complaint events from AWS SES.
   * Generates notification fax with etiquette guidance and logs the event.
   */
  async handleComplaint(params: {
    userId: string;
    messageId: string;
    complainedRecipients: string[];
    complaintFeedbackType?: string;
  }): Promise<void> {
    const { userId, messageId, complainedRecipients, complaintFeedbackType } = params;

    console.log(`Handling complaint for message ${messageId}, user ${userId}`);

    // Get user details
    const user = await userRepository.findById(userId);
    if (!user) {
      console.error(`User ${userId} not found for complaint notification`);
      return;
    }

    // Log the complaint event
    await this.auditLogService.logEmailEvent({
      userId,
      eventType: 'email.complained',
      messageId,
      details: {
        complainedRecipients,
        complaintFeedbackType,
        timestamp: new Date().toISOString(),
      },
    });

    // Generate and send complaint notification fax
    const complaintDetails: ComplaintDetails = {
      messageId,
      complainedRecipients,
      complaintFeedbackType,
      timestamp: new Date(),
    };

    await this.generateComplaintNotificationFax(userId, user.phoneNumber, complaintDetails);
  }

  /**
   * Generate bounce notification fax
   * 
   * Creates a user-friendly fax explaining why the email bounced and what to do next.
   */
  async generateBounceNotificationFax(
    userId: string,
    phoneNumber: string,
    bounceDetails: BounceDetails
  ): Promise<void> {
    const { bounceType, bouncedRecipients, reason } = bounceDetails;

    // Determine user-friendly message based on bounce type
    const isPermanent = bounceType === 'Permanent';
    const bounceTypeText = isPermanent ? 'PERMANENT' : 'TEMPORARY';
    
    let explanation: string;
    let nextSteps: string[];

    if (isPermanent) {
      explanation = `Your email could not be delivered because the recipient's email address is invalid or does not exist.`;
      nextSteps = [
        'Verify the email address is correct',
        'Check for typos in the email address',
        'Contact the recipient through another method to confirm their email',
        'If this is a contact from your address book, you may need to update their information',
      ];
    } else {
      explanation = `Your email could not be delivered temporarily. This usually means the recipient's mailbox is full or their email server is temporarily unavailable.`;
      nextSteps = [
        'We will automatically retry sending this email',
        'If it continues to fail, try again later',
        'Consider contacting the recipient through another method',
      ];
    }

    // Build fax content
    const recipientsList = bouncedRecipients.map(email => `  • ${email}`).join('\n');
    const nextStepsList = nextSteps.map((step, index) => `${index + 1}. ${step}`).join('\n');

    const message = `EMAIL DELIVERY FAILED - ${bounceTypeText} BOUNCE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Email Delivery Problem

We attempted to send your email but it could not be delivered.

Recipients affected:
${recipientsList}

Bounce Type: ${bounceTypeText}

${explanation}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Technical Details

Reason: ${reason}
Message ID: ${bounceDetails.messageId}
Time: ${bounceDetails.timestamp.toLocaleString('ja-JP')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What To Do Next

${nextStepsList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Need Help?

If you need assistance, please contact Faxi support:
  Email: help@faxi.jp
  Phone: +81-3-1234-5678`;

    // Create simple confirmation template with the message
    const template = FaxTemplateEngine.createConfirmationTemplate({
      type: 'email',
      message,
    });

    // Generate PDF
    const pdfBuffer = await FaxGenerator.generatePdf(template);

    // Send fax
    await faxSenderService.sendFax({
      to: phoneNumber,
      from: process.env.TELNYX_FAX_NUMBER || '+18005551234',
      mediaUrl: '', // Will be set by faxSenderService after upload
      pdfBuffer,
      metadata: {
        type: 'bounce_notification',
        userId,
        messageId: bounceDetails.messageId,
        bounceType,
      },
    });

    console.log(`Bounce notification fax sent to ${phoneNumber}`);
  }

  /**
   * Generate complaint notification fax with etiquette guidance
   * 
   * Creates a fax explaining the complaint and providing email etiquette guidance.
   */
  async generateComplaintNotificationFax(
    userId: string,
    phoneNumber: string,
    complaintDetails: ComplaintDetails
  ): Promise<void> {
    const { complainedRecipients, complaintFeedbackType } = complaintDetails;

    // Build fax content with etiquette guidance
    const recipientsList = complainedRecipients.map(email => `  • ${email}`).join('\n');
    const complaintTypeText = complaintFeedbackType ? `\nComplaint Type: ${complaintFeedbackType}` : '';

    const message = `IMPORTANT: EMAIL COMPLAINT RECEIVED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Complaint Notification

A recipient has marked your email as spam or unwanted.

Recipients who complained:
${recipientsList}${complaintTypeText}

This is a serious matter that affects your ability to send emails through Faxi.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Why This Matters

Email complaints can result in:
  • Your emails being blocked by email providers
  • Restrictions on your Faxi email account
  • Damage to Faxi's email reputation

Multiple complaints may result in temporary or permanent restrictions on your email sending ability.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Email Etiquette Guidelines

To avoid future complaints, please follow these guidelines:

1. ONLY send emails to people who want to hear from you
   • Don't send unsolicited emails
   • Respect when people ask to stop receiving emails

2. Be clear about who you are
   • Include your name in the email
   • Explain why you're contacting them

3. Keep emails relevant and respectful
   • Don't send spam or advertisements
   • Be polite and professional
   • Keep messages concise

4. Respect privacy
   • Don't share others' email addresses
   • Don't forward chain emails

5. If someone asks you to stop emailing them
   • Respect their wishes immediately
   • You can block them using the "Block" command

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What To Do Now

1. Review the email you sent to understand why it was marked as spam
2. Do not send any more emails to the recipients who complained
3. Review these etiquette guidelines carefully
4. If you believe this was a mistake, contact Faxi support

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Technical Details

Message ID: ${complaintDetails.messageId}
Time: ${complaintDetails.timestamp.toLocaleString('ja-JP')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Need Help?

If you have questions or believe this was a mistake:
  Email: help@faxi.jp
  Phone: +81-3-1234-5678`;

    // Create clarification template with the message
    const template = FaxTemplateEngine.createClarificationTemplate({
      question: message,
      requiredInfo: [],
      supportContact: 'help@faxi.jp | +81-3-1234-5678',
    });

    // Generate PDF
    const pdfBuffer = await FaxGenerator.generatePdf(template);

    // Send fax
    await faxSenderService.sendFax({
      to: phoneNumber,
      from: process.env.TELNYX_FAX_NUMBER || '+18005551234',
      mediaUrl: '', // Will be set by faxSenderService after upload
      pdfBuffer,
      metadata: {
        type: 'complaint_notification',
        userId,
        messageId: complaintDetails.messageId,
        complaintFeedbackType,
      },
    });

    console.log(`Complaint notification fax sent to ${phoneNumber}`);
  }
}

// Export singleton instance
export const bounceComplaintHandler = new BounceComplaintHandler();
