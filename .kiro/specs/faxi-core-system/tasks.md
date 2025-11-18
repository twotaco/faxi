# Implementation Plan

- [x] 1. Set up project infrastructure and core database
  - Initialize Node.js/TypeScript project with necessary dependencies
  - Configure PostgreSQL database with connection pooling
  - Set up Redis for job queue management
  - Configure S3-compatible object storage for fax images
  - Create environment configuration management
  - _Requirements: 1.3, 9.5_

- [x] 2. Implement database schema and models
- [x] 2.1 Create database migration system
  - Set up migration tool (e.g., Knex.js or TypeORM migrations)
  - Create initial migration for all tables
  - _Requirements: 1.3, 9.1, 9.2_

- [x] 2.2 Implement core data models
  - Create User model with phone number and email address fields
  - Create FaxJob model with reference ID, direction, status, and context tracking
  - Create ConversationContext model for multi-step interaction tracking
  - Create PaymentMethod model with Stripe integration fields
  - Create Order model for e-commerce transactions
  - Create AddressBook model for contact management
  - Create AuditLog model for system operation tracking
  - _Requirements: 1.3, 5.1, 8.1, 9.1, 9.2, 9.3, 11.1_

- [x] 2.3 Implement reference ID generation system
  - Create function to generate unique reference IDs in FX-YYYY-NNNNNN format
  - Implement sequential numbering with year prefix
  - Add reference ID to all outbound fax records
  - _Requirements: 1.3, 7.1_

- [x] 3. Build Telnyx webhook receiver and user registration
- [x] 3.1 Create webhook endpoint for inbound faxes
  - Implement POST /webhooks/telnyx/fax/received endpoint
  - Parse Telnyx webhook payload
  - Return 200 OK response within 5 seconds
  - _Requirements: 1.1, 1.2, 1.4_

- [x] 3.2 Implement webhook signature verification
  - Verify Telnyx-Signature-Ed25519 header
  - Validate timestamp to prevent replay attacks
  - Reject invalid signatures with 401 response
  - _Requirements: 1.2_

- [x] 3.3 Implement automatic user registration
  - Check if user exists by phone number
  - Create new user record on first fax receipt
  - Generate email address in format {phone_number}@me.faxi.jp
  - Initialize default preferences and feature flags
  - _Requirements: 8.1_

- [x] 3.4 Implement fax job enqueueing
  - Store raw webhook payload in audit log
  - Create FaxJob record with pending status
  - Download fax image from Telnyx media URL
  - Upload fax image to S3 storage
  - Enqueue processing job with fax metadata
  - Handle duplicate deliveries using fax_id as idempotency key
  - _Requirements: 1.3, 1.5, 9.1_

- [x] 4. Implement repository and service layer
- [x] 4.1 Create user repository
  - Implement CRUD operations for users table
  - Add methods for finding users by phone number and email
  - Add method for creating users with auto-generated email
  - _Requirements: 8.1_

- [x] 4.2 Create fax job repository
  - Implement CRUD operations for fax_jobs table
  - Add methods for querying by status, user, and reference ID
  - Add method for updating job status and results
  - _Requirements: 1.3, 9.1, 9.2_

- [x] 4.3 Create conversation context repository
  - Implement CRUD operations for conversation_contexts table
  - Add methods for finding active contexts by user
  - Add method for context recovery by reference ID
  - Add method for expiring old contexts
  - _Requirements: 2.6, 6.5_

- [x] 4.4 Create address book repository
  - Implement CRUD operations for address_book table
  - Add methods for searching contacts by name/relationship
  - Add method for automatic contact addition from emails
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 4.5 Create order repository
  - Implement CRUD operations for orders table
  - Add methods for querying order history
  - Add method for tracking order status
  - _Requirements: 4.5, 9.2_

- [x] 4.6 Create payment method repository
  - Implement CRUD operations for payment_methods table
  - Add methods for managing user payment methods
  - Add method for getting default payment method
  - _Requirements: 5.1, 5.2_

