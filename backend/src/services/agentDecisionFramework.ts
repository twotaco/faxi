import {
  DecisionContext,
  WorkflowStep,
  AgentRequest,
  UserProfile,
  PaymentMethod,
  Order,
  Contact
} from '../types/agent';
import { InterpretationResult } from '../types/vision';
import { auditLogService } from './auditLogService';

/**
 * Agent Decision Framework - Implements the core logic for minimizing round-trips
 * 
 * This service analyzes user requests and determines the optimal workflow strategy
 * based on the design principles of proactive completion and bundling.
 */
export class AgentDecisionFramework {

  /**
   * Analyze a request and determine if it can be completed immediately
   */
  async canCompleteImmediately(context: DecisionContext): Promise<boolean> {
    const { interpretation } = context;

    switch (interpretation.intent) {
      case 'email':
        return this.canCompleteEmailImmediately(context);
      
      case 'shopping':
        return this.canCompleteShoppingImmediately(context);
      
      case 'ai_chat':
        return this.canCompleteAIChatImmediately(context);
      
      case 'payment_registration':
        return false; // Always requires user input for security
      
      case 'reply':
        return this.canCompleteReplyImmediately(context);
      
      default:
        return false;
    }
  }

  /**
   * Determine if email can be sent immediately
   */
  private canCompleteEmailImmediately(context: DecisionContext): boolean {
    const params = context.interpretation.parameters;
    
    // Can complete if we have recipient and message
    const hasRecipient = !!(params.recipientEmail || 
      (params.recipientName && context.addressBook?.some(c => 
        c.name.toLowerCase().includes(params.recipientName!.toLowerCase())
      )));
    
    const hasMessage = !!(params.body && params.body.trim().length > 0);
    
    return hasRecipient && hasMessage;
  }

  /**
   * Determine if shopping can be completed immediately
   */
  private canCompleteShoppingImmediately(context: DecisionContext): boolean {
    const params = context.interpretation.parameters;
    
    // Can complete if user selected specific products and has payment method
    const hasSpecificSelection = !!(params.selectedProductIds && params.selectedProductIds.length > 0);
    const hasPaymentMethod = !!(context.paymentMethods && context.paymentMethods.length > 0);
    
    return hasSpecificSelection && hasPaymentMethod;
  }

  /**
   * Determine if AI chat can be completed immediately
   */
  private canCompleteAIChatImmediately(context: DecisionContext): boolean {
    const params = context.interpretation.parameters;
    
    // Can complete if we have a clear question
    return !!(params.question && params.question.trim().length > 0);
  }

  /**
   * Determine if reply can be processed immediately
   */
  private canCompleteReplyImmediately(context: DecisionContext): boolean {
    const params = context.interpretation.parameters;
    
    // Can complete if we have clear selections or reference ID
    return !!(context.interpretation.referenceId && 
      (params.selectedOptions?.length || params.freeformText));
  }

  /**
   * Create bundling strategy for multiple requests
   */
  async createBundlingStrategy(requests: InterpretationResult[]): Promise<WorkflowStep[]> {
    const workflow: WorkflowStep[] = [];
    const bundleId = `bundle_${Date.now()}`;

    // Group requests by type for efficient processing
    const emailRequests = requests.filter(r => r.intent === 'email');
    const shoppingRequests = requests.filter(r => r.intent === 'shopping');
    const chatRequests = requests.filter(r => r.intent === 'ai_chat');

    // Process emails first (fastest)
    if (emailRequests.length > 0) {
      workflow.push({
        id: `${bundleId}_emails`,
        type: 'tool_call',
        description: `Process ${emailRequests.length} email requests`,
        toolCall: {
          server: 'email',
          tool: 'send_bulk_emails',
          input: {
            emails: emailRequests.map(req => ({
              to: req.parameters.recipientEmail || req.parameters.recipientName,
              subject: req.parameters.subject || 'Message from Faxi',
              body: req.parameters.body || ''
            }))
          }
        }
      });
    }

    // Process shopping requests with bundling
    if (shoppingRequests.length > 0) {
      workflow.push({
        id: `${bundleId}_shopping`,
        type: 'tool_call',
        description: `Process ${shoppingRequests.length} shopping requests`,
        toolCall: {
          server: 'shopping',
          tool: 'search_multiple_products',
          input: {
            queries: shoppingRequests.map(req => req.parameters.productQuery).filter(Boolean)
          }
        }
      });

      // Add complementary products step
      workflow.push({
        id: `${bundleId}_complementary`,
        type: 'tool_call',
        description: 'Find complementary products for bundle deals',
        dependencies: [`${bundleId}_shopping`],
        toolCall: {
          server: 'shopping',
          tool: 'get_bundle_deals',
          input: {
            productQueries: shoppingRequests.map(req => req.parameters.productQuery).filter(Boolean)
          }
        }
      });
    }

    // Process AI chat requests
    if (chatRequests.length > 0) {
      workflow.push({
        id: `${bundleId}_chat`,
        type: 'tool_call',
        description: `Process ${chatRequests.length} AI chat requests`,
        toolCall: {
          server: 'ai_chat',
          tool: 'batch_chat',
          input: {
            messages: chatRequests.map(req => req.parameters.question).filter(Boolean)
          }
        }
      });
    }

    return workflow;
  }

