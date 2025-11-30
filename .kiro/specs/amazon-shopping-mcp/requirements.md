# Amazon.co.jp Proxy Shopping Service - Requirements

## Introduction

This document specifies requirements for Faxi's proxy shopping service, enabling elderly users to purchase products from Amazon.co.jp via fax. Faxi acts as a proxy reseller with human-in-the-loop oversight, providing intelligent product discovery while maintaining compliance with Amazon's Terms of Service and ensuring transaction security.

## Glossary

- **Faxi System**: The fax-to-internet bridge service that processes user requests
- **Proxy Purchase**: A transaction where Faxi staff purchases products on behalf of users
- **Admin Dashboard**: The web interface used by Faxi staff to review and complete orders
- **Product Options Fax**: An outbound fax containing curated product selections
- **Order Confirmation Fax**: A fax sent to users confirming their product selection
- **Playwright Scraping**: Automated browser interaction to extract product data from Amazon.co.jp
- **Product Cache**: Database storage of scraped product data with 12-hour default TTL
- **Browser Automation**: Semi-automated web interaction using Playwright to prepare checkout
- **Payment Reconciliation**: The process of matching received payments to pending orders
- **Reference ID**: A unique identifier (FX-YYYY-NNNNNN) linking fax exchanges
- **ASIN**: Amazon Standard Identification Number, unique product identifier
- **Rate Limiting**: Throttling scraping requests to 1 per 8-15 seconds, max 30/hour

## Requirements

### Requirement 1: Product Discovery

**User Story:** As a Faxi user, I want to describe products I need via fax, so that I can receive curated shopping options without using a computer.

#### Acceptance Criteria

1. WHEN a user sends a fax containing a product request in natural language THEN the Faxi System SHALL extract the product query using AI vision interpretation
2. WHEN the Faxi System extracts a product query THEN the Faxi System SHALL check the product cache for recent results
3. WHEN cached products exist and are less than 12 hours old THEN the Faxi System SHALL use cached results instead of scraping
4. WHEN no cached products exist or cache is expired THEN the Faxi System SHALL scrape Amazon.co.jp search results using Playwright
5. WHEN the Faxi System scrapes Amazon THEN the Faxi System SHALL parse the top 10 product listings with title, price, ASIN, rating, Prime badge, and seller
6. WHEN the Faxi System parses products THEN the Faxi System SHALL store all product data in the database with timestamps
7. WHEN the Faxi System curates product options THEN the Faxi System SHALL filter results to include only Prime-eligible products with ratings of 3.5 stars or higher
8. WHEN the Faxi System performs a product search THEN the Faxi System SHALL return between 3 and 5 curated product options
9. WHEN the Faxi System generates a Product Options Fax THEN the Faxi System SHALL format each product with title, price in Japanese Yen, delivery estimate, and selection marker

### Requirement 2: Product Selection and Order Creation

**User Story:** As a Faxi user, I want to select a product by marking my choice on the fax, so that I can proceed with purchasing without complex forms.

#### Acceptance Criteria

1. WHEN a user returns a Product Options Fax with a visual selection mark THEN the Faxi System SHALL detect the marked selection using visual annotation detection
2. WHEN the Faxi System detects a product selection THEN the Faxi System SHALL create an order record with status "pending_payment"
3. WHEN the Faxi System creates an order record THEN the Faxi System SHALL associate the order with the user's Reference ID
4. WHEN an order is created THEN the Faxi System SHALL send an Order Confirmation Fax containing payment instructions
5. WHEN the Order Confirmation Fax is generated THEN the Faxi System SHALL include the total amount, payment methods available, and Reference ID

### Requirement 3: Payment Processing

**User Story:** As a Faxi user, I want to pay using my saved card or bank transfer, so that I can complete my purchase through familiar payment methods.

#### Acceptance Criteria

