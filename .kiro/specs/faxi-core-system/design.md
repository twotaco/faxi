# Faxi Core System Design

## Overview

The Faxi system is a fax-to-internet bridge that enables offline users to access online services through fax machines. The architecture follows an event-driven, microservices-inspired approach with clear separation between fax I/O, AI interpretation, service execution, and response generation.

The system processes incoming faxes through a webhook, uses multimodal AI to interpret user intent (including visual annotations), executes requested actions via various service integrations, and returns results via fax. A bidirectional email-to-fax bridge enables persistent communication channels for each user.

### Key Design Principles

1. **Dignity-first UX**: All interactions assume zero digital literacy; responses are clear, simple, and respectful
2. **Minimize round-trips**: Every fax costs money and time; design for single-fax completion whenever possible
3. **Embedded context**: Include reply templates, reference IDs, and actionable elements in every outbound fax
4. **Proactive completion**: Anticipate next steps and include them in responses (e.g., payment barcodes with product lists)
5. **Stateless context recovery**: Use visual cues, reference IDs, and AI interpretation to reconnect conversations without cookies
6. **Asynchronous processing**: Long-running operations don't block webhook responses
7. **Idempotency**: Duplicate fax deliveries are handled gracefully
8. **Audit trail**: Complete logging of all operations for debugging and compliance
9. **Graceful degradation**: Service failures result in helpful user feedback, not silent errors

## Architecture

### High-Level System Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Telnyx    │────────▶│   Webhook    │────────▶│   Queue     │
│  (Inbound)  │         │   Receiver   │         │  (Jobs)     │
└─────────────┘         └──────────────┘         └─────────────┘
                                                         │
                                                         ▼
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Telnyx    │◀────────│   Response   │◀────────│  Processor  │
│  (Outbound) │         │   Generator  │         │   Worker    │
└─────────────┘         └──────────────┘         └─────────────┘
                                                         │
                                                         ▼
                                              ┌──────────────────┐
                                              │   AI Vision      │
                                              │   Interpreter    │
                                              └──────────────────┘
                                                         │
                                                         ▼
                                              ┌──────────────────┐
                                              │  MCP Controller │
                                              │     Agent       │
                                              └──────────────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────┐
                        ▼                                ▼                    ▼
                 ┌─────────────┐              ┌──────────────┐      ┌─────────────┐
                 │   Email     │              │  Shopping    │      │   AI Chat   │
                 │ MCP Server  │              │  MCP Server  │      │ MCP Server  │
                 └─────────────┘              └──────────────┘      └─────────────┘
                                                      │
                                                      ▼
                                              ┌──────────────┐
                                              │   Payment    │
                                              │  MCP Server  │
                                              └──────────────┘
```

### Email-to-Fax Bridge

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────┐
│  External Email │────────▶│  Email MX    │────────▶│   Queue     │
│  Sender         │         │  Handler     │         │  (Email)    │
└─────────────────┘         └──────────────┘         └─────────────┘
                                                             │
                                                             ▼
                                                      ┌─────────────┐
                                                      │  Email to   │
                                                      │  Fax Worker │
                                                      └─────────────┘
                                                             │
                                                             ▼
                                                      ┌─────────────┐
                                                      │   Telnyx    │
                                                      │  (Outbound) │
                                                      └─────────────┘
```

## Interaction Patterns for Minimal Round-Trips

### Pattern 1: Email with Smart Reply Options

**Scenario**: User receives email from friend

**Outbound Fax Structure**:
```
┌─────────────────────────────────────┐
│ Email from friend@example.com       │
│ Subject: Can you meet for lunch?    │
│                                     │
│ Hi! I'm in town next week. Would    │
│ you like to meet for lunch on       │
│ Thursday? Let me know!              │
│                                     │
│ ─────────────────────────────────── │
│ QUICK REPLIES (Circle one):         │
│ ○ A. Yes, Thursday works            │
│ ○ B. No, I'm not available          │
│ ○ C. Can we do a different day?     │
│                                     │
│ Additional comments or write your   │
│ own reply below:                    │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Reply via fax. Ref: FX-2024-001234  │
│ You can reply on a blank page.      │
│ We'll match it.                     │
└─────────────────────────────────────┘
```

**For open-ended emails (no clear question)**:
```
┌─────────────────────────────────────┐
│ Email from friend@example.com       │
│ Subject: How are you?               │
│                                     │
│ Just wanted to check in and see     │
│ how you've been doing. Hope all     │
│ is well!                            │
│                                     │
│ ─────────────────────────────────── │
│ Reply via fax. Ref: FX-2024-001234  │
│ You can reply on a blank page.      │
│ We'll match it.                     │
└─────────────────────────────────────┘
```

**Spam Filtering**:
- AI analyzes email content before faxing
- Filters out: promotional emails, newsletters, automated notifications
- Only fax: personal emails, important transactional emails, emails from address book
- User can configure spam sensitivity in preferences

**Inbound Processing**:
- AI Vision looks for reference ID on fax
- If quick reply circled: send that response
- If custom reply written: extract and send
- If blank page with ref ID: extract handwritten message and send

### Pattern 2: Shopping with Integrated Selection

**Scenario**: User requests "shampoo and toilet paper"

**Outbound Fax Structure**:
```
┌─────────────────────────────────────┐
│ SHOPPING ORDER FORM                 │
│ Ref: FX-2024-001235                 │
│                                     │
│ SHAMPOO OPTIONS (Circle one):       │
│ ○ A. Brand X Shampoo - ¥850         │
│      500ml, moisturizing            │
│ ○ B. Brand Y Shampoo - ¥650         │
│      400ml, daily use               │
│ ○ C. Brand Z Shampoo - ¥1200        │
│      600ml, premium                 │
│                                     │
│ TOILET PAPER OPTIONS (Circle one):  │
│ ○ D. 12-roll pack - ¥580            │
│      Soft, 2-ply                    │
│ ○ E. 24-roll pack - ¥980            │
│      Soft, 2-ply, bulk              │
│                                     │
│ SUGGESTED ADDITIONS (Optional):     │
│ ○ F. Hand soap - ¥320               │
│ ○ G. Tissues (5 boxes) - ¥450       │
│                                     │
│ Total if all selected: ¥4,000       │
│                                     │
│ Circle your choices and fax back.   │
│ We'll charge your card on file      │
│ and deliver in 2-3 days.            │
│                                     │
│ Delivery to: [Your saved address]   │
└─────────────────────────────────────┘
```

