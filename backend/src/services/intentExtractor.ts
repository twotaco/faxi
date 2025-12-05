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
      this.detectReplyIntent(text, visualAnnotations),
      this.detectBlocklistIntent(text, visualAnnotations),
      this.detectContactManagementIntent(text, visualAnnotations)
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
   * Extract multiple products from text by splitting on conjunctions
   * E.g., "shampoo and vegetable crackers" → ["shampoo", "vegetable crackers"]
   * E.g., "buy coffee, tea, sugar" → ["coffee", "tea", "sugar"]
   * @returns Array of product queries (max 5)
   */
  private extractMultipleProducts(text: string): string[] {
    // Remove common shopping prefixes to isolate product list
    let productText = text
      .replace(/^(?:buy|purchase|order|need|want|get me|find|looking for|search for|i need|i want)\s+(?:to\s+buy\s+)?(?:some\s+)?(?:a\s+)?/i, '')
      .replace(/\s+(?:for me|please|asap|urgently|under|below|less than).*$/i, '')
      .trim();

    // Split on conjunctions: "and", ",", "、", "と", "&"
    // Be careful with "and" - don't split "bread and butter" (common phrases)
    const splitPattern = /\s+and\s+|\s*,\s*|\s*、\s*|\s*と\s*|\s*&\s*/i;

    const products = productText
      .split(splitPattern)
      .map(p => p.trim())
      .filter(p => p.length > 1) // Filter out empty or single-char entries
      .slice(0, 5); // Limit to 5 products max

    return products;
  }

  /**
   * Detect shopping intent
   * Supports: product_search, product_selection, order_status
   */
  private async detectShoppingIntent(text: string, annotations: VisualAnnotation[]): Promise<{
    intent: string;
    confidence: number;
    parameters: IntentParameters;
  }> {
    // Check for order status queries first
    const orderStatusKeywords = [
      'order status', 'track order', 'where is my order', 'delivery status',
      'when will it arrive', 'shipping status', 'order tracking', 'status of my order',
      'check order', 'order update'
    ];
    
    const hasOrderStatusKeyword = orderStatusKeywords.some(keyword => text.includes(keyword));
    const hasReferenceId = /(?:ref|reference|order)(?:\s+id)?:\s*FX-\d{4}-\d{6}/i.test(text);
    
    if (hasOrderStatusKeyword || hasReferenceId) {
      let confidence = hasOrderStatusKeyword ? 0.7 : 0.5;
      const parameters: IntentParameters = {
        shoppingSubIntent: 'order_status'
      };
      
      // Look for reference ID
      const refIdPattern = /(?:ref|reference|order)(?:\s+id)?:\s*(FX-\d{4}-\d{6})/i;
      const refMatch = text.match(refIdPattern);
      if (refMatch) {
        parameters.referenceId = refMatch[1].toUpperCase(); // Normalize to uppercase
        confidence += 0.3;
      }
      
      return {
        intent: 'shopping',
        confidence: Math.min(confidence, 1.0),
        parameters
      };
    }

    // Check for selected product IDs from visual annotations (circled items)
    // Extract selection marker (A, B, C, D, E) from annotation's associated text
    // associatedText may be just "D" or full text like "D. Dove シャンプー..."
    const annotationOptions = annotations
      .filter(ann => ann.type === 'circle' || ann.type === 'checkmark')
      .map(ann => {
        const assocText = ann.associatedText?.trim();
        if (!assocText) return null;
        // Check if it's a single letter (A-E)
        if (/^[A-E]$/i.test(assocText)) return assocText.toUpperCase();
        // Check if it starts with a letter followed by period or space (e.g., "D. Dove..." or "D Dove...")
        const match = assocText.match(/^([A-E])[\.\s]/i);
        if (match) return match[1].toUpperCase();
        return null;
      })
      .filter((t): t is string => t !== null);

    // Also check for circled options in OCR text (○ B. or ○ D. patterns)
    // These appear when the circle is picked up by OCR rather than visual annotation
    const textCirclePattern = /[○◯⭕]\s*([A-E])[\.\s]/gi;
    const textOptions: string[] = [];
    let match;
    while ((match = textCirclePattern.exec(text)) !== null) {
      textOptions.push(match[1].toUpperCase());
    }

    // Combine both sources, removing duplicates
    const selectedOptions = Array.from(new Set([...annotationOptions, ...textOptions]));

    if (selectedOptions.length > 0) {
      // Check for reference ID indicating this is a reply to a previous shopping form
      // Reference ID pattern: Ref: UUID format or FX-YYYY-NNNNNN format
      const hasReferenceId = /(?:ref|reference):\s*(?:[a-f0-9-]{36}|FX-\d{4}-\d{6})/i.test(text);

      // Check for shopping order form keywords (from our PDF templates)
      const hasOrderFormKeywords = /(?:shopping\s*order\s*form|order\s*form|注文書|ショッピング)/i.test(text);

      // This is a product selection - boost confidence if replying to a form
      const isReplyToForm = hasReferenceId || hasOrderFormKeywords;
      return {
        intent: 'shopping',
        confidence: isReplyToForm ? 0.95 : 0.9,
        parameters: {
          shoppingSubIntent: 'product_selection',
          selectedProductIds: selectedOptions,
          isReplyToForm
        }
      };
    }

    // Check for product search keywords
    const shoppingKeywords = [
      'buy', 'purchase', 'order', 'shop', 'need', 'want',
      'get me', 'find', 'looking for', 'search for'
    ];

    let confidence = 0;
    const parameters: IntentParameters = {
      shoppingSubIntent: 'product_search'
    };

    // Check for shopping keywords
    const keywordMatches = shoppingKeywords.filter(keyword => text.includes(keyword));
    confidence += keywordMatches.length * 0.1;

    // Extract product information - supports multiple products
    const shoppingPhrasePatterns = [
      /(?:buy|purchase|order|need|want|get me|find|looking for|search for|i need|i want)\s+(?:to\s+buy\s+)?(?:some\s+)?(?:a\s+)?(.+?)(?:\s+under|\s+below|\s+less|\s+between|$)/i
    ];

    let rawProductText = '';
    for (const pattern of shoppingPhrasePatterns) {
      const match = text.match(pattern);
      if (match) {
        rawProductText = match[1].trim();
        break;
      }
    }

    // Extract multiple products from the raw text
    if (rawProductText) {
      const productQueries = this.extractMultipleProducts(rawProductText);

      if (productQueries.length > 0) {
        parameters.productQueries = productQueries;
        // Set productQuery for backwards compatibility (first product)
        parameters.productQuery = productQueries[0];

        // Confidence boost: more for multi-product requests
        confidence += productQueries.length > 1 ? 0.5 : 0.4;
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

    // Extract price range
    const pricePatterns = [
      /under\s+[¥￥]?(\d+(?:,\d{3})*)/i,
      /less than\s+[¥￥]?(\d+(?:,\d{3})*)/i,
      /below\s+[¥￥]?(\d+(?:,\d{3})*)/i,
      /between\s+[¥￥]?(\d+(?:,\d{3})*)\s+and\s+[¥￥]?(\d+(?:,\d{3})*)/i
    ];

    for (const pattern of pricePatterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[2]) {
          // Range pattern
          parameters.priceRange = {
            min: parseInt(match[1].replace(/,/g, ''), 10),
            max: parseInt(match[2].replace(/,/g, ''), 10)
          };
        } else {
          // Max only pattern
          parameters.priceRange = {
            max: parseInt(match[1].replace(/,/g, ''), 10)
          };
        }
        confidence += 0.15;
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

    // Reduce confidence if this looks like a shopping form reply (product circles present)
    // Shopping forms often contain "payment" text but circled A-E options indicate product selection
    const hasProductCircles = annotations.some(ann => {
      if (ann.type !== 'circle' && ann.type !== 'checkmark') return false;
      const assocText = ann.associatedText?.trim();
      if (!assocText) return false;
      // Check single letter or text starting with letter+period/space
      return /^[A-E]$/i.test(assocText) || /^[A-E][\.\s]/i.test(assocText);
    });
    if (hasProductCircles) {
      confidence *= 0.3; // Heavily penalize - this is likely a product selection, not payment registration
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
   * Detect blocklist management intent (block/unblock email senders)
   * Requirements: 15.1, 15.4, 15.5
   */
  private async detectBlocklistIntent(text: string, annotations: VisualAnnotation[]): Promise<{
    intent: string;
    confidence: number;
    parameters: IntentParameters;
  }> {
    let confidence = 0;
    const parameters: IntentParameters = {};

    // Block keywords
    const blockKeywords = [
      'block', 'stop', 'unsubscribe', 'spam', 'dont want', 'no more',
      'ブロック', '停止', '拒否', '迷惑'
    ];

    // Unblock keywords
    const unblockKeywords = [
      'unblock', 'allow', 'permit', 'resume', 'restore',
      'ブロック解除', '許可', '再開'
    ];

    // Check for block intent
    const hasBlockKeyword = blockKeywords.some(keyword => text.includes(keyword));
    const hasUnblockKeyword = unblockKeywords.some(keyword => text.includes(keyword));

    if (hasBlockKeyword) {
      parameters.blocklistAction = 'block';
      confidence += 0.6;
    } else if (hasUnblockKeyword) {
      parameters.blocklistAction = 'unblock';
      confidence += 0.6;
    }

    // Extract email address to block/unblock
    // Look for patterns like "block emails from X" or "block X"
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const emailMatch = text.match(emailPattern);
    
    if (emailMatch) {
      parameters.targetEmail = emailMatch[1];
      confidence += 0.3;
    }

    // Look for "from" patterns to extract email or name
    const fromPattern = /(?:from|sender|address)\s+([^\s,]+(?:@[^\s,]+)?)/i;
    const fromMatch = text.match(fromPattern);
    
    if (fromMatch && !parameters.targetEmail) {
      const extracted = fromMatch[1];
      if (extracted.includes('@')) {
        parameters.targetEmail = extracted;
        confidence += 0.2;
      } else {
        parameters.targetName = extracted;
        confidence += 0.1;
      }
    }

    // If we have an action but no target, reduce confidence
    if (parameters.blocklistAction && !parameters.targetEmail && !parameters.targetName) {
      confidence *= 0.5;
    }

    return {
      intent: 'blocklist_management',
      confidence: Math.min(confidence, 1.0),
      parameters
    };
  }

  /**
   * Detect contact management intent (add/update/delete/list contacts)
   */
  private async detectContactManagementIntent(text: string, annotations: VisualAnnotation[]): Promise<{
    intent: string;
    confidence: number;
    parameters: IntentParameters;
  }> {
    let confidence = 0;
    const parameters: IntentParameters = {};

    // Add contact keywords
    const addKeywords = [
      'add contact', 'save contact', 'new contact', 'create contact',
      'add to contacts', 'add to address book'
    ];

    // Update contact keywords
    const updateKeywords = [
      'update contact', 'edit contact', 'change contact', 'modify contact',
      'rename contact', 'update name', 'change name'
    ];

    // Delete contact keywords
    const deleteKeywords = [
      'delete contact', 'remove contact', 'remove from contacts',
      'delete from address book'
    ];

    // List/view contacts keywords
    const listKeywords = [
      'show contacts', 'list contacts', 'my contacts', 'view contacts',
      'address book', 'contact list', 'see contacts', 'get contacts',
      'show my contacts', 'show address book'
    ];

    // Check for specific actions
    const hasAddKeyword = addKeywords.some(keyword => text.includes(keyword));
    const hasUpdateKeyword = updateKeywords.some(keyword => text.includes(keyword));
    const hasDeleteKeyword = deleteKeywords.some(keyword => text.includes(keyword));
    const hasListKeyword = listKeywords.some(keyword => text.includes(keyword));

    if (hasAddKeyword) {
      parameters.contactAction = 'add';
      confidence += 0.7;
    } else if (hasUpdateKeyword) {
      parameters.contactAction = 'update';
      confidence += 0.7;
    } else if (hasDeleteKeyword) {
      parameters.contactAction = 'delete';
      confidence += 0.7;
    } else if (hasListKeyword) {
      parameters.contactAction = 'list';
      confidence += 0.8;
    }

    // Extract contact name for update/delete operations
    // Pattern: "update contact <name> name to <newname>"
    const updateNamePattern = /(?:update|edit|change|modify|rename)\s+contact\s+([^\s]+)\s+(?:name\s+)?to\s+([^.]+)/i;
    const updateMatch = text.match(updateNamePattern);
    if (updateMatch) {
      parameters.currentName = updateMatch[1].trim();
      parameters.newName = updateMatch[2].trim();
      confidence += 0.2;
    }

    // Pattern: "update contact <name>"
    const simpleUpdatePattern = /(?:update|edit|change|modify)\s+contact\s+([a-zA-Z0-9_]+)/i;
    const simpleUpdateMatch = text.match(simpleUpdatePattern);
    if (simpleUpdateMatch && !parameters.currentName) {
      parameters.currentName = simpleUpdateMatch[1].trim();
      confidence += 0.1;
    }

    // Extract note/relationship: "Note: <value>" or "note <value>"
    const notePattern = /note[:\s]+([^.]+?)(?:\.|$)/i;
    const noteMatch = text.match(notePattern);
    if (noteMatch) {
      parameters.note = noteMatch[1].trim();
      confidence += 0.1;
    }

    // Extract email address
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const emailMatch = text.match(emailPattern);
    if (emailMatch) {
      parameters.email = emailMatch[1];
      confidence += 0.15;
    }

    // For add contact: "add contact: <name>, <email>, <note>"
    const addContactPattern = /add\s+contact[:\s]+([^,]+),\s*([^,]+)(?:,\s*(.+))?/i;
    const addMatch = text.match(addContactPattern);
    if (addMatch) {
      parameters.newName = addMatch[1].trim();
      if (addMatch[2] && addMatch[2].includes('@')) {
        parameters.email = addMatch[2].trim();
      }
      if (addMatch[3]) {
        parameters.note = addMatch[3].trim();
      }
      confidence += 0.2;
    }

    // For delete contact: "delete contact <name>"
    const deletePattern = /(?:delete|remove)\s+contact\s+([a-zA-Z0-9_\s]+)/i;
    const deleteMatch = text.match(deletePattern);
    if (deleteMatch && parameters.contactAction === 'delete') {
      parameters.currentName = deleteMatch[1].trim();
      confidence += 0.1;
    }

    return {
      intent: 'contact_management',
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
        const subIntent = parameters.shoppingSubIntent;

        if (subIntent === 'product_search') {
          // Check for multi-product queries first, fall back to single
          if (parameters.productQueries && parameters.productQueries.length > 0) {
            shoppingScore += 0.6;
            // Bonus for multiple products properly extracted
            if (parameters.productQueries.length > 1) shoppingScore += 0.1;
          } else if (parameters.productQuery) {
            shoppingScore += 0.6;
          }
          if (parameters.quantity) shoppingScore += 0.2;
          if (parameters.deliveryPreferences || parameters.priceRange) shoppingScore += 0.2;
        } else if (subIntent === 'product_selection') {
          if (parameters.selectedProductIds && parameters.selectedProductIds.length > 0) shoppingScore += 1.0;
        } else if (subIntent === 'order_status') {
          if (parameters.referenceId) shoppingScore += 1.0;
          else shoppingScore += 0.5; // Can still look up recent orders
        } else {
          // Generic shopping intent
          if (parameters.productQuery) shoppingScore += 0.6;
          if (parameters.quantity) shoppingScore += 0.2;
          if (parameters.deliveryPreferences) shoppingScore += 0.2;
        }
        
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

      case 'blocklist_management':
        let blocklistScore = 0;
        if (parameters.blocklistAction) blocklistScore += 0.5;
        if (parameters.targetEmail) blocklistScore += 0.5;
        else if (parameters.targetName) blocklistScore += 0.3;
        return blocklistScore;

      case 'contact_management':
        let contactScore = 0;
        if (parameters.contactAction) contactScore += 0.4;
        if (parameters.contactAction === 'list') {
          contactScore += 0.6; // List action is complete by itself
        } else if (parameters.contactAction === 'add') {
          if (parameters.newName) contactScore += 0.3;
          if (parameters.email) contactScore += 0.3;
        } else if (parameters.contactAction === 'update') {
          if (parameters.currentName) contactScore += 0.3;
          if (parameters.newName || parameters.note || parameters.email) contactScore += 0.3;
        } else if (parameters.contactAction === 'delete') {
          if (parameters.currentName) contactScore += 0.6;
        }
        return contactScore;

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
      reply: 'Contains circled options or reference to previous communication',
      blocklist_management: 'Contains block/unblock keywords and email address',
      contact_management: 'Contains contact management keywords (add/update/delete/list)'
    };
    return reasons[intent] || 'Pattern match detected';
  }
}

// Export singleton instance
export const intentExtractor = new IntentExtractor();