  /**
   * Generate proactive suggestions based on user intent
   */
  async generateProactiveSuggestions(context: DecisionContext): Promise<any[]> {
    const { interpretation } = context;
    const suggestions: any[] = [];

    switch (interpretation.intent) {
      case 'shopping':
        return this.generateShoppingSuggestions(context);
      
      case 'email':
        return this.generateEmailSuggestions(context);
      
      case 'ai_chat':
        return this.generateChatSuggestions(context);
      
      default:
        return suggestions;
    }
  }

  /**
   * Generate shopping-related proactive suggestions
   */
  private async generateShoppingSuggestions(context: DecisionContext): Promise<any[]> {
    const params = context.interpretation.parameters;
    const suggestions: any[] = [];

    if (!params.productQuery) return suggestions;

    // Common complementary items based on product type
    const complementaryMap: Record<string, string[]> = {
      'flashlight': ['batteries', 'battery tester', 'carrying case'],
      'coffee maker': ['coffee filters', 'coffee beans', 'descaler'],
      'shampoo': ['conditioner', 'hair treatment', 'shower cap'],
      'toilet paper': ['hand soap', 'tissues', 'wet wipes'],
      'batteries': ['battery tester', 'flashlight', 'remote control'],
      'phone': ['phone case', 'screen protector', 'charger'],
      'laptop': ['laptop bag', 'mouse', 'keyboard', 'screen cleaner'],
      'book': ['bookmark', 'reading light', 'book stand'],
      'vitamins': ['pill organizer', 'water bottle', 'health tracker']
    };

    // Find matching complementary items
    const query = params.productQuery.toLowerCase();
    for (const [product, complements] of Object.entries(complementaryMap)) {
      if (query.includes(product)) {
        suggestions.push({
          type: 'complementary_items',
          items: complements.slice(0, 3), // Limit to 3 suggestions
          reason: `Customers who buy ${product} often also need these items`
        });
        break;
      }
    }

    // Suggest bulk buying for consumables
    const consumables = ['batteries', 'toilet paper', 'tissues', 'soap', 'shampoo'];
    if (consumables.some(item => query.includes(item))) {
      suggestions.push({
        type: 'bulk_discount',
        message: 'Buy in bulk and save up to 20%',
        minQuantity: 3
      });
    }

    // Payment method suggestion if none on file
    if (!context.paymentMethods || context.paymentMethods.length === 0) {
      suggestions.push({
        type: 'payment_setup',
        message: 'Register a payment method for faster checkout',
        options: ['credit_card', 'convenience_store']
      });
    }

    return suggestions;
  }

  /**
   * Generate email-related proactive suggestions
   */
  private async generateEmailSuggestions(context: DecisionContext): Promise<any[]> {
    const params = context.interpretation.parameters;
    const suggestions: any[] = [];

    // Suggest adding to address book if recipient not found
    if (params.recipientEmail && !context.addressBook?.some(c => c.email === params.recipientEmail)) {
      suggestions.push({
        type: 'add_to_address_book',
        email: params.recipientEmail,
        message: 'Add this contact to your address book for easier future emails'
      });
    }

    // Suggest common email templates
    if (!params.body || params.body.length < 10) {
      suggestions.push({
        type: 'email_templates',
        templates: [
          'Thank you for your message',
          'I received your email and will respond soon',
          'Please call me when you have a chance'
        ]
      });
    }

    return suggestions;
  }

