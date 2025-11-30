/**
 * Shopping Order Confirmation Fax Generator
 * 
 * Generates order confirmation faxes for Amazon.co.jp shopping orders.
 * Includes order summary, payment instructions, and reference ID.
 * 
 * Requirements: 2.4, 2.5, 3.3
 */

import { FaxGenerator } from './faxGenerator.js';
import { FaxTemplateEngine } from './faxTemplateEngine.js';
import { FaxTemplate, FaxContent } from '../types/fax.js';

/**
 * Payment method type for order confirmation
 */
export type PaymentMethodType = 'card' | 'bank_transfer';

/**
 * Bank transfer instructions for order payment
 */
export interface BankTransferInstructions {
  bankName: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  referenceCode: string;
  expiresAt: Date;
}

/**
 * Shopping order confirmation data
 */
export interface ShoppingOrderConfirmationData {
  orderId: string;
  referenceId: string;
  productTitle: string;
  productAsin: string;
  quantity: number;
  quotedPrice: number;
  totalAmount: number;
  paymentMethod: PaymentMethodType;
  bankTransferInstructions?: BankTransferInstructions;
  estimatedDelivery?: string;
  userName?: string;
}

export class ShoppingOrderConfirmationFaxGenerator {
  /**
   * Generate shopping order confirmation fax
   * 
   * @param data - Order confirmation data
   * @returns PDF buffer ready for fax transmission
   */
  static async generateOrderConfirmationFax(
    data: ShoppingOrderConfirmationData
  ): Promise<Buffer> {
    const template = this.createOrderConfirmationTemplate(data);
    return await FaxGenerator.generatePdf(template);
  }

