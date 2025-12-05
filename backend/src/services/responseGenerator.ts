import { EmailFaxGenerator } from './emailFaxGenerator.js';
import { ProductSelectionFaxGenerator } from './productSelectionFaxGenerator.js';
import { ConfirmationFaxGenerator } from './confirmationFaxGenerator.js';
import { ClarificationFaxGenerator } from './clarificationFaxGenerator.js';
import { WelcomeFaxGenerator } from './welcomeFaxGenerator.js';
import { AppointmentSelectionFaxGenerator } from './appointmentSelectionFaxGenerator.js';
import { GeneralInquiryFaxGenerator } from './generalInquiryFaxGenerator.js';
import { ShoppingOrderConfirmationFaxGenerator, ShoppingOrderConfirmationData } from './shoppingOrderConfirmationFaxGenerator.js';
import { FaxGenerator } from './faxGenerator.js';
import { PdfFaxGenerator } from './pdfFaxGenerator.js';
import { FaxTemplateEngine } from './faxTemplateEngine.js';
import { TemplateRegistry } from './templateRegistry.js';
import { loggingService } from './loggingService.js';
import {
  FaxTemplate,
  EmailReplyData,
  ProductSelectionData,
  ConfirmationData,
  ClarificationData,
  ProductOption,
  AppointmentSelectionTemplateData,
  GeneralInquiryTemplateData
} from '../types/fax.js';

export interface ResponseGeneratorRequest {
  type: 'email_reply' | 'product_selection' | 'confirmation' | 'clarification' | 'welcome' | 'multi_action' | 'appointment_selection' | 'general_inquiry' | 'order_confirmation';
  data: any;
  referenceId?: string;
  options?: any;
  mcpServer?: string;  // For template selection via TemplateRegistry
  intent?: string;     // For template selection via TemplateRegistry
}

export interface ResponseGeneratorResult {
  pdfBuffer: Buffer;
  template: FaxTemplate;
  referenceId: string;
}

export class ResponseGenerator {
  private static templateRegistry = TemplateRegistry.getInstance();
  private static logger = loggingService;

  /**
   * Get template type from MCP server and intent using TemplateRegistry
   * @param mcpServer MCP server name
   * @param intent Optional intent
   * @returns Template type to use
   */
  static getTemplateTypeFromMcp(mcpServer: string, intent?: string): string {
    const templateType = this.templateRegistry.getTemplate(mcpServer, intent);
    
    // Log template selection for monitoring
    this.logger.info('Template selected via TemplateRegistry', {
      mcpServer,
      intent,
      templateType,
      isFallback: templateType === 'general_inquiry' && mcpServer !== 'ai_chat' && mcpServer !== 'chat'
    });
    
    return templateType;
  }

