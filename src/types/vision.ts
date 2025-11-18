// Types for AI Vision Interpreter

export interface InterpretationRequest {
  imageUrl?: string;
  imageData?: Buffer;
  context?: ConversationContext;
  userId?: string;
}

export interface ConversationContext {
  id: string;
  userId: string;
  referenceId: string;
  contextType: string;
  contextData: any;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterpretationResult {
  intent: 'email' | 'shopping' | 'ai_chat' | 'payment_registration' | 'reply' | 'unknown';
  confidence: number; // 0-1
  parameters: IntentParameters;
  visualAnnotations?: VisualAnnotation[];
  requiresClarification: boolean;
  clarificationQuestion?: string;
  extractedText?: string;
  referenceId?: string; // Extracted from fax
  contextRecovery?: ContextRecoveryResult;
}

export interface IntentParameters {
  // Email intent
  recipientEmail?: string;
  recipientName?: string; // For address book lookup
  subject?: string;
  body?: string;
  
  // Shopping intent
  productQuery?: string;
  selectedProductIds?: string[]; // From circled/checked items
  quantity?: number;
  deliveryPreferences?: string;
  
  // AI chat intent
  question?: string;
  conversationId?: string;
  
  // Payment intent
  paymentMethod?: 'credit_card' | 'convenience_store';
  cardDetails?: string; // Masked for security
  
  // Reply intent (for form responses)
  selectedOptions?: string[]; // Circled options like A, B, C
  freeformText?: string; // Handwritten additional text
}

export interface VisualAnnotation {
  type: 'circle' | 'checkmark' | 'underline' | 'arrow' | 'checkbox';
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  associatedText?: string;
  confidence: number;
}

export interface ContextRecoveryResult {
  method: 'reference_id' | 'template_pattern' | 'content_similarity' | 'temporal_proximity' | 'none';
  matchedContextId?: string;
  confidence: number;
  ambiguousMatches?: string[]; // Multiple possible contexts
}

export interface FaxTemplate {
  type: 'email_reply' | 'product_selection' | 'payment_barcodes' | 'confirmation' | 'multi_action' | 'clarification';
  referenceId: string;
  hasReplyForm: boolean;
  expectedSelections?: string[]; // Expected option letters/numbers
  contextData?: Record<string, any>;
}