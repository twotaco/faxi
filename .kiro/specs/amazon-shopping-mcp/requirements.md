# Amazon.co.jp Shopping MCP - Requirements

## Overview
Enable Faxi users to search, browse, and purchase products from Amazon.co.jp via fax, with the system acting as an intelligent shopping assistant.

## User Stories

### US1: Product Search
**As a** Faxi user  
**I want to** search for products on Amazon.co.jp by describing what I need  
**So that** I can find products without using a computer

**Acceptance Criteria:**
- User can describe product in natural language (Japanese or English)
- System translates to effective Amazon search queries
- Returns 3-5 relevant products with prices
- Products formatted for fax readability

### US2: Product Selection
**As a** Faxi user  
**I want to** select a product from search results  
**So that** I can proceed to purchase

**Acceptance Criteria:**
- User can select by circling option on fax
- System retrieves full product details
- Shows product specifications, reviews summary
- Confirms availability and delivery time

### US3: Order Placement
**As a** Faxi user  
**I want to** place an order with my saved payment and delivery info  
**So that** I can complete purchase without entering details

**Acceptance Criteria:**
- Uses saved Amazon account credentials
- Confirms delivery address
- Uses default payment method or asks for selection
- Places order and returns confirmation number

### US4: Order Tracking
**As a** Faxi user  
**I want to** check status of my orders  
**So that** I know when to expect delivery

**Acceptance Criteria:**
- Lists recent orders
- Shows delivery status
- Provides tracking numbers
- Estimates delivery date

### US5: Reorder Previous Purchase
**As a** Faxi user  
**I want to** reorder something I bought before  
**So that** I can quickly repurchase regular items

**Acceptance Criteria:**
- Shows order history
- One-click reorder option
- Confirms current price (may have changed)
- Warns if product unavailable

## Functional Requirements

### FR1: Amazon Account Integration
- Store encrypted Amazon.co.jp credentials per user
- Auto-login for each request
- Session management
- Handle 2FA if enabled (SMS to fax number)

### FR2: Product Search
- Convert natural language to Amazon search queries
- Support Japanese and English input
- Filter by price range, category, Prime eligibility
- Sort by relevance, price, rating

### FR3: Product Data Extraction
- Product name and description
- Price (current, original if on sale)
- Prime eligibility
- Average rating and review count
- Availability status
- Delivery estimate
- Product images (for fax display)

### FR4: Shopping Cart Management
- Add items to cart
- Update quantities
- Remove items
- View cart total

### FR5: Checkout Process
- Confirm delivery address
- Select payment method
- Apply coupons/gift cards if provided
- Review order before placement
- Handle errors (out of stock, payment failure)

### FR6: Order Management
- View order history
- Track shipments
- Cancel orders (if eligible)
- Return/refund requests

## Non-Functional Requirements

### NFR1: Security
- Encrypt Amazon credentials at rest (AES-256)
- Secure credential transmission
- No credential logging
- Session timeout after 1 hour

### NFR2: Performance
- Product search: < 5 seconds
- Order placement: < 10 seconds
- Handle Amazon rate limiting gracefully

### NFR3: Reliability
- 95% success rate for searches
- 99% success rate for order placement (when product available)
- Graceful degradation if Amazon changes UI

### NFR4: Compliance
- Respect Amazon Terms of Service
- Use official API if available
- Rate limit requests appropriately
- User consent for automated purchases

## Technical Approach

### Option A: Amazon Product Advertising API
**Pros:**
- Official, supported by Amazon
- Reliable, structured data
- No scraping concerns

**Cons:**
- Limited to product search/details
- Cannot place orders via API
- Requires Amazon Associates account
- May have usage limits

### Option B: Playwright Web Automation
**Pros:**
- Full functionality (search, order, track)
- No API limitations
- Can handle any Amazon feature

**Cons:**
- Fragile (breaks if Amazon changes UI)
- Slower than API
- May violate ToS
- Requires maintenance

### Recommended: Hybrid Approach
- Use Product Advertising API for search/browse
- Use Playwright for order placement and tracking
- Fallback to full Playwright if API unavailable

## Data Models

### User Amazon Account
```typescript
interface UserAmazonAccount {
  userId: string;
  email: string;
  encryptedPassword: string;
  defaultAddress: Address;
  defaultPaymentMethod: string;
  sessionToken?: string;
  sessionExpiry?: Date;
  twoFactorEnabled: boolean;
}
```

### Product
```typescript
interface AmazonProduct {
  asin: string; // Amazon Standard Identification Number
  title: string;
  price: number;
  currency: string;
  primeEligible: boolean;
  rating: number;
  reviewCount: number;
  availability: 'in_stock' | 'out_of_stock' | 'limited';
  deliveryEstimate: string;
  imageUrl: string;
  category: string;
  features: string[];
}
```