  /**
   * Create order confirmation fax template
   */
  private static createOrderConfirmationTemplate(
    data: ShoppingOrderConfirmationData
  ): FaxTemplate {
    const content: FaxContent[] = [];

    // Header
    content.push({
      type: 'header',
      text: 'Faxi - ご注文確認',
      fontSize: 40, // ~14pt
      bold: true,
      alignment: 'center',
      marginBottom: 40
    });

    // Greeting
    if (data.userName) {
      content.push({
        type: 'text',
        text: `${data.userName} 様`,
        fontSize: 34, // 12pt
        marginBottom: 20
      });
    }

    // Confirmation message
    content.push({
      type: 'text',
      text: 'ご注文を承りました。',
      fontSize: 40,
      bold: true,
      marginBottom: 40
    });

    // Divider
    content.push({
      type: 'text',
      text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      fontSize: 34,
      alignment: 'center',
      marginBottom: 30
    });

    // Order details section
    content.push({
      type: 'text',
      text: '【ご注文内容】',
      fontSize: 40,
      bold: true,
      marginBottom: 20
    });

    // Product information
    content.push({
      type: 'text',
      text: `商品名: ${data.productTitle}`,
      fontSize: 34,
      marginBottom: 10
    });

    content.push({
      type: 'text',
      text: `商品番号: ${data.productAsin}`,
      fontSize: 34,
      marginBottom: 10
    });

    content.push({
      type: 'text',
      text: `数量: ${data.quantity}個`,
      fontSize: 34,
      marginBottom: 10
    });

    content.push({
      type: 'text',
      text: `単価: ${this.formatPrice(data.quotedPrice)}`,
      fontSize: 34,
      marginBottom: 10
    });

    content.push({
      type: 'text',
      text: `合計金額: ${this.formatPrice(data.totalAmount)}`,
      fontSize: 40,
      bold: true,
      marginBottom: 30
    });

    // Delivery information
    if (data.estimatedDelivery) {
      content.push({
        type: 'text',
        text: `お届け予定: ${data.estimatedDelivery}`,
        fontSize: 34,
        marginBottom: 30
      });
    }

    // Divider
    content.push({
      type: 'text',
      text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      fontSize: 34,
      alignment: 'center',
      marginBottom: 30
    });

    // Payment instructions section
    content.push({
      type: 'text',
      text: '【お支払い方法】',
      fontSize: 40,
      bold: true,
      marginBottom: 20
    });

    if (data.paymentMethod === 'card') {
      // Card payment instructions
      content.push({
        type: 'text',
        text: 'クレジットカード決済',
        fontSize: 34,
        bold: true,
        marginBottom: 20
      });

      content.push({
        type: 'text',
        text: 'ご登録のクレジットカードで決済いたします。',
        fontSize: 34,
        marginBottom: 10
      });

      content.push({
        type: 'text',
        text: '決済完了後、商品の購入手続きを開始いたします。',
        fontSize: 34,
        marginBottom: 30
      });
    } else if (data.paymentMethod === 'bank_transfer' && data.bankTransferInstructions) {
      // Bank transfer instructions
      const instructions = data.bankTransferInstructions;
      
      content.push({
        type: 'text',
        text: '銀行振込',
        fontSize: 34,
        bold: true,
        marginBottom: 20
      });

      content.push({
        type: 'text',
        text: '以下の口座にお振込みください:',
        fontSize: 34,
        marginBottom: 20
      });

      content.push({
        type: 'text',
        text: `銀行名: ${instructions.bankName}`,
        fontSize: 34,
        marginBottom: 10
      });

      content.push({
        type: 'text',
        text: `口座番号: ${instructions.accountNumber}`,
        fontSize: 34,
        marginBottom: 10
      });

      content.push({
        type: 'text',
        text: `口座名義: ${instructions.accountName}`,
        fontSize: 34,
        marginBottom: 10
      });

      content.push({
        type: 'text',
        text: `振込金額: ${this.formatPrice(instructions.amount)}`,
        fontSize: 40,
        bold: true,
        marginBottom: 10
      });

      content.push({
        type: 'text',
        text: `振込人名: ${instructions.referenceCode}`,
        fontSize: 34,
        bold: true,
        marginBottom: 20
      });

      content.push({
        type: 'text',
        text: '※振込人名には必ず上記の参照コードを入力してください',
        fontSize: 28,
        marginBottom: 20
      });

      const expirationDate = instructions.expiresAt.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      content.push({
        type: 'text',
        text: `お振込み期限: ${expirationDate}`,
        fontSize: 34,
        bold: true,
        marginBottom: 10
      });

      content.push({
        type: 'text',
        text: 'ご入金確認後、商品の購入手続きを開始いたします。',
        fontSize: 34,
        marginBottom: 30
      });
    }

    // Divider
    content.push({
      type: 'text',
      text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      fontSize: 34,
      alignment: 'center',
      marginBottom: 30
    });

    // Reference ID section
    content.push({
      type: 'text',
      text: '【参照番号】',
      fontSize: 40,
      bold: true,
      marginBottom: 20
    });

    content.push({
      type: 'text',
      text: data.referenceId,
      fontSize: 45,
      bold: true,
      alignment: 'center',
      marginBottom: 20
    });

    content.push({
      type: 'text',
      text: 'お問い合わせの際は、この番号をお伝えください。',
      fontSize: 28,
      alignment: 'center',
      marginBottom: 40
    });

    // Next steps section
    content.push({
      type: 'text',
      text: '【今後の流れ】',
      fontSize: 40,
      bold: true,
      marginBottom: 20
    });

    if (data.paymentMethod === 'card') {
      content.push({
        type: 'text',
        text: '1. クレジットカード決済を実行',
        fontSize: 34,
        marginBottom: 10
      });

      content.push({
        type: 'text',
        text: '2. 決済完了後、Amazonで商品を購入',
        fontSize: 34,
        marginBottom: 10
      });

      content.push({
        type: 'text',
        text: '3. 購入完了のFAXをお送りします',
        fontSize: 34,
        marginBottom: 10
      });

      content.push({
        type: 'text',
        text: '4. 商品発送後、追跡番号をお知らせします',
        fontSize: 34,
        marginBottom: 30
      });
    } else {
      content.push({
        type: 'text',
        text: '1. 上記口座にお振込み',
        fontSize: 34,
        marginBottom: 10
      });

      content.push({
        type: 'text',
        text: '2. ご入金確認後、Amazonで商品を購入',
        fontSize: 34,
        marginBottom: 10
      });

      content.push({
        type: 'text',
        text: '3. 購入完了のFAXをお送りします',
        fontSize: 34,
        marginBottom: 10
      });

      content.push({
        type: 'text',
        text: '4. 商品発送後、追跡番号をお知らせします',
        fontSize: 34,
        marginBottom: 30
      });
    }

    // Footer
    content.push({
      type: 'footer',
      text: `ご注文確認 | 参照: ${data.referenceId} | お問い合わせ: 0120-XXX-XXX`,
      fontSize: 28,
      alignment: 'center',
      marginTop: 30
    });

    return {
      type: 'confirmation',
      referenceId: data.referenceId,
      pages: [{
        content,
        pageNumber: 1,
        totalPages: 1
      }],
      contextData: {
        orderId: data.orderId,
        productAsin: data.productAsin,
        paymentMethod: data.paymentMethod,
        totalAmount: data.totalAmount
      }
    };
  }

