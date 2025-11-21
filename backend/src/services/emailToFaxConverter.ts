import { EmailReplyData } from '../types/fax';
import { EmailFaxGenerator } from './emailFaxGenerator';
import { FaxGenerator } from './faxGenerator';
import { FaxTemplateEngine } from './faxTemplateEngine';

export interface EmailToFaxOptions {
  includeAttachmentNotifications?: boolean;
  maxBodyLength?: number;
  preserveFormatting?: boolean;
}

export interface ConvertedEmailFax {
  pdfBuffer: Buffer;
  referenceId: string;
  pageCount: number;
  hasAttachments: boolean;
  attachmentCount: number;
}

export class EmailToFaxConverter {
  private static readonly DEFAULT_OPTIONS: EmailToFaxOptions = {
    includeAttachmentNotifications: true,
    maxBodyLength: 2000, // Limit to prevent excessive pages
    preserveFormatting: true
  };

  /**
   * Convert email to fax format
   */
  static async convertEmailToFax(
    emailData: {
      from: string;
      subject: string;
      body: string;
      html?: string;
      attachments?: Array<{ filename: string; size: number; contentType: string }>;
    },
    options: EmailToFaxOptions = {}
  ): Promise<ConvertedEmailFax> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    // Generate reference ID for this email-to-fax conversion
    const referenceId = this.generateReferenceId();

    // Process email content
    const processedBody = this.processEmailBody(emailData.body, emailData.html, opts);
    
    // Create email reply data structure
    const emailReplyData: EmailReplyData = {
      from: emailData.from,
      subject: emailData.subject,
      body: processedBody,
      hasQuickReplies: false // Email-to-fax doesn't include quick replies
    };

    // Add attachment notifications if present
    if (emailData.attachments && emailData.attachments.length > 0 && opts.includeAttachmentNotifications) {
      emailReplyData.body += this.generateAttachmentNotification(emailData.attachments);
    }

    // Generate fax PDF
    const pdfBuffer = await EmailFaxGenerator.generateEmailFax(emailReplyData, {
      includeQuickReplies: false,
      minimizePages: true
    }, referenceId);