### Order
```typescript
interface AmazonOrder {
  orderId: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  estimatedDelivery: Date;
  deliveryAddress: Address;
  placedAt: Date;
}
```

## LLM Output Schema

```typescript
const AmazonShoppingSchema = z.object({
  intent: z.enum([
    'search',
    'select_product',
    'add_to_cart',
    'checkout',
    'track_order',
    'reorder',
    'view_history'
  ]),
  
  // For search intent
  searchQuery: z.object({
    keywords: z.string(),
    category: z.string().optional(),
    priceMin: z.number().optional(),
    priceMax: z.number().optional(),
    primeOnly: z.boolean().optional(),
    sortBy: z.enum(['relevance', 'price_low', 'price_high', 'rating']).optional()
  }).optional(),
  
  // For product selection
  selectedAsin: z.string().optional(),
  quantity: z.number().optional(),
  
  // For checkout
  deliveryAddress: z.object({
    useDefault: z.boolean(),
    customAddress: z.string().optional()
  }).optional(),
  
  paymentMethod: z.object({
    useDefault: z.boolean(),
    methodId: z.string().optional()
  }).optional(),
  
  // For tracking
  orderId: z.string().optional(),
  
  // Response for user
  response: z.string().describe("Human-readable response for fax"),
  
  // Products to display (for search results)
  productsToShow: z.array(z.object({
    asin: z.string(),
    title: z.string(),
    price: z.number(),
    primeEligible: z.boolean(),
    rating: z.number()
  })).optional(),
  
  // Next action
  nextAction: z.enum([
    'show_products',
    'confirm_selection',
    'confirm_checkout',
    'complete',
    'clarify'
  ]),
  
  // Clarification needed
  clarificationQuestion: z.string().optional()
});
```

## System Prompt

```
You are a shopping assistant for Amazon.co.jp, helping users via fax.

SHOPPING GUIDELINES:
- Understand product needs in natural language
- Search Amazon.co.jp effectively
- Present 3-5 best options with prices in ¥
- Highlight Prime-eligible products
- Consider user's budget and preferences
- Confirm all details before ordering

IMPORTANT RULES:
- Always show prices in Japanese Yen (¥)
- Indicate Prime eligibility clearly
- Confirm delivery address before checkout
- Never place order without explicit confirmation
- Warn if price has changed since last view
- Respect user's budget constraints

RESPONSE FORMAT:
- Keep product descriptions concise
- Use bullet points for features
- Show price prominently
- Indicate delivery time
- Make selection easy (circle A, B, C, etc.)

OUTPUT SCHEMA:
{schema}

EXAMPLES:
{examples}
```

## Implementation Phases

### Phase 1: Search & Browse (Week 1)
- [ ] Set up Amazon Product Advertising API
- [ ] Implement product search
- [ ] Extract product details
- [ ] Format results for fax
- [ ] LLM integration with schema

### Phase 2: Account Management (Week 2)
- [ ] Credential storage (encrypted)
- [ ] Login automation with Playwright
- [ ] Session management
- [ ] 2FA handling

### Phase 3: Order Placement (Week 3)
- [ ] Add to cart automation
- [ ] Checkout flow
- [ ] Payment method selection
- [ ] Order confirmation

### Phase 4: Order Tracking (Week 4)
- [ ] Order history retrieval
- [ ] Tracking number extraction
- [ ] Delivery status updates
- [ ] Reorder functionality

### Phase 5: Testing & Refinement (Week 5)
- [ ] End-to-end testing
- [ ] Error handling
- [ ] Edge cases
- [ ] Performance optimization

## Success Metrics
- 90%+ successful product searches
- 95%+ successful order placements
- < 5 seconds average search time
- < 10 seconds average order time
- Zero credential leaks
- 80%+ user satisfaction

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Amazon ToS violation | High | Use official API where possible, get legal review |
| UI changes break automation | Medium | Implement robust selectors, monitoring, quick fixes |
| Rate limiting | Medium | Implement backoff, queue requests |
| Credential security | High | Strong encryption, security audit, no logging |
| Order errors | High | Extensive validation, confirmation steps, rollback |

## Dependencies
- Amazon Product Advertising API access
- Playwright for web automation
- Encryption library (crypto)
- Image processing for product photos
- Gemini for LLM with JSON schema

## Out of Scope (Future)
- Multiple marketplace support (US, UK, etc.)
- Price tracking and alerts
- Wishlist management
- Gift wrapping options
- Subscribe & Save