  /**
   * Generate AI chat-related proactive suggestions
   */
  private async generateChatSuggestions(context: DecisionContext): Promise<any[]> {
    const suggestions: any[] = [];

    // Suggest follow-up questions based on topic
    const params = context.interpretation.parameters;
    if (params.question) {
      const question = params.question.toLowerCase();
      
      if (question.includes('weather')) {
        suggestions.push({
          type: 'follow_up_questions',
          questions: [
            'Would you like the 7-day forecast?',
            'Do you need weather for a specific location?'
          ]
        });
      } else if (question.includes('recipe') || question.includes('cooking')) {
        suggestions.push({
          type: 'follow_up_questions',
          questions: [
            'Would you like ingredient substitutions?',
            'Do you need cooking time adjustments?'
          ]
        });
      }
    }

    return suggestions;
  }

  /**
   * Check payment methods and determine barcode generation strategy
   */
  async determinePaymentStrategy(context: DecisionContext): Promise<{
    strategy: 'charge_on_file' | 'generate_barcodes' | 'mixed';
    hasPaymentMethod: boolean;
    shouldGenerateBarcodes: boolean;
    recommendRegistration: boolean;
  }> {
    const hasPaymentMethod = !!(context.paymentMethods && context.paymentMethods.length > 0);
    
    if (hasPaymentMethod) {
      return {
        strategy: 'charge_on_file',
        hasPaymentMethod: true,
        shouldGenerateBarcodes: false,
        recommendRegistration: false
      };
    }

    // No payment method - generate barcodes for convenience store payment
    return {
      strategy: 'generate_barcodes',
      hasPaymentMethod: false,
      shouldGenerateBarcodes: true,
      recommendRegistration: true
    };
  }

  /**
   * Create multi-step workflow orchestration
   */
  async createMultiStepWorkflow(context: DecisionContext): Promise<WorkflowStep[]> {
    const workflow: WorkflowStep[] = [];
    const { interpretation } = context;

    // Step 1: Gather user context (always first)
    workflow.push({
      id: 'gather_context',
      type: 'tool_call',
      description: 'Gather user profile and preferences',
      toolCall: {
        server: 'user_profile',
        tool: 'get_user_profile',
        input: { userId: context.userId }
      }
    });

    // Step 2: Intent-specific workflow
    const intentWorkflow = await this.createIntentSpecificWorkflow(context);
    workflow.push(...intentWorkflow);

    // Step 3: Generate proactive suggestions
    workflow.push({
      id: 'generate_suggestions',
      type: 'tool_call',
      description: 'Generate proactive suggestions',
      dependencies: ['gather_context'],
      toolCall: {
        server: 'user_profile',
        tool: 'generate_suggestions',
        input: {
          userId: context.userId,
          intent: interpretation.intent,
          parameters: interpretation.parameters
        }
      }
    });

    // Step 4: Determine payment strategy (for shopping)
    if (interpretation.intent === 'shopping') {
      workflow.push({
        id: 'payment_strategy',
        type: 'tool_call',
        description: 'Determine optimal payment strategy',
        dependencies: ['gather_context'],
        toolCall: {
          server: 'payment',
          tool: 'get_payment_methods',
          input: { userId: context.userId }
        }
      });
    }

    return workflow;
  }

  /**
   * Create intent-specific workflow steps
   */
  private async createIntentSpecificWorkflow(context: DecisionContext): Promise<WorkflowStep[]> {
    const { interpretation } = context;

    switch (interpretation.intent) {
      case 'email':
        return this.createEmailWorkflowSteps(context);
      
      case 'shopping':
        return this.createShoppingWorkflowSteps(context);
      
      case 'ai_chat':
        return this.createAIChatWorkflowSteps(context);
      
      case 'payment_registration':
        return this.createPaymentWorkflowSteps(context);
      
      case 'reply':
        return this.createReplyWorkflowSteps(context);
      
      default:
        return [];
    }
  }

  /**
   * Create email-specific workflow steps
   */
  private createEmailWorkflowSteps(context: DecisionContext): WorkflowStep[] {
    const params = context.interpretation.parameters;
    const workflow: WorkflowStep[] = [];

    // Resolve recipient if needed
    if (params.recipientName && !params.recipientEmail) {
      workflow.push({
        id: 'resolve_recipient',
        type: 'tool_call',
        description: 'Look up recipient email address',
        toolCall: {
          server: 'email',
          tool: 'lookup_contact',
          input: { 
            name: params.recipientName,
            userId: context.userId 
          }
        }
      });
    }

    // Send email
    workflow.push({
      id: 'send_email',
      type: 'tool_call',
      description: 'Send email to recipient',
      dependencies: params.recipientName ? ['resolve_recipient'] : undefined,
      toolCall: {
        server: 'email',
        tool: 'send_email',
        input: {
          to: params.recipientEmail,
          subject: params.subject || 'Message from Faxi',
          body: params.body || '',
          userId: context.userId
        }
      }
    });

    return workflow;
  }