**Inbound Processing**:
- AI Vision detects circled items (A, D, F)
- Calculates total (¥850 + ¥580 + ¥320 = ¥1,750)
- Charges payment method on file
- Places order immediately
- Sends confirmation fax with order number and tracking

### Pattern 3: Shopping with Payment Barcodes (No Card on File)

**Scenario**: Same request, but user has no payment method registered

**Outbound Fax Structure**:
```
┌─────────────────────────────────────┐
│ SHOPPING OPTIONS                    │
│ Ref: FX-2024-001236                 │
│                                     │
│ SHAMPOO:                            │
│ A. Brand X - ¥850                   │
│ [Barcode image]                     │
│ Pay at convenience store to order   │
│                                     │
│ B. Brand Y - ¥650                   │
│ [Barcode image]                     │
│ Pay at convenience store to order   │
│                                     │
│ TOILET PAPER:                       │
│ D. 12-roll - ¥580                   │
│ [Barcode image]                     │
│ Pay at convenience store to order   │
│                                     │
│ E. 24-roll - ¥980                   │
│ [Barcode image]                     │
│ Pay at convenience store to order   │
│                                     │
│ COMBO DEAL (Save ¥200):             │
│ Brand X Shampoo + 12-roll TP        │
│ ¥1,230 (was ¥1,430)                 │
│ [Barcode image]                     │
│                                     │
│ Pay any barcode at FamilyMart,      │
│ 7-Eleven, or Lawson.                │
│ We'll ship after payment confirmed. │
│ Barcodes expire in 7 days.          │
└─────────────────────────────────────┘
```

**Processing**:
- User pays barcode at convenience store
- Stripe webhook notifies Faxi of payment
- Order placed automatically
- Confirmation fax sent with tracking

### Pattern 4: Multi-Action with Proactive Email Sending

**Scenario**: User sends "I need to book a hotel in Tokyo and send an email to my son confirming our plans to meet at the gallery Sunday for lunch and checking out the new exhibit"

**Agent Processing**:
1. Extract hotel booking intent (Tokyo, dates if mentioned)
2. Extract email intent with full message content
3. Look up "son" in user's address book
4. Check for previous email conversations with son for context
5. Compose and send email immediately with the specified message
6. Search for hotel options

**Outbound Fax Structure**:
```
┌─────────────────────────────────────┐
│ CONFIRMATION & HOTEL OPTIONS        │
│ Ref: FX-2024-001237                 │
│                                     │
│ ✓ EMAIL SENT                        │
│ To: son@example.com (from address   │
│     book)                           │
│ Subject: Plans for Sunday           │
│ Message: "Confirming our plans to   │
│ meet at the gallery Sunday for      │
│ lunch and checking out the new      │
│ exhibit"                            │
│                                     │
│ ─────────────────────────────────── │
│ TOKYO HOTEL OPTIONS                 │
│ For [dates from request or ask]:    │
│                                     │
│ ○ A. Hotel Sunrise - ¥8,500/night   │
│      Near station, breakfast incl.  │
│ ○ B. Business Inn - ¥6,200/night    │
│      Basic, clean, central          │
│                                     │
│ Circle choice and write dates if    │
│ not specified:                      │
│ Check-in: ___/___/___               │
│ Check-out: ___/___/___              │
│                                     │
│ Fax back to book hotel.             │
└─────────────────────────────────────┘
```

**If address not in address book**:
- User must include email address in message: "send email to son@example.com"
- Agent extracts email from message text
- Optionally adds to address book for future use

**Inbound Processing**:
- AI Vision extracts hotel selection and dates
- Books hotel with selected option
- Sends confirmation fax with both hotel booking and email receipt

### Pattern 5: Context Recovery from Blank Reply

**Scenario**: User receives product selection fax, but replies with blank paper (forgot to include reference)

**AI Vision Analysis**:
1. Check for reference ID written on fax
2. Check for partial context clues (product names mentioned, circled items matching recent faxes)
3. Check recent outbound faxes to this number (last 7 days)
4. If single recent conversation awaiting reply: assume continuation
5. If multiple recent conversations: send clarification fax listing recent topics

**Clarification Fax**:
```
┌─────────────────────────────────────┐
│ We received your fax but couldn't   │
│ determine which request it's for.   │
│                                     │
│ Recent conversations:               │
│ A. Shampoo order (2 days ago)       │
│    Ref: FX-2024-001235              │
│                                     │
│ B. Email to friend (1 day ago)      │
│    Ref: FX-2024-001234              │
│                                     │
│ Please write the letter (A or B)    │
│ and fax back with your original.    │
│                                     │
│ Or write the Ref number on future   │
│ faxes to help us connect them.      │
└─────────────────────────────────────┘
```

### Pattern 6: Proactive Upsell with "Customers Also Bought"

**MCP Agent Strategy**:
When user requests items, agent should:
1. Search for requested items
2. Use "customers also bought" or complementary products API
3. Suggest items that enhance or complete the purchase
4. Check for bundle deals or bulk discounts
5. Include 2-3 suggestions maximum (avoid overwhelming)
6. Present as optional checkboxes, not separate decision

**Example**: User requests "flashlight"
```
┌─────────────────────────────────────┐
│ FLASHLIGHT OPTIONS (Circle one):    │
│                                     │
│ ○ A. LED Flashlight - ¥1,200        │
│      Bright, compact, waterproof    │
│      Add: ☐ AA Batteries (4pk) ¥380 │
│      Add: ☐ Medium case ¥450        │
│                                     │
│ ○ B. Mini Flashlight - ¥680         │
│      Keychain size, basic           │
│      Add: ☐ CR2032 Batteries ¥280   │
│      Add: ☐ Small pouch ¥220        │
│                                     │
│ Circle flashlight, check any adds.  │
│ We'll only send items for your      │
│ chosen flashlight.                  │
│                                     │
│ Reply via fax. Ref: FX-2024-001240  │
└─────────────────────────────────────┘
```

**Example**: User requests "coffee maker"
```
┌─────────────────────────────────────┐
│ COFFEE MAKER OPTIONS (Circle one):  │
│                                     │
│ ○ A. Drip Coffee Maker - ¥3,500     │
│      10-cup capacity                │
│      Add: ☐ Filters (100ct) ¥320    │
│      Add: ☐ Coffee beans ¥980       │
│                                     │
│ ○ B. Single Serve - ¥2,200          │
│      Quick brew, compact            │
│      Add: ☐ K-cups (24pk) ¥1,200    │
│      Add: ☐ Descaler ¥450           │
│                                     │
│ Circle coffee maker, check any adds.│
│ We'll only send items for your      │
│ chosen coffee maker.                │
│                                     │
│ Reply via fax. Ref: FX-2024-001241  │
└─────────────────────────────────────┘
```