1. WHEN a user has a saved payment method marked as default THEN the Faxi System SHALL automatically charge the payment method upon order confirmation
2. WHEN a user has no saved payment method THEN the Faxi System SHALL create a Stripe payment intent for bank transfer
3. WHEN the Faxi System creates a bank transfer payment intent THEN the Faxi System SHALL generate an Order Confirmation Fax with bank transfer instructions
4. WHEN Stripe receives a bank transfer payment THEN the Faxi System SHALL receive a webhook notification with payment confirmation
5. WHEN the Faxi System receives payment confirmation THEN the Faxi System SHALL update the order status to "paid" and make the order available for admin review

### Requirement 4: Admin Order Review and Fulfillment

**User Story:** As a Faxi admin, I want to review and approve orders before purchase, so that I can verify pricing and prevent errors.

#### Acceptance Criteria

1. WHEN an order reaches "paid" status THEN the Admin Dashboard SHALL display the order in the "Pending Purchase" queue
2. WHEN an admin views a pending order THEN the Admin Dashboard SHALL display the original fax image, parsed product selection, and payment status
3. WHEN an admin initiates order preparation THEN the Faxi System SHALL use Browser Automation to pre-fill the Amazon checkout page
4. WHEN Browser Automation completes THEN the Admin Dashboard SHALL display the final checkout screen for human review
5. WHEN an admin confirms price and stock availability THEN the admin SHALL manually complete the purchase on Amazon
6. WHEN an admin completes a purchase THEN the Admin Dashboard SHALL capture the Amazon Order ID and update the order status to "purchased"

### Requirement 5: Order Tracking and Delivery Confirmation

**User Story:** As a Faxi user, I want to receive updates about my order delivery, so that I know when to expect my products.

#### Acceptance Criteria

1. WHEN an order status changes to "purchased" THEN the Faxi System SHALL send a Purchase Confirmation Fax to the user
2. WHEN an admin updates an order with a tracking number THEN the Faxi System SHALL store the tracking number in the order record
3. WHEN a user sends a fax requesting order status THEN the Faxi System SHALL retrieve the order using the Reference ID
4. WHEN the Faxi System retrieves an order THEN the Faxi System SHALL generate a status fax containing current status, tracking number, and estimated delivery date
5. WHEN an order is marked as "delivered" THEN the Faxi System SHALL send a Delivery Confirmation Fax to the user

### Requirement 6: Price and Stock Validation

**User Story:** As a Faxi admin, I want to verify current prices before completing purchases, so that users are charged the correct amount.

#### Acceptance Criteria

1. WHEN an admin reviews a pending order THEN the Admin Dashboard SHALL display the price quoted to the user
2. WHEN an admin initiates order preparation THEN the Faxi System SHALL perform a fresh scrape of the product page to get current price and stock
3. WHEN Browser Automation loads the checkout page THEN the Faxi System SHALL extract the current Amazon price
4. WHEN the current price differs from the quoted price by more than 50 Japanese Yen THEN the Admin Dashboard SHALL highlight the price discrepancy in red
5. WHEN a price discrepancy is highlighted THEN the admin SHALL contact the user for approval before completing the purchase
6. WHEN a product is out of stock THEN the Admin Dashboard SHALL display an out-of-stock warning and prevent purchase completion

### Requirement 7: Payment Method Management

**User Story:** As a Faxi user, I want to register my payment card once, so that future purchases are faster and more convenient.

#### Acceptance Criteria

1. WHEN a user registers a new payment card THEN the Faxi System SHALL store the card details securely using Stripe
2. WHEN the Faxi System stores a payment method THEN the Faxi System SHALL encrypt sensitive data and store only the Stripe payment method ID
3. WHEN a user has multiple payment methods THEN the Faxi System SHALL mark one method as default
4. WHEN a user requests to change their default payment method THEN the Faxi System SHALL update the default flag in the payment methods table
5. WHEN a user has no saved payment method THEN the Order Confirmation Fax SHALL include only bank transfer instructions

### Requirement 8: Product Search Quality and Rate Limiting

**User Story:** As a Faxi user, I want to receive relevant, high-quality product recommendations, so that I can trust the options presented to me.

#### Acceptance Criteria