  /**
   * Generate fax response based on request type
   */
  static async generateResponse(request: ResponseGeneratorRequest): Promise<ResponseGeneratorResult> {
    let pdfBuffer: Buffer;
    let template: FaxTemplate;
    const referenceId = request.referenceId || this.generateReferenceId();

    // If mcpServer is provided, use TemplateRegistry to determine template type
    let requestType = request.type;
    if (request.mcpServer) {
      const templateType = this.getTemplateTypeFromMcp(request.mcpServer, request.intent);
      requestType = templateType as typeof request.type;
    }

    switch (requestType) {
      case 'email_reply':
        // Use new PDF generator for text-based PDFs
        template = FaxTemplateEngine.createEmailReplyTemplate(request.data as EmailReplyData, referenceId);
        pdfBuffer = await PdfFaxGenerator.generatePdf(template);
        break;

      case 'product_selection':
        // Check if this is a grouped (multi-product) search or single product search
        if (request.data.groupedResults) {
          // Multi-product search with grouped results
          pdfBuffer = await ProductSelectionFaxGenerator.generateGroupedProductSelectionFax(
            request.data,
            referenceId
          );
        } else {
          // Single product search
          pdfBuffer = await ProductSelectionFaxGenerator.generateProductSelectionFax(
            request.data,
            referenceId
          );
        }
        template = {
          type: 'product_selection',
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

      case 'appointment_selection':
        const appointmentData = request.data as AppointmentSelectionTemplateData;
        pdfBuffer = await AppointmentSelectionFaxGenerator.generateAppointmentSelectionFax(
          appointmentData,
          referenceId
        );
        template = {
          type: 'appointment_selection',
          referenceId,
          pages: [],
          contextData: request.data
        };
        break;

      case 'general_inquiry':
        const inquiryData = request.data as GeneralInquiryTemplateData;
        pdfBuffer = await GeneralInquiryFaxGenerator.generateInquiryFax(
          inquiryData,
          referenceId
        );
        template = {
          type: 'general_inquiry',
          referenceId,
          pages: [],
          contextData: request.data
        };
        break;

      case 'order_confirmation':
        // Build ShoppingOrderConfirmationData from the order result
        const orderData = request.data;
        const shoppingOrderData: ShoppingOrderConfirmationData = {
          orderId: orderData.order?.id || '',
          referenceId: orderData.order?.referenceId || referenceId,
          productTitle: orderData.product?.title || 'Product',
          productAsin: orderData.product?.asin || '',
          quantity: orderData.product?.quantity || 1,
          quotedPrice: orderData.product?.price || 0,
          totalAmount: orderData.order?.totalAmount || 0,
          paymentMethod: orderData.bankTransferDetails ? 'bank_transfer' : 'card',
          bankTransferInstructions: orderData.bankTransferDetails ? {
            bankName: orderData.bankTransferDetails.bankName,
            accountNumber: orderData.bankTransferDetails.accountNumber,
            accountName: orderData.bankTransferDetails.accountName,
            amount: orderData.bankTransferDetails.amount,
            referenceCode: orderData.bankTransferDetails.referenceCode,
            expiresAt: new Date(orderData.bankTransferDetails.expiresAt),
          } : undefined,
          userName: orderData.deliveryAddress?.name,
        };
        pdfBuffer = await ShoppingOrderConfirmationFaxGenerator.generateOrderConfirmationFax(
          shoppingOrderData
        );
        template = {
          type: 'order_confirmation',
          referenceId: shoppingOrderData.referenceId,
          pages: [],
          contextData: request.data
        };
        break;

      default:
        // Fallback to general inquiry template for unknown types
        this.logger.warn('Unknown response type, falling back to general_inquiry', {
          requestedType: request.type,
          mcpServer: request.mcpServer,
          intent: request.intent
        });
        
        const fallbackData: GeneralInquiryTemplateData = {
          question: 'Request Processing',
          answer: typeof request.data === 'string' 
            ? request.data 
            : JSON.stringify(request.data, null, 2),
          relatedTopics: []
        };
        
        pdfBuffer = await GeneralInquiryFaxGenerator.generateInquiryFax(
          fallbackData,
          referenceId
        );
        template = {
          type: 'general_inquiry',
          referenceId,
          pages: [],
          contextData: request.data
        };
        break;
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
   * @deprecated Use generateResponse with ProductSelectionFaxData directly
   */
  static async generateShoppingFax(
    data: any,
    referenceId?: string
  ): Promise<ResponseGeneratorResult> {
    return await this.generateResponse({
      type: 'product_selection',
      data,
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
   * Generate appointment selection fax
   */
  static async generateAppointmentFax(
    appointmentData: AppointmentSelectionTemplateData,
    referenceId?: string
  ): Promise<ResponseGeneratorResult> {
    return await this.generateResponse({
      type: 'appointment_selection',
      data: appointmentData,
      referenceId
    });
  }

  /**
   * Generate general inquiry (AI Q&A) fax
   */
  static async generateInquiryFax(
    inquiryData: GeneralInquiryTemplateData,
    referenceId?: string
  ): Promise<ResponseGeneratorResult> {
    return await this.generateResponse({
      type: 'general_inquiry',
      data: inquiryData,
      referenceId
    });
  }

  /**
   * Generate fax using MCP server and intent for template selection
   */
  static async generateFromMcp(
    mcpServer: string,
    intent: string | undefined,
    data: any,
    referenceId?: string
  ): Promise<ResponseGeneratorResult> {
    const templateType = this.getTemplateTypeFromMcp(mcpServer, intent);
    
    return await this.generateResponse({
      type: templateType as any,
      data,
      referenceId,
      mcpServer,
      intent
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

      case 'appointment_selection':
        const appointmentData = request.data as AppointmentSelectionTemplateData;
        const slotCount = appointmentData.slots?.length || 0;
        return slotCount > 10 ? 2 : 1;
      
      case 'general_inquiry':
        const inquiryData = request.data as GeneralInquiryTemplateData;
        const answerLength = inquiryData.answer?.length || 0;
        const imageCount = inquiryData.images?.length || 0;
        // Estimate: ~1500 chars per page, plus 1 page per 3 images
        return Math.max(1, Math.ceil(answerLength / 1500) + Math.ceil(imageCount / 3));
      
      case 'confirmation':
      case 'clarification':
      case 'welcome':
      case 'multi_action':
      default:
        return 1;
    }
  }
}