## Components and Interfaces

### 1. Webhook Receiver

**Responsibility**: Accept incoming fax notifications from Telnyx, validate, and enqueue for processing

**Interface**:
```typescript
POST /webhooks/telnyx/fax/received
Headers:
  - Telnyx-Signature-Ed25519: <signature>
  - Telnyx-Timestamp: <timestamp>
Body:
  {
    "data": {
      "event_type": "fax.received",
      "id": "<event_id>",
      "occurred_at": "<iso_timestamp>",
      "payload": {
        "fax_id": "<fax_id>",
        "connection_id": "<connection_id>",
        "direction": "inbound",
        "from": "+1234567890",
        "to": "+0987654321",
        "media_url": "<url_to_fax_tiff>",
        "page_count": 2,
        "status": "received"
      }
    }
  }

Response: 200 OK
```

**Implementation Notes**:
- Verify Telnyx webhook signature for security
- Return 200 immediately to prevent retries
- Store raw webhook payload for audit
- Enqueue job with fax metadata and media URL
- Handle duplicate deliveries via idempotency key (fax_id)

### 2. Fax Processor Worker

**Responsibility**: Orchestrate the complete fax processing pipeline

**Process Flow**:
1. Download fax image from Telnyx media URL
2. Store fax image in object storage (S3-compatible)
3. Pass image to AI Vision Interpreter
4. Pass interpretation to MCP Controller Agent
5. Agent orchestrates multi-step workflow using MCP tools
6. Collect agent results and pass to Response Generator
7. Handle errors and generate appropriate user feedback

**State Management**:
```typescript
interface FaxJob {
  id: string;
  faxId: string;
  fromNumber: string;
  toNumber: string;
  imageUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  interpretation?: InterpretationResult;
  actionResults?: ActionResult[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 3. AI Vision Interpreter

**Responsibility**: Analyze fax images and extract user intent, parameters, and visual selections

**Interface**:
```typescript
interface InterpretationRequest {
  imageUrl: string;
  imageData?: Buffer;
  context?: ConversationContext; // For follow-up faxes
}

interface InterpretationResult {
  intent: 'email' | 'shopping' | 'ai_chat' | 'payment_registration' | 'unknown';
  confidence: number; // 0-1
  parameters: {
    // Email intent
    recipientEmail?: string;
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
  };
  visualAnnotations?: {
    type: 'circle' | 'checkmark' | 'underline' | 'arrow';
    boundingBox: { x: number; y: number; width: number; height: number };
    associatedText?: string;
  }[];
  requiresClarification: boolean;
  clarificationQuestion?: string;
}
```

**Context Recovery**:
The interpreter must identify context from multiple sources:
1. **Reference IDs**: Look for "Ref: FX-XXXX-XXXXXX" written or printed on fax
2. **Visual patterns**: Recognize our own fax templates (reply forms, order forms, barcode pages)
3. **Temporal proximity**: Recent faxes from same number are likely related
4. **Content similarity**: Match topics/keywords with recent outbound faxes
5. **Explicit references**: User writes "Re: shampoo order" or "Reply to email from John"

**Implementation Notes**:
- Use Google Gemini 2.5 Flash for multimodal vision interpretation
- Provide system prompt that explains the Faxi context and expected user behaviors
- Include examples of common fax patterns (handwritten requests, circled items, checkboxes, reply templates)
- Maintain conversation context for 7 days (longer than typical response time)
- Set confidence threshold (e.g., 0.7) below which clarification is requested
- When context is ambiguous, include recent conversation summary in clarification fax

### 4. MCP Controller Agent (Action Router)

**Responsibility**: Orchestrate complex, multi-step workflows by delegating to specialized MCP servers

**Architecture**: The Action Router is implemented as an AI agent with access to multiple MCP (Model Context Protocol) servers. Each MCP server provides tools for specific domains (email, shopping, payments, etc.). The agent can:
- Execute simple single-step requests directly
- Orchestrate complex multi-step workflows
- Handle conditional logic and error recovery
- Maintain state across multiple tool calls
- Request user clarification when needed

**MCP Server Architecture**:
```typescript
interface MCPServer {
  name: string;
  description: string;
  tools: MCPTool[];
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: (params: any) => Promise<any>;
}
```

**Available MCP Servers**:

1. **Email MCP Server**
   - `send_email`: Send email from user's Faxi email address
   - `get_email_thread`: Retrieve conversation history
   - `search_emails`: Search user's email history

2. **Shopping MCP Server**
   - `search_products`: Search for products by query
   - `get_product_details`: Get detailed product information
   - `add_to_cart`: Add items to shopping cart
   - `get_cart`: View current cart contents
   - `checkout`: Complete purchase

3. **Payment MCP Server**
   - `get_payment_methods`: List user's registered payment methods
   - `register_payment_method`: Add new payment method
   - `process_payment`: Charge payment method
   - `generate_konbini_barcode`: Create convenience store payment barcode
   - `check_payment_status`: Verify payment completion

4. **AI Chat MCP Server**
   - `chat`: Send message to AI assistant
   - `get_conversation`: Retrieve conversation history
   - `summarize_conversation`: Get conversation summary

5. **User Profile MCP Server**
   - `get_user_profile`: Retrieve user information
   - `update_delivery_address`: Update shipping address
   - `get_order_history`: View past orders
   - `track_order`: Get order status

**Agent Workflow**:
```typescript
interface AgentRequest {
  interpretation: InterpretationResult;
  userId: string;
  faxJobId: string;
  conversationContext?: ConversationContext;
  recentFaxes?: FaxHistory[]; // For context recovery
}

interface AgentResponse {
  success: boolean;
  steps: AgentStep[];
  finalResult: any;
  responseType: 'completion' | 'selection_required' | 'payment_required' | 'clarification';
  faxTemplate: FaxTemplate; // Structured fax to generate
  autoExecuteOnReply?: boolean; // If true, execute immediately when user replies
  userMessage: string;
}

interface AgentStep {
  toolName: string;
  toolServer: string;
  input: any;
  output: any;
  timestamp: Date;
}