- [x] 4.7 Create audit log service
  - Implement logging service for all system operations
  - Add methods for logging fax receipts, transmissions, and API calls
  - Add method for querying logs by entity and time range
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 5. Implement AI Vision Interpreter
- [x] 5.1 Create vision interpretation service
  - Integrate Google Gemini 2.5 Flash for multimodal vision interpretation
  - Implement image preprocessing for optimal fax interpretation
  - Create system prompt explaining Faxi context and user behaviors
  - _Requirements: 2.1, 2.2_

- [x] 5.2 Implement intent and parameter extraction
  - Extract action type (email, shopping, AI chat, payment registration)
  - Extract parameters (recipient addresses, product names, questions, selections)
  - Calculate confidence scores for interpretation
  - Identify when clarification is needed (confidence < 0.7)
  - _Requirements: 2.3, 2.4, 2.6_

- [x] 5.3 Implement visual annotation detection
  - Detect circles, checkmarks, underlines, and arrows
  - Extract bounding boxes for visual annotations
  - Associate annotations with nearby text or form elements
  - Recognize Faxi template structures (reply forms, order forms)
  - _Requirements: 2.2, 2.5_

- [x] 5.4 Implement context recovery system
  - Extract reference IDs from fax images
  - Detect Faxi template patterns for automatic context linking
  - Implement content matching algorithm for ambiguous faxes
  - Query recent conversation contexts for same user
  - Generate disambiguation requests when multiple contexts match
  - _Requirements: 2.6, 6.5_

- [x] 6. Build MCP Controller Agent
- [x] 6.1 Set up agent orchestration framework
  - Integrate LangChain or similar agent framework
  - Configure MCP protocol client for tool access
  - Implement agent execution loop with tool calling
  - Create system prompt emphasizing round-trip minimization
  - _Requirements: 2.3, 2.4_

- [x] 6.2 Implement agent decision framework
  - Create logic to determine if request can complete immediately
  - Implement bundling strategy for multiple user requests
  - Add proactive suggestion logic (complementary items, bundles)
  - Implement payment method checking and barcode generation decision
  - Create multi-step workflow orchestration
  - _Requirements: 3.1, 4.1, 4.2, 4.3, 4.4, 5.2, 5.3_

- [x] 6.3 Implement agent state management
  - Track tool execution steps for audit trail
  - Store intermediate results for multi-step workflows
  - Handle tool execution errors with retry logic
  - Generate human-readable action summaries
  - _Requirements: 9.3, 9.4_

- [x] 7. Implement Email MCP Server
- [x] 7.1 Create MCP server structure
  - Set up MCP server with tool registration
  - Implement tool input validation using JSON schemas
  - Create error handling for tool execution
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 7.2 Implement send_email tool
  - Integrate with email service provider (SendGrid, AWS SES, or Postfix)
  - Compose email from user's Faxi email address
  - Send email and return message ID
  - Log email sending in audit trail
  - _Requirements: 3.1, 3.2, 3.3, 9.4_

- [x] 7.3 Implement get_email_thread tool
  - Retrieve email conversation history by thread ID
  - Parse email thread structure
  - Return formatted email history
  - _Requirements: 3.5_

- [x] 7.4 Implement search_emails tool
  - Search user's email history by query
  - Return matching emails with snippets
  - Limit results to prevent overwhelming responses
  - _Requirements: 3.5_

- [x] 7.5 Implement address book management tools
  - Create get_address_book tool to retrieve user's contacts
  - Create add_contact tool to add new contacts
  - Create lookup_contact tool to find email by name/relationship
  - Automatically add senders to address book when emails are received
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 7.6 Implement spam filtering for incoming emails
  - Integrate AI to analyze email content for spam indicators
  - Filter out promotional emails, newsletters, automated notifications
  - Only fax personal emails, important transactional emails, and emails from address book
  - Allow user to configure spam sensitivity
  - _Requirements: 3.6_

- [x] 7.7 Implement smart reply generation for emails
  - Analyze email content to detect clear questions
  - Generate 2-3 quick reply options when applicable
  - Include quick reply options in email fax template
  - _Requirements: 3.8_

