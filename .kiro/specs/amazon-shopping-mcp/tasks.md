# Amazon.co.jp Proxy Shopping Service - Implementation Tasks

## Task Overview

This implementation plan breaks down the Amazon Shopping MCP service into discrete, manageable coding tasks. Each task builds incrementally on previous work, with property-based tests integrated throughout to catch errors early. The plan follows an implementation-first approach: build features, then test them.

## Implementation Tasks

- [x] 1. Set up Amazon Product Advertising API integration
  - Create PA-API client wrapper with authentication
  - Implement product search method with filters (Prime, rating, price)
  - Implement product details retrieval by ASIN
  - Add error handling for rate limiting and API errors
  - Configure environment variables for PA-API credentials
  - _Requirements: 1.1, 1.2, 8.1_

- [x] 1.1 Write property test for PA-API search filters
  - **Property 2: Product Quality Filtering**
  - **Validates: Requirements 1.4, 8.1, 8.2**

- [x] 2. Implement product curation service
  - Create LLM prompt for product curation with quality criteria
  - Implement product filtering logic (Prime, 3.5+ stars, Amazon.co.jp seller)
  - Implement product title truncation to 60 characters
  - Implement price range diversity selection (low/mid/premium)
  - Implement selection marker assignment (A, B, C, D, E)
  - _Requirements: 1.3, 1.4, 8.2, 8.3, 8.4, 8.5_

- [x] 2.1 Write property test for search result count bounds
  - **Property 1: Product Search Result Count Bounds**
  - **Validates: Requirements 1.3**

- [x] 2.2 Write property test for product title truncation
  - **Property 3: Product Title Truncation**
  - **Validates: Requirements 8.5**

- [x] 2.3 Write property test for Amazon.co.jp seller prioritization
  - **Property 18: Amazon.co.jp Seller Prioritization**
  - **Validates: Requirements 8.3**

- [x] 2.4 Write property test for price range diversity
  - **Property 19: Price Range Diversity**
  - **Validates: Requirements 8.4**

- [x] 3. Create Shopping MCP Server
  - Implement MCP server registration in backend/src/mcp/index.ts
  - Create shoppingMcpServer.ts with tool definitions
  - Implement search_products tool
  - Implement get_product_details tool
  - Implement create_order tool
  - Implement get_order_status tool
  - Implement list_user_orders tool
  - Wire up to MCP Controller Agent
  - _Requirements: 1.1, 1.2, 2.1, 5.3_

- [-] 4. Implement product options fax generator
  - Create productSelectionFaxGenerator.ts service
  - Implement fax template with product grid layout
  - Format prices in Japanese Yen with comma separators
  - Add selection markers (circles with A, B, C, D, E)
  - Include delivery estimates and Prime badges
  - Ensure 12pt minimum font size for readability
  - _Requirements: 1.5, 8.5_

- [ ] 4.1 Write property test for fax content completeness
  - **Property 4: Fax Content Completeness**
  - **Validates: Requirements 1.5**

- [x] 5. Extend database schema for shopping orders
  - Create migration file 012_add_shopping_order_fields.sql
  - Add product_asin, product_title, product_image_url columns to orders table
  - Add quantity, quoted_price, actual_price columns
  - Add stripe_payment_intent_id, admin_user_id, purchased_at columns
  - Create index idx_orders_status_paid for pending purchase queue
  - Run migration and verify schema changes
  - _Requirements: 2.2, 2.3, 6.1, 6.2_

- [x] 6. Implement order management service
  - Create orderManagementService.ts
  - Implement createOrder method with initial state "pending_payment"
  - Implement updateOrderStatus method with state machine validation
  - Implement getOrderByReferenceId method
  - Implement getPendingPurchaseOrders method for admin queue
  - Implement validateOrderForPurchase method (price/stock check)
  - Implement completePurchase method to capture Amazon Order ID
  - _Requirements: 2.2, 2.3, 4.1, 4.6, 6.1, 6.2, 9.1-9.6_

- [x] 6.1 Write property test for order initial state
  - **Property 5: Order Initial State**
  - **Validates: Requirements 2.2, 2.3, 9.1**

- [x] 6.2 Write property test for order status lifecycle state machine
  - **Property 9: Order Status Lifecycle State Machine**
  - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**

- [x] 7. Implement payment service for shopping orders
  - Create paymentService.ts (or extend existing)
  - Implement createPaymentIntent method for orders
  - Implement chargePaymentMethod for card on file auto-charge
  - Implement createBankTransferIntent with Stripe
  - Implement handlePaymentWebhook for payment confirmation
  - Update order status to "paid" on successful payment
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 7.1_

- [x] 7.1 Write property test for payment method auto-charge
  - **Property 6: Payment Method Auto-Charge**
  - **Validates: Requirements 3.1**

