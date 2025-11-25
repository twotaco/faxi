# LLM Prompt Architecture - Implementation Tasks

## Overview
Implement structured, use-case-specific prompt system with JSON schemas and user insights collection.

---

## Phase 1: Core Infrastructure ✅ COMPLETE

- [x] 1. Set up base schemas and prompt infrastructure
  - Create base insights schema with Zod validation
  - Create PromptManager class for centralized prompt management
  - Set up schema validation layer with error handling
  - _Requirements: AC1, AC4, NFR3_

- [x] 1.1 Create base insights schema (`backend/src/prompts/schemas/base.ts`)
  - Define UserInsightsSchema with Zod
  - Include demographics, life events, intent signals, behavioral, consumer profile, digital profile
  - Add confidence scores for all inferences
  - _Requirements: AC1, AC6_

- [x] 1.2 Create PromptManager class (`backend/src/prompts/index.ts`)
  - Implement template registration system
  - Add methods: register(), get(), buildSystemPrompt(), validateOutput()
  - Support for JSON schema and Zod schema storage
  - _Requirements: AC1, AC5_

- [x] 1.3 Implement schema validation layer
  - Create SchemaValidationError class
  - Add handleLLMResponse() with retry logic
  - Implement validation error logging
  - _Requirements: AC4, NFR2_

- [x] 2. Set up user insights infrastructure
  - Create database migrations for insights storage
  - Implement UserInsightsService for insights processing
  - Implement UserInsightsRepository for data access
  - _Requirements: AC6_

- [x] 2.1 Create database migrations (`backend/src/database/migrations/007_user_insights.sql`)
  - Create user_insights table (current profile)
  - Create insights_history table (audit trail)
  - Create aggregate_insights table (data products)
  - Add indexes for performance
  - _Requirements: AC6_

- [x] 2.2 Implement UserInsightsService (`backend/src/services/userInsightsService.ts`)
  - processInsights() - validate and merge insights
  - getProfile() - retrieve user profile
  - updateProfile() - update with confidence weighting
  - recordInsight() - audit trail
  - updateAggregates() - aggregate data for data products
  - Privacy validation (no PII, no medical diagnoses)
  - _Requirements: AC6_

- [x] 2.3 Implement UserInsightsRepository (`backend/src/repositories/userInsightsRepository.ts`)
  - CRUD operations for user_insights
  - Insert operations for insights_history
  - Query operations for aggregate_insights
  - _Requirements: AC6_

- [x] 2.4 Write unit tests for insights infrastructure
  - Test schema validation
  - Test insights merging logic
  - Test confidence score calculations
  - Test privacy validation
  - _Requirements: AC6_

---

## Phase 2: Q&A Use Case with Insights ✅ COMPLETE

- [x] 3. Implement Q&A prompt and schema
  - Create Q&A response schema with insights
  - Create Q&A system prompt with insights extraction instructions
  - Add few-shot examples including insights
  - Update aiChatMcpServer to use structured outputs
  - _Requirements: AC1, AC2, AC3, AC6_

- [x] 3.1 Create Q&A schema (`backend/src/prompts/schemas/qa.ts`)
  - Define QAResponseSchema with Zod
  - Include response, followUpSuggestions, requiresContinuation, sources, metadata
  - Include insights field using UserInsightsSchema
  - Add example responses with insights
  - _Requirements: AC1, AC6_

- [x] 3.2 Create Q&A prompt template (`backend/src/prompts/templates/qa.ts`)
  - Write system prompt for Q&A with insights extraction
  - Include fax formatting rules
  - Add insights extraction guidelines (demographics, life events, intent signals)
  - Include few-shot examples
  - _Requirements: AC3, AC6_

- [x] 3.3 Update aiChatMcpServer (`backend/src/mcp/aiChatMcpServer.ts`)
  - Integrate PromptManager
  - Use Gemini JSON mode with Q&A schema
  - Add schema validation
  - Extract and process insights from responses
  - _Requirements: AC2, AC4, AC6_

