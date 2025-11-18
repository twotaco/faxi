import {
  FaxTemplate,
  FaxPage,
  FaxContent,
  EmailReplyData,
  ProductSelectionData,
  PaymentBarcodeData,
  ConfirmationData,
  ClarificationData,
  CircleOption,
  ProductOption
} from '../types/fax.js';

export class FaxTemplateEngine {
  private static readonly REFERENCE_ID_PREFIX = 'FX';
  private static readonly SUPPORT_CONTACT = 'Support: help@faxi.jp | +81-3-1234-5678';
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
        fontSize: 14,
        bold: true,
        marginBottom: 8
      },
      {
        type: 'text',
        text: `Subject: ${data.subject}`,
        fontSize: 12,
        bold: true,
        marginBottom: 12
      },
      {
        type: 'text',
        text: data.body,
        fontSize: 12,
        marginBottom: 16
      }
    ];

    // Add quick reply options if email has clear questions
    if (data.hasQuickReplies && data.quickReplies && data.quickReplies.length > 0) {
      content.push({
        type: 'text',
        text: '─'.repeat(40),
        fontSize: 12,
        marginBottom: 8
      });
      content.push({
        type: 'text',
        text: 'QUICK REPLIES (Circle one):',
        fontSize: 12,
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

    // Add space for custom reply
    content.push({
      type: 'text',
      text: 'Additional comments or write your own reply below:',
      fontSize: 12,
      marginBottom: 8
    });
    content.push({
      type: 'blank_space',
      height: 100,
      marginBottom: 16
    });

    content.push(this.createFooter(refId));

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
        fontSize: 16,
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
        fontSize: 14,
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
        fontSize: 14,
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
      : 'Circle your choices and fax back. We\'ll send payment barcodes for convenience store payment.';

    content.push({
      type: 'text',
      text: paymentText,
      fontSize: 12,
      marginBottom: 12
    });

    if (data.deliveryAddress) {
      content.push({
        type: 'text',
        text: `Delivery to: ${data.deliveryAddress}`,
        fontSize: 12,
        marginBottom: 16
      });
    }

    content.push(this.createFooter(refId));

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
   * Create payment barcode template
   */
  static createPaymentBarcodeTemplate(data: PaymentBarcodeData, referenceId?: string): FaxTemplate {
    const refId = referenceId || this.generateReferenceId();
    const pages: FaxPage[] = [];

    const content: FaxContent[] = [
      this.createHeader(),
      {
        type: 'text',
        text: 'PAYMENT BARCODES',
        fontSize: 16,
        bold: true,
        alignment: 'center',
        marginBottom: 16
      }
    ];

    // Add each product with its barcode
    data.barcodes.forEach((barcode, index) => {
      const product = data.products.find(p => p.id === barcode.productId);
      if (product) {
        content.push({
          type: 'text',
          text: `${String.fromCharCode(65 + index)}. ${product.name}`,
          fontSize: 14,
          bold: true,
          marginBottom: 8
        });
        content.push({
          type: 'text',
          text: `¥${barcode.amount}`,
          fontSize: 12,
          marginBottom: 8
        });
        content.push({
          type: 'barcode',
          barcodeData: {
            data: barcode.barcodeData,
            format: 'CODE128',
            width: 200,
            height: 50,
            displayValue: true
          },
          marginBottom: 16
        });
      }
    });

    // Add payment instructions
    content.push({
      type: 'text',
      text: data.instructions,
      fontSize: 12,
      marginBottom: 12
    });

    content.push({
      type: 'text',
      text: `Barcodes expire: ${data.expirationDate.toLocaleDateString('ja-JP')}`,
      fontSize: 12,
      bold: true,
      marginBottom: 16
    });

    content.push(this.createFooter(refId));

    pages.push({
      content,
      pageNumber: 1,
      totalPages: 1
    });

    return {
      type: 'payment_barcodes',
      referenceId: refId,
      pages,
      contextData: {
        barcodes: data.barcodes,
        expirationDate: data.expirationDate
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
        fontSize: 16,
        bold: true,
        alignment: 'center',
        marginBottom: 16
      },
      {
        type: 'text',
        text: '✓ COMPLETED',
        fontSize: 14,
        bold: true,
        marginBottom: 12
      },
      {
        type: 'text',
        text: data.message,
        fontSize: 12,
        marginBottom: 16
      }
    ];

    // Add specific details based on confirmation type
    if (data.type === 'order' && data.orderId) {
      content.push({
        type: 'text',
        text: `Order ID: ${data.orderId}`,
        fontSize: 12,
        bold: true,
        marginBottom: 8
      });
      if (data.trackingNumber) {
        content.push({
          type: 'text',
          text: `Tracking: ${data.trackingNumber}`,
          fontSize: 12,
          bold: true,
          marginBottom: 16
        });
      }
    } else if (data.type === 'email' && data.emailRecipient) {
      content.push({
        type: 'text',
        text: `Sent to: ${data.emailRecipient}`,
        fontSize: 12,
        bold: true,
        marginBottom: 16
      });
    }

    content.push(this.createFooter(refId));

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
        fontSize: 16,
        bold: true,
        alignment: 'center',
        marginBottom: 16
      },
      {
        type: 'text',
        text: data.question,
        fontSize: 12,
        marginBottom: 16
      }
    ];

    // Add required information list
    if (data.requiredInfo.length > 0) {
      content.push({
        type: 'text',
        text: 'Please provide:',
        fontSize: 12,
        bold: true,
        marginBottom: 8
      });
      data.requiredInfo.forEach(info => {
        content.push({
          type: 'text',
          text: `• ${info}`,
          fontSize: 12,
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
        fontSize: 12,
        bold: true,
        marginBottom: 8
      });
      data.recentConversations.forEach(conv => {
        content.push({
          type: 'text',
          text: `${conv.referenceId}: ${conv.topic} (${conv.daysAgo} days ago)`,
          fontSize: 12,
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
      fontSize: 12,
      bold: true,
      marginBottom: 8
    });
    content.push({
      type: 'blank_space',
      height: 120,
      marginBottom: 16
    });

    content.push(this.createFooter(refId));

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
   * Create standard header content
   */
  private static createHeader(): FaxContent {
    return {
      type: 'header',
      text: this.FAXI_BRANDING,
      fontSize: 10,
      alignment: 'center',
      marginBottom: 12
    };
  }

  /**
   * Create standard footer content
   */
  private static createFooter(referenceId: string): FaxContent {
    return {
      type: 'footer',
      text: `Reply via fax. Ref: ${referenceId} | ${this.SUPPORT_CONTACT}`,
      fontSize: 10,
      alignment: 'center',
      marginTop: 16
    };
  }
}