1. WHEN the Faxi System scrapes Amazon search results THEN the Faxi System SHALL wait 8-15 seconds between scraping requests
2. WHEN the Faxi System performs scraping operations THEN the Faxi System SHALL limit scraping to a maximum of 30 searches per hour
3. WHEN the Faxi System receives search results THEN the Faxi System SHALL filter products to include only those with 3.5 stars or higher ratings
4. WHEN the Faxi System curates product options THEN the Faxi System SHALL prioritize products sold by Amazon.co.jp
5. WHEN the Faxi System selects products THEN the Faxi System SHALL include diverse price points across low, medium, and premium ranges
6. WHEN the Faxi System formats product options THEN the Faxi System SHALL limit product titles to 60 characters for fax readability

### Requirement 9: Order Status Lifecycle

**User Story:** As a Faxi admin, I want to track orders through their complete lifecycle, so that I can manage fulfillment efficiently.

#### Acceptance Criteria

1. WHEN a new order is created THEN the Faxi System SHALL set the order status to "pending_payment"
2. WHEN payment is confirmed THEN the Faxi System SHALL transition the order status to "paid"
3. WHEN an admin reviews an order THEN the Faxi System SHALL transition the order status to "pending_purchase"
4. WHEN an admin completes a purchase THEN the Faxi System SHALL transition the order status to "purchased"
5. WHEN a tracking number is added THEN the Faxi System SHALL transition the order status to "shipped"
6. WHEN delivery is confirmed THEN the Faxi System SHALL transition the order status to "delivered"

### Requirement 10: Audit Trail and Compliance

**User Story:** As a Faxi administrator, I want complete audit logs of all shopping transactions, so that I can ensure compliance and resolve disputes.

#### Acceptance Criteria

1. WHEN a product search is performed THEN the Faxi System SHALL log the search query, results count, and timestamp
2. WHEN a user selects a product THEN the Faxi System SHALL log the selected product ASIN, price, and user ID
3. WHEN a payment is processed THEN the Faxi System SHALL log the payment method, amount, and transaction ID
4. WHEN an admin completes a purchase THEN the Faxi System SHALL log the admin user ID, Amazon Order ID, and timestamp
5. WHEN any order status changes THEN the Faxi System SHALL create an audit log entry with the previous status, new status, and reason

## Non-Functional Requirements

### NFR1: Security and Data Protection

1. THE Faxi System SHALL encrypt all payment method data at rest using AES-256 encryption
2. THE Faxi System SHALL transmit payment data only through TLS 1.3 or higher
3. THE Faxi System SHALL store Stripe payment method IDs instead of raw card numbers
4. THE Faxi System SHALL implement role-based access control for the Admin Dashboard
5. THE Faxi System SHALL log all admin actions for security audit purposes

### NFR2: Performance

1. WHEN a product search uses cached results THEN the Faxi System SHALL return results within 2 seconds
2. WHEN a product search requires fresh scraping THEN the Faxi System SHALL return results within 15 seconds
3. WHEN Browser Automation prepares a checkout THEN the Faxi System SHALL complete within 20 seconds
4. WHEN the Admin Dashboard loads pending orders THEN the Faxi System SHALL display results within 2 seconds
5. THE Faxi System SHALL handle up to 30 product searches per hour to stay within rate limits
6. THE Faxi System SHALL process payment confirmations within 1 second

### NFR3: Reliability and Error Handling

1. THE Faxi System SHALL achieve 99% uptime for product search functionality
2. WHEN Playwright scraping fails THEN the Faxi System SHALL retry once before falling back to cached results
3. WHEN no cached results exist and scraping fails THEN the Faxi System SHALL send an error fax to the user within 30 seconds
4. WHEN Browser Automation fails THEN the Faxi System SHALL notify the admin and mark the order for manual processing
5. WHEN a payment fails THEN the Faxi System SHALL send a payment failure fax to the user
6. THE Faxi System SHALL implement exponential backoff for scraping retries (8s, 16s, 32s)

### NFR4: Compliance