- [x] 7.2 Write property test for bank transfer fallback
  - **Property 7: Bank Transfer Fallback**
  - **Validates: Requirements 3.2, 3.3, 7.5**

- [x] 7.3 Write property test for payment confirmation state transition
  - **Property 8: Payment Confirmation State Transition**
  - **Validates: Requirements 3.5, 9.2**

- [x] 8. Create order confirmation fax generator
  - Extend confirmationFaxGenerator.ts or create shopping-specific version
  - Generate fax with order summary (product, price, quantity)
  - Include payment instructions for card or bank transfer
  - Add Reference ID prominently
  - Format in Japanese with clear sections
  - _Requirements: 2.4, 2.5, 3.3_

- [x] 9. Implement visual annotation detection for product selection
  - Extend visualAnnotationDetector.ts to detect selection markers
  - Detect circles around A, B, C, D, E markers
  - Detect checkmarks next to products
  - Map detected selection to product ASIN from conversation context
  - Handle ambiguous or multiple selections with clarification
  - _Requirements: 2.1_

- [x] 10. Integrate shopping flow into fax processing pipeline
  - Update intentExtractor.ts to recognize shopping intents
  - Add shopping intent to LLM schema (product_search, order_status)
  - Wire shopping MCP server into mcpControllerAgent.ts
  - Implement conversation context management for shopping sessions
  - Handle product search → selection → order creation flow
  - _Requirements: 1.1, 1.2, 2.1, 5.3_

- [-] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement browser automation service
  - Create browserAutomationService.ts using Playwright
  - Implement prepareCheckout method to navigate Amazon
  - Implement addToCart method with ASIN and quantity
  - Implement fillShippingAddress method
  - Implement navigateToReview method (stop before Place Order)
  - Implement extractCheckoutDetails method for price/stock validation
  - Add error handling for UI changes and captchas
  - _Requirements: 4.3, 6.2, 6.5_

- [ ] 13. Create admin order controller API endpoints
  - Create adminOrderController.ts in backend/src/webhooks/
  - Implement GET /api/admin/orders/pending endpoint
  - Implement GET /api/admin/orders/:id endpoint with full order details
  - Implement POST /api/admin/orders/:id/prepare-checkout endpoint
  - Implement POST /api/admin/orders/:id/complete-purchase endpoint
  - Implement POST /api/admin/orders/:id/cancel endpoint
  - Add authentication middleware for admin endpoints
  - _Requirements: 4.1, 4.2, 4.3, 4.6_

- [x] 14. Build admin dashboard pending purchase queue UI
  - Create admin-dashboard/app/(dashboard)/orders/pending/page.tsx
  - Display table of orders with status "paid"
  - Show order details: product, price, user, payment status
  - Add filters and sorting (date, price, user)
  - Implement real-time updates with polling or SSE
  - Add pagination for large order lists
  - _Requirements: 4.1, 4.2_

- [ ] 15. Build admin dashboard order detail view
  - Create admin-dashboard/app/(dashboard)/orders/[id]/page.tsx
  - Display fax image thumbnail and full-size view
  - Show parsed product selection and user information
  - Display payment status with Stripe payment intent details
  - Show price validation with discrepancy highlighting
  - Display stock status with last checked timestamp
  - Add "Prepare Checkout" button
  - _Requirements: 4.2, 6.1, 6.3_

- [ ] 15.1 Write property test for price discrepancy highlighting
  - **Property 10: Price Discrepancy Highlighting**
  - **Validates: Requirements 6.3**

- [ ] 15.2 Write property test for out-of-stock prevention
  - **Property 11: Out-of-Stock Prevention**
  - **Validates: Requirements 6.5**

- [ ] 16. Implement admin checkout preparation workflow
  - Add browser automation trigger in order detail view
  - Display loading state while automation runs
  - Show extracted checkout details (price, shipping, tax)
  - Highlight price discrepancies in red if > ¥50 difference
  - Display out-of-stock warnings if product unavailable
  - Provide "Open Amazon Checkout" button to new tab
  - Add "Complete Purchase" form to capture Amazon Order ID
  - _Requirements: 4.3, 4.4, 6.2, 6.3, 6.5_

- [x] 17. Implement purchase completion and confirmation
  - Handle "Complete Purchase" form submission
  - Validate Amazon Order ID format
  - Update order status to "purchased"
  - Record admin user ID and purchase timestamp
  - Trigger purchase confirmation fax generation
  - Send confirmation fax to user
  - _Requirements: 4.6, 5.1_

- [x] 18. Create purchase confirmation fax generator
  - Create purchaseConfirmationFaxGenerator.ts
  - Include order summary with Amazon Order ID
  - Show estimated delivery date
  - Add tracking information section (to be filled later)
  - Format in Japanese with clear sections
  - Include Reference ID for future inquiries
  - _Requirements: 5.1_