interface FaxTemplate {
  type: 'email_reply' | 'product_selection' | 'payment_barcodes' | 'confirmation' | 'multi_action';
  referenceId: string; // FX-YYYY-NNNNNN format
  pages: FaxPage[];
  contextData: any; // Data needed to process reply (thread IDs, product IDs, etc.)
}
```

**Agent Decision Framework for Minimizing Round-Trips**:

1. **Can we complete immediately?**
   - User has payment method + clear intent → Execute and confirm
   - Email reply with clear message → Send immediately
   - Simple query → Answer directly

2. **Do we need user selection?**
   - Multiple product options → Send selection form with ALL options
   - Include payment method (charge on file OR barcodes)
   - Include suggested add-ons as optional checkboxes
   - Make form actionable: circle + fax back = done

3. **Do we need payment first?**
   - No payment method on file → Send barcodes with product info
   - Each barcode = complete transaction (no confirmation needed)
   - Include combo deals to reduce decisions

4. **Can we bundle multiple requests?**
   - User asks for multiple things → Create multi-page form
   - Each page handles one request
   - Single fax back completes all actions
   - Example: Hotel booking + email + shopping = 3-page form

5. **Is context unclear?**
   - Check recent fax history (7 days)
   - Look for visual/content matches
   - If single recent conversation → assume continuation
   - If multiple → send disambiguation with reference IDs

**Example Optimized Workflow** (Shopping):

**Traditional approach (3 faxes)**:
1. User: "I want batteries" → 
2. System: "What type?" → 
3. User: "AA batteries" → 
4. System: "Here are options" → 
5. User: "Option B" → 
6. System: "Confirmed"

**Faxi approach (1-2 faxes)**:
1. User: "I want batteries"
2. Agent reasoning:
   - Calls `search_products({query: "batteries AA"})`  // Assume AA (most common)
   - Calls `search_products({query: "batteries AAA"})` // Also get AAA
   - Calls `get_payment_methods({userId})`
   - Calls `search_products({query: "battery tester"})` // Complementary item
3. Agent generates SINGLE fax with:
   - AA options (3 choices with prices)
   - AAA options (2 choices, marked optional)
   - Battery tester (optional checkbox)
   - If payment on file: "Circle choices, we'll charge and ship"
   - If no payment: Each option has barcode, "Pay any barcode to order"
4. User circles AA option B, checks battery tester, faxes back
5. Agent processes:
   - Detects circled items via AI Vision
   - Calls `add_to_cart` for both items
   - Calls `checkout` with payment method
   - Calls `track_order` for tracking number
6. Agent sends confirmation fax with order number and tracking

**Result**: 2 faxes total instead of 6

**Implementation Notes**:
- Use LangChain or similar framework for agent orchestration
- Agent has access to all MCP tools via standardized protocol
- Agent maintains execution log for debugging and audit
- Agent can retry failed steps with exponential backoff
- Agent generates human-readable explanations of actions taken
- System prompt emphasizes: "Minimize round-trips. Be proactive. Bundle related items. Include payment in first response."
- Agent tracks conversation context for 7 days
- Agent uses reference IDs, visual cues, and temporal proximity for context recovery

### 5. Email MCP Server

**Responsibility**: Provide email tools to the MCP Controller Agent

**MCP Tools**:

1. `send_email`
```typescript
{
  name: "send_email",
  description: "Send an email from the user's Faxi email address",
  inputSchema: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Email subject" },
      body: { type: "string", description: "Email body content" }
    },
    required: ["to", "subject", "body"]
  }
}
// Returns: { messageId: string, sent: boolean }
```

2. `get_email_thread`
```typescript
{
  name: "get_email_thread",
  description: "Retrieve email conversation history",
  inputSchema: {
    type: "object",
    properties: {
      threadId: { type: "string", description: "Email thread identifier" }
    },
    required: ["threadId"]
  }
}
// Returns: { emails: Array<{from, to, subject, body, timestamp}> }
```

3. `search_emails`
```typescript
{
  name: "search_emails",
  description: "Search user's email history",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      limit: { type: "number", description: "Max results", default: 10 }
    },
    required: ["query"]
  }
}
// Returns: { emails: Array<{messageId, from, to, subject, snippet, timestamp}> }
```

**Inbound Email Handler**:
```typescript
POST /webhooks/email/received
Body:
  {
    "to": "1234567890@me.faxi.jp",
    "from": "sender@example.com",
    "subject": "Re: Your message",
    "body": "Email content...",
    "attachments": [...]
  }