1. THE Faxi System SHALL use realistic browser fingerprints and user agents to avoid detection
2. THE Faxi System SHALL limit Browser Automation to checkout preparation only, requiring human confirmation for purchase
3. THE Faxi System SHALL rate-limit scraping to 1 search per 8-15 seconds with maximum 30 searches per hour
4. THE Faxi System SHALL obtain explicit user consent before storing payment methods
5. THE Faxi System SHALL comply with PCI DSS requirements by using Stripe for payment processing
6. THE Faxi System SHALL use logged-out sessions for product searches to maintain predictable results

### NFR5: Usability

1. WHEN generating a Product Options Fax THEN the Faxi System SHALL use fonts of at least 12pt for readability
2. WHEN displaying prices THEN the Faxi System SHALL format amounts with comma separators (e.g., ¥1,234)
3. WHEN creating selection markers THEN the Faxi System SHALL use circles with at least 10mm diameter
4. THE Admin Dashboard SHALL display orders in a table with sortable columns
5. THE Admin Dashboard SHALL provide one-click actions for common operations

## Technical Approach

### Playwright-Based Architecture with Human-in-the-Loop

The MVP uses Playwright for all Amazon interactions, eliminating API dependencies and approval requirements:

**Product Discovery (Playwright + Aggressive Caching)**
- Playwright scrapes Amazon.co.jp search results pages
- Parses product listings: title, price, ASIN, rating, Prime badge, seller
- Extracts top 10 results, passes to LLM for curation
- **Aggressive caching**: 12-hour default TTL, extendable for testing
- Database stores all scraped product data with timestamps
- Fresh scrapes only when: cache expired, not in DB, or preparing purchase
- Rate limiting: 1 search per 8-15 seconds, max 10-30 searches/hour (MVP)

**Order Preparation (Semi-Automated)**
- Playwright browser automation for checkout preparation
- Automation stops before final "Place Order" button
- Human admin reviews and completes the purchase
- Complies with Amazon ToS by maintaining human oversight

**Payment Processing (Automated via Stripe)**
- Stripe for card payments (PCI DSS compliant)
- Stripe for bank transfer payments with automatic reconciliation
- Stripe webhooks notify system when bank transfers are received
- No manual payment reconciliation required
- No direct handling of card numbers or bank account details

**Admin Oversight**
- All purchases require human confirmation
- Price and stock validation before completion (fresh scrape)
- Manual intervention for discrepancies or errors

**Anti-Detection Measures**
- Realistic user agent and browser fingerprint
- Randomized human-like delays (150-600ms)
- Full browser mode (not headless for production)
- Logged-out session for predictable results

## Data Models

### Shopping Order (extends existing orders table)

```typescript
interface ShoppingOrder {
  id: string;                    // UUID
  userId: string;                // References users.id
  referenceId: string;           // FX-YYYY-NNNNNN
  externalOrderId: string | null; // Amazon Order ID
  status: OrderStatus;
  totalAmount: number;           // In Japanese Yen
  currency: string;              // 'JPY'
  items: OrderItem[];            // JSONB
  shippingAddress: Address;      // JSONB
  trackingNumber: string | null;
  quotedPrice: number;           // Price shown to user
  actualPrice: number | null;    // Price at checkout
  createdAt: Date;
  updatedAt: Date;
}

type OrderStatus = 
  | 'pending_payment'   // Awaiting payment
  | 'paid'              // Payment confirmed
  | 'pending_purchase'  // Ready for admin review
  | 'purchased'         // Bought on Amazon
  | 'shipped'           // Tracking number added
  | 'delivered'         // Delivery confirmed
  | 'cancelled';        // Order cancelled

interface OrderItem {
  asin: string;                  // Amazon Standard Identification Number
  title: string;
  price: number;
  quantity: number;
  primeEligible: boolean;
  imageUrl: string;
}

interface Address {
  name: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2?: string;
  phoneNumber: string;
}
```

### Product Search Result