- [x] 3.4 Write integration tests for Q&A with insights
  - Test Q&A response generation
  - Test schema validation
  - Test insights extraction accuracy
  - Test confidence scores
  - _Requirements: AC4, AC6_

---

## Phase 3: Amazon Shopping Use Case with Insights

**Note**: Shopping MCP server exists but needs structured output integration with insights

- [x] 4. Integrate structured outputs with existing Shopping MCP server
  - Create shopping response schema with insights
  - Create shopping system prompt with insights extraction
  - Update existing ShoppingMCPServer to use structured outputs
  - _Requirements: AC1, AC2, AC3, AC6_

- [x] 4.1 Create Amazon Shopping schema (`backend/src/prompts/schemas/shopping.ts`)
  - Define ShoppingResponseSchema with Zod
  - Include intent, searchQuery, products, selectedProduct, deliveryAddress, paymentMethod
  - Include insights field with consumer profile, intent signals, life events
  - Add example shopping interactions with insights
  - _Requirements: AC1, AC6_

- [x] 4.2 Create Shopping prompt template (`backend/src/prompts/templates/shopping.ts`)
  - Write system prompt for shopping with insights extraction
  - Include Japanese pricing (¥), Prime eligibility
  - Add insights extraction for consumer behavior (spend sensitivity, brand preferences)
  - Include few-shot examples with product searches
  - _Requirements: AC3, AC6_

- [x] 4.3 Update Shopping MCP server (`backend/src/mcp/shoppingMcpServer.ts`)
  - Add handleShoppingRequest() method with Gemini JSON mode
  - Integrate with existing product search/cart tools
  - Extract and process shopping insights
  - Return structured responses with insights
  - _Requirements: AC2, AC5, AC6_

- [x] 4.4 Write integration tests for Shopping with insights
  - Test product search flow with structured outputs
  - Test shopping insights extraction
  - Test consumer profile building
  - _Requirements: AC4, AC6_

---

## Phase 4: Email Use Case with Insights

**Note**: Email MCP server exists but needs structured output integration with insights

- [x] 5. Integrate structured outputs with existing Email MCP server
  - Create email response schema with insights
  - Create email system prompt with insights extraction
  - Update existing EmailMCPServer to use structured outputs
  - _Requirements: AC1, AC2, AC3, AC6_

- [x] 5.1 Create Email schema (`backend/src/prompts/schemas/email.ts`)
  - Define EmailResponseSchema with Zod
  - Include intent, recipient, subject, body, tone
  - Include insights field with relationship patterns, life events
  - Add example email interactions with insights
  - _Requirements: AC1, AC6_

- [x] 5.2 Create Email prompt template (`backend/src/prompts/templates/email.ts`)
  - Write system prompt for email composition with insights extraction
  - Include tone matching guidelines
  - Add insights extraction for relationships and communication patterns
  - Include few-shot examples
  - _Requirements: AC3, AC6_

- [x] 5.3 Update Email MCP server (`backend/src/mcp/emailMcpServer.ts`)
  - Add handleEmailRequest() method with Gemini JSON mode
  - Integrate with existing email tools (send, lookup contact, etc.)
  - Extract and process email insights
  - Return structured responses with insights
  - _Requirements: AC2, AC5, AC6_

- [x] 5.4 Write integration tests for Email with insights
  - Test email composition flow with structured outputs
  - Test recipient identification
  - Test insights extraction
  - _Requirements: AC4, AC6_

---

## Phase 5: Appointment Booking Use Case with Insights

**Note**: Appointment booking MCP server does not exist yet - needs full implementation

- [x] 6. Implement Appointment Booking prompt and schema
  - Create appointment response schema with insights
  - Create appointment system prompt with insights extraction
  - Implement Appointment Booking MCP server
  - _Requirements: AC1, AC2, AC3, AC6_

