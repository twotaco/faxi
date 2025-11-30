import { FaxTemplateEngine } from './faxTemplateEngine.js';
import { FaxGenerator } from './faxGenerator.js';
import { PaymentBarcodeData, PaymentBarcode, ProductOption, FaxTemplate } from '../types/fax.js';

export interface PaymentBarcodeOptions {
  includeProductDetails?: boolean;
  includeBundleOptions?: boolean;
  expirationDays?: number;
  storeInstructions?: string;
}

export class PaymentBarcodeFaxGenerator {
  private static readonly DEFAULT_EXPIRATION_DAYS = 7;
  private static readonly DEFAULT_STORE_INSTRUCTIONS = 'Pay at FamilyMart, 7-Eleven, or Lawson. Show barcode to cashier.';

  /**
   * Generate payment barcode fax for products
   */
  static async generatePaymentBarcodeFax(
    products: ProductOption[],
    barcodes: PaymentBarcode[],
    options: PaymentBarcodeOptions = {},
    referenceId?: string
  ): Promise<Buffer> {
    const opts = {
      includeProductDetails: true,
      includeBundleOptions: true,
      expirationDays: this.DEFAULT_EXPIRATION_DAYS,
      storeInstructions: this.DEFAULT_STORE_INSTRUCTIONS,
      ...options
    };

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + opts.expirationDays);

    // Add bundle deals if enabled
    const enhancedBarcodes = opts.includeBundleOptions 
      ? [...barcodes, ...this.generateBundleBarcodes(products, barcodes)]
      : barcodes;

    const barcodeData: PaymentBarcodeData = {
      products,
      barcodes: enhancedBarcodes,
      expirationDate,
      instructions: opts.storeInstructions
    };