- [x] 19. Implement order status tracking
  - Add tracking number field to order detail view
  - Implement tracking number update endpoint
  - Update order status to "shipped" when tracking added
  - Create order status fax generator
  - Handle user requests for order status via fax
  - _Requirements: 5.2, 5.3, 5.4_

- [ ] 19.1 Write property test for reference ID order lookup
  - **Property 15: Reference ID Order Lookup**
  - **Validates: Requirements 5.3**

- [ ] 19.2 Write property test for status fax content completeness
  - **Property 16: Status Fax Content Completeness**
  - **Validates: Requirements 5.4**

- [ ] 19.3 Write property test for tracking number persistence
  - **Property 17: Tracking Number Persistence**
  - **Validates: Requirements 5.2**

- [ ] 20. Implement delivery confirmation workflow
  - Add "Mark as Delivered" button in admin dashboard
  - Update order status to "delivered"
  - Trigger delivery confirmation fax generation
  - Send delivery confirmation fax to user
  - _Requirements: 5.5_

- [ ] 21. Implement payment method security measures
  - Verify payment method repository only stores Stripe IDs
  - Add encryption for payment method IDs at rest
  - Implement audit logging for payment method operations
  - Add unit tests to verify no raw card data is stored
  - _Requirements: 7.2_

- [ ] 21.1 Write property test for payment method security
  - **Property 12: Payment Method Security**
  - **Validates: Requirements 7.2**

- [ ] 21.2 Write property test for default payment method uniqueness
  - **Property 13: Default Payment Method Uniqueness**
  - **Validates: Requirements 7.3**

- [ ] 22. Implement comprehensive audit logging
  - Extend auditLogService.ts for shopping events
  - Log product searches with query and result count
  - Log product selections with ASIN and price
  - Log payment processing with method and amount
  - Log admin purchase actions with admin ID and Amazon Order ID
  - Log all order status changes with previous/new status
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 22.1 Write property test for audit log completeness
  - **Property 14: Audit Log Completeness**
  - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

- [x] 23. Implement error handling and error faxes
  - Create error fax templates for common failures
  - Implement payment failure fax generator
  - Implement product unavailable fax generator
  - Implement PA-API error fax generator
  - Add retry logic with exponential backoff for PA-API
  - Add error recovery strategies for browser automation
  - _Requirements: NFR3_

- [x] 24. Add caching for product searches
  - Implement Redis caching for PA-API search results (5 min TTL)
  - Implement Redis caching for product details (1 hour TTL)
  - Implement cache invalidation on price updates
  - Add cache hit/miss metrics
  - _Requirements: NFR2_

- [x] 25. Implement rate limiting
  - Add rate limiting for PA-API requests (1 req/sec per user)
  - Add rate limiting for admin dashboard endpoints (60 req/min)
  - Implement request queuing for PA-API
  - Add rate limit metrics and alerts
  - _Requirements: NFR2, NFR4_

- [x] 26. Add monitoring and alerting
  - Implement metrics collection for shopping operations
  - Add metrics: search success rate, order completion rate, payment success rate
  - Add metrics: browser automation success rate, price discrepancy rate
  - Create monitoring dashboard in admin interface
  - Configure alerts for critical thresholds
  - _Requirements: NFR3_

- [x] 27. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 28. Write integration tests for complete shopping flow
  - Test end-to-end flow: search → selection → payment → purchase
  - Test card payment flow with auto-charge
  - Test bank transfer flow with webhook
  - Test error scenarios: out of stock, payment declined, price change
  - Test admin workflow: review → prepare → complete
  - _Requirements: All_

- [ ] 29. Perform manual testing and bug fixes
  - Test admin dashboard UI thoroughly
  - Test fax generation and readability
  - Test browser automation with real Amazon
  - Test payment flows with Stripe test mode
  - Fix any bugs discovered during testing
  - _Requirements: All_

- [ ] 30. Documentation and deployment preparation
  - Document PA-API setup and credentials
  - Document Stripe configuration for bank transfers
  - Document browser automation setup (Playwright, Amazon account)
  - Create admin user guide for order fulfillment
  - Update environment variables documentation
  - Prepare rollout plan for phased release
  - _Requirements: All_

## Task Dependencies

```
1 → 2 → 3 → 4 → 10
     ↓
     5 → 6 → 7 → 8 → 10 → 11
              ↓
              9 → 10

12 → 13 → 14 → 15 → 16 → 17 → 18

19 → 20

21 → 22 → 23 → 24 → 25 → 26 → 27 → 28 → 29 → 30
```

## Notes

- All property-based tests are required for comprehensive correctness validation
- Each property test should run a minimum of 100 iterations
- Integration tests (task 28) should cover the complete user journey
- Manual testing (task 29) is critical for UI/UX validation
- Checkpoints (tasks 11, 27) ensure stability before proceeding
- Property tests are placed immediately after implementing the corresponding functionality to catch bugs early