- [x] 8. Implement Shopping MCP Server
- [x] 8.1 Create MCP server structure
  - Set up MCP server with tool registration
  - Implement tool input validation
  - Create error handling for e-commerce API failures
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 8.2 Implement search_products tool
  - Integrate with Amazon Product Advertising API or similar
  - Search for products by query string
  - Return product details (ID, name, price, description, image URL, delivery estimate)
  - Cache search results for follow-up selections
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 8.3 Implement get_product_details tool
  - Fetch detailed product information by product ID
  - Return specifications, reviews, and availability
  - _Requirements: 4.2, 4.3_

- [x] 8.4 Implement shopping cart tools
  - Create add_to_cart tool to add products to user's cart
  - Create get_cart tool to view cart contents
  - Implement cart persistence in database
  - _Requirements: 4.4_

- [x] 8.5 Implement checkout tool
  - Complete purchase using payment method on file
  - Coordinate with Payment MCP Server for transaction
  - Place order through e-commerce API
  - Return order ID and tracking information
  - _Requirements: 4.4, 4.5, 5.2, 5.5_

- [x] 8.6 Implement proactive shopping tools
  - Create get_complementary_products tool using "customers also bought" data
  - Create get_bundle_deals tool for bulk discounts
  - Return suggestions with pricing and savings information
  - Prioritize items that enhance or complete the purchase (e.g., batteries for flashlight)
  - _Requirements: 4.2, 4.3_

- [x] 9. Implement Payment MCP Server
- [x] 9.1 Create MCP server structure
  - Set up MCP server with tool registration
  - Integrate Stripe SDK
  - Implement PCI-compliant payment handling
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9.2 Implement payment method management tools
  - Create get_payment_methods tool to list user's payment methods
  - Create register_payment_method tool for adding new payment methods
  - Store payment methods securely using Stripe Customer and PaymentMethod objects
  - _Requirements: 5.1_

- [x] 9.3 Implement process_payment tool
  - Charge payment method using Stripe
  - Handle payment confirmation and errors
  - Return transaction ID and status
  - _Requirements: 5.2, 5.5_

- [x] 9.4 Implement generate_konbini_barcode tool
  - Create Stripe Konbini payment intent for convenience store payment
  - Generate barcode data and image URL
  - Return barcode with expiration date and instructions
  - _Requirements: 5.3, 5.4_

- [x] 9.5 Implement check_payment_status tool
  - Query payment status by transaction ID
  - Return payment confirmation details
  - _Requirements: 5.5_

- [x] 9.6 Implement Stripe webhook handler
  - Create endpoint for Stripe payment confirmation webhooks
  - Verify webhook signatures
  - Update order status on payment completion
  - Trigger order placement for konbini payments
  - _Requirements: 5.5_

- [x] 10. Implement AI Chat MCP Server
- [x] 10.1 Create MCP server structure
  - Set up MCP server with tool registration
  - Integrate Google Gemini 2.5 Flash for AI chat
  - _Requirements: 6.1, 6.2_

- [x] 10.2 Implement chat tool
  - Send user message to LLM with conversation context
  - Format response for fax readability (short paragraphs, bullet points)
  - Limit response length to fit on fax pages
  - Return response and conversation ID
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [x] 10.3 Implement conversation management tools
  - Create get_conversation tool to retrieve conversation history
  - Create summarize_conversation tool for conversation summaries
  - Store conversation history in database
  - Implement conversation expiration (24 hours per requirements, 7 days per design)
  - _Requirements: 6.5_

- [x] 11. Implement User Profile MCP Server
- [x] 11.1 Create MCP server structure
  - Set up MCP server with tool registration
  - Implement user data access controls
  - Design for modularity to support future MCP server additions
  - _Requirements: 8.1_

- [x] 11.2 Implement profile management tools
  - Create get_user_profile tool to retrieve user information
  - Create update_delivery_address tool for shipping address management
  - Store user preferences and delivery addresses
  - _Requirements: 4.1, 8.1_