  /**
   * Format price in Japanese Yen with comma separators
   * Example: 1234 -> "¥1,234"
   */
  private static formatPrice(price: number): string {
    return `¥${price.toLocaleString('ja-JP')}`;
  }

  /**
   * Generate purchase completion confirmation fax
   * Sent after admin completes the purchase on Amazon
   */
  static async generatePurchaseConfirmationFax(
    data: {
      referenceId: string;
      productTitle: string;
      amazonOrderId: string;
      totalAmount: number;
      estimatedDelivery?: string;
      userName?: string;
    }
  ): Promise<Buffer> {
    const content: FaxContent[] = [];

    // Header
    content.push({
      type: 'header',
      text: 'Faxi - 購入完了のお知らせ',
      fontSize: 40,
      bold: true,
      alignment: 'center',
      marginBottom: 40
    });

    // Greeting
    if (data.userName) {
      content.push({
        type: 'text',
        text: `${data.userName} 様`,
        fontSize: 34,
        marginBottom: 20
      });
    }

    // Confirmation message
    content.push({
      type: 'text',
      text: 'ご注文の商品を購入いたしました。',
      fontSize: 40,
      bold: true,
      marginBottom: 40
    });

    // Divider
    content.push({
      type: 'text',
      text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      fontSize: 34,
      alignment: 'center',
      marginBottom: 30
    });

    // Order details
    content.push({
      type: 'text',
      text: '【購入内容】',
      fontSize: 40,
      bold: true,
      marginBottom: 20
    });

    content.push({
      type: 'text',
      text: `商品名: ${data.productTitle}`,
      fontSize: 34,
      marginBottom: 10
    });

    content.push({
      type: 'text',
      text: `Amazon注文番号: ${data.amazonOrderId}`,
      fontSize: 34,
      bold: true,
      marginBottom: 10
    });

    content.push({
      type: 'text',
      text: `お支払い金額: ${this.formatPrice(data.totalAmount)}`,
      fontSize: 40,
      bold: true,
      marginBottom: 30
    });

    if (data.estimatedDelivery) {
      content.push({
        type: 'text',
        text: `お届け予定: ${data.estimatedDelivery}`,
        fontSize: 34,
        marginBottom: 30
      });
    }

    // Divider
    content.push({
      type: 'text',
      text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      fontSize: 34,
      alignment: 'center',
      marginBottom: 30
    });

    // Next steps
    content.push({
      type: 'text',
      text: '【今後の流れ】',
      fontSize: 40,
      bold: true,
      marginBottom: 20
    });

    content.push({
      type: 'text',
      text: '商品が発送されましたら、追跡番号をFAXでお知らせいたします。',
      fontSize: 34,
      marginBottom: 20
    });

    content.push({
      type: 'text',
      text: 'お届けまで今しばらくお待ちください。',
      fontSize: 34,
      marginBottom: 40
    });

    // Reference ID
    content.push({
      type: 'text',
      text: '【参照番号】',
      fontSize: 40,
      bold: true,
      marginBottom: 20
    });

    content.push({
      type: 'text',
      text: data.referenceId,
      fontSize: 45,
      bold: true,
      alignment: 'center',
      marginBottom: 40
    });

    // Footer
    content.push({
      type: 'footer',
      text: `購入完了 | 参照: ${data.referenceId} | お問い合わせ: 0120-XXX-XXX`,
      fontSize: 28,
      alignment: 'center',
      marginTop: 30
    });

    const template: FaxTemplate = {
      type: 'confirmation',
      referenceId: data.referenceId,
      pages: [{
        content,
        pageNumber: 1,
        totalPages: 1
      }],
      contextData: {
        amazonOrderId: data.amazonOrderId,
        isPurchaseConfirmation: true
      }
    };

    return await FaxGenerator.generatePdf(template);
  }