    return {
      pdfBuffer,
      referenceId,
      pageCount: 1, // Single PDF file
      hasAttachments: (emailData.attachments?.length || 0) > 0,
      attachmentCount: emailData.attachments?.length || 0
    };
  }

  /**
   * Process email body content for fax format
   */
  private static processEmailBody(
    textBody: string,
    htmlBody?: string,
    options: EmailToFaxOptions = {}
  ): string {
    let body = textBody;

    // If no text body but HTML is available, convert HTML to text
    if (!body && htmlBody) {
      body = this.convertHtmlToText(htmlBody);
    }

    // Clean up the body
    body = this.cleanEmailBody(body);

    // Limit body length to prevent excessive pages
    if (options.maxBodyLength && body.length > options.maxBodyLength) {
      body = body.substring(0, options.maxBodyLength) + '\n\n[Email content truncated to fit on fax pages]';
    }

    return body;
  }

  /**
   * Convert HTML email to plain text
   */
  private static convertHtmlToText(html: string): string {
    if (!html) return '';

    let text = html;

    // Convert common HTML elements to text equivalents
    text = text
      // Convert line breaks
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      
      // Convert lists
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      
      // Convert links (show URL)
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
      
      // Remove all other HTML tags
      .replace(/<[^>]*>/g, '')
      
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      
      // Clean up whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
      .replace(/[ \t]+/g, ' ') // Collapse multiple spaces
      .trim();

    return text;
  }

  /**
   * Clean up email body content
   */
  private static cleanEmailBody(body: string): string {
    if (!body) return '';

    let cleaned = body;

    // Remove email signatures (common patterns)
    cleaned = this.removeEmailSignatures(cleaned);

    // Remove quoted text from replies (lines starting with >)
    cleaned = this.removeQuotedText(cleaned);

    // Clean up excessive whitespace
    cleaned = cleaned
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
      .replace(/[ \t]+/g, ' ') // Collapse multiple spaces
      .trim();

    return cleaned;
  }

  /**
   * Remove email signatures
   */
  private static removeEmailSignatures(body: string): string {
    // Common signature patterns
    const signaturePatterns = [
      /\n--\s*\n[\s\S]*$/,  // Standard signature delimiter
      /\n_{3,}\s*\n[\s\S]*$/,  // Underscore delimiter
      /\nSent from my \w+[\s\S]*$/i,  // Mobile signatures
      /\nGet Outlook for \w+[\s\S]*$/i,  // Outlook signatures
      /\nThis email was sent from[\s\S]*$/i,  // Generic mobile signatures
    ];

    let cleaned = body;
    for (const pattern of signaturePatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    return cleaned;
  }

  /**
   * Remove quoted text from email replies
   */
  private static removeQuotedText(body: string): string {
    const lines = body.split('\n');
    const cleanedLines: string[] = [];
    let inQuotedSection = false;

    for (const line of lines) {
      // Check if this line starts a quoted section
      if (line.trim().startsWith('>') || 
          line.includes('wrote:') || 
          line.includes('On ') && line.includes(' wrote:')) {
        inQuotedSection = true;
        continue;
      }

      // If we're in a quoted section and this line doesn't look like quoted text, exit
      if (inQuotedSection && !line.trim().startsWith('>') && line.trim().length > 0) {
        inQuotedSection = false;
      }

      // Only include lines that aren't in quoted sections
      if (!inQuotedSection) {
        cleanedLines.push(line);
      }
    }

    return cleanedLines.join('\n');
  }

  /**
   * Generate attachment notification text
   */
  private static generateAttachmentNotification(
    attachments: Array<{ filename: string; size: number; contentType: string }>
  ): string {
    if (attachments.length === 0) return '';

    let notification = '\n\n--- ATTACHMENTS ---\n';
    notification += `This email included ${attachments.length} attachment${attachments.length > 1 ? 's' : ''}:\n\n`;

    for (const attachment of attachments) {
      const sizeKB = Math.round(attachment.size / 1024);
      notification += `• ${attachment.filename} (${sizeKB} KB)\n`;
    }

    notification += '\nTo access attachments, contact support at:\n';
    notification += 'Email: help@faxi.jp\n';
    notification += 'Phone: +81-3-1234-5678\n';
    notification += '\nWe can help you access attachment content\n';
    notification += 'or convert it to a format suitable for fax.';

    return notification;
  }

  /**
   * Generate reference ID for email-to-fax conversion
   */
  private static generateReferenceId(): string {
    const year = new Date().getFullYear();
    const sequence = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `FX-${year}-${sequence}`;
  }

  /**
   * Convert email thread to fax (multiple emails in conversation)
   */
  static async convertEmailThreadToFax(
    emails: Array<{
      from: string;
      subject: string;
      body: string;
      html?: string;
      timestamp: Date;
    }>,
    options: EmailToFaxOptions = {}
  ): Promise<ConvertedEmailFax> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const referenceId = this.generateReferenceId();

    // Process each email in the thread
    const processedEmails = emails.map((email, index) => {
      const processedBody = this.processEmailBody(email.body, email.html, opts);
      const direction = email.from.includes('@me.faxi.jp') ? 'You wrote' : `${email.from} wrote`;
      const timestamp = email.timestamp.toLocaleDateString('ja-JP');
      
      return {
        direction,
        timestamp,
        subject: email.subject,
        body: processedBody
      };
    });

    // Create conversation body
    const conversationBody = processedEmails.map(email => {
      return `--- ${email.direction} (${email.timestamp}) ---\nSubject: ${email.subject}\n\n${email.body}\n\n`;
    }).join('');

    // Create email reply data for the thread
    const emailReplyData: EmailReplyData = {
      from: 'Email Thread',
      subject: `Conversation: ${emails[0]?.subject || 'Email Thread'}`,
      body: conversationBody,
      hasQuickReplies: false
    };

    // Generate fax PDF
    const pdfBuffer = await EmailFaxGenerator.generateEmailFax(emailReplyData, {
      includeQuickReplies: false,
      minimizePages: true
    }, referenceId);

    return {
      pdfBuffer,
      referenceId,
      pageCount: 1, // Single PDF file
      hasAttachments: false,
      attachmentCount: 0
    };
  }

  /**
   * Create spam notification fax
   */
  static async createSpamNotificationFax(
    spamCount: number,
    timeframe: string = '24 hours'
  ): Promise<ConvertedEmailFax> {
    const referenceId = this.generateReferenceId();

    const pdfBuffer = await EmailFaxGenerator.generateSpamNotificationFax(
      spamCount,
      timeframe,
      referenceId
    );

    return {
      pdfBuffer,
      referenceId,
      pageCount: 1, // Single PDF file
      hasAttachments: false,
      attachmentCount: 0
    };
  }

  /**
   * Create email delivery failure notification fax
   */
  static async createEmailFailureFax(
    recipientEmail: string,
    errorMessage: string,
    originalSubject: string
  ): Promise<ConvertedEmailFax> {
    const referenceId = this.generateReferenceId();

    const pdfBuffer = await EmailFaxGenerator.generateEmailFailureFax(
      recipientEmail,
      errorMessage,
      originalSubject,
      referenceId
    );

    return {
      pdfBuffer,
      referenceId,
      pageCount: 1, // Single PDF file
      hasAttachments: false,
      attachmentCount: 0
    };
  }
}