```

**Implementation Notes**:
- Use email service provider (SendGrid, AWS SES, or Postfix)
- Configure MX records for me.faxi.jp domain
- Parse incoming emails and extract text content
- Handle attachments by including notification in fax ("This email included 2 attachments. Contact support to access them.")
- Maintain email thread context for conversations

### 6. Shopping MCP Server

**Responsibility**: Provide e-commerce tools to the MCP Controller Agent

**MCP Tools**:

1. `search_products`
```typescript
{
  name: "search_products",
  description: "Search for products by query",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Product search query" },
      maxResults: { type: "number", description: "Max results", default: 5 }
    },
    required: ["query"]
  }
}
// Returns: { products: Array<{id, name, price, currency, description, imageUrl, estimatedDelivery}> }
```

2. `get_product_details`
```typescript
{
  name: "get_product_details",
  description: "Get detailed information about a specific product",
  inputSchema: {
    type: "object",
    properties: {
      productId: { type: "string", description: "Product identifier" }
    },
    required: ["productId"]
  }
}
// Returns: { product: {id, name, price, description, specifications, reviews, availability} }
```

3. `add_to_cart`
```typescript
{
  name: "add_to_cart",
  description: "Add product to shopping cart",
  inputSchema: {
    type: "object",
    properties: {
      productId: { type: "string", description: "Product identifier" },
      quantity: { type: "number", description: "Quantity to add", default: 1 }
    },
    required: ["productId"]
  }
}
// Returns: { cartId: string, itemCount: number, total: number }
```

4. `get_cart`
```typescript
{
  name: "get_cart",
  description: "View current shopping cart contents",
  inputSchema: {
    type: "object",
    properties: {}
  }
}
// Returns: { items: Array<{productId, name, quantity, price}>, total: number }
```

5. `checkout`
```typescript
{
  name: "checkout",
  description: "Complete purchase of cart items",
  inputSchema: {
    type: "object",
    properties: {
      paymentMethodId: { type: "string", description: "Payment method to use (optional)" }
    }
  }
}
// Returns: { orderId: string, status: string, total: number, estimatedDelivery: string }
```

6. `get_complementary_products`
```typescript
{
  name: "get_complementary_products",
  description: "Find products that complement the given items (for upselling)",
  inputSchema: {
    type: "object",
    properties: {
      productIds: { type: "array", items: { type: "string" }, description: "Products to find complements for" },
      maxResults: { type: "number", description: "Max suggestions", default: 3 }
    },
    required: ["productIds"]
  }
}
// Returns: { suggestions: Array<{productId, name, price, reason}> }
```

7. `get_bundle_deals`
```typescript
{
  name: "get_bundle_deals",
  description: "Find bundle deals or bulk discounts for products",
  inputSchema: {
    type: "object",
    properties: {
      productIds: { type: "array", items: { type: "string" }, description: "Products to check for bundles" }
    },
    required: ["productIds"]
  }
}
// Returns: { bundles: Array<{bundleId, products, originalPrice, bundlePrice, savings}> }
```

**Implementation Notes**:
- Start with Amazon Product Advertising API or similar
- Cache product search results for selection follow-ups
- Store user delivery addresses in user profiles
- Coordinate with Payment MCP Server for transaction processing
- Proactively search for complementary items and bundles to minimize round-trips
- Return multiple quantity options (single, bulk) in search results

### 7. Payment MCP Server

**Responsibility**: Provide payment and transaction tools to the MCP Controller Agent

**MCP Tools**:

1. `get_payment_methods`
```typescript
{
  name: "get_payment_methods",
  description: "List user's registered payment methods",
  inputSchema: {
    type: "object",
    properties: {}
  }
}
// Returns: { paymentMethods: Array<{id, type, last4, isDefault}> }
```

2. `register_payment_method`
```typescript
{
  name: "register_payment_method",
  description: "Register a new payment method",
  inputSchema: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["credit_card", "convenience_store_default"] },
      cardToken: { type: "string", description: "Stripe token (for credit card)" }
    },
    required: ["type"]
  }
}
// Returns: { paymentMethodId: string, success: boolean }
```

3. `process_payment`
```typescript
{
  name: "process_payment",
  description: "Charge a payment method",
  inputSchema: {
    type: "object",
    properties: {
      amount: { type: "number", description: "Amount in smallest currency unit" },
      currency: { type: "string", description: "Currency code", default: "jpy" },
      paymentMethodId: { type: "string", description: "Payment method to charge" },
      description: { type: "string", description: "Payment description" }
    },
    required: ["amount", "paymentMethodId", "description"]
  }
}
// Returns: { transactionId: string, success: boolean, status: string }
```

4. `generate_konbini_barcode`
```typescript
{
  name: "generate_konbini_barcode",
  description: "Generate convenience store payment barcode",
  inputSchema: {
    type: "object",
    properties: {
      amount: { type: "number", description: "Amount in smallest currency unit" },
      currency: { type: "string", description: "Currency code", default: "jpy" },
      description: { type: "string", description: "Payment description" }
    },
    required: ["amount", "description"]
  }
}
// Returns: { barcodeUrl: string, barcodeData: string, expiresAt: string, instructions: string }
```

5. `check_payment_status`
```typescript
{
  name: "check_payment_status",
  description: "Check status of a payment",
  inputSchema: {
    type: "object",
    properties: {
      transactionId: { type: "string", description: "Transaction identifier" }
    },
    required: ["transactionId"]
  }
}
// Returns: { status: string, paidAt?: string, amount: number }
```

**Implementation Notes**:
- Use Stripe for payment processing
- Store payment methods securely using Stripe Customer and PaymentMethod objects
- For convenience store payments, use Stripe's Konbini payment method (Japan-specific)
- Generate barcode images for fax delivery
- Include clear instructions for in-store payment
- Webhook handler for payment confirmation events

### 8. AI Chat MCP Server

**Responsibility**: Provide conversational AI tools to the MCP Controller Agent

**MCP Tools**:

1. `chat`
```typescript
{
  name: "chat",
  description: "Send a message to the AI assistant",
  inputSchema: {
    type: "object",
    properties: {
      message: { type: "string", description: "User's message or question" },
      conversationId: { type: "string", description: "Conversation ID for context (optional)" }
    },
    required: ["message"]
  }
}
// Returns: { response: string, conversationId: string }
```

2. `get_conversation`
```typescript
{
  name: "get_conversation",
  description: "Retrieve conversation history",
  inputSchema: {
    type: "object",
    properties: {
      conversationId: { type: "string", description: "Conversation identifier" }
    },
    required: ["conversationId"]
  }
}
// Returns: { messages: Array<{role, content, timestamp}> }
```

3. `summarize_conversation`
```typescript
{
  name: "summarize_conversation",
  description: "Get a summary of the conversation",
  inputSchema: {
    type: "object",
    properties: {
      conversationId: { type: "string", description: "Conversation identifier" }
    },
    required: ["conversationId"]
  }
}
// Returns: { summary: string, keyPoints: string[] }
```

**Implementation Notes**:
- Use Google Gemini 2.5 Flash for AI chat
- Maintain conversation history for context
- Format responses for fax readability (avoid long paragraphs, use bullet points)
- Set character limits appropriate for fax pages
- Provide conversation context in system prompt

### 9. Response Generator

**Responsibility**: Convert action results into fax-formatted documents

**Interface**:
```typescript
interface GenerateResponseRequest {
  faxJobId: string;
  actionResults: ActionResult[];
  interpretation: InterpretationResult;
  recipientNumber: string;
}

interface FaxDocument {
  pages: Buffer[]; // TIFF format
  pageCount: number;
}
```

**Document Templates**:
- Email confirmation
- Product selection sheet
- Order confirmation
- Payment instructions with barcode
- AI chat response
- Error/clarification request

**Implementation Notes**:
- Generate TIFF images at 204x196 DPI (standard fax resolution)
- Use clear, large fonts (minimum 12pt)
- Include Faxi branding and support contact
- Add page numbers for multi-page documents
- Optimize for black and white rendering
- Include timestamp and reference number on each page

### 10. Fax Sender

**Responsibility**: Deliver outbound faxes via Telnyx

**Interface**:
```typescript
interface SendFaxRequest {
  to: string;
  from: string; // Faxi fax number
  mediaUrl: string; // URL to TIFF document
  retryCount?: number;
}

POST https://api.telnyx.com/v2/faxes
Headers:
  Authorization: Bearer <api_key>
