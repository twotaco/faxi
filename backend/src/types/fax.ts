export interface FaxTemplate {
  type: 'email_reply' | 'product_selection' | 'payment_barcodes' | 'confirmation' | 'multi_action' | 'clarification' | 'welcome' | 'appointment_selection' | 'general_inquiry';
  referenceId: string; // FX-YYYY-NNNNNN format
  pages: FaxPage[];
  contextData: any; // Data needed to process reply (thread IDs, product IDs, etc.)
  metadata?: TemplateMetadata; // NEW: Template metadata
}

export interface TemplateMetadata {
  mcpServer: string;
  intent?: string;
  generatedAt: Date;
  expiresAt?: Date;
  version: string;
}

export interface FaxPage {
  content: FaxContent[];
  pageNumber: number;
  totalPages: number;
}

export interface FaxContent {
  type: 'text' | 'checkbox' | 'circle_option' | 'barcode' | 'blank_space' | 'header' | 'footer' | 'image'; // Added 'image'
  text?: string;
  fontSize?: number;
  bold?: boolean;
  alignment?: 'left' | 'center' | 'right';
  marginTop?: number;
  marginBottom?: number;
  options?: CircleOption[];
  barcodeData?: BarcodeData;
  height?: number; // For blank spaces
  imageData?: ImageContent; // NEW: Image support
}

export interface ImageContent {
  url?: string;           // Download from URL
  buffer?: Buffer;        // Pre-loaded image buffer
  width: number;
  height: number;
  alignment?: 'left' | 'center' | 'right';
  caption?: string;
  fallbackText?: string;  // Text to show if image fails
}

export interface CircleOption {
  id: string;
  label: string;
  text: string;
  price?: number;
  currency?: string;
  optional?: boolean;
}

export interface BarcodeData {
  data: string;
  format: 'CODE128' | 'QR';
  width?: number;
  height?: number;
  displayValue?: boolean;
}

export interface EmailReplyData {
  from: string;
  subject: string;
  body: string;
  threadId?: string;
  hasQuickReplies?: boolean;
  quickReplies?: string[];
  attachmentCount?: number;
}

export interface ProductSelectionData {
  products: ProductOption[];
  complementaryItems?: ProductOption[];
  hasPaymentMethod: boolean;
  deliveryAddress?: string;
}

export interface ProductOption {
  id: string;
  name: string;
  price: number;
  currency: string;
  description: string;
  estimatedDelivery?: string;
  imageUrl?: string;
}

export interface PaymentBarcodeData {
  products: ProductOption[];
  barcodes: PaymentBarcode[];
  expirationDate: Date;
  instructions: string;
}

export interface PaymentBarcode {
  productId: string;
  barcodeData: string;
  amount: number;
  currency: string;
}

export interface ConfirmationData {
  type: 'order' | 'email' | 'general';
  orderId?: string;
  trackingNumber?: string;
  emailRecipient?: string;
  message: string;
  details?: any;
}

export interface ClarificationData {
  question: string;
  requiredInfo: string[];
  recentConversations?: RecentConversation[];
  supportContact: string;
}

export interface RecentConversation {
  referenceId: string;
  topic: string;
  daysAgo: number;
}

export interface FaxGenerationOptions {
  dpi: number;
  width: number;
  height: number;
  backgroundColor: string;
  textColor: string;
  defaultFontSize: number;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}
export
 interface AppointmentSelectionTemplateData {
  serviceName: string;
  provider: string;
  location?: string;
  slots: AppointmentSlot[];
}

export interface AppointmentSlot {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  duration: number;          // minutes
  available: boolean;
  selectionMarker: string;   // A, B, C, etc.
}

export interface GeneralInquiryTemplateData {
  question: string;
  answer: string;
  images?: ImageReference[];
  relatedTopics?: string[];
}

export interface ImageReference {
  url: string;
  caption?: string;
  position: 'inline' | 'end';
}