- [x] 11.3 Implement address book management tools
  - Create get_address_book tool to list all contacts
  - Create add_contact tool to manually add contacts
  - Create update_contact tool to modify contact details
  - Create delete_contact tool to remove contacts
  - Create lookup_contact tool to find contact by name/relationship
  - Implement automatic contact addition from received emails
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 11.4 Implement order management tools
  - Create get_order_history tool to view past orders
  - Create track_order tool to get order status and tracking
  - Integrate with e-commerce API for order tracking
  - _Requirements: 4.5, 9.2_

- [x] 12. Build Response Generator
- [x] 12.1 Create fax template system
  - Design template structure for different response types
  - Implement template rendering engine
  - Create templates for: email reply, product selection, payment barcodes, confirmation, multi-action, clarification
  - _Requirements: 3.4, 4.3, 4.5, 5.4, 6.3, 7.1_

- [x] 12.2 Implement TIFF generation
  - Create function to generate TIFF images at 204x196 DPI
  - Implement text rendering with clear, large fonts (minimum 12pt)
  - Add page numbers for multi-page documents
  - Include Faxi branding and support contact on each page
  - Add reference ID to header or footer of every page
  - _Requirements: 7.1, 7.3, 7.4_

- [x] 12.3 Implement email fax generation
  - Create template with email content
  - Include quick reply options when email contains clear questions (circle A/B/C)
  - Add reference ID footer: "Reply via fax. Ref: FX-YYYY-NNNNNN | You can reply on a blank page. We'll match it."
  - Include blank space for custom replies
  - Minimize extra pages to reduce cost and paper waste
  - _Requirements: 3.4, 3.5, 3.8, 7.1_

- [x] 12.4 Implement product selection form generation
  - Create template with product options and checkboxes/circles
  - Include pricing, descriptions, and delivery estimates
  - Add optional complementary items section
  - Include payment instructions (charge on file or barcode)
  - _Requirements: 4.3, 5.3, 5.4, 7.1_

- [x] 12.5 Implement payment barcode fax generation
  - Create template with product info and barcode image
  - Include clear payment instructions for convenience stores
  - Add barcode expiration date
  - Support multiple barcodes per fax for different products
  - _Requirements: 5.4, 7.1_

- [x] 12.6 Implement confirmation fax generation
  - Create template for order confirmations with order ID and tracking
  - Create template for email sent confirmations
  - Create template for general action completions
  - _Requirements: 3.4, 4.5, 7.1_

- [x] 12.7 Implement clarification request generation
  - Create template for ambiguous requests
  - Include specific questions and required information
  - Add reference ID and support contact
  - For multiple active conversations, list recent topics with reference IDs
  - _Requirements: 2.6, 10.5_

- [x] 13. Implement Fax Sender
- [x] 13.1 Create Telnyx fax sending integration
  - Implement function to upload TIFF to publicly accessible URL
  - Call Telnyx API to send fax with media URL
  - Handle API errors and rate limiting
  - _Requirements: 7.4_

- [x] 13.2 Implement retry logic
  - Retry failed fax deliveries up to 3 times
  - Use exponential backoff between retries
  - Log all delivery attempts
  - _Requirements: 7.5_

- [x] 13.3 Implement delivery status tracking
  - Create webhook endpoint for Telnyx delivery status
  - Update FaxJob status based on delivery confirmation
  - Alert operators on repeated delivery failures
  - _Requirements: 7.5, 9.2, 10.4_

- [x] 14. Implement Email-to-Fax Bridge
- [x] 14.1 Configure email MX records
  - Set up MX records for me.faxi.jp domain
  - Configure email service to receive emails
  - _Requirements: 8.1, 8.2_

- [x] 14.2 Create email webhook receiver
  - Implement endpoint to receive incoming emails
  - Parse email headers, body, and attachments
  - Extract recipient phone number from email address
  - _Requirements: 8.2, 8.3_

- [x] 14.3 Implement email-to-fax conversion
  - Convert email text content to fax format
  - Handle basic HTML formatting
  - Add attachment notifications for emails with attachments
  - Generate TIFF document from email content
  - _Requirements: 8.3, 8.4, 8.5_