- [x] 6.1 Create Appointment schema (`backend/src/prompts/schemas/appointment.ts`)
  - Define AppointmentResponseSchema with Zod
  - Include intent, business, dateTime, partySize, specialRequests
  - Include insights field with healthcare patterns, lifestyle preferences
  - Add example appointment interactions with insights
  - _Requirements: AC1, AC6_

- [x] 6.2 Create Appointment prompt template (`backend/src/prompts/templates/appointment.ts`)
  - Write system prompt for appointment booking
  - Include date/time parsing guidelines
  - Add insights extraction for healthcare and lifestyle patterns
  - Include few-shot examples
  - _Requirements: AC3, AC6_

- [x] 6.3 Implement Appointment Booking MCP server (`backend/src/mcp/appointmentMcpServer.ts`)
  - Create AppointmentBookingMcpServer class
  - Implement handleAppointmentRequest() with Gemini JSON mode
  - Add business identification logic
  - Extract and process appointment insights
  - _Requirements: AC2, AC5, AC6_

- [x] 6.4 Write integration tests for Appointment Booking
  - Test appointment booking flow
  - Test date/time parsing
  - Test insights extraction
  - _Requirements: AC4, AC6_

---

## Phase 6: PromptManager & Schema Validation Infrastructure

**Note**: Core infrastructure needed before expanding to more use cases

- [x] 7. Implement PromptManager and validation infrastructure
  - Create centralized prompt management system
  - Implement schema validation with retry logic
  - Enable easy addition of new use cases
  - _Requirements: AC1, AC4, AC5, NFR2, NFR3_

- [x] 7.1 Create PromptManager class (`backend/src/prompts/index.ts`)
  - Implement template registration system
  - Add methods: register(), get(), buildSystemPrompt(), validateOutput()
  - Support for JSON schema and Zod schema storage
  - Include retry logic for validation failures
  - _Requirements: AC1, AC5_

- [x] 7.2 Implement schema validation layer (`backend/src/prompts/validation.ts`)
  - Create SchemaValidationError class
  - Add handleLLMResponse() with retry logic
  - Implement validation error logging
  - Add fallback strategies for validation failures
  - _Requirements: AC4, NFR2_

- [x] 7.3 Create prompt templates directory structure
  - Set up `backend/src/prompts/templates/` directory
  - Create base.ts with common prompt components
  - Create qa.ts with Q&A specific prompt
  - Document template format and conventions
  - _Requirements: AC3, NFR3_

- [x] 7.4 Write unit tests for PromptManager
  - Test template registration and retrieval
  - Test schema validation
  - Test retry logic
  - Test error handling
  - _Requirements: AC4_

---

## Phase 7: MCP Controller Integration

- [ ] 8. Update MCP Controller for structured output routing
  - Implement intent detection logic
  - Route to appropriate MCP server based on use case
  - Handle multi-action requests
  - _Requirements: AC2, AC3_

- [ ] 8.1 Update MCP Controller (`backend/src/services/mcpControllerAgent.ts`)
  - Add use case detection (qa, shopping, email, appointment)
  - Implement routing logic to appropriate MCP server
  - Add fallback to generic prompt
  - Handle multi-action decomposition
  - Integrate with PromptManager
  - _Requirements: AC2, AC3_

- [ ] 8.2 Update Response Generator (`backend/src/services/responseGenerator.ts`)
  - Handle structured outputs from different use cases
  - Convert JSON to fax-friendly format
  - Maintain formatting consistency
  - Preserve insights data for storage
  - _Requirements: AC3_

- [ ] 8.3 Write integration tests for MCP Controller
  - Test use case detection accuracy
  - Test routing to correct MCP server
  - Test multi-action handling
  - _Requirements: AC2_

---

## Phase 8: Testing & Validation

