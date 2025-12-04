import { FaxTemplateEngine } from './faxTemplateEngine.js';
import { FaxGenerator } from './faxGenerator.js';
import { DynamicLayoutCalculator } from './dynamicLayoutCalculator.js';
import { EmailReplyData, FaxTemplate, FaxPage, FaxContent } from '../types/fax.js';

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

    // Check if email body is long and needs pagination
    const needsPagination = this.needsPagination(processedEmailData.body);

    let template: FaxTemplate;
    if (needsPagination && !opts.minimizePages) {
      // Create multi-page template for long emails
      template = this.createMultiPageEmailTemplate(processedEmailData, referenceId);
    } else {
      // Use standard single-page template
      template = FaxTemplateEngine.createEmailReplyTemplate(processedEmailData, referenceId);
    }

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
      // Meeting and scheduling patterns
      {
        patterns: [/can you meet/i, /would you like to meet/i, /want to meet/i, /let'?s meet/i],
        replies: ['Yes, that works for me', 'No, I\'m not available', 'Can we do a different time?']
      },
      {
        patterns: [/are you free/i, /are you available/i, /available on/i, /free on/i],
        replies: ['Yes, I\'m free', 'No, I\'m busy', 'What time?']
      },
      {
        patterns: [/when (can|could|would|should)/i, /what time/i, /which day/i, /what date/i],
        replies: ['Morning works', 'Afternoon works', 'Evening works']
      },
      {
        patterns: [/where/i, /which place/i, /what location/i, /meet at/i],
        replies: ['Your suggestion is fine', 'I have a different preference', 'Let me think about it']
      },
      
      // Preference and choice patterns
      {
        patterns: [/do you want/i, /would you like/i, /do you prefer/i, /would you prefer/i],
        replies: ['Yes, please', 'No, thank you', 'Maybe later']
      },
      {
        patterns: [/which (one|option)/i, /what would you (like|prefer)/i, /your preference/i],
        replies: ['The first option', 'The second option', 'I need more details']
      },
      
      // Confirmation patterns
      {
        patterns: [/can you confirm/i, /please confirm/i, /confirm (that|if|whether)/i],
        replies: ['Yes, confirmed', 'No, that\'s not correct', 'Let me check']
      },
      {
        patterns: [/is (this|that) (ok|okay|correct|right)/i, /does (this|that) work/i],
        replies: ['Yes, that\'s fine', 'No, please change it', 'I have a question']
      },
      
      // Help and assistance patterns
      {
        patterns: [/can you help/i, /need help/i, /could you assist/i, /need assistance/i],
        replies: ['Yes, I can help', 'Sorry, I can\'t', 'What do you need?']
      },
      
      // Opinion and feedback patterns
      {
        patterns: [/what do you think/i, /your opinion/i, /your thoughts/i, /how do you feel/i],
        replies: ['I agree', 'I disagree', 'I need more information']
      },
      {
        patterns: [/do you (like|approve)/i, /are you (happy|satisfied)/i],
        replies: ['Yes, I like it', 'No, I don\'t like it', 'It\'s okay']
      },
      
      // Yes/No questions
      {
        patterns: [/yes or no/i, /\?.*yes.*no/i, /\?.*no.*yes/i],
        replies: ['Yes', 'No']
      },
      {
        patterns: [/(can|could|would|will|should|did|do|does|is|are|have|has) (you|we|they|he|she|it)/i],
        replies: ['Yes', 'No', 'Let me get back to you']
      },
      
      // RSVP and attendance patterns
      {
        patterns: [/can you (attend|come|join|make it)/i, /will you (attend|come|join|be there)/i, /rsvp/i],
        replies: ['Yes, I\'ll be there', 'No, I can\'t make it', 'Maybe, I\'ll let you know']
      },
      
      // Action request patterns
      {
        patterns: [/could you (please )?send/i, /can you (please )?send/i, /please send/i],
        replies: ['Yes, I\'ll send it', 'I don\'t have that', 'When do you need it?']
      },
      {
        patterns: [/could you (please )?review/i, /can you (please )?review/i, /please review/i],
        replies: ['Yes, I\'ll review it', 'I need more time', 'I have some questions']
      }
    ];

    // Check for question patterns with priority (more specific patterns first)
    for (const pattern of questionPatterns) {
      for (const regex of pattern.patterns) {
        if (regex.test(emailBody)) {
          // Return the most relevant replies for this pattern
          return pattern.replies.slice(0, maxReplies);
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

  /**
   * Check if email body needs pagination based on estimated content height
   */
  private static needsPagination(emailBody: string): boolean {
    // Estimate content height based on character count and line breaks
    const lines = emailBody.split('\n').length;
    const estimatedCharsPerLine = 80;
    const charsPerLineActual = emailBody.length / Math.max(lines, 1);
    const wrappedLines = Math.ceil(charsPerLineActual / estimatedCharsPerLine) * lines;
    
    // Approximate line height in pixels (45pt font = ~60px line height)
    const lineHeight = 60;
    const estimatedBodyHeight = wrappedLines * lineHeight;
    
    // Add height for header, subject, and other elements (~400px)
    const otherContentHeight = 400;
    const totalContentHeight = estimatedBodyHeight + otherContentHeight;
    
    // Check if content exceeds single page
    const layoutCalculator = new DynamicLayoutCalculator();
    const availableHeight = layoutCalculator.getAvailableContentHeight();
    
    return totalContentHeight > availableHeight;
  }

  /**
   * Create multi-page email template for long email bodies
   */
  private static createMultiPageEmailTemplate(
    data: EmailReplyData,
    referenceId?: string
  ): FaxTemplate {
    const refId = referenceId || FaxTemplateEngine.generateReferenceId();
    const layoutCalculator = new DynamicLayoutCalculator();
    const availableHeight = layoutCalculator.getAvailableContentHeight();
    
    // Split email body into chunks that fit on pages
    const bodyChunks = this.splitEmailBody(data.body, availableHeight);
    const totalPages = bodyChunks.length;
    
    const pages: FaxPage[] = [];
    
    bodyChunks.forEach((chunk, index) => {
      const pageNumber = index + 1;
      const isFirstPage = pageNumber === 1;
      const isLastPage = pageNumber === totalPages;
      
      const content: FaxContent[] = [];
      
      // Add header on every page
      content.push({
        type: 'header',
        text: 'Faxi - Your Fax to Internet Bridge',
        fontSize: 34,
        alignment: 'center',
        marginBottom: 12
      });
      
      // Add email metadata only on first page
      if (isFirstPage) {
        content.push({
          type: 'text',
          text: `Email from ${data.from}`,
          fontSize: 57,
          bold: true,
          marginBottom: 8
        });
        content.push({
          type: 'text',
          text: `Subject: ${data.subject}`,
          fontSize: 57,
          bold: true,
          marginBottom: 12
        });
        
        // Add attachment indicator if attachments exist
        if (data.attachmentCount && data.attachmentCount > 0) {
          content.push({
            type: 'text',
            text: `Attachments: ${data.attachmentCount}`,
            fontSize: 45,
            bold: true,
            marginBottom: 12
          });
        }
      } else {
        // Add continuation indicator on subsequent pages
        content.push({
          type: 'text',
          text: '(continued)',
          fontSize: 45,
          marginBottom: 12
        });
      }
      
      // Add body chunk
      content.push({
        type: 'text',
        text: chunk,
        fontSize: 45,
        marginBottom: 16
      });
      
      // Add quick replies only on last page
      if (isLastPage && data.hasQuickReplies && data.quickReplies && data.quickReplies.length > 0) {
        content.push({
          type: 'text',
          text: '─'.repeat(40),
          fontSize: 45,
          marginBottom: 8
        });
        content.push({
          type: 'text',
          text: 'QUICK REPLIES (Circle one):',
          fontSize: 57,
          bold: true,
          marginBottom: 8
        });
        
        const options = data.quickReplies.map((reply, idx) => ({
          id: String.fromCharCode(65 + idx),
          label: String.fromCharCode(65 + idx),
          text: reply
        }));
        
        content.push({
          type: 'circle_option',
          options: options,
          marginBottom: 16
        });
      }
      
      // Add blank space for reply only on last page
      if (isLastPage) {
        content.push({
          type: 'text',
          text: 'Additional comments or write your own reply below:',
          fontSize: 45,
          marginBottom: 8
        });
        content.push({
          type: 'blank_space',
          height: 100,
          marginBottom: 16
        });
      }
      
      // Add footer with reference ID and page number on every page
      content.push({
        type: 'blank_space',
        height: 40,
        marginBottom: 0
      });
      content.push({
        type: 'footer',
        text: `Reply via fax. Ref: ${refId} | Page ${pageNumber} of ${totalPages}`,
        fontSize: 45, // Match body text size (45 pixels at 204 DPI ≈ 16pt)
        bold: true,
        alignment: 'center',
        marginTop: 16
      });
      
      pages.push({
        content,
        pageNumber,
        totalPages
      });
    });
    
    return {
      type: 'email_reply',
      referenceId: refId,
      pages,
      contextData: {
        threadId: data.threadId,
        from: data.from,
        subject: data.subject
      }
    };
  }

  /**
   * Split email body into chunks that fit on pages
   */
  private static splitEmailBody(body: string, availableHeight: number): string[] {
    const chunks: string[] = [];
    
    // Approximate line height (45pt font = ~60px line height)
    const lineHeight = 60;
    const maxLinesPerPage = Math.floor(availableHeight / lineHeight) - 5; // Reserve space for header/footer
    
    // Split by paragraphs first to maintain readability
    const paragraphs = body.split('\n\n');
    let currentChunk = '';
    let currentLines = 0;
    
    for (const paragraph of paragraphs) {
      const paragraphLines = paragraph.split('\n').length;
      const estimatedCharsPerLine = 80;
      const totalParagraphLines = Math.ceil(paragraph.length / estimatedCharsPerLine);
      
      if (currentLines + totalParagraphLines > maxLinesPerPage && currentChunk.length > 0) {
        // Start new page
        chunks.push(currentChunk.trim());
        currentChunk = paragraph + '\n\n';
        currentLines = totalParagraphLines;
      } else {
        currentChunk += paragraph + '\n\n';
        currentLines += totalParagraphLines;
      }
    }
    
    // Add remaining content
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    // Ensure at least one chunk
    if (chunks.length === 0) {
      chunks.push(body);
    }
    
    return chunks;
  }
}