- [x] 14.4 Implement email-to-fax delivery
  - Enqueue fax sending job for converted email
  - Send fax to user's fax number
  - Process within 2 minutes of email receipt
  - _Requirements: 8.3_

- [x] 15. Build Fax Processor Worker
- [x] 15.1 Create job queue worker
  - Implement BullMQ worker to consume fax processing jobs from queue
  - Handle job failures with retry logic and exponential backoff
  - Implement graceful shutdown and cleanup
  - Update fax job status throughout processing pipeline
  - _Requirements: 1.3_

- [x] 15.2 Implement processing pipeline orchestration
  - Download and store fax image from Telnyx (already done in webhook handler)
  - Call AI Vision Interpreter for intent extraction
  - Recover or create conversation context
  - Pass interpretation to MCP Controller Agent
  - Collect agent results
  - Pass results to Response Generator
  - Send response fax via Fax Sender
  - _Requirements: 1.3, 2.1, 2.3, 3.3, 4.4, 6.4, 7.1, 7.4_

- [x] 15.3 Implement error handling
  - Catch and log all processing errors
  - Generate appropriate error faxes for user-facing issues
  - Alert operators for system errors
  - Update FaxJob status appropriately
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 16. Implement welcome fax generation
- [x] 16.1 Create welcome and onboarding fax template
  - Generate welcome fax thanking user for first contact
  - Include user's dedicated email address ({phone_number}@me.faxi.jp)
  - Request optional information: name, payment method registration
  - Provide basic instructions for common actions (email, shopping, AI chat)
  - Offer detailed help on specific topics (circle topics of interest)
  - Include reference ID and support contact
  - _Requirements: 8.1_

- [x] 16.2 Implement welcome fax sending logic
  - Detect first-time users in fax processor
  - Generate and send welcome fax after processing first request
  - Store welcome fax sent flag to avoid duplicates
  - _Requirements: 8.1_

- [x] 17. Create test harness for Telnyx-free testing
- [x] 17.1 Create test webhook endpoint
  - Implement POST /test/fax/receive endpoint that accepts PDF/TIFF uploads
  - Bypass Telnyx signature verification in test mode
  - Generate mock fax metadata (from/to numbers, fax ID)
  - Enqueue fax processing job directly
  - _Requirements: All_

- [x] 17.2 Create test UI for fax simulation
  - Build simple web interface to upload fax images
  - Display processing status and results
  - Show generated response fax as downloadable PDF/TIFF
  - Include conversation history viewer
  - Allow setting test user phone number
  - _Requirements: All_

- [x] 17.3 Implement mock Telnyx sender for testing
  - Create mock fax sender that saves TIFF to local storage instead of calling Telnyx
  - Display outbound faxes in test UI
  - Allow downloading response faxes
  - Track delivery status locally
  - _Requirements: 7.4, 7.5_

- [x] 17.4 Create test data fixtures
  - Create sample fax images for common scenarios (email request, shopping, AI chat)
  - Create sample fax images with visual annotations (circles, checkmarks)
  - Create sample reply faxes with filled-in forms
  - Include edge cases (poor handwriting, ambiguous requests)
  - _Requirements: All_

- [x] 18. Create deployment configuration
- [x] 18.1 Set up containerization (Docker)
  - Create Dockerfile for the application
  - Create docker-compose.yml for local development
  - Configure environment variables and secrets management
  - _Requirements: All_

- [x] 18.2 Create deployment manifests
  - Create deployment manifests for cloud platform (Kubernetes/ECS)
  - Set up database connection pooling and scaling
  - Configure Redis for job queue
  - Set up S3 bucket policies and access controls
  - Include test mode flag configuration
  - _Requirements: All_

- [x] 19. Write integration tests
  - Test complete fax processing pipeline with sample fax images using test harness
  - Test automatic user registration on first fax
  - Test email-to-fax flow end-to-end with address book
  - Test shopping workflow with product selection and payment
  - Test context recovery with multiple conversation scenarios
  - Test error handling and retry logic
  - Test spam filtering for incoming emails
  - Test smart reply generation for emails with questions
  - All tests should use test harness to avoid Telnyx costs
  - _Requirements: All_