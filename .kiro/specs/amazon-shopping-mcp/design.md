# Amazon.co.jp Proxy Shopping Service - Design Document

## Overview

This design document specifies the technical architecture for Faxi's proxy shopping service, enabling elderly users to purchase products from Amazon.co.jp via fax. The system combines Amazon's Product Advertising API for product discovery with semi-automated browser interaction for order fulfillment, maintaining human oversight to ensure compliance with Amazon's Terms of Service.

### Key Design Principles

1. **Human-in-the-Loop**: All purchases require explicit admin confirmation
2. **Compliance First**: Use official APIs where available; automate only preparation steps
3. **Payment Security**: Leverage Stripe for PCI DSS compliance and automatic reconciliation
4. **User Experience**: Minimize fax exchanges while maintaining clarity
5. **Auditability**: Log all transactions for compliance and dispute resolution

## Architecture

### High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Faxi Core System                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐         ┌──────────────────┐               │
│  │ AI Vision      │────────▶│ MCP Controller   │               │
│  │ Interpreter    │         │ Agent            │               │
│  └────────────────┘         └────────┬─────────┘               │
│                                      │                          │
│                                      ▼                          │
│                          ┌──────────────────────┐              │
│                          │ Shopping MCP Server  │              │
│                          └──────────┬───────────┘              │
│                                     │                           │
│         ┌───────────────────────────┼───────────────────────┐  │
│         │                           │                       │  │
│         ▼                           ▼                       ▼  │
│  ┌─────────────┐          ┌──────────────┐      ┌──────────────┐
│  │ Product     │          │ Order        │      │ Payment      │
│  │ Search      │          │ Management   │      │ Processing   │
│  │ Service     │          │ Service      │      │ Service      │
│  └──────┬──────┘          └──────┬───────┘      └──────┬───────┘
│         │                        │                     │        │
└─────────┼────────────────────────┼─────────────────────┼────────┘
          │                        │                     │
          ▼                        ▼                     ▼
┌─────────────────┐    ┌──────────────────┐   ┌──────────────────┐
│ Amazon PA-API   │    │ PostgreSQL       │   │ Stripe API       │
│ (Product Search)│    │ (Orders, Users)  │   │ (Payments)       │
└─────────────────┘    └──────────────────┘   └──────────────────┘

          ┌────────────────────────────────────────┐
          │      Admin Dashboard (Next.js)         │
          ├────────────────────────────────────────┤
          │  - Pending Purchase Queue              │
          │  - Price & Stock Validation            │
          │  - Browser Automation Trigger          │
          │  - Manual Purchase Completion          │
          └────────────────────────────────────────┘
                          │
                          ▼
                ┌──────────────────┐
                │ Playwright       │
                │ (Checkout Prep)  │
                └──────────────────┘
```

### Request Flow Sequence

#### 1. Product Search Flow

```
User Fax → AI Vision → Intent Extraction → Shopping MCP Server
                                                    │
                                                    ▼
                                          PA-API Product Search
                                                    │
                                                    ▼
                                          LLM Product Curation
                                                    │
                                                    ▼
                                          Response Generator
                                                    │
                                                    ▼
                                          Product Options Fax → User
```

#### 2. Order Placement Flow

```
User Selection Fax → Visual Annotation Detection → Order Creation
                                                          │
                                                          ▼
                                                  Payment Intent
                                                          │
                                    ┌─────────────────────┴─────────────────────┐
                                    ▼                                           ▼
                            Card on File                              Bank Transfer
                            Auto-charge                               Instructions Fax
                                    │                                           │
                                    └─────────────────────┬─────────────────────┘
                                                          │
                                                          ▼
                                                  Stripe Webhook
                                                          │
                                                          ▼
                                                  Order Status: "paid"
                                                          │
                                                          ▼
                                                  Admin Dashboard Queue
```

#### 3. Purchase Fulfillment Flow

```
Admin Dashboard → Price Validation → Stock Check → Browser Automation
                                                            │
                                                            ▼
                                                  Amazon Checkout Prep
                                                            │
                                                            ▼
                                                  Admin Manual Review
                                                            │
                                                            ▼
                                                  Place Order (Human)
                                                            │
                                                            ▼
                                                  Capture Order ID
                                                            │
                                                            ▼
                                                  Confirmation Fax → User
```

## Components and Interfaces

### 1. Shopping MCP Server

**Purpose**: Orchestrate shopping operations including product search, order management, and status tracking.

**Location**: `backend/src/mcp/shoppingMcpServer.ts`

**MCP Tools**:

```typescript
interface ShoppingMCPTools {
  // Product search
  search_products(query: string, filters?: SearchFilters): Promise<ProductSearchResult[]>;
  
  // Order management
  create_order(userId: string, productAsin: string, quantity: number): Promise<Order>;
  get_order_status(referenceId: string): Promise<OrderStatus>;
  list_user_orders(userId: string, limit?: number): Promise<Order[]>;
  
  // Product details
  get_product_details(asin: string): Promise<ProductDetails>;
}