Body:
  {
    "connection_id": "<connection_id>",
    "to": "+1234567890",
    "from": "+0987654321",
    "media_url": "https://faxi.jp/fax-documents/<doc_id>.tiff",
    "quality": "high",
    "store_media": true
  }
```

**Implementation Notes**:
- Upload generated TIFF to publicly accessible URL before sending
- Implement retry logic (up to 3 attempts with exponential backoff)
- Handle Telnyx webhook for delivery status
- Log all delivery attempts and outcomes
- Alert on repeated delivery failures

### 11. User Profile MCP Server

**Responsibility**: Provide user profile and order management tools to the MCP Controller Agent

**MCP Tools**:

1. `get_user_profile`
```typescript
{
  name: "get_user_profile",
  description: "Retrieve user profile information",
  inputSchema: {
    type: "object",
    properties: {}
  }
}
// Returns: { phoneNumber, emailAddress, preferences, deliveryAddress }
```

2. `update_delivery_address`
```typescript
{
  name: "update_delivery_address",
  description: "Update user's delivery address",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      postalCode: { type: "string" },
      address: { type: "string" },
      phone: { type: "string" }
    },
    required: ["name", "postalCode", "address"]
  }
}
// Returns: { success: boolean }
```

3. `get_order_history`
```typescript
{
  name: "get_order_history",
  description: "View user's past orders",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max results", default: 10 }
    }
  }
}
// Returns: { orders: Array<{orderId, date, items, total, status}> }
```

4. `track_order`
```typescript
{
  name: "track_order",
  description: "Get current status of an order",
  inputSchema: {
    type: "object",
    properties: {
      orderId: { type: "string", description: "Order identifier" }
    },
    required: ["orderId"]
  }
}
// Returns: { orderId, status, trackingNumber, estimatedDelivery, updates: Array<{timestamp, status, location}> }
```

5. `get_address_book`
```typescript
{
  name: "get_address_book",
  description: "Retrieve user's contact list",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Optional search query" }
    }
  }
}
// Returns: { contacts: Array<{id, name, email, relationship, addedAt}> }
```

6. `add_contact`
```typescript
{
  name: "add_contact",
  description: "Add a new contact to address book",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Contact name" },
      email: { type: "string", description: "Email address" },
      relationship: { type: "string", description: "Relationship (e.g., son, friend)" }
    },
    required: ["name", "email"]
  }
}
// Returns: { contactId: string, success: boolean }
```

7. `lookup_contact`
```typescript
{
  name: "lookup_contact",
  description: "Find contact by name or relationship",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Name or relationship to search for" }
    },
    required: ["query"]
  }
}
// Returns: { contact: {id, name, email, relationship} | null }
```

8. `update_contact`
```typescript
{
  name: "update_contact",
  description: "Update contact information",
  inputSchema: {
    type: "object",
    properties: {
      contactId: { type: "string", description: "Contact identifier" },
      name: { type: "string", description: "Updated name" },
      email: { type: "string", description: "Updated email" },
      relationship: { type: "string", description: "Updated relationship" }
    },
    required: ["contactId"]
  }
}
// Returns: { success: boolean }
```

9. `delete_contact`
```typescript
{
  name: "delete_contact",
  description: "Remove contact from address book",
  inputSchema: {
    type: "object",
    properties: {
      contactId: { type: "string", description: "Contact identifier" }
    },
    required: ["contactId"]
  }
}
// Returns: { success: boolean }
```

### 12. MCP Server Modularity and Extensibility

**Architecture for Future MCP Servers**:

The system is designed to support adding new MCP servers without modifying core code. Future MCP servers can be added for example:
- **Game Services**: "Atlantis PbeM" email fantasy game, other play-by-mail games
- **Government Services**: Tax filing, pension inquiries, municipal services
- **Healthcare**: Hospital appointments, prescription refills, test results
- **Partner Services**: Local businesses, community services, specialized integrations

**Adding New MCP Servers**:
1. Create new MCP server following standard protocol
2. Register server with MCP Controller Agent
3. Define tools with clear descriptions and JSON schemas
4. Agent automatically discovers and uses new tools
5. No changes needed to core Faxi infrastructure

**MCP Server Registration**:
```typescript
interface MCPServerConfig {
  name: string;
  description: string;
  endpoint: string; // For remote MCP servers
  enabled: boolean;
  tools: MCPTool[];
}

// Configuration file: config/mcp-servers.json
{
  "servers": [
    {
      "name": "email",
      "description": "Email sending and management",
      "enabled": true
    },
    {
      "name": "shopping",
      "description": "E-commerce and product search",
      "enabled": true
    },
    {
      "name": "atlantis-pbem",
      "description": "Atlantis play-by-mail fantasy game",
      "enabled": false, // Can be enabled when ready
      "endpoint": "http://atlantis-mcp:3000"
    },
    {
      "name": "government-services",
      "description": "Government and municipal services",
      "enabled": false,
      "endpoint": "http://gov-services-mcp:3000"
    }
  ]
}
```

**Agent Discovery**:
- Agent queries all enabled MCP servers for available tools
- Tools are presented to agent with descriptions
- Agent selects appropriate tools based on user intent
- New tools become available automatically when servers are enabled

**Example Future MCP Server** (Atlantis PbeM Game):
```typescript
// Tools for game interaction
{
  name: "atlantis_get_turn_report",
  description: "Get current turn report for Atlantis game",
  inputSchema: { type: "object", properties: {} }
}

{
  name: "atlantis_submit_orders",
  description: "Submit orders for next turn",
  inputSchema: {
    type: "object",
    properties: {
      orders: { type: "string", description: "Game orders text" }
    }
  }
}

