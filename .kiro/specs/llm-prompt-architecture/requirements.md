# LLM Prompt Architecture - Requirements

## Overview
Design a structured, use-case-specific prompt system that leverages Gemini's JSON schema capabilities for reliable, programmatic outputs across different Faxi services.

## Problem Statement
Current implementation:
- Generic system prompt that doesn't differentiate between use cases
- No structured JSON output schema
- Difficult to programmatically parse and validate responses
- No clear separation between different service capabilities (shopping, email, Q&A, etc.)

## Goals
1. **Structured Outputs**: Define JSON schemas for each use case to ensure reliable, parseable responses
2. **Use-Case Specific Prompts**: Tailor prompts for different services (shopping, email, Q&A, Atlantis PBEM, etc.)
3. **Programmatic Control**: Enable reliable parsing and validation of LLM outputs
4. **Extensibility**: Easy to add new use cases and MCP servers
5. **Fax Optimization**: Maintain fax-friendly formatting while adding structure

## Use Cases

### 1. General Q&A / Information Requests
**Examples:**
- "What's the weather in Tokyo?"
- "Tell me about Japanese history"
- "How do I cook rice?"

**Output Requirements:**
- Simple text response
- Optional follow-up questions
- Conversation continuation flag

### 2. E-commerce Shopping (Amazon.co.jp)
**Examples:**
- "I want to buy a rice cooker"
- "Show me laptops under ¥50,000"
- "Order the same thing I bought last time"
- "Find me a birthday gift for my grandson"

**Output Requirements:**
- Product search queries (Japanese)
- Product selections with prices (¥)
- Product images/descriptions for fax
- Delivery address confirmation
- Payment method selection
- Order tracking

**Technical Requirements:**
- Amazon.co.jp API or web scraping
- Product data extraction
- Price monitoring
- Inventory checking
- Order placement automation

### 3. Email Sending
**Examples:**
- "Send email to my son about dinner plans"
- "Email my doctor to reschedule appointment"

**Output Requirements:**
- Recipient identification
- Email subject
- Email body
- Confirmation of intent

### 4. Appointment & Reservation Booking
**Examples:**
- "Make an appointment at Tanaka Clinic for next Tuesday"
- "Reserve a table at Sushi Dai for 2 people tomorrow at 7pm"
- "Book a haircut at my usual salon"

**Output Requirements:**
- Service/venue identification
- Date/time preferences
- Number of people (if applicable)
- Special requests
- Account creation and Login credentials management (secure)
- Confirmation details

**Technical Requirements:**
- Playwright/Puppeteer for web automation
- Credential storage (encrypted)
- Email: {fax_number}@me.faxi.jp
- Session management
- Error handling for booking failures

### 5. Multi-Action Requests
**Examples:**
- "Email my son and order groceries"
- "Check weather and send results to my daughter"

**Output Requirements:**
- Multiple action identification
- Action sequencing
- Dependency handling

### 6. User Insights Collection (Cross-Cutting)
**Purpose:** Extract strategic data insights from every interaction

**Data Categories:**
- Demographics (age, gender, region, household type)
- Life events (moving, caregiving, hospitalization, retirement)
- Intent signals (commercial, health, government)
- Behavioral patterns (frequency, communication style)
- Consumer profile (spend sensitivity, brand preferences)
- Healthcare patterns (appointment frequency, support needs)
- Government service usage (certificate requests, patterns)
- Digital exclusion metrics (literacy, assistance needs)

**Output Requirements:**
- Structured insights in every LLM response
- Confidence scores for inferences
- Privacy-safe data (no medical diagnoses)
- Incremental profile building

## Acceptance Criteria

### AC1: JSON Schema Definitions
- [ ] Each use case has a defined JSON schema for outputs
- [ ] Schemas include all required fields for programmatic processing
- [ ] Schemas support optional fields for flexibility
- [ ] Schemas are validated using Zod or similar

### AC2: Use-Case Detection
- [ ] System can identify which use case applies to a request
- [ ] Multi-action requests are properly decomposed
- [ ] Ambiguous requests trigger clarification

### AC3: Prompt Templates
- [ ] Each use case has a specific system prompt
- [ ] Prompts include JSON schema in the instructions
- [ ] Prompts maintain fax-friendly formatting guidelines
- [ ] Prompts include examples of expected outputs

### AC4: Response Validation
- [ ] All LLM outputs are validated against schemas
- [ ] Invalid outputs trigger retry with clarification
- [ ] Validation errors are logged for debugging

### AC5: Extensibility
- [ ] New use cases can be added without modifying core logic
- [ ] MCP servers can register their own schemas and prompts
- [ ] Configuration-driven prompt management

### AC6: Insights Collection
- [ ] Every LLM response includes insights field
- [ ] Insights validated against schema
- [ ] Confidence scores for all inferences
- [ ] Privacy-safe data extraction (no PII, no medical diagnoses)
- [ ] Incremental profile updates
- [ ] Aggregate insights generation for data products

## Non-Functional Requirements

### NFR1: Performance
- Response generation should complete within 5 seconds for simple queries
- Schema validation should add < 100ms overhead

### NFR2: Reliability
- 95% of responses should match expected schema on first attempt
- Graceful degradation when schema validation fails

### NFR3: Maintainability
- Prompts stored in separate files for easy editing
- JSON schemas co-located with use case logic
- Clear documentation for adding new use cases

## Technical Considerations

### Gemini JSON Mode
- Use `response_mime_type: "application/json"` for structured outputs
- Provide JSON schema in system instructions
- Handle cases where Gemini returns non-JSON (fallback)

### Schema Validation
- Use Zod for runtime validation
- Generate TypeScript types from schemas
- Provide clear error messages for validation failures

### Prompt Engineering
- Include few-shot examples in prompts
- Balance between specificity and flexibility
- Test prompts with edge cases

## Out of Scope
- Natural language understanding improvements (rely on Gemini's capabilities)
- Custom ML models for classification
- Real-time learning from user feedback (future enhancement)

## Success Metrics
- 95%+ of responses match expected schema
- < 5% retry rate due to validation failures
- Zero manual parsing of LLM outputs
- Easy addition of new use cases (< 1 hour per use case)

## Dependencies
- Gemini 2.0 Flash or later (for JSON mode support)
- Zod for schema validation
- MCP server architecture for extensibility

## Timeline
- Design: 1 day
- Implementation: 3-5 days
- Testing: 2 days
- Documentation: 1 day
