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
  context?: ConversationContext; // Recovered conversation context
  // Enhanced visualization data for demo
  processingTime?: number; // Processing time in milliseconds
  textRegions?: TextRegion[]; // Detected text regions with coordinates
  visualizationData?: VisualizationData; // Complete visualization data
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
  color?: string; // Color code for visualization overlay
}

export interface TextRegion {
  text: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  type: 'printed' | 'handwritten';
}

export interface DetectedRegion {
  type: 'text' | 'annotation' | 'form-field' | 'signature';
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  label: string;
  confidence: number;
  color: string; // For overlay rendering
}

export interface VisualizationData {
  annotatedImageUrl?: string; // Image with overlays (optional)
  regions: DetectedRegion[];
}

export interface ContextRecoveryResult {
  method: 'reference_id' | 'template_pattern' | 'content_similarity' | 'temporal_proximity' | 'none';
  matchedContextId?: string;
  confidence: number;
  ambiguousMatches?: string[]; // Multiple possible contexts
}

// FaxTemplate is defined in fax.ts