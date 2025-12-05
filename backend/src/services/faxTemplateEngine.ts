import {
  FaxTemplate,
  FaxPage,
  FaxContent,
  EmailReplyData,
  ProductSelectionData,
  ConfirmationData,
  ClarificationData,
  CircleOption,
  ProductOption
} from '../types/fax.js';

export class FaxTemplateEngine {
  private static readonly REFERENCE_ID_PREFIX = 'FX';
  private static readonly FAXI_BRANDING = 'Faxi - Your Fax to Internet Bridge';

  /**
   * Generate a unique reference ID in FX-YYYY-NNNNNN format
   */
  static generateReferenceId(): string {
    const year = new Date().getFullYear();
    const sequence = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `${this.REFERENCE_ID_PREFIX}-${year}-${sequence}`;
  }

  /**
   * Create email reply template
   */
  static createEmailReplyTemplate(data: EmailReplyData, referenceId?: string): FaxTemplate {
    const refId = referenceId || this.generateReferenceId();
    const pages: FaxPage[] = [];

    const content: FaxContent[] = [
      this.createHeader(),
      {
        type: 'text',
        text: `Email from ${data.from}`,
        fontSize: 57, // 20pt header
        bold: true,
        marginBottom: 8
      },
      {
        type: 'text',
        text: `Subject: ${data.subject}`,
        fontSize: 57, // 20pt header
        bold: true,
        marginBottom: 12
      }
    ];

    // Add attachment indicator if attachments exist
    if (data.attachmentCount && data.attachmentCount > 0) {
      content.push({
        type: 'text',
        text: `Attachments: ${data.attachmentCount}`,
        fontSize: 45, // 16pt body text
        bold: true,
        marginBottom: 12
      });
    }

    content.push({
      type: 'text',
      text: data.body,
      fontSize: 45, // 16pt body text
      marginBottom: 16
    });

    // Add quick reply options if email has clear questions
    if (data.hasQuickReplies && data.quickReplies && data.quickReplies.length > 0) {
      content.push({
        type: 'text',
        text: '─'.repeat(40),
        fontSize: 45, // 16pt body text
        marginBottom: 8
      });
      content.push({
        type: 'text',
        text: 'QUICK REPLIES (Circle one):',
        fontSize: 57, // 20pt header
        bold: true,
        marginBottom: 8
      });

      const options: CircleOption[] = data.quickReplies.map((reply, index) => ({
        id: String.fromCharCode(65 + index), // A, B, C, etc.
        label: String.fromCharCode(65 + index),
        text: reply
      }));

      content.push({
        type: 'circle_option',
        options: options,
        marginBottom: 16
      });
    }

    // Add space for custom reply (only if there are quick replies or it's an actual email)
    if (data.hasQuickReplies || data.from !== 'Faxi Support') {
      content.push({
        type: 'text',
        text: 'Additional comments or write your own reply below:',
        fontSize: 45, // 16pt body text
        marginBottom: 8
      });
      content.push({
        type: 'blank_space',
        height: 100,
        marginBottom: 16
      });
    }

    // Add extra margin before footer to prevent overlap
    content.push({
      type: 'blank_space',
      height: 40,
      marginBottom: 0
    });

    content.push(this.createFooter(refId, 'Email Reply'));

    pages.push({
      content,
      pageNumber: 1,
      totalPages: 1
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
   * Create product selection template
   */
  static createProductSelectionTemplate(data: ProductSelectionData, referenceId?: string): FaxTemplate {
    const refId = referenceId || this.generateReferenceId();
    const pages: FaxPage[] = [];

    const content: FaxContent[] = [
      this.createHeader(),
      {
        type: 'text',
        text: 'SHOPPING ORDER FORM',
        fontSize: 68, // 24pt page title
        bold: true,
        alignment: 'center',
        marginBottom: 16
      }
    ];

    // Add main product options
    if (data.products.length > 0) {
      content.push({
        type: 'text',
        text: 'PRODUCT OPTIONS (Circle one):',
        fontSize: 57, // 20pt header
        bold: true,
        marginBottom: 12
      });

      const productOptions: CircleOption[] = data.products.map((product, index) => ({
        id: product.id,
        label: String.fromCharCode(65 + index), // A, B, C, etc.
        text: `${product.name} - ¥${product.price}`,
        price: product.price,
        currency: product.currency
      }));

      content.push({
        type: 'circle_option',
        options: productOptions,
        marginBottom: 16
      });
    }

    // Add complementary items if available
    if (data.complementaryItems && data.complementaryItems.length > 0) {
      content.push({
        type: 'text',
        text: 'SUGGESTED ADDITIONS (Optional):',
        fontSize: 57, // 20pt header
        bold: true,
        marginBottom: 12
      });

      const complementaryOptions: CircleOption[] = data.complementaryItems.map((item, index) => ({
        id: item.id,
        label: String.fromCharCode(70 + index), // F, G, H, etc.
        text: `${item.name} - ¥${item.price}`,
        price: item.price,
        currency: item.currency,
        optional: true
      }));

      content.push({
        type: 'checkbox',
        options: complementaryOptions,
        marginBottom: 16
      });
    }

    // Add payment instructions
    const paymentText = data.hasPaymentMethod
      ? 'Circle your choices and fax back. We\'ll charge your card on file and deliver in 2-3 days.'
      : 'Circle your choices and fax back. We\'ll contact you to arrange payment.';

    content.push({
      type: 'text',
      text: paymentText,
      fontSize: 45, // 16pt body text
      marginBottom: 12
    });

    if (data.deliveryAddress) {
      content.push({
        type: 'text',
        text: `Delivery to: ${data.deliveryAddress}`,
        fontSize: 45, // 16pt body text
        marginBottom: 16
      });
    }

    content.push(this.createFooter(refId, 'Shopping Order Form'));

    pages.push({
      content,
      pageNumber: 1,
      totalPages: 1
    });

    return {
      type: 'product_selection',
      referenceId: refId,
      pages,
      contextData: {
        products: data.products,
        complementaryItems: data.complementaryItems,
        hasPaymentMethod: data.hasPaymentMethod
      }
    };
  }

  /**
   * Create confirmation template
   */
  static createConfirmationTemplate(data: ConfirmationData, referenceId?: string): FaxTemplate {
    const refId = referenceId || this.generateReferenceId();
    const pages: FaxPage[] = [];

    const content: FaxContent[] = [
      this.createHeader(),
      {
        type: 'text',
        text: 'CONFIRMATION',
        fontSize: 68, // 24pt page title
        bold: true,
        alignment: 'center',
        marginBottom: 16
      },
      {
        type: 'text',
        text: '✓ COMPLETED',
        fontSize: 57, // 20pt header
        bold: true,
        marginBottom: 12
      },
      {
        type: 'text',
        text: data.message,
        fontSize: 45, // 16pt body text
        marginBottom: 16
      }
    ];

    // Add specific details based on confirmation type
    if (data.type === 'order' && data.orderId) {
      content.push({
        type: 'text',
        text: `Order ID: ${data.orderId}`,
        fontSize: 45, // 16pt body text
        bold: true,
        marginBottom: 8
      });
      if (data.trackingNumber) {
        content.push({
          type: 'text',
          text: `Tracking: ${data.trackingNumber}`,
          fontSize: 45, // 16pt body text
          bold: true,
          marginBottom: 16
        });
      }
    } else if (data.type === 'email' && data.emailRecipient) {
      content.push({
        type: 'text',
        text: `Sent to: ${data.emailRecipient}`,
        fontSize: 45, // 16pt body text
        bold: true,
        marginBottom: 16
      });
    }

    content.push(this.createFooter(refId, 'Confirmation'));

    pages.push({
      content,
      pageNumber: 1,
      totalPages: 1
    });

    return {
      type: 'confirmation',
      referenceId: refId,
      pages,
      contextData: data
    };
  }

  /**
   * Create clarification request template
   */
  static createClarificationTemplate(data: ClarificationData, referenceId?: string): FaxTemplate {
    const refId = referenceId || this.generateReferenceId();
    const pages: FaxPage[] = [];

    const content: FaxContent[] = [
      this.createHeader(),
      {
        type: 'text',
        text: 'CLARIFICATION NEEDED',
        fontSize: 68, // 24pt page title
        bold: true,
        alignment: 'center',
        marginBottom: 16
      },
      {
        type: 'text',
        text: data.question,
        fontSize: 45, // 16pt body text
        marginBottom: 16
      }
    ];

    // Add required information list
    if (data.requiredInfo.length > 0) {
      content.push({
        type: 'text',
        text: 'Please provide:',
        fontSize: 57, // 20pt header
        bold: true,
        marginBottom: 8
      });
      data.requiredInfo.forEach(info => {
        content.push({
          type: 'text',
          text: `• ${info}`,
          fontSize: 45, // 16pt body text
          marginBottom: 4
        });
      });
      content.push({
        type: 'text',
        text: '',
        marginBottom: 16
      });
    }

    // Add recent conversations if multiple contexts exist
    if (data.recentConversations && data.recentConversations.length > 0) {
      content.push({
        type: 'text',
        text: 'Recent conversations:',
        fontSize: 57, // 20pt header
        bold: true,
        marginBottom: 8
      });
      data.recentConversations.forEach(conv => {
        content.push({
          type: 'text',
          text: `${conv.referenceId}: ${conv.topic} (${conv.daysAgo} days ago)`,
          fontSize: 45, // 16pt body text
          marginBottom: 4
        });
      });
      content.push({
        type: 'text',
        text: '',
        marginBottom: 16
      });
    }

    // Add blank space for response
    content.push({
      type: 'text',
      text: 'Your response:',
      fontSize: 57, // 20pt header
      bold: true,
      marginBottom: 8
    });
    content.push({
      type: 'blank_space',
      height: 120,
      marginBottom: 16
    });

    content.push(this.createFooter(refId, 'Clarification Needed'));

    pages.push({
      content,
      pageNumber: 1,
      totalPages: 1
    });

    return {
      type: 'clarification',
      referenceId: refId,
      pages,
      contextData: {
        question: data.question,
        requiredInfo: data.requiredInfo,
        recentConversations: data.recentConversations
      }
    };
  }

  /**
   * Create standard header content with prominent reference ID
   */
  private static createHeader(referenceId?: string): FaxContent {
    if (referenceId) {
      // Header with reference ID (for multi-page faxes)
      return {
        type: 'header',
        text: `${this.FAXI_BRANDING}\nRef: ${referenceId}`,
        fontSize: 34, // 12pt for branding, ref ID will be rendered separately
        alignment: 'center',
        marginBottom: 12
      };
    }
    return {
      type: 'header',
      text: this.FAXI_BRANDING,
      fontSize: 34, // 12pt header/footer
      alignment: 'center',
      marginBottom: 12
    };
  }

  /**
   * Create standard footer content with reference ID
   * Format: [Template Label] | Ref: FX-YYYY-NNNNNN
   */
  private static createFooter(referenceId: string, label: string = 'Email Reply'): FaxContent {
    return {
      type: 'footer',
      text: `${label} | Ref: ${referenceId}`,
      fontSize: 45, // 16pt - consistent across all templates
      bold: true,
      alignment: 'center',
      marginTop: 16
    };
  }
}