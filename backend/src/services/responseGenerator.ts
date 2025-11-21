import { EmailFaxGenerator } from './emailFaxGenerator.js';
import { ProductSelectionFaxGenerator } from './productSelectionFaxGenerator.js';
import { PaymentBarcodeFaxGenerator } from './paymentBarcodeFaxGenerator.js';
import { ConfirmationFaxGenerator } from './confirmationFaxGenerator.js';
import { ClarificationFaxGenerator } from './clarificationFaxGenerator.js';
import { WelcomeFaxGenerator } from './welcomeFaxGenerator.js';
import { FaxGenerator } from './faxGenerator.js';
import {
  FaxTemplate,
  EmailReplyData,
  ProductSelectionData,
  PaymentBarcodeData,
  ConfirmationData,
  ClarificationData,
  ProductOption
} from '../types/fax.js';

export interface ResponseGeneratorRequest {
  type: 'email_reply' | 'product_selection' | 'payment_barcodes' | 'confirmation' | 'clarification' | 'welcome' | 'multi_action';
  data: any;
  referenceId?: string;
  options?: any;
}

export interface ResponseGeneratorResult {
  pdfBuffer: Buffer;
  template: FaxTemplate;
  referenceId: string;
}

export class ResponseGenerator {
  /**
   * Generate fax response based on request type
   */
  static async generateResponse(request: ResponseGeneratorRequest): Promise<ResponseGeneratorResult> {
    let pdfBuffer: Buffer;
    let template: FaxTemplate;
    const referenceId = request.referenceId || this.generateReferenceId();

    switch (request.type) {
      case 'email_reply':
        pdfBuffer = await EmailFaxGenerator.generateEmailFax(
          request.data as EmailReplyData,
          request.options,
          referenceId
        );
        // Create a minimal template for tracking
        template = {
          type: 'email_reply',
          referenceId,
          pages: [],
          contextData: request.data
        };
        break;

      case 'product_selection':
        const productData = request.data as ProductSelectionData;
        pdfBuffer = await ProductSelectionFaxGenerator.generateProductSelectionFax(
          productData.products,
          productData.complementaryItems,
          productData.hasPaymentMethod,
          productData.deliveryAddress,
          request.options,
          referenceId
        );
        template = {
          type: 'product_selection',
          referenceId,
          pages: [],
          contextData: request.data
        };
        break;

      case 'payment_barcodes':
        const barcodeData = request.data as PaymentBarcodeData;
        pdfBuffer = await PaymentBarcodeFaxGenerator.generatePaymentBarcodeFax(
          barcodeData.products,
          barcodeData.barcodes,
          request.options,
          referenceId
        );
        template = {
          type: 'payment_barcodes',
          referenceId,
          pages: [],
          contextData: request.data
        };
        break;

      case 'confirmation':
        const confirmationData = request.data as ConfirmationData;
        if (confirmationData.type === 'order') {
          pdfBuffer = await ConfirmationFaxGenerator.generateOrderConfirmationFax(
            request.data,
            referenceId
          );
        } else if (confirmationData.type === 'email') {
          pdfBuffer = await ConfirmationFaxGenerator.generateEmailConfirmationFax(
            request.data,
            referenceId
          );
        } else {
          pdfBuffer = await ConfirmationFaxGenerator.generateGeneralConfirmationFax(
            request.data,
            referenceId
          );
        }
        template = {
          type: 'confirmation',
          referenceId,
          pages: [],
          contextData: request.data
        };
        break;

      case 'clarification':
        const clarificationData = request.data as ClarificationData;
        pdfBuffer = await ClarificationFaxGenerator.generateClarificationFax(
          clarificationData.question,
          clarificationData.requiredInfo,
          clarificationData.recentConversations,
          request.options,
          referenceId
        );
        template = {
          type: 'clarification',
          referenceId,
          pages: [],
          contextData: request.data
        };
        break;

      case 'welcome':
        pdfBuffer = await WelcomeFaxGenerator.generateWelcomeFax(
          {
            phoneNumber: request.data.phoneNumber,
            emailAddress: request.data.emailAddress,
            userName: request.data.userName
          },
          referenceId
        );
        template = {
          type: 'welcome',
          referenceId,
          pages: [],
          contextData: request.data
        };
        break;

      case 'multi_action':
        // For multi-action, convert to general action details
        const multiActionData = request.data;
        const generalActionDetails = {
          actionType: 'Multi-Action Request',
          description: multiActionData.message || 'Multiple actions completed',
          result: 'Success',
          nextSteps: multiActionData.nextSteps || []
        };
        pdfBuffer = await ConfirmationFaxGenerator.generateGeneralConfirmationFax(
          generalActionDetails,
          referenceId
        );
        template = {
          type: 'multi_action',
          referenceId,
          pages: [],
          contextData: request.data
        };
        break;

      default:
        throw new Error(`Unsupported response type: ${request.type}`);
    }

    return {
      pdfBuffer,
      template,
      referenceId
    };
  }