```typescript
interface ProductSearchResult {
  asin: string;
  title: string;
  price: number;
  currency: string;
  primeEligible: boolean;
  rating: number;
  reviewCount: number;
  availability: 'in_stock' | 'out_of_stock' | 'limited';
  deliveryEstimate: string;
  imageUrl: string;
  detailPageUrl: string;
}
```

### Admin Order View

```typescript
interface AdminOrderView {
  order: ShoppingOrder;
  user: {
    id: string;
    name: string;
    phoneNumber: string;
  };
  faxImage: {
    storageKey: string;
    thumbnailUrl: string;
  };
  paymentStatus: {
    method: 'card' | 'bank_transfer';
    stripePaymentIntentId: string;
    status: 'pending' | 'succeeded' | 'failed';
    paidAt?: Date;
  };
  priceValidation: {
    quotedPrice: number;
    currentPrice: number | null;
    discrepancy: number;
    requiresApproval: boolean;
  };
  stockStatus: {
    available: boolean;
    checkedAt: Date;
  };
}
```

## LLM Integration Schema

### Intent Extraction Schema

```typescript
const ShoppingIntentSchema = z.object({
  intent: z.enum([
    'product_search',      // User wants to find products
    'order_status',        // User wants to check order status
    'general_question'     // User has questions about shopping
  ]),
  
  // For product_search intent
  productQuery: z.object({
    keywords: z.string().describe("Main product keywords"),
    category: z.string().optional().describe("Product category if specified"),
    priceRange: z.object({
      min: z.number().optional(),
      max: z.number().optional()
    }).optional(),
    urgency: z.enum(['normal', 'urgent']).optional(),
    preferences: z.array(z.string()).optional().describe("Brand, size, color preferences")
  }).optional(),
  
  // For order_status intent
  referenceId: z.string().optional().describe("FX-YYYY-NNNNNN reference ID"),
  
  // For general_question intent
  question: z.string().optional(),
  
  // Confidence and clarification
  confidence: z.number().min(0).max(1),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().optional()
});
```

### Product Curation Schema

```typescript
const ProductCurationSchema = z.object({
  selectedProducts: z.array(z.object({
    asin: z.string(),
    title: z.string().max(60).describe("Truncated for fax readability"),
    price: z.number(),
    primeEligible: z.boolean(),
    rating: z.number(),
    deliveryEstimate: z.string(),
    selectionMarker: z.enum(['A', 'B', 'C', 'D', 'E']),
    reasoning: z.string().describe("Why this product was selected")
  })).min(3).max(5),
  
  searchSummary: z.string().describe("Brief summary of search results"),
  recommendations: z.string().optional().describe("Additional shopping advice")
});
```

### System Prompts

**Product Search Prompt:**
```
You are a shopping assistant helping elderly Japanese users find products on Amazon.co.jp via fax.

SELECTION CRITERIA:
- Only recommend Prime-eligible products with free delivery
- Minimum 3.5 star rating
- Prefer products sold by Amazon.co.jp
- Include diverse price points (budget, mid-range, premium)
- Consider user's stated preferences and past purchases

RESPONSE FORMAT:
- Select exactly 3-5 products
- Truncate titles to 60 characters maximum
- Show prices in Japanese Yen with comma separators
- Indicate delivery time clearly
- Assign selection markers A, B, C, D, E

IMPORTANT:
- Prioritize quality and reliability over lowest price
- Consider elderly user needs (easy to use, clear instructions)
- Avoid products with complex setup or technical requirements
```

**Order Status Prompt:**
```
You are helping a user check their order status via fax.

INFORMATION TO PROVIDE:
- Current order status in simple terms
- Tracking number if available
- Estimated delivery date
- Next steps if any action needed

TONE:
- Clear and reassuring
- Use simple language
- Provide specific dates and times
```

## System Architecture Overview

