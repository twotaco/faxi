import { db } from '../database/connection.js';
import { AuditLogService } from './auditLogService.js';
import { FaxGenerator } from './faxGenerator.js';
import { FaxTemplateEngine } from './faxTemplateEngine.js';
import { faxSenderService } from './faxSenderService.js';
import { userRepository } from '../repositories/userRepository.js';

export interface AccountStatus {
  userId: string;
  complaintCount30Days: number;
  status: 'active' | 'flagged' | 'restricted';
  restrictedAt?: Date;
  restrictionReason?: string;
}

export interface Complaint {
  id: string;
  userId: string;
  messageId: string;
  complainedAt: Date;
  complaintType?: string;
  details?: string;
}

/**
 * Account Review Service
 * 
 * Tracks complaint rates and manages account restrictions.
 * Implements Requirements 16.1-16.7 for complaint tracking and account review.
 */
export class AccountReviewService {
  private auditLogService: AuditLogService;

  constructor() {
    this.auditLogService = new AuditLogService();
  }

  /**
   * Record complaint for user
   * 
   * Inserts a complaint record into the user_complaints table.
   * Requirement 16.1: Track complaint count per user
   */
  async recordComplaint(
    userId: string,
    messageId: string,
    complaintType?: string,
    details?: string
  ): Promise<void> {
    await db.query(
      `INSERT INTO user_complaints (user_id, message_id, complaint_type, details)
       VALUES ($1, $2, $3, $4)`,
      [userId, messageId, complaintType, details]
    );

    console.log(`Recorded complaint for user ${userId}, message ${messageId}`);

    // Log the complaint recording
    await this.auditLogService.log({
      userId,
      eventType: 'account.complaint_recorded',
      eventData: {
        messageId,
        complaintType,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Check account status
   * 
   * Counts complaints in the last 30 days and determines account status.
   * Requirements 16.2, 16.5: Flag at 3 complaints, restrict at 5 complaints
   */
  async checkAccountStatus(userId: string): Promise<AccountStatus> {
    // Count complaints in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db.query(
      `SELECT COUNT(*) as count
       FROM user_complaints
       WHERE user_id = $1 AND complained_at >= $2`,
      [userId, thirtyDaysAgo]
    );

    const complaintCount30Days = parseInt(result.rows[0].count, 10);

    // Get current restriction status from users table
    const userResult = await db.query(
      `SELECT email_restricted, email_restricted_at, email_restriction_reason
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error(`User ${userId} not found`);
    }

    const user = userResult.rows[0];
    const isRestricted = user.email_restricted === true;

    // Determine status based on complaint count
    let status: 'active' | 'flagged' | 'restricted';
    if (isRestricted) {
      status = 'restricted';
    } else if (complaintCount30Days >= 3) {
      status = 'flagged';
    } else {
      status = 'active';
    }

    return {
      userId,
      complaintCount30Days,
      status,
      restrictedAt: user.email_restricted_at,
      restrictionReason: user.email_restriction_reason,
    };
  }

  /**
   * Restrict account
   * 
   * Updates the users table to restrict outbound email sending.
   * Requirements 16.5, 16.6: Restrict at 5 complaints, send notification
   */
  async restrictAccount(userId: string, reason: string): Promise<void> {
    await db.query(
      `UPDATE users
       SET email_restricted = TRUE,
           email_restricted_at = CURRENT_TIMESTAMP,
           email_restriction_reason = $2
       WHERE id = $1`,
      [userId, reason]
    );

    console.log(`Restricted email account for user ${userId}: ${reason}`);

    // Log the restriction
    await this.auditLogService.log({
      userId,
      eventType: 'account.restricted',
      eventData: {
        reason,
        timestamp: new Date().toISOString(),
      },
    });

    // Send notification fax to user
    await this.sendRestrictionNotificationFax(userId, reason);
  }

  /**
   * Get complaint history
   * 
   * Retrieves complaint records for a user within a specified time window.
   * Requirement 16.7: View complaint history for account review
   */
  async getComplaintHistory(userId: string, days: number = 30): Promise<Complaint[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await db.query(
      `SELECT id, user_id, message_id, complained_at, complaint_type, details
       FROM user_complaints
       WHERE user_id = $1 AND complained_at >= $2
       ORDER BY complained_at DESC`,
      [userId, startDate]
    );

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      messageId: row.message_id,
      complainedAt: row.complained_at,
      complaintType: row.complaint_type,
      details: row.details,
    }));
  }

  /**
   * Send restriction notification fax to user
   * 
   * Requirement 16.6: Notify user when account is restricted
   */
  private async sendRestrictionNotificationFax(userId: string, reason: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) {
      console.error(`User ${userId} not found for restriction notification`);
      return;
    }

    const message = `IMPORTANT: EMAIL ACCOUNT RESTRICTED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Your Email Account Has Been Restricted

Your Faxi email account has been temporarily restricted from sending outbound emails.

Reason: ${reason}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What This Means

You will NOT be able to:
  • Send emails through Faxi
  • Reply to emails you receive

You CAN still:
  • Receive emails as faxes
  • Use other Faxi services (shopping, appointments, etc.)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Why This Happened

Your account received multiple spam complaints from email recipients. This indicates that your emails may have been unwanted or inappropriate.

To maintain good email reputation and comply with email provider policies, we must restrict accounts that generate complaints.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

How To Resolve This

1. Review the email etiquette guidelines we sent you
2. Understand why your emails were marked as spam
3. Contact Faxi support to discuss your account:
   
   Email: help@faxi.jp
   Phone: +81-3-1234-5678

4. After review, we may lift the restriction if appropriate

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Important Reminders

• Only send emails to people who want to hear from you
• Be respectful and professional in all communications
• Don't send unsolicited emails or spam
• Respect when people ask you to stop contacting them

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We take email complaints seriously to protect all Faxi users and maintain our service quality.

If you believe this restriction was applied in error, please contact support immediately.`;

    const template = FaxTemplateEngine.createClarificationTemplate({
      question: message,
      requiredInfo: [],
      supportContact: 'help@faxi.jp | +81-3-1234-5678',
    });

    const pdfBuffer = await FaxGenerator.generatePdf(template);

    await faxSenderService.sendFax({
      to: user.phoneNumber,
      from: process.env.TELNYX_FAX_NUMBER || '+18005551234',
      mediaUrl: '',
      pdfBuffer,
      metadata: {
        type: 'account_restriction',
        userId,
        reason,
      },
    });

    console.log(`Restriction notification fax sent to ${user.phoneNumber}`);
  }

  /**
   * Send warning fax to user
   * 
   * Requirement 16.4: Send warning fax when account is flagged
   */
  async sendWarningFax(userId: string, complaintCount: number): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) {
      console.error(`User ${userId} not found for warning fax`);
      return;
    }

    const message = `⚠️ WARNING: EMAIL COMPLAINT THRESHOLD REACHED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Important Account Notice

Your Faxi email account has received ${complaintCount} spam complaints in the last 30 days.

This is a WARNING that your account is at risk of being restricted.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What Happens Next

If you receive ${5 - complaintCount} more complaint(s) within 30 days:
  ⚠️ Your email sending will be RESTRICTED
  ⚠️ You will not be able to send emails through Faxi
  ⚠️ Manual review will be required to restore access

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

How To Avoid Restrictions

Please review and follow these guidelines:

1. ONLY send emails to people who want to hear from you
   • Don't send unsolicited emails
   • Respect when people ask to stop receiving emails

2. Be clear and professional
   • Include your name and reason for contact
   • Keep messages relevant and respectful
   • Don't send spam or advertisements

3. Respect privacy
   • Don't share others' email addresses
   • Don't forward chain emails

4. If someone complains or asks you to stop
   • Immediately stop emailing them
   • Use the "Block" command to prevent accidental contact

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Need Help Understanding This?

Contact Faxi support:
  Email: help@faxi.jp
  Phone: +81-3-1234-5678

We're here to help you use email appropriately and avoid restrictions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is an automated warning based on complaint reports from email recipients. Please take this seriously to maintain your email access.`;

    const template = FaxTemplateEngine.createClarificationTemplate({
      question: message,
      requiredInfo: [],
      supportContact: 'help@faxi.jp | +81-3-1234-5678',
    });

    const pdfBuffer = await FaxGenerator.generatePdf(template);

    await faxSenderService.sendFax({
      to: user.phoneNumber,
      from: process.env.TELNYX_FAX_NUMBER || '+18005551234',
      mediaUrl: '',
      pdfBuffer,
      metadata: {
        type: 'account_warning',
        userId,
        complaintCount,
      },
    });

    console.log(`Warning fax sent to ${user.phoneNumber} (${complaintCount} complaints)`);
  }

  /**
   * Send alert to administrators
   * 
   * Requirement 16.3: Alert administrators when account is flagged
   */
  async sendAdminAlert(userId: string, complaintCount: number): Promise<void> {
    // Log the alert
    await this.auditLogService.log({
      userId,
      eventType: 'account.flagged_for_review',
      eventData: {
        complaintCount,
        threshold: 3,
        timestamp: new Date().toISOString(),
      },
    });

    // In production, this would integrate with alerting service
    console.warn(`ADMIN ALERT: User ${userId} flagged for review with ${complaintCount} complaints`);
    
    // TODO: Integrate with alertingService.sendAlert() when available
    // await alertingService.sendAlert({
    //   severity: 'warning',
    //   title: 'User Account Flagged for Review',
    //   message: `User ${userId} has ${complaintCount} complaints in 30 days`,
    //   userId,
    // });
  }
}

// Export singleton instance
export const accountReviewService = new AccountReviewService();