interface SearchFilters {
  priceMin?: number;
  priceMax?: number;
  primeOnly?: boolean;
  minRating?: number;
  category?: string;
}
```

**Dependencies**:
- `ProductSearchService` for Playwright scraping and caching
- `ProductCacheService` for cache management
- `OrderRepository` for order persistence
- `PaymentService` for payment intent creation
- `ResponseGenerator` for fax generation

### 2. Product Search Service

**Purpose**: Scrape Amazon.co.jp using Playwright with intelligent caching.

**Location**: `backend/src/services/productSearchService.ts`

**Key Methods**:

```typescript
class ProductSearchService {
  /**
   * Search Amazon products (checks cache first, then scrapes if needed)
   */
  async searchProducts(
    query: string,
    filters: SearchFilters
  ): Promise<ScrapedProduct[]>;
  
  /**
   * Scrape Amazon search results page using Playwright
   */
  private async scrapeAmazonSearch(
    query: string,
    filters: SearchFilters
  ): Promise<ScrapedProduct[]>;
  
  /**
   * Parse product card from HTML element
   */
  private async parseProductCard(element: ElementHandle): Promise<ScrapedProduct>;
  
  /**
   * Get detailed product information (fresh scrape for price validation)
   */
  async getProductDetails(asin: string, forceFresh?: boolean): Promise<ProductDetails>;
  
  /**
   * Curate products using LLM
   */
  async curateProducts(
    products: ScrapedProduct[],
    userQuery: string,
    userPreferences?: UserPreferences
  ): Promise<CuratedProduct[]>;
  
  /**
   * Validate product availability and price (always fresh scrape)
   */
  async validateProduct(asin: string): Promise<ProductValidation>;
}
```

**Playwright Scraping Configuration**:

```typescript
interface ScrapingConfig {
  userAgent: string; // Realistic Chrome user agent
  viewport: { width: number; height: number };
  locale: 'ja-JP';
  timezone: 'Asia/Tokyo';
  headless: boolean; // false for production to avoid detection
  delayMin: number; // 150ms
  delayMax: number; // 600ms
  maxSearchesPerHour: number; // 30
  minDelayBetweenSearches: number; // 8000ms
  maxDelayBetweenSearches: number; // 15000ms
}

interface ScrapedProduct {
  asin: string;
  title: string;
  price: number;
  currency: 'JPY';
  primeEligible: boolean;
  rating: number;
  reviewCount: number;
  seller: string; // 'Amazon.co.jp' or third-party
  deliveryEstimate: string;
  imageUrl: string;
  productUrl: string;
  scrapedAt: Date;
}
```

### 3. Product Cache Service

**Purpose**: Manage cached product data to minimize scraping frequency.

**Location**: `backend/src/services/productCacheService.ts`

**Key Methods**:

```typescript
class ProductCacheService {
  /**
   * Get cached products for a search query
   */
  async getCachedSearch(
    query: string,
    filters: SearchFilters,
    maxAgeHours: number = 12
  ): Promise<ScrapedProduct[] | null>;
  
  /**
   * Store scraped products in cache
   */
  async cacheSearchResults(
    query: string,
    filters: SearchFilters,
    products: ScrapedProduct[]
  ): Promise<void>;
  
  /**
   * Get cached product details by ASIN
   */
  async getCachedProduct(
    asin: string,
    maxAgeHours: number = 12
  ): Promise<ScrapedProduct | null>;
  
  /**
   * Store individual product in cache
   */
  async cacheProduct(product: ScrapedProduct): Promise<void>;
  
  /**
   * Invalidate cache for specific ASIN (after price change detected)
   */
  async invalidateProduct(asin: string): Promise<void>;
  
  /**
   * Clean up expired cache entries
   */
  async cleanExpiredCache(): Promise<number>;
}
```

**Database Schema**:

```sql
CREATE TABLE IF NOT EXISTS product_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asin VARCHAR(20) NOT NULL,
  title VARCHAR(500) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'JPY',
  prime_eligible BOOLEAN NOT NULL,
  rating DECIMAL(2, 1),
  review_count INTEGER,
  seller VARCHAR(255),
  delivery_estimate VARCHAR(100),
  image_url TEXT,
  product_url TEXT NOT NULL,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_product_cache_asin ON product_cache(asin);
CREATE INDEX idx_product_cache_scraped_at ON product_cache(scraped_at);

-- Search cache table
CREATE TABLE IF NOT EXISTS product_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash VARCHAR(64) NOT NULL, -- MD5 of query + filters
  query_text VARCHAR(500) NOT NULL,
  filters JSONB,
  product_asins TEXT[] NOT NULL,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_search_cache_query_hash ON product_search_cache(query_hash);
CREATE INDEX idx_search_cache_scraped_at ON product_search_cache(scraped_at);
```

### 4. Order Management Service

**Purpose**: Handle order lifecycle from creation to delivery.

**Location**: `backend/src/services/orderManagementService.ts`

**Key Methods**:

```typescript
class OrderManagementService {
  /**
   * Create a new shopping order
   */
  async createOrder(data: CreateOrderData): Promise<Order>;
  
  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    metadata?: Record<string, any>
  ): Promise<Order>;
  
  /**
   * Get order by reference ID
   */
  async getOrderByReferenceId(referenceId: string): Promise<Order | null>;
  
  /**
   * List orders for admin review
   */
  async getPendingPurchaseOrders(): Promise<AdminOrderView[]>;
  
  /**
   * Validate order before purchase
   */
  async validateOrderForPurchase(orderId: string): Promise<OrderValidation>;
  
  /**
   * Complete purchase and capture Amazon order ID
   */
  async completePurchase(
    orderId: string,
    amazonOrderId: string,
    actualPrice: number
  ): Promise<Order>;
}