  /**
   * Create shopping-specific workflow steps
   */
  private createShoppingWorkflowSteps(context: DecisionContext): WorkflowStep[] {
    const params = context.interpretation.parameters;
    const workflow: WorkflowStep[] = [];

    // Search for products
    if (params.productQuery) {
      workflow.push({
        id: 'search_products',
        type: 'tool_call',
        description: 'Search for requested products',
        toolCall: {
          server: 'shopping',
          tool: 'search_products',
          input: {
            query: params.productQuery,
            maxResults: 5
          }
        }
      });

      // Get complementary products
      workflow.push({
        id: 'get_complementary',
        type: 'tool_call',
        description: 'Find complementary products',
        dependencies: ['search_products'],
        toolCall: {
          server: 'shopping',
          tool: 'get_complementary_products',
          input: {
            query: params.productQuery,
            maxResults: 3
          }
        }
      });
    }

    // If user already selected products, add to cart and checkout
    if (params.selectedProductIds && params.selectedProductIds.length > 0) {
      workflow.push({
        id: 'add_to_cart',
        type: 'tool_call',
        description: 'Add selected products to cart',
        toolCall: {
          server: 'shopping',
          tool: 'add_to_cart',
          input: {
            productIds: params.selectedProductIds,
            quantities: Array(params.selectedProductIds.length).fill(params.quantity || 1),
            userId: context.userId
          }
        }
      });

      workflow.push({
        id: 'checkout',
        type: 'tool_call',
        description: 'Complete purchase',
        dependencies: ['add_to_cart', 'payment_strategy'],
        toolCall: {
          server: 'shopping',
          tool: 'checkout',
          input: {
            userId: context.userId,
            deliveryAddress: context.userProfile?.deliveryAddress
          }
        }
      });
    }

    return workflow;
  }

  /**
   * Create AI chat workflow steps
   */
  private createAIChatWorkflowSteps(context: DecisionContext): WorkflowStep[] {
    const params = context.interpretation.parameters;

    return [{
      id: 'ai_chat',
      type: 'tool_call',
      description: 'Process AI chat request',
      toolCall: {
        server: 'ai_chat',
        tool: 'chat',
        input: {
          message: params.question || '',
          conversationId: params.conversationId,
          userId: context.userId
        }
      }
    }];
  }

  /**
   * Create payment registration workflow steps
   */
  private createPaymentWorkflowSteps(context: DecisionContext): WorkflowStep[] {
    return [{
      id: 'register_payment',
      type: 'tool_call',
      description: 'Register new payment method',
      toolCall: {
        server: 'payment',
        tool: 'register_payment_method',
        input: {
          userId: context.userId,
          type: context.interpretation.parameters.paymentMethod || 'credit_card'
        }
      }
    }];
  }

  /**
   * Create reply processing workflow steps
   */
  private createReplyWorkflowSteps(context: DecisionContext): WorkflowStep[] {
    const params = context.interpretation.parameters;

    return [{
      id: 'process_reply',
      type: 'tool_call',
      description: 'Process form reply',
      toolCall: {
        server: 'user_profile',
        tool: 'process_form_reply',
        input: {
          referenceId: context.interpretation.referenceId,
          selectedOptions: params.selectedOptions || [],
          freeformText: params.freeformText,
          userId: context.userId
        }
      }
    }];
  }

  /**
   * Log decision reasoning for audit purposes
   */
  async logDecisionReasoning(
    context: DecisionContext, 
    decision: string, 
    reasoning: string
  ): Promise<void> {
    await auditLogService.logOperation({
      entityType: 'agent_decision',
      entityId: context.userId,
      operation: 'decision_made',
      details: {
        intent: context.interpretation.intent,
        confidence: context.interpretation.confidence,
        decision,
        reasoning,
        hasPaymentMethod: !!(context.paymentMethods?.length),
        hasAddressBook: !!(context.addressBook?.length)
      }
    });
  }
}

// Export singleton instance
export const agentDecisionFramework = new AgentDecisionFramework();