    const template = FaxTemplateEngine.createPaymentBarcodeTemplate(barcodeData, referenceId);
    return await FaxGenerator.generatePdf(template);
  }

  /**
   * Generate single product barcode fax
   */
  static async generateSingleProductBarcodeFax(
    product: ProductOption,
    barcode: PaymentBarcode,
    options: PaymentBarcodeOptions = {},
    referenceId?: string
  ): Promise<Buffer> {
    return await this.generatePaymentBarcodeFax([product], [barcode], options, referenceId);
  }

  /**
   * Generate subscription payment barcode fax
   */
  static async generateSubscriptionBarcodeFax(
    subscriptionName: string,
    monthlyAmount: number,
    barcode: PaymentBarcode,
    nextBillingDate: Date,
    referenceId?: string
  ): Promise<Buffer> {
    const subscriptionProduct: ProductOption = {
      id: 'subscription',
      name: `${subscriptionName} - Monthly Subscription`,
      price: monthlyAmount,
      currency: 'JPY',
      description: `Next billing: ${nextBillingDate.toLocaleDateString('ja-JP')}`,
      estimatedDelivery: 'Immediate activation'
    };

    const options: PaymentBarcodeOptions = {
      includeProductDetails: true,
      includeBundleOptions: false,
      expirationDays: 3, // Shorter expiration for subscriptions
      storeInstructions: 'Pay at convenience store to activate subscription. Service starts immediately after payment.'
    };

    return await this.generatePaymentBarcodeFax([subscriptionProduct], [barcode], options, referenceId);
  }

  /**
   * Generate bill payment barcode fax
   */
  static async generateBillPaymentBarcodeFax(
    billType: string,
    billAmount: number,
    dueDate: Date,
    barcode: PaymentBarcode,
    referenceId?: string
  ): Promise<Buffer> {
    const billProduct: ProductOption = {
      id: 'bill_payment',
      name: `${billType} Bill Payment`,
      price: billAmount,
      currency: 'JPY',
      description: `Due: ${dueDate.toLocaleDateString('ja-JP')}`,
      estimatedDelivery: 'Payment processed within 1 business day'
    };

    const options: PaymentBarcodeOptions = {
      includeProductDetails: true,
      includeBundleOptions: false,
      expirationDays: Math.max(1, Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
      storeInstructions: 'Pay at convenience store before due date. Payment will be processed within 1 business day.'
    };

    return await this.generatePaymentBarcodeFax([billProduct], [barcode], options, referenceId);
  }

  /**
   * Generate multi-payment option fax (different payment amounts)
   */
  static async generateMultiPaymentOptionsFax(
    baseProduct: ProductOption,
    paymentOptions: Array<{
      name: string;
      amount: number;
      barcode: PaymentBarcode;
      description: string;
    }>,
    referenceId?: string
  ): Promise<Buffer> {
    const products: ProductOption[] = paymentOptions.map((option, index) => ({
      id: `${baseProduct.id}_option_${index}`,
      name: `${baseProduct.name} - ${option.name}`,
      price: option.amount,
      currency: baseProduct.currency,
      description: option.description,
      estimatedDelivery: baseProduct.estimatedDelivery
    }));

    const barcodes: PaymentBarcode[] = paymentOptions.map((option, index) => ({
      productId: `${baseProduct.id}_option_${index}`,
      barcodeData: option.barcode.barcodeData,
      amount: option.amount,
      currency: option.barcode.currency
    }));

    const options: PaymentBarcodeOptions = {
      includeProductDetails: true,
      includeBundleOptions: false,
      storeInstructions: 'Choose one payment option. Pay the barcode for your preferred option at any convenience store.'
    };

    return await this.generatePaymentBarcodeFax(products, barcodes, options, referenceId);
  }

  /**
   * Generate payment reminder fax (for expiring barcodes)
   */
  static async generatePaymentReminderFax(
    originalProducts: ProductOption[],
    originalBarcodes: PaymentBarcode[],
    newBarcodes: PaymentBarcode[],
    daysUntilExpiration: number,
    referenceId?: string
  ): Promise<Buffer> {
    const reminderData: PaymentBarcodeData = {
      products: originalProducts,
      barcodes: newBarcodes,
      expirationDate: new Date(Date.now() + daysUntilExpiration * 24 * 60 * 60 * 1000),
      instructions: `REMINDER: Your previous barcodes expire soon. Use these new barcodes to complete your purchase. ${this.DEFAULT_STORE_INSTRUCTIONS}`
    };

    const template = FaxTemplateEngine.createPaymentBarcodeTemplate(reminderData, referenceId);
    
    // Add reminder header
    if (template.pages[0]) {
      template.pages[0].content.splice(1, 0, {
        type: 'text',
        text: 'PAYMENT REMINDER',
        fontSize: 16,
        bold: true,
        alignment: 'center',
        marginBottom: 8
      });
      template.pages[0].content.splice(2, 0, {
        type: 'text',
        text: 'Your previous barcodes are expiring soon. Please use the new barcodes below.',
        fontSize: 12,
        marginBottom: 16
      });
    }

    return await FaxGenerator.generatePdf(template);
  }

  /**
   * Generate payment confirmation fax (after successful payment)
   */
  static async generatePaymentConfirmationFax(
    products: ProductOption[],
    paidAmount: number,
    transactionId: string,
    orderNumber?: string,
    trackingNumber?: string,
    referenceId?: string
  ): Promise<Buffer> {
    const confirmationText = `Payment confirmed! Thank you for your purchase.

Transaction ID: ${transactionId}
Amount Paid: ¥${paidAmount}
${orderNumber ? `Order Number: ${orderNumber}` : ''}
${trackingNumber ? `Tracking Number: ${trackingNumber}` : ''}

Items purchased:
${products.map(p => `• ${p.name} - ¥${p.price}`).join('\n')}

${trackingNumber ? 'Your order is being prepared for shipment.' : 'Your order will be processed within 1 business day.'}

Thank you for using Faxi!`;

    // Create a simple text-based confirmation fax
    const template: FaxTemplate = {
      type: 'confirmation',
      referenceId: referenceId || FaxTemplateEngine.generateReferenceId(),
      pages: [{
        content: [
          {
            type: 'header',
            text: 'Faxi - Your Fax to Internet Bridge',
            fontSize: 10,
            alignment: 'center',
            marginBottom: 12
          },
          {
            type: 'text',
            text: 'PAYMENT CONFIRMED',
            fontSize: 16,
            bold: true,
            alignment: 'center',
            marginBottom: 16
          },
          {
            type: 'text',
            text: confirmationText,
            fontSize: 12,
            marginBottom: 16
          },
          {
            type: 'footer',
            text: `Ref: ${referenceId || FaxTemplateEngine.generateReferenceId()} | Support: help@faxi.jp | +81-3-1234-5678`,
            fontSize: 96, // 34pt minimum for reference ID prominence (96 pixels at 204 DPI ≈ 34pt)
            bold: true,
            alignment: 'center',
            marginTop: 16
          }
        ],
        pageNumber: 1,
        totalPages: 1
      }],
      contextData: {
        transactionId,
        orderNumber,
        trackingNumber,
        products,
        paidAmount
      }
    };

    return await FaxGenerator.generatePdf(template);
  }

  /**
   * Generate bundle barcodes for multiple items
   */
  private static generateBundleBarcodes(products: ProductOption[], individualBarcodes: PaymentBarcode[]): PaymentBarcode[] {
    const bundles: PaymentBarcode[] = [];

    // Create 2-item bundles with 10% discount
    for (let i = 0; i < products.length - 1; i++) {
      for (let j = i + 1; j < products.length && bundles.length < 2; j++) {
        const product1 = products[i];
        const product2 = products[j];
        const originalTotal = product1.price + product2.price;
        const bundlePrice = Math.floor(originalTotal * 0.9); // 10% discount

        // Generate a mock barcode for the bundle
        const bundleBarcode = this.generateMockBarcode(`bundle_${product1.id}_${product2.id}`, bundlePrice);

        bundles.push({
          productId: `bundle_${product1.id}_${product2.id}`,
          barcodeData: bundleBarcode,
          amount: bundlePrice,
          currency: product1.currency
        });
      }
    }

    return bundles;
  }

  /**
   * Generate mock barcode data (in real implementation, this would call Stripe)
   */
  private static generateMockBarcode(productId: string, amount: number): string {
    // In real implementation, this would create a Stripe payment intent and return the barcode data
    // For now, return a mock barcode string
    const timestamp = Date.now().toString().slice(-8);
    return `FAXI${timestamp}${amount.toString().padStart(6, '0')}`;
  }

  /**
   * Generate payment failure notification fax
   */
  static async generatePaymentFailureFax(
    products: ProductOption[],
    failureReason: string,
    newBarcodes: PaymentBarcode[],
    referenceId?: string
  ): Promise<Buffer> {
    const failureData: PaymentBarcodeData = {
      products,
      barcodes: newBarcodes,
      expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      instructions: `Payment failed: ${failureReason}. Please try again with the new barcodes below. ${this.DEFAULT_STORE_INSTRUCTIONS}`
    };

    const template = FaxTemplateEngine.createPaymentBarcodeTemplate(failureData, referenceId);
    
    // Add failure header
    if (template.pages[0]) {
      template.pages[0].content.splice(1, 0, {
        type: 'text',
        text: 'PAYMENT FAILED',
        fontSize: 16,
        bold: true,
        alignment: 'center',
        marginBottom: 8
      });
      template.pages[0].content.splice(2, 0, {
        type: 'text',
        text: `Reason: ${failureReason}`,
        fontSize: 12,
        marginBottom: 16
      });
    }

    return await FaxGenerator.generatePdf(template);
  }
}