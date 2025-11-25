import { FaxTemplateEngine } from './faxTemplateEngine.js';
import { FaxGenerator } from './faxGenerator.js';
import { EmailReplyData, FaxTemplate } from '../types/fax.js';

export interface EmailFaxOptions {
  includeQuickReplies?: boolean;
  maxQuickReplies?: number;
  minimizePages?: boolean;
}

export class EmailFaxGenerator {
  /**
   * Generate email fax from email data
   */
  static async generateEmailFax(
    emailData: EmailReplyData,
    options: EmailFaxOptions = {},
    referenceId?: string
  ): Promise<Buffer> {
    const opts = {
      includeQuickReplies: true,
      maxQuickReplies: 3,
      minimizePages: true,
      ...options
    };

    // Detect if email contains clear questions for quick replies
    const processedEmailData = this.processEmailForQuickReplies(emailData, opts);

    // Create template
    const template = FaxTemplateEngine.createEmailReplyTemplate(processedEmailData, referenceId);

    // Generate PDF
    return await FaxGenerator.generatePdf(template);
  }

  /**
   * Process email content to detect questions and generate quick replies
   */
  private static processEmailForQuickReplies(
    emailData: EmailReplyData,
    options: EmailFaxOptions
  ): EmailReplyData {
    // If hasQuickReplies is explicitly set to false, respect that
    if (emailData.hasQuickReplies === false) {
      return { ...emailData, hasQuickReplies: false, quickReplies: [] };
    }

    if (!options.includeQuickReplies) {
      return { ...emailData, hasQuickReplies: false };
    }

    const quickReplies = this.detectQuickReplies(emailData.body, options.maxQuickReplies || 3);
    
    return {
      ...emailData,
      hasQuickReplies: quickReplies.length > 0,
      quickReplies: quickReplies.length > 0 ? quickReplies : undefined
    };
  }

  /**
   * Detect questions in email and generate appropriate quick replies
   */
  private static detectQuickReplies(emailBody: string, maxReplies: number): string[] {
    const replies: string[] = [];

    // Common question patterns and their responses
    const questionPatterns = [
      {
        patterns: [/can you meet/i, /would you like to meet/i, /want to meet/i],
        replies: ['Yes, that works for me', 'No, I\'m not available', 'Can we do a different time?']
      },
      {
        patterns: [/are you free/i, /are you available/i],
        replies: ['Yes, I\'m free', 'No, I\'m busy', 'What time?']
      },
      {
        patterns: [/do you want/i, /would you like/i],
        replies: ['Yes, please', 'No, thank you', 'Maybe later']
      },
      {
        patterns: [/can you help/i, /need help/i],
        replies: ['Yes, I can help', 'Sorry, I can\'t', 'What do you need?']
      },
      {
        patterns: [/what do you think/i, /your opinion/i],
        replies: ['I agree', 'I disagree', 'I need more information']
      },
      {
        patterns: [/yes or no/i, /\?.*yes.*no/i, /\?.*no.*yes/i],
        replies: ['Yes', 'No']
      },
      {
        patterns: [/when/i, /what time/i],
        replies: ['Morning works', 'Afternoon works', 'Evening works']
      },
      {
        patterns: [/where/i, /which place/i],
        replies: ['Your suggestion is fine', 'I have a different preference', 'Let me think about it']
      }
    ];

    // Check for question patterns
    for (const pattern of questionPatterns) {
      for (const regex of pattern.patterns) {
        if (regex.test(emailBody)) {
          replies.push(...pattern.replies.slice(0, maxReplies));
          return replies.slice(0, maxReplies);
        }
      }
    }

    // Check for general questions (ending with ?)
    const sentences = emailBody.split(/[.!?]+/);
    const questions = sentences.filter(sentence => 
      sentence.trim().endsWith('?') || 
      sentence.includes('?')
    );

    if (questions.length > 0) {
      // Generic responses for unrecognized questions
      return [
        'Yes',
        'No', 
        'Let me get back to you'
      ].slice(0, maxReplies);
    }

    return [];
  }