{
  name: "atlantis_get_map",
  description: "Get map of explored regions",
  inputSchema: { type: "object", properties: {} }
}
```

**Benefits of Modular Architecture**:
- Easy to add new services without touching core code
- Third-party developers can create MCP servers
- Services can be enabled/disabled per user
- Scales to support many specialized use cases
- Maintains clean separation of concerns

### 13. User Profile Service

**Responsibility**: Manage user accounts, preferences, and metadata (backend implementation for User Profile MCP Server)

**Data Model**:
```typescript
interface UserProfile {
  id: string;
  phoneNumber: string; // Primary identifier
  emailAddress: string; // {phoneNumber}@me.faxi.jp
  registeredAt: Date;
  preferences: {
    language: 'ja' | 'en';
    defaultPaymentMethod?: string;
    deliveryAddress?: {
      name: string;
      postalCode: string;
      address: string;
      phone: string;
    };
  };
  conversationContexts: {
    [conversationId: string]: {
      messages: { role: string; content: string }[];
      expiresAt: Date;
    };
  };
}
```

## Data Models

### Reference ID System

**Format**: `FX-YYYY-NNNNNN`
- `FX`: Faxi prefix
- `YYYY`: Year
- `NNNNNN`: Sequential number (6 digits, zero-padded)

**Usage**:
- Every outbound fax includes reference ID prominently
- Printed on every page (header or footer)
- Users encouraged to write it on reply faxes
- AI Vision trained to detect and extract reference IDs

**Context Tracking**:
```typescript
interface ConversationContext {
  referenceId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date; // 7 days from creation
  status: 'awaiting_reply' | 'completed' | 'expired';
  originalIntent: string;
  contextData: {
    // Email context
    emailThreadId?: string;
    emailRecipient?: string;
    
    // Shopping context
    searchQuery?: string;
    productOptions?: Product[];
    selectedProducts?: string[];
    cartId?: string;
    
    // Payment context
    paymentIntentId?: string;
    barcodeMapping?: { [barcode: string]: { productId: string, amount: number } };
    
    // Multi-action context
    actions?: Array<{ type: string, data: any, status: string }>;
  };
  relatedFaxes: string[]; // Other reference IDs in same conversation
}
```

**Context Recovery Algorithm**:
```typescript
async function recoverContext(inboundFax: FaxJob): Promise<ConversationContext | null> {
  // 1. Check for explicit reference ID in fax
  const refId = await aiVision.extractReferenceId(inboundFax.imageUrl);
  if (refId) {
    return await db.getContext(refId);
  }
  
  // 2. Check for visual template match (our own forms)
  const templateMatch = await aiVision.detectFaxiTemplate(inboundFax.imageUrl);
  if (templateMatch?.referenceId) {
    return await db.getContext(templateMatch.referenceId);
  }
  
  // 3. Check recent conversations from same user
  const recentContexts = await db.getRecentContexts(
    inboundFax.fromNumber,
    { status: 'awaiting_reply', maxAge: '7 days' }
  );
  
  if (recentContexts.length === 1) {
    // Only one active conversation, assume it's this one
    return recentContexts[0];
  }
  
  if (recentContexts.length > 1) {
    // Multiple active conversations, try content matching
    const interpretation = await aiVision.interpret(inboundFax.imageUrl);
    const bestMatch = await findBestContextMatch(interpretation, recentContexts);
    
    if (bestMatch.confidence > 0.8) {
      return bestMatch.context;
    }
    
    // Ambiguous - send disambiguation fax
    return null; // Will trigger clarification flow
  }
  
  // 4. No context found - treat as new conversation
  return null;
}
```

### Database Schema

**fax_jobs**
```sql
CREATE TABLE fax_jobs (
  id UUID PRIMARY KEY,
  fax_id VARCHAR(255) UNIQUE NOT NULL,
  reference_id VARCHAR(20), -- FX-YYYY-NNNNNN
  user_id UUID REFERENCES users(id),
  from_number VARCHAR(20) NOT NULL,
  to_number VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL, -- 'inbound' | 'outbound'
  status VARCHAR(20) NOT NULL,
  image_url TEXT,
  interpretation JSONB,
  action_results JSONB,
  context_id UUID REFERENCES conversation_contexts(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_status (status),
  INDEX idx_reference_id (reference_id),
  INDEX idx_context_id (context_id)
);
```

**conversation_contexts**
```sql
CREATE TABLE conversation_contexts (
  id UUID PRIMARY KEY,
  reference_id VARCHAR(20) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  original_intent VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'awaiting_reply' | 'completed' | 'expired'
  context_data JSONB NOT NULL,
  related_faxes TEXT[], -- Array of fax_job IDs
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  INDEX idx_user_status (user_id, status),
  INDEX idx_reference_id (reference_id),
  INDEX idx_expires_at (expires_at)
);
```

**users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL, -- Fax machine number (account identifier)
  email_address VARCHAR(255) UNIQUE NOT NULL, -- {phone_number}@me.faxi.jp
  name VARCHAR(255), -- Optional, requested in welcome fax
  preferences JSONB,
  feature_flags JSONB, -- For feature gating and subscription tiers
  registered_at TIMESTAMP DEFAULT NOW(),
  first_fax_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_phone (phone_number),
  INDEX idx_email (email_address)
);

-- Note: Account is per fax machine, not per person
-- Multiple people using same fax machine share one account
```

**payment_methods**
```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  stripe_payment_method_id VARCHAR(255),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user (user_id)
);
```

**orders**
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  fax_job_id UUID REFERENCES fax_jobs(id),
  external_order_id VARCHAR(255),
  product_id VARCHAR(255),
  product_name TEXT,
  quantity INTEGER,
  total_amount DECIMAL(10, 2),
  currency VARCHAR(3),
  status VARCHAR(50) NOT NULL,
  payment_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_created (user_id, created_at)
);
```

**address_book**
```sql
CREATE TABLE address_book (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  relationship VARCHAR(100),
  added_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_id (user_id),
  INDEX idx_user_email (user_id, email),
  UNIQUE (user_id, email)
);
```

**audit_logs**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created (created_at)
);
```

### Object Storage Structure

```
s3://faxi-storage/
  fax-images/
    inbound/
      {year}/{month}/{day}/{fax_id}.tiff
    outbound/
      {year}/{month}/{day}/{doc_id}.tiff
  product-images/
    {product_id}.jpg
  generated-documents/
    {doc_id}.tiff
```

## Error Handling

### Error Categories

1. **Transient Errors** (retry automatically)
   - Network timeouts
   - Service temporarily unavailable
   - Rate limiting

2. **User Errors** (send clarification fax)
   - Ambiguous request
   - Missing required information
   - Invalid product selection

3. **System Errors** (alert operators, send apology fax)
   - AI service failure
   - Database connection lost
   - Payment processing error

### Error Response Templates

**Clarification Request**:
```
We received your fax but need more information:

[Specific question]

Please send a new fax with:
- [Required information 1]
- [Required information 2]

Reference: [Job ID]
Support: [Phone/Fax number]
```

**Service Unavailable**:
```
We're experiencing technical difficulties.

Your request: [Brief description]
Reference: [Job ID]

We'll process your request as soon as possible.
Expected resolution: [Timeframe]

Support: [Phone/Fax number]
```