```
┌─────────────┐
│ User Fax    │
│ "I need     │
│  shampoo"   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ Faxi AI Vision Interpreter                              │
│ - Extract product query                                 │
│ - Detect visual annotations (circles, checkmarks)       │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ MCP Controller Agent                                    │
│ - Route to Shopping MCP Server                          │
│ - Manage conversation context                           │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ Shopping MCP Server                                     │
│ - Query Amazon PA-API                                   │
│ - Filter & curate products (LLM)                        │
│ - Create order records                                  │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ Response Generator                                      │
│ - Generate Product Options Fax (3-5 products)          │
│ - Generate Order Confirmation Fax                       │
│ - Generate Status Update Fax                            │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│ User Fax    │
│ [Circles    │
│  Option B]  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ Payment Processing (Stripe)                            │
│ - Card on file → Auto-charge                           │
│ - Bank Transfer → Payment intent + instructions fax    │
│ - Stripe webhook → Auto-reconciliation                 │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ Admin Dashboard - Pending Purchase Queue                │
│ - Display fax image & parsed selection                 │
│ - Show payment status                                   │
│ - Validate price & stock                                │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ Browser Automation (Playwright)                         │
│ - Open Amazon product page                              │
│ - Add to cart                                           │
│ - Pre-fill checkout (address, payment)                 │
│ - STOP before "Place Order" button                     │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ Admin Manual Confirmation                               │
│ - Review final price                                    │
│ - Verify stock availability                             │
│ - Click "Place Order" manually                          │
│ - Capture Amazon Order ID                               │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│ User Fax    │
│ "Order      │
│  confirmed" │
└─────────────┘
```

## Success Metrics

- **Product Search Success Rate**: ≥95% of searches return relevant results
- **Order Completion Rate**: ≥90% of paid orders successfully purchased
- **Price Accuracy**: ≥98% of orders completed within ±50 yen of quoted price
- **Search Response Time**: <5 seconds from PA-API query to results
- **Admin Review Time**: <2 minutes average per order
- **Payment Success Rate**: ≥99% for card payments, ≥95% for bank transfers
- **User Satisfaction**: ≥85% positive feedback on product quality and delivery

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Amazon ToS violation | Critical | Low | Use PA-API for search; human-in-loop for purchases; legal review |
| Amazon UI changes break automation | High | Medium | Robust CSS selectors; monitoring; rapid response team |
| PA-API rate limiting | Medium | Medium | Request queuing; exponential backoff; user-level rate limits |
| Price discrepancies | Medium | High | Real-time price validation; admin approval for >¥50 difference |
| Payment fraud | High | Low | Stripe fraud detection; Stripe handles bank transfer verification |
| Stock-outs after selection | Medium | Medium | Real-time stock check before purchase; user notification |
| Browser automation detection | High | Low | Human-like interaction patterns; session management |

## Dependencies

### External Services
- **Stripe**: Payment processing and PCI compliance
- **Playwright/Chromium**: Browser automation for scraping and checkout preparation

### Internal Systems
- **AI Vision Interpreter**: Extract product queries from fax images
- **Visual Annotation Detector**: Detect user selections (circles, checkmarks)
- **MCP Controller Agent**: Route requests to Shopping MCP Server
- **Response Generator**: Create formatted fax responses
- **Admin Dashboard**: Order review and fulfillment interface
- **Audit Log Service**: Track all transactions for compliance
- **Product Cache Service**: Store and retrieve scraped product data

### Infrastructure
- **PostgreSQL**: Order, payment method, and product cache storage
- **Redis**: Rate limiting and scraping queue management
- **S3**: Fax image storage

## Out of Scope

The following features are explicitly excluded from this specification:

- **Fully Automated Purchasing**: All purchases require human admin confirmation
- **Multiple Marketplaces**: Only Amazon.co.jp is supported (not .com, .uk, etc.)
- **Price Tracking**: No automated price monitoring or alerts
- **Wishlist Management**: No saved product lists
- **Product Reviews**: No detailed review browsing (only rating summaries)
- **Gift Options**: No gift wrapping or gift messages
- **Subscribe & Save**: No recurring order subscriptions
- **Returns/Refunds**: Handled manually outside the system
- **Product Comparisons**: No side-by-side comparison features