  /**
   * Generate welcome email fax for new users
   */
  static async generateWelcomeEmailFax(
    userPhoneNumber: string,
    userEmailAddress: string,
    referenceId?: string
  ): Promise<Buffer> {
    const emailData: EmailReplyData = {
      from: 'Faxi System <welcome@faxi.jp>',
      subject: 'Welcome to Faxi!',
      body: `Welcome to Faxi! Your fax machine is now connected to the internet.

Your dedicated email address is: ${userEmailAddress}

You can now:
• Send emails by faxing us your message
• Shop online by faxing product requests  
• Ask questions to our AI assistant
• Register payment methods for easy shopping

To get started, try faxing us:
"Send email to friend@example.com: Hello from my fax machine!"

Or ask us a question:
"What's the weather like today?"

We're here to help bridge your fax machine to the digital world.

Need help? Contact us anytime at help@faxi.jp or +81-3-1234-5678.`,
      hasQuickReplies: true,
      quickReplies: [
        'I want to register a payment method',
        'I want to add contacts to my address book',
        'I have questions about how this works'
      ]
    };

    const template = FaxTemplateEngine.createEmailReplyTemplate(emailData, referenceId);
    return await FaxGenerator.generatePdf(template);
  }

  /**
   * Generate email thread fax (for conversation history)
   */
  static async generateEmailThreadFax(
    emails: EmailReplyData[],
    referenceId?: string
  ): Promise<Buffer> {
    if (emails.length === 0) {
      throw new Error('No emails provided for thread fax');
    }

    // For multiple emails, create a conversation view
    if (emails.length > 1) {
      const conversationBody = emails.map((email, index) => {
        const direction = email.from.includes('@me.faxi.jp') ? 'You wrote' : `${email.from} wrote`;
        const timestamp = new Date().toLocaleDateString('ja-JP'); // In real implementation, use actual timestamps
        
        return `--- ${direction} (${timestamp}) ---
Subject: ${email.subject}

${email.body}

`;
      }).join('\n');

      const threadData: EmailReplyData = {
        from: 'Email Thread',
        subject: `Conversation: ${emails[0].subject}`,
        body: conversationBody,
        threadId: emails[0].threadId,
        hasQuickReplies: false
      };

      const template = FaxTemplateEngine.createEmailReplyTemplate(threadData, referenceId);
      return await FaxGenerator.generatePdf(template);
    }

    // Single email - use standard email fax generation
    return await this.generateEmailFax(emails[0], {}, referenceId);
  }

  /**
   * Generate spam notification fax (when spam is detected)
   */
  static async generateSpamNotificationFax(
    spamCount: number,
    timeframe: string,
    referenceId?: string
  ): Promise<Buffer> {
    const emailData: EmailReplyData = {
      from: 'Faxi Spam Filter <system@faxi.jp>',
      subject: 'Spam Emails Filtered',
      body: `We filtered ${spamCount} spam email${spamCount > 1 ? 's' : ''} in the last ${timeframe}.

These were promotional emails, newsletters, or automated messages that we determined were not personal communications.

If you want to receive all emails (including spam), you can adjust your spam filter settings by faxing us:
"Turn off spam filter"

Or to see what was filtered:
"Show me filtered emails"

Your spam filter helps save paper and fax costs by only sending you important personal emails.`,
      hasQuickReplies: true,
      quickReplies: [
        'Turn off spam filter',
        'Show me filtered emails',
        'Keep current settings'
      ]
    };

    const template = FaxTemplateEngine.createEmailReplyTemplate(emailData, referenceId);
    return await FaxGenerator.generatePdf(template);
  }

  /**
   * Generate email delivery failure notification
   */
  static async generateEmailFailureFax(
    recipientEmail: string,
    errorMessage: string,
    originalSubject: string,
    referenceId?: string
  ): Promise<Buffer> {
    const emailData: EmailReplyData = {
      from: 'Faxi System <system@faxi.jp>',
      subject: 'Email Delivery Failed',
      body: `Your email could not be delivered.

To: ${recipientEmail}
Subject: ${originalSubject}

Error: ${errorMessage}

Please check the email address and try again. If the problem persists, the recipient's email server may be temporarily unavailable.

You can try resending by faxing us your message again, or contact us for help.`,
      hasQuickReplies: true,
      quickReplies: [
        'Try sending again',
        'Check the email address',
        'Contact support for help'
      ]
    };

    const template = FaxTemplateEngine.createEmailReplyTemplate(emailData, referenceId);
    return await FaxGenerator.generatePdf(template);
  }
}