import {
  InterpretationResult,
  IntentParameters,
  VisualAnnotation
} from '../types/vision';
import { auditLogService } from './auditLogService';

export class IntentExtractor {
  
  /**
   * Extract and refine intent from raw interpretation
   */
  async extractIntent(
    rawText: string,
    visualAnnotations: VisualAnnotation[],
    existingInterpretation?: Partial<InterpretationResult>
  ): Promise<{ 
    intent: string; 
    confidence: number; 
    parameters: IntentParameters;
    confidenceBreakdown?: {
      overall: number;
      byComponent: {
        intentClassification: number;
        parameterExtraction: number;
        contextUnderstanding: number;
      };
    };
    alternativeIntents?: Array<{
      intent: string;
      confidence: number;
      reason: string;
    }>;
  }> {
    
    const text = rawText.toLowerCase();
    const results = await Promise.all([
      this.detectEmailIntent(text, visualAnnotations),
      this.detectShoppingIntent(text, visualAnnotations),
      this.detectAIChatIntent(text, visualAnnotations),
      this.detectPaymentIntent(text, visualAnnotations),
      this.detectReplyIntent(text, visualAnnotations)
    ]);

    // Find the highest confidence intent
    const bestMatch = results.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    // Get alternative intents (those with confidence > 0.3)
    const alternativeIntents = results
      .filter(r => r.intent !== bestMatch.intent && r.confidence > 0.3)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 2) // Top 2 alternatives
      .map(r => ({
        intent: r.intent,
        confidence: r.confidence,
        reason: this.getIntentReason(r.intent, r.confidence)
      }));

    // Calculate detailed confidence breakdown
    const parameterCompleteness = this.assessParameterCompleteness(bestMatch.intent, bestMatch.parameters);
    const contextQuality = visualAnnotations.length > 0 ? 0.8 : 0.5;
    
    const confidenceBreakdown = {
      overall: bestMatch.confidence,
      byComponent: {
        intentClassification: bestMatch.confidence,
        parameterExtraction: parameterCompleteness,
        contextUnderstanding: contextQuality
      }
    };

    // Log the intent extraction
    await auditLogService.logOperation({
      entityType: 'intent_extraction',
      entityId: 'system',
      operation: 'intent_detected',
      details: {
        detectedIntent: bestMatch.intent,
        confidence: bestMatch.confidence,
        confidenceBreakdown,
        alternativeIntents: alternativeIntents.map(a => a.intent),
        allResults: results.map(r => ({ intent: r.intent, confidence: r.confidence }))
      }
    });