interface CreateOrderData {
  userId: string;
  referenceId: string;
  productAsin: string;
  productTitle: string;
  quantity: number;
  quotedPrice: number;
  shippingAddress: Address;
}

interface OrderValidation {
  valid: boolean;
  currentPrice: number;
  priceDifference: number;
  inStock: boolean;
  requiresApproval: boolean;
  warnings: string[];
}
```

### 4. Payment Service

**Purpose**: Handle payment processing via Stripe for both card and bank transfer.

**Location**: `backend/src/services/paymentService.ts`

**Key Methods**:

```typescript
class PaymentService {
  /**
   * Create payment intent for order
   */
  async createPaymentIntent(
    orderId: string,
    amount: number,
    paymentMethodId?: string
  ): Promise<Stripe.PaymentIntent>;
  
  /**
   * Charge saved payment method
   */
  async chargePaymentMethod(
    userId: string,
    amount: number,
    orderId: string
  ): Promise<Stripe.PaymentIntent>;
  
  /**
   * Create bank transfer payment intent
   */
  async createBankTransferIntent(
    orderId: string,
    amount: number
  ): Promise<BankTransferInstructions>;
  
  /**
   * Handle Stripe webhook for payment confirmation
   */
  async handlePaymentWebhook(
    event: Stripe.Event
  ): Promise<void>;
}

interface BankTransferInstructions {
  paymentIntentId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  referenceCode: string;
  expiresAt: Date;
}
```

### 5. Browser Automation Service

**Purpose**: Semi-automated checkout preparation using Playwright.

**Location**: `backend/src/services/browserAutomationService.ts`

**Key Methods**:

```typescript
class BrowserAutomationService {
  /**
   * Prepare Amazon checkout for admin review
   */
  async prepareCheckout(order: Order): Promise<CheckoutSession>;
  
  /**
   * Navigate to product and add to cart
   */
  private async addToCart(
    page: Page,
    asin: string,
    quantity: number
  ): Promise<void>;
  
  /**
   * Fill shipping address
   */
  private async fillShippingAddress(
    page: Page,
    address: Address
  ): Promise<void>;
  
  /**
   * Navigate to final review page (stop before Place Order)
   */
  private async navigateToReview(page: Page): Promise<void>;
  
  /**
   * Extract final price and details
   */
  private async extractCheckoutDetails(page: Page): Promise<CheckoutDetails>;
}

interface CheckoutSession {
  sessionId: string;
  browserContext: string; // Serialized browser context
  checkoutUrl: string;
  checkoutDetails: CheckoutDetails;
  expiresAt: Date;
}

interface CheckoutDetails {
  totalPrice: number;
  shippingCost: number;
  tax: number;
  estimatedDelivery: string;
  inStock: boolean;
}
```

### 6. Admin Order Controller

**Purpose**: API endpoints for admin dashboard order management.

**Location**: `backend/src/webhooks/adminOrderController.ts`

**Endpoints**:

```typescript
// GET /api/admin/orders/pending
// Returns list of orders ready for purchase
async getPendingOrders(req: Request, res: Response): Promise<void>;

// GET /api/admin/orders/:id
// Returns detailed order view with fax image and validation
async getOrderDetails(req: Request, res: Response): Promise<void>;

// POST /api/admin/orders/:id/prepare-checkout
// Triggers browser automation to prepare checkout
async prepareCheckout(req: Request, res: Response): Promise<void>;

// POST /api/admin/orders/:id/complete-purchase
// Records Amazon order ID and completes purchase
async completePurchase(req: Request, res: Response): Promise<void>;