**Payment Failed**:
```
Payment could not be processed.

Reason: [User-friendly error message]

Options:
1. Try again with different payment method
2. Use convenience store payment (barcode below)

[Barcode image]

Reference: [Job ID]
Support: [Phone/Fax number]
```

## Testing Strategy

### Unit Testing
- Test each service component in isolation
- Mock external dependencies (Telnyx, Stripe, AI APIs)
- Validate data transformations and business logic
- Test error handling paths

### Integration Testing
- Test webhook receivers with sample payloads
- Test complete fax processing pipeline with test images
- Test email-to-fax flow end-to-end
- Test payment processing with Stripe test mode
- Verify database transactions and rollbacks

### End-to-End Testing
- Send test faxes through Telnyx test environment
- Verify complete user journeys:
  - Send email request → receive confirmation
  - Request product → select → purchase → confirm
  - Ask AI question → receive answer
  - Register payment method → use for purchase
- Test error scenarios with invalid inputs
- Verify retry logic and idempotency

### AI Testing
- Create test dataset of sample fax images with known intents
- Measure interpretation accuracy and confidence scores
- Test visual annotation detection (circles, checkmarks)
- Validate handling of edge cases (poor handwriting, smudged faxes)
- Test conversation context maintenance

### Load Testing
- Simulate concurrent fax arrivals
- Test queue processing under load
- Verify database performance with large datasets
- Test rate limiting and backpressure handling

### Security Testing
- Verify webhook signature validation
- Test authentication and authorization
- Validate PII handling and data encryption
- Test SQL injection and XSS prevention
- Verify payment data security (PCI compliance)

## Automatic User Registration

### First Fax Flow

When a fax is received from a phone number:

1. **Check if user exists**: Query database for user with matching phone number
2. **If user doesn't exist**:
   - Create new user record with phone number as identifier
   - Generate email address: `{phone_number}@me.faxi.jp`
   - Initialize default preferences and feature flags
   - Set `first_fax_at` timestamp
   - Mark this fax for special welcome response

3. **Process fax normally**: Continue with AI interpretation and action execution

4. **Generate welcome fax** (in addition to or instead of normal response):
```
┌─────────────────────────────────────┐
│ Welcome to Faxi!                    │
│                                     │
│ Thank you for your fax. Your        │
│ account is now active.              │
│                                     │
│ Your email address:                 │
│ {phone_number}@me.faxi.jp           │
│                                     │
│ Emails sent here will be faxed to   │
│ you automatically.                  │
│                                     │
│ ─────────────────────────────────── │
│ OPTIONAL: Help us serve you better  │
│                                     │
│ Your name: ___________________      │
│                                     │
│ ─────────────────────────────────── │
│ WHAT YOU CAN DO:                    │
│                                     │
│ • Send emails                       │
│ • Shop online (Amazon, etc.)        │
│ • Ask AI questions                  │
│ • [Other services...]               │
│                                     │
│ Circle topics for detailed help:    │
│ ○ How to send email                 │
│ ○ How to shop online                │
│ ○ How to ask AI questions           │
│ ○ Payment methods                   │
│ ○ All of the above                  │
│                                     │
│ Fax back for more information.      │
│ Ref: FX-2024-001000                 │
│                                     │
│ Support: [phone/fax number]         │
└─────────────────────────────────────┘
```

5. **If user provides information**:
   - Update user name if provided
   - Send payment registration instructions if requested
   - Send detailed help faxes for circled topics

### Account Model

- **One account per fax machine**: Phone number is the unique identifier
- **No person identification**: System cannot distinguish between multiple people using same fax machine
- **Shared context**: All faxes from same number share conversation history and preferences
- **Privacy consideration**: Users should be aware that anyone with access to the fax machine can access the account

### Feature Gating

**Current State (MVP)**:
- All features enabled for all users
- No subscription tiers or payment required

**Future State**:
```typescript
interface FeatureFlags {
  email_enabled: boolean;
  shopping_enabled: boolean;
  ai_chat_enabled: boolean;
  max_emails_per_month: number;
  max_shopping_orders_per_month: number;
  premium_features: string[]; // Future premium features
  subscription_tier: 'free' | 'basic' | 'premium';
}
```

**Implementation**:
- Feature flags stored in `users.feature_flags` JSONB column
- Check feature access before executing actions
- Graceful degradation: inform user if feature is not available
- Easy to add new features and control access

## Security Considerations

### Data Protection
- Encrypt fax images at rest (S3 server-side encryption)
- Encrypt sensitive data in database (payment info, addresses)
- Use TLS for all API communications
- Implement data retention policies (delete old faxes after 90 days)

### Authentication & Authorization
- Verify Telnyx webhook signatures
- Use API keys for service-to-service communication
- Implement rate limiting on public endpoints
- Validate user ownership before accessing data

### PCI Compliance
- Never store raw credit card numbers
- Use Stripe tokenization for card data
- Minimize PCI scope by using Stripe Elements
- Regular security audits

### Privacy
- Obtain user consent for data processing
- Provide data access and deletion mechanisms
- Comply with Japanese privacy laws
- Anonymize logs and analytics data

## Deployment Architecture

### Infrastructure
- **Application**: Node.js/TypeScript services on containerized platform (ECS, Cloud Run, or Kubernetes)
- **Database**: PostgreSQL (managed service like RDS or Cloud SQL)
- **Queue**: Redis or managed queue service (SQS, Cloud Tasks)
- **Object Storage**: S3-compatible storage
- **Email**: SendGrid, AWS SES, or self-hosted Postfix
- **Monitoring**: Application logs, metrics, and alerts

### Scalability
- Horizontal scaling of worker processes
- Database read replicas for queries
- CDN for static fax documents
- Queue-based architecture prevents overload
- Rate limiting protects external APIs

### High Availability
- Multi-AZ database deployment
- Redundant worker processes
- Health checks and automatic restarts
- Graceful degradation when services fail
- Circuit breakers for external dependencies

## Future Enhancements

1. **Multi-language Support**: Expand beyond Japanese and English
2. **Voice Integration**: Add phone call support for voice requests
3. **Advanced Shopping**: Support for multiple retailers, price comparison
4. **Bill Payment**: Utility bills, subscriptions via fax
5. **Document Services**: Government forms, applications
6. **Family Accounts**: Multiple users sharing one fax number
7. **Mobile App**: Companion app for family members to monitor elderly users
8. **Analytics Dashboard**: Usage patterns, popular services, system health