    return {
      ...bestMatch,
      confidenceBreakdown,
      alternativeIntents: alternativeIntents.length > 0 ? alternativeIntents : undefined
    };
  }

  /**
   * Detect email sending intent
   */
  private async detectEmailIntent(text: string, annotations: VisualAnnotation[]): Promise<{
    intent: string;
    confidence: number;
    parameters: IntentParameters;
  }> {
    const emailKeywords = [
      'send email', 'email to', 'tell', 'message', 'write to',
      'contact', 'let know', 'inform', 'notify', 'reply to'
    ];

    let confidence = 0;
    const parameters: IntentParameters = {};

    // Check for email keywords
    const keywordMatches = emailKeywords.filter(keyword => text.includes(keyword));
    confidence += keywordMatches.length * 0.15;

    // Extract recipient information
    const recipientPatterns = [
      /(?:email to|send to|tell|write to|contact)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      /(?:email to|send to|tell|write to|contact)\s+([a-zA-Z\s]+?)(?:\s|$|,|\.|that|about)/i
    ];

    for (const pattern of recipientPatterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[1].includes('@')) {
          parameters.recipientEmail = match[1].trim();
          confidence += 0.3;
        } else {
          parameters.recipientName = match[1].trim();
          confidence += 0.25;
        }
        break;
      }
    }

    // Extract subject
    const subjectPatterns = [
      /subject:?\s*([^\n\r]+)/i,
      /about\s+([^\n\r]+)/i,
      /regarding\s+([^\n\r]+)/i
    ];

    for (const pattern of subjectPatterns) {
      const match = text.match(pattern);
      if (match) {
        parameters.subject = match[1].trim();
        confidence += 0.2;
        break;
      }
    }

    // Extract message body
    const bodyPatterns = [
      /(?:tell them|message|say|write)(?:\s+that)?\s*:?\s*([^\n\r]+)/i,
      /(?:the message is|body|content):\s*([^\n\r]+)/i
    ];

    for (const pattern of bodyPatterns) {
      const match = text.match(pattern);
      if (match) {
        parameters.body = match[1].trim();
        confidence += 0.2;
        break;
      }
    }

    // If no explicit body found but we have recipient, use remaining text as body
    if (!parameters.body && (parameters.recipientEmail || parameters.recipientName)) {
      const bodyText = this.extractImplicitEmailBody(text, parameters);
      if (bodyText) {
        parameters.body = bodyText;
        confidence += 0.15;
      }
    }

    return {
      intent: 'email',
      confidence: Math.min(confidence, 1.0),
      parameters
    };
  }

  /**
   * Detect shopping intent
   */
  private async detectShoppingIntent(text: string, annotations: VisualAnnotation[]): Promise<{
    intent: string;
    confidence: number;
    parameters: IntentParameters;
  }> {
    const shoppingKeywords = [
      'buy', 'purchase', 'order', 'shop', 'need', 'want',
      'get me', 'find', 'looking for', 'search for'
    ];

    let confidence = 0;
    const parameters: IntentParameters = {};

    // Check for shopping keywords
    const keywordMatches = shoppingKeywords.filter(keyword => text.includes(keyword));
    confidence += keywordMatches.length * 0.1;

    // Extract product information
    const productPatterns = [
      /(?:buy|purchase|order|need|want|get me|find|looking for|search for)\s+([a-zA-Z0-9\s,.-]+?)(?:\s|$|and|from|at|for)/i,
      /(?:i need|i want)\s+([a-zA-Z0-9\s,.-]+?)(?:\s|$|and|from|at|for)/i
    ];

    for (const pattern of productPatterns) {
      const match = text.match(pattern);
      if (match) {
        parameters.productQuery = match[1].trim();
        confidence += 0.4;
        break;
      }
    }

    // Extract quantity
    const quantityPatterns = [
      /(\d+)\s*(?:of|x|pieces?|items?|units?)/i,
      /(?:quantity|qty|amount):\s*(\d+)/i
    ];

    for (const pattern of quantityPatterns) {
      const match = text.match(pattern);
      if (match) {
        parameters.quantity = parseInt(match[1], 10);
        confidence += 0.1;
        break;
      }
    }

    // Extract delivery preferences
    const deliveryPatterns = [
      /(?:deliver to|ship to|send to)\s+([^\n\r]+)/i,
      /(?:delivery|shipping):\s*([^\n\r]+)/i,
      /(?:urgent|rush|fast|quick|asap)/i
    ];

    for (const pattern of deliveryPatterns) {
      const match = text.match(pattern);
      if (match) {
        parameters.deliveryPreferences = match[1] ? match[1].trim() : 'urgent';
        confidence += 0.15;
        break;
      }
    }

    // Check for selected product IDs from visual annotations (circled items)
    const selectedOptions = annotations
      .filter(ann => ann.type === 'circle' || ann.type === 'checkmark')
      .map(ann => ann.associatedText)
      .filter((text): text is string => text !== undefined && /^[A-Z]$/.test(text));

    if (selectedOptions.length > 0) {
      parameters.selectedProductIds = selectedOptions;
      confidence += 0.3;
    }

    return {
      intent: 'shopping',
      confidence: Math.min(confidence, 1.0),
      parameters
    };
  }

  /**
   * Detect AI chat intent
   */
  private async detectAIChatIntent(text: string, annotations: VisualAnnotation[]): Promise<{
    intent: string;
    confidence: number;
    parameters: IntentParameters;
  }> {
    const chatKeywords = [
      'ask', 'question', 'what is', 'how to', 'why', 'when',
      'where', 'who', 'explain', 'help me understand',
      'tell me about', 'ai', 'assistant'
    ];

    let confidence = 0;
    const parameters: IntentParameters = {};

    // Check for question keywords
    const keywordMatches = chatKeywords.filter(keyword => text.includes(keyword));
    confidence += keywordMatches.length * 0.15;

    // Check for question patterns
    const questionPatterns = [
      /\?/g, // Question marks
      /^(?:what|how|why|when|where|who|can you|could you|please)/i,
      /(?:ask ai|ai question|help me)/i
    ];

    for (const pattern of questionPatterns) {
      if (pattern.test(text)) {
        confidence += 0.2;
      }
    }

    // Extract the question
    if (confidence > 0.2) {
      // Remove common prefixes and clean up the question
      let question = text
        .replace(/^(?:ask ai|ai question|help me|please|can you|could you)\s*/i, '')
        .replace(/^(?:what is|how to|why|when|where|who)\s*/i, match => match)
        .trim();

      if (question.length > 5) {
        parameters.question = question;
        confidence += 0.3;
      }
    }

    return {
      intent: 'ai_chat',
      confidence: Math.min(confidence, 1.0),
      parameters
    };
  }

  /**
   * Detect payment registration intent
   */
  private async detectPaymentIntent(text: string, annotations: VisualAnnotation[]): Promise<{
    intent: string;
    confidence: number;
    parameters: IntentParameters;
  }> {
    const paymentKeywords = [
      'payment', 'credit card', 'card', 'pay', 'billing',
      'register card', 'add card', 'payment method',
      'convenience store', 'konbini', 'barcode'
    ];

    let confidence = 0;
    const parameters: IntentParameters = {};

    // Check for payment keywords
    const keywordMatches = paymentKeywords.filter(keyword => text.includes(keyword));
    confidence += keywordMatches.length * 0.2;

    // Detect payment method type
    if (text.includes('credit card') || text.includes('card')) {
      parameters.paymentMethod = 'credit_card';
      confidence += 0.3;
    } else if (text.includes('convenience store') || text.includes('konbini') || text.includes('barcode')) {
      parameters.paymentMethod = 'convenience_store';
      confidence += 0.3;
    }

    // Look for card details (but mask them for security)
    const cardPattern = /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/;
    if (cardPattern.test(text)) {
      parameters.cardDetails = '****-****-****-' + text.match(cardPattern)?.[0].slice(-4);
      confidence += 0.4;
    }

    return {
      intent: 'payment_registration',
      confidence: Math.min(confidence, 1.0),
      parameters
    };
  }

  /**
   * Detect reply intent (responding to previous Faxi template)
   */
  private async detectReplyIntent(text: string, annotations: VisualAnnotation[]): Promise<{
    intent: string;
    confidence: number;
    parameters: IntentParameters;
  }> {
    let confidence = 0;
    const parameters: IntentParameters = {};

    // Check for circled options (A, B, C, etc.)
    const selectedOptions = annotations
      .filter(ann => (ann.type === 'circle' || ann.type === 'checkmark') && ann.confidence > 0.5)
      .map(ann => ann.associatedText)
      .filter((text): text is string => text !== undefined && /^[A-Z]$/.test(text));

    if (selectedOptions.length > 0) {
      parameters.selectedOptions = selectedOptions;
      confidence += 0.6;
    }

    // Check for reference ID patterns
    const refIdPattern = /(?:ref|reference):\s*(FX-\d{4}-\d{6})/i;
    const refMatch = text.match(refIdPattern);
    if (refMatch) {
      confidence += 0.4;
    }

    // Look for freeform text (additional comments)
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const meaningfulLines = lines.filter(line => 
      !line.match(/^[A-Z]$/) && // Not just option letters
      !line.match(/ref:/i) && // Not reference ID
      line.length > 3 // Has some content
    );

    if (meaningfulLines.length > 0) {
      parameters.freeformText = meaningfulLines.join(' ');
      confidence += 0.2;
    }

    // Reply intent needs either selections or meaningful text
    if (parameters.selectedOptions || parameters.freeformText) {
      confidence = Math.max(confidence, 0.3);
    }

    return {
      intent: 'reply',
      confidence: Math.min(confidence, 1.0),
      parameters
    };
  }

  /**
   * Extract implicit email body when no explicit body is found
   */
  private extractImplicitEmailBody(text: string, parameters: IntentParameters): string | undefined {
    // Remove the recipient part and common prefixes
    let bodyText = text;
    
    if (parameters.recipientEmail) {
      bodyText = bodyText.replace(parameters.recipientEmail, '');
    }
    if (parameters.recipientName) {
      bodyText = bodyText.replace(parameters.recipientName, '');
    }
    
    // Remove common email prefixes
    bodyText = bodyText
      .replace(/^(?:send email to|email to|tell|write to|contact)\s*/i, '')
      .replace(/^(?:that|about|regarding)\s*/i, '')
      .trim();

    // If there's meaningful content left, use it as body
    if (bodyText.length > 10 && !bodyText.match(/^[a-z\s]{1,5}$/)) {
      return bodyText;
    }

    return undefined;
  }

  /**
   * Calculate overall confidence score
   */
  calculateConfidence(
    intentConfidence: number,
    parameterCompleteness: number,
    visualAnnotationQuality: number
  ): number {
    // Weighted average of different confidence factors
    const weights = {
      intent: 0.5,
      parameters: 0.3,
      visual: 0.2
    };

    return (
      intentConfidence * weights.intent +
      parameterCompleteness * weights.parameters +
      visualAnnotationQuality * weights.visual
    );
  }

  /**
   * Assess parameter completeness for given intent
   */
  assessParameterCompleteness(intent: string, parameters: IntentParameters): number {
    switch (intent) {
      case 'email':
        let emailScore = 0;
        if (parameters.recipientEmail || parameters.recipientName) emailScore += 0.4;
        if (parameters.subject) emailScore += 0.3;
        if (parameters.body) emailScore += 0.3;
        return emailScore;

      case 'shopping':
        let shoppingScore = 0;
        if (parameters.productQuery) shoppingScore += 0.6;
        if (parameters.quantity) shoppingScore += 0.2;
        if (parameters.deliveryPreferences) shoppingScore += 0.2;
        return shoppingScore;

      case 'ai_chat':
        return parameters.question ? 1.0 : 0.2;

      case 'payment_registration':
        return parameters.paymentMethod ? 0.8 : 0.3;

      case 'reply':
        let replyScore = 0;
        if (parameters.selectedOptions && parameters.selectedOptions.length > 0) replyScore += 0.7;
        if (parameters.freeformText) replyScore += 0.3;
        return replyScore;

      default:
        return 0.1;
    }
  }

  /**
   * Get reason for intent classification
   */
  private getIntentReason(intent: string, confidence: number): string {
    const reasons: Record<string, string> = {
      email: 'Contains email-related keywords or recipient information',
      shopping: 'Contains product or purchase-related keywords',
      ai_chat: 'Contains question patterns or inquiry keywords',
      payment_registration: 'Contains payment or billing-related keywords',
      reply: 'Contains circled options or reference to previous communication'
    };
    return reasons[intent] || 'Pattern match detected';
  }
}

// Export singleton instance
export const intentExtractor = new IntentExtractor();