import { FaxTemplateEngine } from './faxTemplateEngine.js';
import { TiffGenerator } from './tiffGenerator.js';
import { ClarificationData, RecentConversation, FaxTemplate } from '../types/fax.js';

export interface ClarificationOptions {
  includeRecentConversations?: boolean;
  maxRecentConversations?: number;
  includeSuggestions?: boolean;
  includeExamples?: boolean;
}

export class ClarificationFaxGenerator {
  private static readonly SUPPORT_CONTACT = 'help@faxi.jp | +81-3-1234-5678';

  /**
   * Generate clarification request fax
   */
  static async generateClarificationFax(
    question: string,
    requiredInfo: string[],
    recentConversations: RecentConversation[] = [],
    options: ClarificationOptions = {},
    referenceId?: string
  ): Promise<Buffer[]> {
    const opts = {
      includeRecentConversations: true,
      maxRecentConversations: 5,
      includeSuggestions: true,
      includeExamples: false,
      ...options
    };

    const limitedConversations = opts.includeRecentConversations 
      ? recentConversations.slice(0, opts.maxRecentConversations)
      : [];

    const clarificationData: ClarificationData = {
      question,
      requiredInfo,
      recentConversations: limitedConversations,
      supportContact: this.SUPPORT_CONTACT
    };

    const template = FaxTemplateEngine.createClarificationTemplate(clarificationData, referenceId);
    
    // Add examples if requested
    if (opts.includeExamples) {
      this.addExamples(template, question);
    }

    return await TiffGenerator.generateTiff(template);
  }

  /**
   * Generate ambiguous request clarification fax
   */
  static async generateAmbiguousRequestFax(
    originalRequest: string,
    possibleInterpretations: string[],
    referenceId?: string
  ): Promise<Buffer[]> {
    const question = `We received your fax but need clarification on what you'd like us to do.

Your request: "${originalRequest}"

This could mean:
${possibleInterpretations.map((interp, index) => `${String.fromCharCode(65 + index)}. ${interp}`).join('\n')}

Please circle the letter for what you meant, or write a clearer request below.`;

    return await this.generateClarificationFax(
      question,
      ['Circle the correct interpretation OR write a clearer request'],
      [],
      { includeExamples: true },
      referenceId
    );
  }

  /**
   * Generate missing information clarification fax
   */
  static async generateMissingInfoFax(
    actionType: 'email' | 'shopping' | 'payment',
    missingFields: string[],
    partialData?: any,
    referenceId?: string
  ): Promise<Buffer[]> {
    const actionMessages = {
      email: 'We understand you want to send an email, but we need more information.',
      shopping: 'We understand you want to shop, but we need more details.',
      payment: 'We understand you want to make a payment, but we need more information.'
    };

    let question = actionMessages[actionType];
    
    if (partialData) {
      question += '\n\nWhat we understood:';
      if (actionType === 'email') {
        if (partialData.recipient) question += `\nTo: ${partialData.recipient}`;
        if (partialData.subject) question += `\nSubject: ${partialData.subject}`;
        if (partialData.body) question += `\nMessage: ${partialData.body.substring(0, 100)}...`;
      } else if (actionType === 'shopping') {
        if (partialData.product) question += `\nProduct: ${partialData.product}`;
        if (partialData.quantity) question += `\nQuantity: ${partialData.quantity}`;
      }
    }

    question += '\n\nPlease provide the missing information:';

    return await this.generateClarificationFax(
      question,
      missingFields,
      [],
      { includeExamples: true },
      referenceId
    );
  }

  /**
   * Generate context recovery clarification fax
   */
  static async generateContextRecoveryFax(
    recentConversations: RecentConversation[],
    referenceId?: string
  ): Promise<Buffer[]> {
    const question = `We received your fax but couldn't determine which conversation it relates to.

Please tell us which topic you're responding to, or start a new request.`;

    return await this.generateClarificationFax(
      question,
      ['Write the reference ID (FX-YYYY-NNNNNN) OR the letter of the conversation you\'re responding to'],
      recentConversations,
      { includeRecentConversations: true },
      referenceId
    );
  }

  /**
   * Generate handwriting unclear clarification fax
   */
  static async generateHandwritingUnclearFax(
    unclearParts: string[],
    referenceId?: string
  ): Promise<Buffer[]> {
    const question = `We received your fax but some parts were difficult to read.

Please write more clearly or use printed letters for:
${unclearParts.map(part => `• ${part}`).join('\n')}

You can also try:
• Writing in larger letters
• Using a darker pen or marker
• Printing instead of cursive writing`;

    return await this.generateClarificationFax(
      question,
      ['Rewrite the unclear parts more clearly'],
      [],
      { includeExamples: false },
      referenceId
    );
  }