  /**
   * Generate welcome fax for new users
   */
  static async generateWelcomeFax(phoneNumber: string, emailAddress: string): Promise<ResponseGeneratorResult> {
    return await this.generateResponse({
      type: 'welcome',
      data: { phoneNumber, emailAddress }
    });
  }

  /**
   * Generate email reply fax
   */
  static async generateEmailReplyFax(
    emailData: EmailReplyData,
    referenceId?: string
  ): Promise<ResponseGeneratorResult> {
    return await this.generateResponse({
      type: 'email_reply',
      data: emailData,
      referenceId
    });
  }

  /**
   * Generate shopping selection fax
   */
  static async generateShoppingFax(
    products: ProductOption[],
    complementaryItems: ProductOption[] = [],
    hasPaymentMethod: boolean = false,
    deliveryAddress?: string,
    referenceId?: string
  ): Promise<ResponseGeneratorResult> {
    return await this.generateResponse({
      type: 'product_selection',
      data: {
        products,
        complementaryItems,
        hasPaymentMethod,
        deliveryAddress
      } as ProductSelectionData,
      referenceId
    });
  }

  /**
   * Generate payment barcode fax
   */
  static async generatePaymentFax(
    products: ProductOption[],
    barcodes: any[],
    referenceId?: string
  ): Promise<ResponseGeneratorResult> {
    return await this.generateResponse({
      type: 'payment_barcodes',
      data: {
        products,
        barcodes,
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        instructions: 'Pay at FamilyMart, 7-Eleven, or Lawson. Show barcode to cashier.'
      } as PaymentBarcodeData,
      referenceId
    });
  }

  /**
   * Generate order confirmation fax
   */
  static async generateOrderConfirmationFax(
    orderDetails: any,
    referenceId?: string
  ): Promise<ResponseGeneratorResult> {
    return await this.generateResponse({
      type: 'confirmation',
      data: { ...orderDetails, type: 'order' } as ConfirmationData,
      referenceId
    });
  }

  /**
   * Generate email sent confirmation fax
   */
  static async generateEmailConfirmationFax(
    emailDetails: any,
    referenceId?: string
  ): Promise<ResponseGeneratorResult> {
    return await this.generateResponse({
      type: 'confirmation',
      data: { ...emailDetails, type: 'email' } as ConfirmationData,
      referenceId
    });
  }

  /**
   * Generate clarification request fax
   */
  static async generateClarificationFax(
    question: string,
    requiredInfo: string[],
    recentConversations: any[] = [],
    referenceId?: string
  ): Promise<ResponseGeneratorResult> {
    return await this.generateResponse({
      type: 'clarification',
      data: {
        question,
        requiredInfo,
        recentConversations,
        supportContact: 'help@faxi.jp | +81-3-1234-5678'
      } as ClarificationData,
      referenceId
    });
  }

  /**
   * Generate error fax for system failures
   */
  static async generateErrorFax(
    errorMessage: string,
    suggestedActions: string[] = [],
    referenceId?: string
  ): Promise<ResponseGeneratorResult> {
    return await this.generateClarificationFax(
      `We encountered an error processing your request: ${errorMessage}`,
      [
        'Try your request again',
        'Contact support if the problem continues',
        ...suggestedActions
      ],
      [],
      referenceId
    );
  }

  /**
   * Generate test fax for debugging
   */
  static async generateTestFax(message: string): Promise<Buffer> {
    return await FaxGenerator.generateTestPdf(message);
  }

  /**
   * Generate reference ID in FX-YYYY-NNNNNN format
   */
  private static generateReferenceId(): string {
    const year = new Date().getFullYear();
    const sequence = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `FX-${year}-${sequence}`;
  }

  /**
   * Validate PDF buffer
   */
  static validatePdfBuffer(buffer: Buffer): boolean {
    return buffer instanceof Buffer &&
      buffer.length > 0 &&
      buffer.subarray(0, 4).toString('hex').toLowerCase().includes('25504446'); // PDF magic bytes: %PDF
  }

  /**
   * Get estimated page count for response
   */
  static estimatePageCount(request: ResponseGeneratorRequest): number {
    switch (request.type) {
      case 'email_reply':
        const emailData = request.data as EmailReplyData;
        const bodyLength = emailData.body?.length || 0;
        const hasQuickReplies = emailData.hasQuickReplies;
        return bodyLength > 1000 || hasQuickReplies ? 2 : 1;
      
      case 'product_selection':
        const productData = request.data as ProductSelectionData;
        const productCount = (productData.products?.length || 0) + (productData.complementaryItems?.length || 0);
        return productCount > 8 ? 2 : 1;
      
      case 'payment_barcodes':
        const barcodeData = request.data as PaymentBarcodeData;
        const barcodeCount = barcodeData.barcodes?.length || 0;
        return Math.ceil(barcodeCount / 3); // ~3 barcodes per page
      
      case 'confirmation':
      case 'clarification':
      case 'welcome':
      case 'multi_action':
      default:
        return 1;
    }
  }
}