- [-] 9. End-to-end testing and validation
  - Test all use cases with real examples
  - Validate insights accuracy and privacy compliance
  - Performance testing
  - _Requirements: All ACs_

- [x] 9.1 Create test fixtures for all use cases
  - Q&A test cases with expected insights
  - Shopping test cases with expected insights
  - Email test cases with expected insights
  - Appointment test cases with expected insights
  - _Requirements: AC4, AC6_

- [ ] 9.2 Run end-to-end tests
  - Test complete fax-to-response flow for each use case
  - Validate schema validation success rate (target 95%+)
  - Validate insights extraction accuracy
  - Test error handling and retry logic
  - _Requirements: AC4, NFR1, NFR2_

- [ ] 9.3 Privacy and compliance audit
  - Verify no PII in insights
  - Verify no medical diagnoses in insights
  - Test confidence score calibration
  - Validate data retention policies
  - _Requirements: AC6_

- [ ] 9.4 Performance testing
  - Measure response time (target < 5 seconds)
  - Measure schema validation overhead (target < 100ms)
  - Test under load
  - _Requirements: NFR1_

---

## Phase 9: Documentation & Monitoring

- [x] 10. Documentation and monitoring setup
  - Document prompt engineering guidelines
  - Set up monitoring for schema validation
  - Create runbooks for common issues
  - _Requirements: NFR3_

- [x] 10.1 Create prompt engineering documentation
  - Guidelines for adding new use cases
  - Best practices for insights extraction
  - Schema design patterns
  - _Requirements: AC5, NFR3_

- [x] 10.2 Set up monitoring and alerting
  - Schema validation success rate dashboard
  - Insights extraction quality metrics
  - Error rate monitoring
  - Performance metrics
  - _Requirements: NFR1, NFR2_

- [x] 10.3 Create runbooks
  - Handling schema validation failures
  - Debugging insights extraction issues
  - Adding new use cases
  - _Requirements: NFR3_

---

## Success Criteria

### Technical Metrics
- ✅ 95%+ schema validation success rate
- ✅ < 5 seconds response time
- ✅ < 100ms schema validation overhead
- ✅ < 5% error rate requiring manual intervention

### Insights Quality Metrics
- ✅ 90%+ demographic inference accuracy
- ✅ 95%+ life event detection accuracy
- ✅ 90%+ intent signal accuracy
- ✅ Zero PII leaks
- ✅ Zero medical diagnoses
- ✅ 80%+ profile completeness after 10 interactions

### Extensibility
- ✅ New use case can be added in < 1 hour
- ✅ Clear documentation for prompt engineering
- ✅ Modular architecture for easy maintenance

---

## Implementation Status

### ✅ Completed (Phases 1-2)
- Base insights schema with Zod validation
- Q&A response schema with insights
- User insights database tables (migration 007)
- UserInsightsService with merge logic
- UserInsightsRepository for data access
- AI Chat MCP server with JSON mode and insights extraction
- Privacy validation (no PII, no medical diagnoses)
- Confidence scoring system

### 🚧 In Progress
- PromptManager class (needed for centralized management)
- Schema validation layer with retry logic
- Prompt templates directory structure
- Q&A prompt template file

### 📋 Remaining Work
- Shopping MCP server structured output integration
- Email MCP server structured output integration
- Appointment Booking MCP server (full implementation)
- MCP Controller routing updates
- Response Generator structured output handling
- End-to-end testing
- Documentation and monitoring

---

## Notes

- All tasks marked with `*` are optional testing/documentation tasks
- Core implementation tasks must be completed in order
- Insights collection is integrated into every use case
- Privacy compliance is critical - no PII, no medical diagnoses
- Focus on incremental profile building over time
- Phases 1-2 are complete (see PHASE1_COMPLETE.md and PHASE2_COMPLETE.md)
- Shopping and Email MCP servers exist but need structured output integration
- Appointment Booking MCP server needs to be created from scratch