  /**
   * Generate payment method clarification fax
   */
  static async generatePaymentMethodFax(
    totalAmount: number,
    currency: string = 'JPY',
    referenceId?: string
  ): Promise<Buffer[]> {
    const question = `Your order total is ¥${totalAmount}. How would you like to pay?

We don't have a payment method on file for you.`;

    const requiredInfo = [
      'Circle A to register a credit card (we\'ll send instructions)',
      'Circle B to pay at convenience store (we\'ll send barcode)',
      'Circle C to cancel this order'
    ];

    return await this.generateClarificationFax(
      question,
      requiredInfo,
      [],
      { includeExamples: false },
      referenceId
    );
  }

  /**
   * Generate address confirmation clarification fax
   */
  static async generateAddressConfirmationFax(
    detectedAddress: string,
    orderItems: string[],
    referenceId?: string
  ): Promise<Buffer[]> {
    const question = `Please confirm your delivery address for this order:

Items to deliver:
${orderItems.map(item => `• ${item}`).join('\n')}

Delivery address we have on file:
${detectedAddress}

Is this address correct?`;

    const requiredInfo = [
      'Circle YES if address is correct',
      'Circle NO and write the correct address below',
      'Write "PICKUP" if you prefer to pick up the order'
    ];

    return await this.generateClarificationFax(
      question,
      requiredInfo,
      [],
      { includeExamples: false },
      referenceId
    );
  }

  /**
   * Generate service unavailable clarification fax
   */
  static async generateServiceUnavailableFax(
    serviceName: string,
    reason: string,
    alternatives: string[] = [],
    estimatedRestoreTime?: string,
    referenceId?: string
  ): Promise<Buffer[]> {
    let question = `The ${serviceName} service is temporarily unavailable.

Reason: ${reason}`;

    if (estimatedRestoreTime) {
      question += `\nEstimated restore time: ${estimatedRestoreTime}`;
    }

    if (alternatives.length > 0) {
      question += `\n\nAlternatives you can try:
${alternatives.map(alt => `• ${alt}`).join('\n')}`;
    }

    question += '\n\nWhat would you like to do?';

    const requiredInfo = [
      'Wait for service to be restored (we\'ll process your request then)',
      'Try one of the alternatives listed above',
      'Cancel this request'
    ];

    return await this.generateClarificationFax(
      question,
      requiredInfo,
      [],
      { includeExamples: false },
      referenceId
    );
  }

  /**
   * Generate low confidence interpretation clarification fax
   */
  static async generateLowConfidenceFax(
    originalRequest: string,
    bestGuess: string,
    confidence: number,
    referenceId?: string
  ): Promise<Buffer[]> {
    const question = `We're not completely sure what you're asking for.

Your request: "${originalRequest}"

Our best guess: ${bestGuess}
Confidence: ${Math.round(confidence * 100)}%

Is our guess correct?`;

    const requiredInfo = [
      'Circle YES if our guess is correct',
      'Circle NO and write what you actually want below'
    ];

    return await this.generateClarificationFax(
      question,
      requiredInfo,
      [],
      { includeExamples: true },
      referenceId
    );
  }

  /**
   * Add examples to clarification template based on question type
   */
  private static addExamples(template: FaxTemplate, question: string): void {
    if (!template.pages[0]) return;

    let examples: string[] = [];

    if (question.toLowerCase().includes('email')) {
      examples = [
        'Send email to john@example.com: Meeting tomorrow at 3pm',
        'Reply to mom: Yes, I can come for dinner Sunday',
        'Email my doctor: I need to reschedule my appointment'
      ];
    } else if (question.toLowerCase().includes('shop') || question.toLowerCase().includes('buy')) {
      examples = [
        'Buy shampoo and conditioner',
        'Order 2 flashlights with batteries',
        'Find a coffee maker under ¥5000'
      ];
    } else if (question.toLowerCase().includes('question') || question.toLowerCase().includes('ask')) {
      examples = [
        'What\'s the weather like today?',
        'How do I cook rice?',
        'What time is it in New York?'
      ];
    }

    if (examples.length > 0) {
      // Find the blank space and add examples before it
      const blankSpaceIndex = template.pages[0].content.findIndex(c => c.type === 'blank_space');
      if (blankSpaceIndex > -1) {
        template.pages[0].content.splice(blankSpaceIndex, 0, 
          {
            type: 'text',
            text: 'Examples of clear requests:',
            fontSize: 12,
            bold: true,
            marginBottom: 8
          },
          {
            type: 'text',
            text: examples.map(ex => `• ${ex}`).join('\n'),
            fontSize: 11,
            marginBottom: 16
          }
        );
      }
    }
  }

  /**
   * Generate system error clarification fax
   */
  static async generateSystemErrorFax(
    errorType: string,
    userFriendlyMessage: string,
    suggestedActions: string[],
    referenceId?: string
  ): Promise<Buffer[]> {
    const question = `We encountered a technical issue while processing your request.

Error: ${userFriendlyMessage}

This is a temporary problem on our end, not something you did wrong.`;

    const requiredInfo = [
      'Try your request again (the issue may be resolved)',
      'Wait 10 minutes and try again',
      'Contact support if the problem continues'
    ];

    return await this.generateClarificationFax(
      question,
      [...requiredInfo, ...suggestedActions],
      [],
      { includeExamples: false },
      referenceId
    );
  }
}