// POST /api/admin/orders/:id/cancel
// Cancels order and refunds payment
async cancelOrder(req: Request, res: Response): Promise<void>;
```

## Data Models

### Database Schema Extensions

```sql
-- Add shopping-specific columns to existing orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_asin VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_title VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_image_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quoted_price DECIMAL(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_price DECIMAL(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_user_id UUID REFERENCES admin_users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMP WITH TIME ZONE;

-- Add index for pending purchase queue
CREATE INDEX IF NOT EXISTS idx_orders_status_paid 
ON orders(status) WHERE status = 'paid';

-- Add shopping context to conversation_contexts
-- context_type = 'shopping'
-- context_data structure:
{
  "searchQuery": "string",
  "searchResults": [
    {
      "asin": "string",
      "title": "string",
      "price": number,
      "selectionMarker": "A" | "B" | "C" | "D" | "E"
    }
  ],
  "selectedProduct": {
    "asin": "string",
    "selectionMarker": "string"
  }
}
```

### TypeScript Interfaces

```typescript
// Order with shopping details
interface ShoppingOrder extends Order {
  productAsin: string;
  productTitle: string;
  productImageUrl: string;
  quantity: number;
  quotedPrice: number;
  actualPrice: number | null;
  stripePaymentIntentId: string;
  adminUserId: string | null;
  purchasedAt: Date | null;
}

// Product from Playwright scraping
interface ScrapedProduct {
  asin: string;
  title: string;
  price: number;
  currency: 'JPY';
  primeEligible: boolean;
  rating: number;
  reviewCount: number;
  seller: string; // 'Amazon.co.jp' or third-party name
  deliveryEstimate: string;
  imageUrl: string;
  productUrl: string;
  scrapedAt: Date;
}

// Curated product for fax display
interface CuratedProduct {
  asin: string;
  title: string; // Truncated to 60 chars
  price: number;
  primeEligible: boolean;
  rating: number;
  deliveryEstimate: string;
  selectionMarker: 'A' | 'B' | 'C' | 'D' | 'E';
  imageUrl: string;
  reasoning: string; // Why this product was selected
}

// Admin order view
interface AdminOrderView {
  order: ShoppingOrder;
  user: {
    id: string;
    name: string;
    phoneNumber: string;
    email: string;
  };
  faxImage: {
    storageKey: string;
    thumbnailUrl: string;
    fullSizeUrl: string;
  };
  paymentStatus: {
    method: 'card' | 'bank_transfer';
    stripePaymentIntentId: string;
    status: 'pending' | 'succeeded' | 'failed';
    paidAt: Date | null;
  };
  priceValidation: {
    quotedPrice: number;
    currentPrice: number | null;
    discrepancy: number;
    discrepancyPercentage: number;
    requiresApproval: boolean;
  };
  stockStatus: {
    available: boolean;
    message: string;
    checkedAt: Date;
  };
  checkoutSession: CheckoutSession | null;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several areas where properties can be consolidated:

**Consolidated State Transition Properties**: Requirements 9.1-9.6 all test order status transitions. These can be combined into a single comprehensive property about the order lifecycle state machine.

**Consolidated Fax Generation Properties**: Requirements 2.4, 2.5, 5.1, 5.5 all test that status changes trigger fax generation with specific content. These can be combined into properties about fax generation completeness.

**Consolidated Audit Logging Properties**: Requirements 10.1-10.5 all test audit logging for different events. These can be combined into a single property about audit trail completeness.

**Consolidated Filtering Properties**: Requirements 1.4, 8.2 both test product filtering by rating. These are redundant and can be combined.

### Core Properties

#### Property 1: Product Search Result Count Bounds
*For any* product search query, the system SHALL return between 3 and 5 curated product options (inclusive).

**Validates: Requirements 1.3**

#### Property 2: Product Quality Filtering
*For any* product search results, all returned products SHALL be Prime-eligible with ratings of 3.5 stars or higher.

**Validates: Requirements 1.4, 8.1, 8.2**

#### Property 3: Product Title Truncation
*For any* product title in a generated fax, the formatted title SHALL be 60 characters or fewer.

**Validates: Requirements 8.5**

#### Property 4: Fax Content Completeness
*For any* Product Options Fax, each product SHALL include title, price in Japanese Yen, delivery estimate, and selection marker (A-E).

**Validates: Requirements 1.5**

#### Property 5: Order Initial State
*For any* newly created order, the order status SHALL be "pending_payment" and the order SHALL be associated with a valid Reference ID.

**Validates: Requirements 2.2, 2.3, 9.1**

#### Property 6: Payment Method Auto-Charge
*For any* user with a default payment method, order confirmation SHALL trigger automatic payment processing using that method.

**Validates: Requirements 3.1**

#### Property 7: Bank Transfer Fallback
*For any* user without a saved payment method, order creation SHALL generate a Stripe payment intent for bank transfer and include bank transfer instructions in the Order Confirmation Fax.

**Validates: Requirements 3.2, 3.3, 7.5**

#### Property 8: Payment Confirmation State Transition
*For any* payment confirmation webhook from Stripe, the corresponding order status SHALL transition to "paid".

**Validates: Requirements 3.5, 9.2**

#### Property 9: Order Status Lifecycle State Machine
*For any* order, status transitions SHALL follow the valid state machine: pending_payment → paid → pending_purchase → purchased → shipped → delivered. No invalid transitions SHALL occur.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**

#### Property 10: Price Discrepancy Highlighting
*For any* order where the current Amazon price differs from the quoted price by more than 50 Japanese Yen, the Admin Dashboard SHALL highlight the discrepancy and require approval.

**Validates: Requirements 6.3**

#### Property 11: Out-of-Stock Prevention
*For any* product that is out of stock, the Admin Dashboard SHALL display a warning and prevent purchase completion.

**Validates: Requirements 6.5**

#### Property 12: Payment Method Security
*For any* stored payment method, the database SHALL contain only the Stripe payment method ID and SHALL NOT contain raw card numbers or sensitive data.

**Validates: Requirements 7.2**

#### Property 13: Default Payment Method Uniqueness
*For any* user with multiple payment methods, exactly one payment method SHALL be marked as default.

**Validates: Requirements 7.3**

#### Property 14: Audit Log Completeness
*For any* order status change, product search, product selection, payment processing, or admin purchase action, an audit log entry SHALL be created with all required fields (event type, user ID, timestamp, and event-specific data).

**Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

#### Property 15: Reference ID Order Lookup
*For any* valid Reference ID, the system SHALL retrieve the correct order associated with that Reference ID.

**Validates: Requirements 5.3**

#### Property 16: Status Fax Content Completeness
*For any* order status request, the generated status fax SHALL contain current status, tracking number (if available), and estimated delivery date.

**Validates: Requirements 5.4**

#### Property 17: Tracking Number Persistence
*For any* tracking number update, the tracking number SHALL be stored in the order record and retrievable in subsequent queries.

**Validates: Requirements 5.2**

#### Property 18: Amazon.co.jp Seller Prioritization
*For any* curated product list, products sold by Amazon.co.jp SHALL appear before products from third-party sellers.

**Validates: Requirements 8.3**

#### Property 19: Price Range Diversity
*For any* curated product list with 3 or more products, the products SHALL include representation across at least two different price ranges (low, medium, or premium).

**Validates: Requirements 8.4**

## Error Handling

### Error Categories

#### 1. External Service Errors

**PA-API Errors**:
- Rate limiting (429): Implement exponential backoff, queue requests
- Authentication errors (401): Alert admin, check credentials
- Service unavailable (503): Retry with backoff, send error fax to user
- Invalid ASIN (404): Filter out invalid products, log warning

**Stripe Errors**:
- Payment declined: Send payment failure fax to user with instructions
- Insufficient funds: Send payment failure fax with alternative payment options
- Card expired: Notify user to update payment method
- Webhook signature invalid: Log security alert, reject webhook

**Browser Automation Errors**:
- Amazon UI changed: Alert admin, mark order for manual processing
- Session timeout: Retry with new session
- Product unavailable: Notify admin, send out-of-stock fax to user
- Captcha detected: Alert admin for manual intervention

#### 2. Data Validation Errors

**Order Creation**:
- Invalid ASIN: Reject order, send error fax
- Missing shipping address: Request address from user
- Invalid price: Reject order, log error

**Payment Processing**:
- Amount mismatch: Alert admin, prevent charge
- Duplicate payment intent: Use existing intent, prevent double-charge
- Invalid payment method: Request new payment method from user

#### 3. State Transition Errors

**Invalid Status Transitions**:
- Attempting to transition from "delivered" to "pending": Reject, log error
- Attempting to charge already-paid order: Prevent, log warning
- Attempting to purchase cancelled order: Reject, alert admin

### Error Recovery Strategies

```typescript
interface ErrorRecoveryStrategy {
  errorType: string;
  retryable: boolean;
  maxRetries: number;
  backoffStrategy: 'exponential' | 'linear' | 'none';
  fallbackAction: 'manual_review' | 'user_notification' | 'admin_alert';
  userNotification: boolean;
}

const errorStrategies: Record<string, ErrorRecoveryStrategy> = {
  'pa_api_rate_limit': {
    errorType: 'PA-API Rate Limit',
    retryable: true,
    maxRetries: 3,
    backoffStrategy: 'exponential',
    fallbackAction: 'user_notification',
    userNotification: true
  },
  'stripe_payment_declined': {
    errorType: 'Payment Declined',
    retryable: false,
    maxRetries: 0,
    backoffStrategy: 'none',
    fallbackAction: 'user_notification',
    userNotification: true
  },
  'browser_automation_failure': {
    errorType: 'Checkout Preparation Failed',
    retryable: true,
    maxRetries: 2,
    backoffStrategy: 'linear',
    fallbackAction: 'manual_review',
    userNotification: false
  },
  'product_out_of_stock': {
    errorType: 'Product Unavailable',
    retryable: false,
    maxRetries: 0,
    backoffStrategy: 'none',
    fallbackAction: 'user_notification',
    userNotification: true
  }
};
```

### Error Fax Templates

**Payment Failure Fax**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          お支払いエラー通知
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

参照番号: [Reference ID]
注文日時: [Order Date]

お支払いが完了できませんでした。

理由: [Error Reason]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          次のステップ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 別のお支払い方法をご利用ください
2. カード情報を更新してください
3. 銀行振込をご利用ください

お問い合わせ: 0120-XXX-XXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Product Unavailable Fax**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          商品在庫切れ通知
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

参照番号: [Reference ID]

申し訳ございません。
選択された商品は現在在庫切れです。

商品名: [Product Title]
ASIN: [ASIN]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          代替案
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 類似商品を検索する
2. 入荷待ちを希望する
3. 注文をキャンセルする

ご希望の番号を○で囲んでFAXしてください
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Testing Strategy

### Unit Testing

**Target Coverage**: 80% code coverage for core business logic

**Key Areas**:
- Product search and curation logic
- Order state machine transitions
- Payment processing workflows
- Fax content generation
- Price validation logic

**Testing Approach**:
- Mock external services (PA-API, Stripe, Playwright)
- Test individual service methods in isolation
- Verify error handling for each method
- Test edge cases (empty results, invalid inputs, boundary conditions)

**Example Unit Tests**:
```typescript
describe('ProductSearchService', () => {
  describe('curateProducts', () => {
    it('should return 3-5 products', async () => {
      const products = await service.curateProducts(mockProducts, 'shampoo');
      expect(products.length).toBeGreaterThanOrEqual(3);
      expect(products.length).toBeLessThanOrEqual(5);
    });
    
    it('should filter out products below 3.5 stars', async () => {
      const products = await service.curateProducts(mockProducts, 'shampoo');
      products.forEach(p => {
        expect(p.rating).toBeGreaterThanOrEqual(3.5);
      });
    });
    
    it('should truncate titles to 60 characters', async () => {
      const products = await service.curateProducts(mockProducts, 'shampoo');
      products.forEach(p => {
        expect(p.title.length).toBeLessThanOrEqual(60);
      });
    });
  });
});
```

### Property-Based Testing

**Framework**: fast-check (already used in the project)

**Configuration**: Minimum 100 iterations per property test

**Property Test Implementation**:

Each correctness property will be implemented as a property-based test. Tests will be tagged with comments referencing the design document.

**Example Property Tests**:

```typescript
import * as fc from 'fast-check';

describe('Shopping Service Properties', () => {
  /**
   * Feature: amazon-shopping-mcp, Property 1: Product Search Result Count Bounds
   * For any product search query, the system SHALL return between 3 and 5 curated product options
   */
  it('property: search results count is always 3-5', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }), // Random search query
        async (query) => {
          const results = await productSearchService.searchProducts(query, {});
          expect(results.length).toBeGreaterThanOrEqual(3);
          expect(results.length).toBeLessThanOrEqual(5);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: amazon-shopping-mcp, Property 2: Product Quality Filtering
   * For any product search results, all returned products SHALL be Prime-eligible with ratings >= 3.5
   */
  it('property: all products meet quality standards', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (query) => {
          const results = await productSearchService.searchProducts(query, {});
          results.forEach(product => {
            expect(product.primeEligible).toBe(true);
            expect(product.rating).toBeGreaterThanOrEqual(3.5);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: amazon-shopping-mcp, Property 9: Order Status Lifecycle State Machine
   * For any order, status transitions SHALL follow the valid state machine
   */
  it('property: order status transitions are valid', async () => {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      'pending_payment': ['paid', 'cancelled'],
      'paid': ['pending_purchase', 'cancelled'],
      'pending_purchase': ['purchased', 'cancelled'],
      'purchased': ['shipped', 'cancelled'],
      'shipped': ['delivered'],
      'delivered': [],
      'cancelled': []
    };

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...Object.keys(validTransitions) as OrderStatus[]),
        fc.constantFrom(...Object.keys(validTransitions) as OrderStatus[]),
        async (fromStatus, toStatus) => {
          const order = await createTestOrder({ status: fromStatus });
          
          const isValidTransition = validTransitions[fromStatus].includes(toStatus);
          
          if (isValidTransition) {
            await expect(
              orderManagementService.updateOrderStatus(order.id, toStatus)
            ).resolves.not.toThrow();
          } else {
            await expect(
              orderManagementService.updateOrderStatus(order.id, toStatus)
            ).rejects.toThrow('Invalid status transition');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: amazon-shopping-mcp, Property 13: Default Payment Method Uniqueness
   * For any user with multiple payment methods, exactly one SHALL be marked as default
   */
  it('property: exactly one default payment method per user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.array(fc.record({
          type: fc.constantFrom('card', 'bank_transfer'),
          stripePaymentMethodId: fc.uuid()
        }), { minLength: 2, maxLength: 5 }),
        async (userId, paymentMethods) => {
          // Create user and payment methods
          await createTestUser({ id: userId });
          for (const pm of paymentMethods) {
            await paymentMethodRepository.create({
              userId,
              ...pm
            });
          }
          
          // Set one as default
          const methods = await paymentMethodRepository.findByUserId(userId);
          await paymentMethodRepository.setAsDefault(methods[0].id);
          
          // Verify exactly one is default
          const allMethods = await paymentMethodRepository.findByUserId(userId);
          const defaultCount = allMethods.filter(m => m.isDefault).length;
          expect(defaultCount).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

**Scope**: Test complete workflows from fax receipt to order completion

**Key Integration Tests**:

1. **Complete Shopping Flow**:
   - Inbound fax with product request
   - Product search and curation
   - Product options fax generation
   - User selection detection
   - Order creation
   - Payment processing
   - Admin review
   - Purchase completion
   - Confirmation fax

2. **Payment Flows**:
   - Card on file auto-charge
   - Bank transfer with webhook
   - Payment failure handling

3. **Error Scenarios**:
   - Product out of stock
   - Price discrepancy
   - Payment declined
   - Browser automation failure

**Example Integration Test**:

```typescript
describe('Complete Shopping Flow Integration', () => {
  it('should complete end-to-end shopping flow with card payment', async () => {
    // 1. User sends product request fax
    const faxJob = await createInboundFax({
      content: 'I need shampoo',
      userId: testUser.id
    });
    
    // 2. Process fax and generate product options
    await faxProcessingPipeline.process(faxJob.id);
    
    // 3. Verify product options fax was sent
    const outboundFaxes = await faxJobRepository.findByUserId(testUser.id, 'outbound');
    expect(outboundFaxes).toHaveLength(1);
    expect(outboundFaxes[0].interpretation_result.intent).toBe('product_search');
    
    // 4. User selects product
    const selectionFax = await createInboundFax({
      content: 'circled option B',
      userId: testUser.id,
      referenceId: outboundFaxes[0].reference_id
    });
    
    // 5. Process selection and create order
    await faxProcessingPipeline.process(selectionFax.id);
    
    // 6. Verify order created with payment
    const orders = await orderRepository.findByUserId(testUser.id);
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe('paid'); // Auto-charged card on file
    
    // 7. Admin reviews and completes purchase
    const adminView = await orderManagementService.getPendingPurchaseOrders();
    expect(adminView).toHaveLength(1);
    
    await orderManagementService.completePurchase(
      orders[0].id,
      'AMAZON-ORDER-123',
      orders[0].quotedPrice
    );
    
    // 8. Verify confirmation fax sent
    const confirmationFaxes = await faxJobRepository.findByReferenceId(
      orders[0].referenceId,
      'outbound'
    );
    expect(confirmationFaxes.some(f => 
      f.interpretation_result?.intent === 'purchase_confirmation'
    )).toBe(true);
  });
});
```

### Manual Testing Checklist

**Admin Dashboard**:
- [ ] Pending purchase queue displays correctly
- [ ] Fax images load and display properly
- [ ] Price discrepancies are highlighted
- [ ] Out-of-stock warnings appear
- [ ] Browser automation trigger works
- [ ] Order completion captures Amazon Order ID
- [ ] Filters and sorting work correctly

**Fax Generation**:
- [ ] Product options fax is readable
- [ ] Selection markers are clear
- [ ] Prices are formatted correctly
- [ ] Japanese text renders properly
- [ ] Bank transfer instructions are complete

**Browser Automation**:
- [ ] Navigates to correct product page
- [ ] Adds product to cart successfully
- [ ] Fills shipping address correctly
- [ ] Stops before "Place Order" button
- [ ] Extracts final price accurately
- [ ] Handles Amazon UI variations

## Security Considerations

### Payment Data Security

1. **PCI DSS Compliance**:
   - Never store raw card numbers
   - Use Stripe for all payment processing
   - Store only Stripe payment method IDs
   - Implement tokenization for sensitive data

2. **Data Encryption**:
   - Encrypt payment method IDs at rest (AES-256)
   - Use TLS 1.3 for all API communications
   - Encrypt database backups

3. **Access Control**:
   - Role-based access control for admin dashboard
   - Require authentication for all admin endpoints
   - Log all admin actions for audit

### API Security

1. **Amazon PA-API**:
   - Store credentials in environment variables
   - Rotate access keys quarterly
   - Monitor for unauthorized usage
   - Implement rate limiting

2. **Stripe**:
   - Use webhook signatures for verification
   - Store webhook secrets securely
   - Implement idempotency for payment operations
   - Monitor for suspicious payment patterns

3. **Browser Automation**:
   - Use dedicated Amazon account for purchases
   - Implement session management
   - Clear cookies and cache after each session
   - Monitor for account suspension

### Data Privacy

1. **User Data**:
   - Minimize data collection
   - Implement data retention policies
   - Provide user data export/deletion
   - Comply with Japanese privacy laws

2. **Fax Images**:
   - Store fax images securely in S3
   - Implement access controls
   - Encrypt at rest and in transit
   - Automatic deletion after 90 days

3. **Audit Logs**:
   - Log all sensitive operations
   - Protect logs from tampering
   - Retain logs for compliance period
   - Implement log monitoring and alerting

## Performance Optimization

### Caching Strategy

```typescript
interface CacheStrategy {
  // Product search results cache
  productSearchCache: {
    ttl: 300, // 5 minutes
    key: (query: string, filters: SearchFilters) => string;
  };
  
  // Product details cache
  productDetailsCache: {
    ttl: 3600, // 1 hour
    key: (asin: string) => string;
  };
  
  // User payment methods cache
  paymentMethodsCache: {
    ttl: 1800, // 30 minutes
    key: (userId: string) => string;
    invalidateOn: ['payment_method_created', 'payment_method_updated'];
  };
}
```

### Database Optimization

1. **Indexes**:
   - `idx_orders_status_paid` for pending purchase queue
   - `idx_orders_user_id_status` for user order history
   - `idx_payment_methods_user_id_default` for default payment lookup

2. **Query Optimization**:
   - Use prepared statements
   - Implement connection pooling
   - Batch insert audit logs
   - Use EXPLAIN ANALYZE for slow queries

3. **Data Archival**:
   - Archive completed orders after 1 year
   - Archive audit logs after 2 years
   - Implement soft deletes for orders

### API Rate Limiting

```typescript
const rateLimits = {
  paApi: {
    requestsPerSecond: 1,
    requestsPerDay: 8640,
    burstSize: 5
  },
  stripe: {
    requestsPerSecond: 100,
    burstSize: 200
  },
  adminDashboard: {
    requestsPerMinute: 60,
    burstSize: 10
  }
};
```

## Deployment Considerations

### Environment Variables

```bash
# Amazon PA-API
PA_API_ACCESS_KEY=your_access_key
PA_API_SECRET_KEY=your_secret_key
PA_API_PARTNER_TAG=your_partner_tag

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Browser Automation
AMAZON_EMAIL=proxy@faxi.jp
AMAZON_PASSWORD=encrypted_password
SCRAPING_HEADLESS=true

# Feature Flags
ENABLE_SHOPPING_MCP=true
ENABLE_BROWSER_AUTOMATION=true
SHOPPING_MAX_PRICE_JPY=50000
```

### Monitoring and Alerts

**Key Metrics**:
- Product search success rate
- Order completion rate
- Payment success rate
- Browser automation success rate
- Average admin review time
- Price discrepancy frequency

**Alerts**:
- PA-API rate limit approaching
- Browser automation failure rate > 10%
- Payment failure rate > 5%
- Price discrepancy rate > 20%
- Admin review queue > 50 orders

### Rollout Strategy

**Phase 1: Internal Testing (Week 1-2)**
- Enable for Faxi staff accounts only
- Test all workflows manually
- Fix critical bugs

**Phase 2: Beta Testing (Week 3-4)**
- Enable for 10-20 selected users
- Monitor metrics closely
- Gather user feedback
- Iterate on UX

**Phase 3: Limited Release (Week 5-6)**
- Enable for 100 users
- Monitor system performance
- Scale infrastructure as needed
- Refine admin workflows

**Phase 4: General Availability (Week 7+)**
- Enable for all users
- Announce feature via fax
- Provide user documentation
- Monitor and optimize

## Future Enhancements

### Out of Scope for V1 (Potential V2 Features)

1. **Price Tracking**:
   - Monitor price changes for saved products
   - Send alerts when prices drop
   - Historical price charts

2. **Wishlist Management**:
   - Save products for later
   - Share wishlists with family
   - Automatic reorder reminders

3. **Product Recommendations**:
   - Personalized recommendations based on purchase history
   - "Frequently bought together" suggestions
   - Seasonal product suggestions

4. **Advanced Search**:
   - Search by image (send product photo via fax)
   - Brand-specific searches
   - Category browsing

5. **Multi-Marketplace Support**:
   - Amazon.com, Amazon.uk, etc.
   - Currency conversion
   - International shipping

6. **Subscription Orders**:
   - Subscribe & Save integration
   - Automatic recurring orders
   - Subscription management via fax

7. **Returns and Refunds**:
   - Automated return request processing
   - Return label generation
   - Refund tracking

8. **Gift Options**:
   - Gift wrapping selection
   - Gift messages
   - Direct shipping to recipients

## Appendix

### Playwright Scraping Selectors

```typescript
// Amazon.co.jp search results page selectors
const SELECTORS = {
  productCard: '[data-component-type="s-search-result"]',
  title: 'h2 a span',
  price: '.a-price .a-offscreen',
  primeBadge: 'i.a-icon-prime',
  rating: '.a-icon-star-small .a-icon-alt',
  reviewCount: '.a-size-base.s-underline-text',
  seller: '.a-size-base.a-color-secondary',
  deliveryText: '.a-color-base.a-text-bold',
  image: '.s-image',
  productLink: 'h2 a.a-link-normal'
};

// Example scraping code
async function scrapeSearchResults(page: Page, query: string): Promise<ScrapedProduct[]> {
  await page.goto(`https://www.amazon.co.jp/s?k=${encodeURIComponent(query)}`);
  await page.waitForSelector(SELECTORS.productCard);
  
  const productCards = await page.$$(SELECTORS.productCard);
  const products: ScrapedProduct[] = [];
  
  for (const card of productCards.slice(0, 10)) {
    const title = await card.$eval(SELECTORS.title, el => el.textContent?.trim());
    const priceText = await card.$eval(SELECTORS.price, el => el.textContent?.trim());
    const price = parseFloat(priceText?.replace(/[^0-9]/g, '') || '0');
    const asin = await card.getAttribute('data-asin');
    const primeEligible = await card.$(SELECTORS.primeBadge) !== null;
    const ratingText = await card.$eval(SELECTORS.rating, el => el.textContent);
    const rating = parseFloat(ratingText?.split(' ')[0] || '0');
    
    products.push({
      asin,
      title,
      price,
      currency: 'JPY',
      primeEligible,
      rating,
      // ... other fields
      scrapedAt: new Date()
    });
  }
  
  return products;
}
```

### Cached Product Example

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "asin": "B08N5WRWNW",
  "title": "パンテーン エクストラダメージケア シャンプー ポンプ 450mL",
  "price": 598,
  "currency": "JPY",
  "primeEligible": true,
  "rating": 4.3,
  "reviewCount": 1247,
  "seller": "Amazon.co.jp",
  "deliveryEstimate": "明日中にお届け",
  "imageUrl": "https://m.media-amazon.com/images/I/...",
  "productUrl": "https://www.amazon.co.jp/dp/B08N5WRWNW",
  "scrapedAt": "2025-11-30T10:30:00Z",
  "createdAt": "2025-11-30T10:30:00Z",
  "updatedAt": "2025-11-30T10:30:00Z"
}
```

### Stripe Payment Intent Example

```json
{
  "id": "pi_3MtwBwLkdIwHu7ix28a3tqPa",
  "object": "payment_intent",
  "amount": 59800,
  "currency": "jpy",
  "customer": "cus_NffrFeUfNV2Hib",
  "payment_method": "pm_1MtwBwLkdIwHu7ix2VpZqvQd",
  "status": "succeeded",
  "metadata": {
    "order_id": "550e8400-e29b-41d4-a716-446655440000",
    "reference_id": "FX-2025-000123"
  }
}
```

### Order State Machine Diagram

```
┌─────────────────┐
│ pending_payment │
└────────┬────────┘
         │ payment confirmed
         ▼
    ┌────────┐
    │  paid  │
    └────┬───┘
         │ admin reviews
         ▼
┌──────────────────┐
│ pending_purchase │
└────────┬─────────┘
         │ admin completes purchase
         ▼
   ┌───────────┐
   │ purchased │
   └─────┬─────┘
         │ tracking added
         ▼
    ┌─────────┐
    │ shipped │
    └────┬────┘
         │ delivery confirmed
         ▼
   ┌───────────┐
   │ delivered │
   └───────────┘

   (Any state can transition to "cancelled")
```