  /**
   * Generate delivery confirmation fax
   * Sent when order is marked as delivered
   */
  static async generateDeliveryConfirmationFax(
    data: {
      referenceId: string;
      productTitle: string;
      amazonOrderId: string;
      trackingNumber?: string;
      deliveredAt: Date;
      userName?: string;
    }
  ): Promise<Buffer> {
    const content: FaxContent[] = [];

    // Header
    content.push({
      type: 'header',
      text: 'Faxi - 配達完了のお知らせ',
      fontSize: 40,
      bold: true,
      alignment: 'center',
      marginBottom: 40
    });

    // Greeting
    if (data.userName) {
      content.push({
        type: 'text',
        text: `${data.userName} 様`,
        fontSize: 34,
        marginBottom: 20
      });
    }

    // Confirmation message
    content.push({
      type: 'text',
      text: 'ご注文の商品が配達されました。',
      fontSize: 40,
      bold: true,
      marginBottom: 40
    });

    // Divider
    content.push({
      type: 'text',
      text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      fontSize: 34,
      alignment: 'center',
      marginBottom: 30
    });

    // Order details
    content.push({
      type: 'text',
      text: '【配達内容】',
      fontSize: 40,
      bold: true,
      marginBottom: 20
    });

    content.push({
      type: 'text',
      text: `商品名: ${data.productTitle}`,
      fontSize: 34,
      marginBottom: 10
    });

    content.push({
      type: 'text',
      text: `Amazon注文番号: ${data.amazonOrderId}`,
      fontSize: 34,
      marginBottom: 10
    });

    if (data.trackingNumber) {
      content.push({
        type: 'text',
        text: `追跡番号: ${data.trackingNumber}`,
        fontSize: 34,
        marginBottom: 10
      });
    }

    const deliveryDate = data.deliveredAt.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    content.push({
      type: 'text',
      text: `配達日時: ${deliveryDate}`,
      fontSize: 34,
      bold: true,
      marginBottom: 40
    });

    // Divider
    content.push({
      type: 'text',
      text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      fontSize: 34,
      alignment: 'center',
      marginBottom: 30
    });

    // Thank you message
    content.push({
      type: 'text',
      text: 'ご利用ありがとうございました。',
      fontSize: 40,
      bold: true,
      alignment: 'center',
      marginBottom: 20
    });

    content.push({
      type: 'text',
      text: '商品に問題がございましたら、お気軽にお問い合わせください。',
      fontSize: 34,
      alignment: 'center',
      marginBottom: 40
    });

    // Reference ID
    content.push({
      type: 'text',
      text: '【参照番号】',
      fontSize: 40,
      bold: true,
      marginBottom: 20
    });

    content.push({
      type: 'text',
      text: data.referenceId,
      fontSize: 45,
      bold: true,
      alignment: 'center',
      marginBottom: 40
    });

    // Footer
    content.push({
      type: 'footer',
      text: `配達完了 | 参照: ${data.referenceId} | お問い合わせ: 0120-XXX-XXX`,
      fontSize: 28,
      alignment: 'center',
      marginTop: 30
    });

    const template: FaxTemplate = {
      type: 'confirmation',
      referenceId: data.referenceId,
      pages: [{
        content,
        pageNumber: 1,
        totalPages: 1
      }],
      contextData: {
        amazonOrderId: data.amazonOrderId,
        isDeliveryConfirmation: true,
        deliveredAt: data.deliveredAt
      }
    };

    return await FaxGenerator.generatePdf(template);
  }
}
