# Integration Tests

This directory contains comprehensive integration tests for the Faxi core system. The tests are designed to validate the complete fax processing pipeline using the test harness to avoid Telnyx costs.

## Test Structure

### Core Test Files

1. **`basic.test.ts`** - Basic infrastructure and test harness validation
2. **`faxProcessingPipeline.test.ts`** - Complete fax processing pipeline tests
3. **`userRegistration.test.ts`** - Automatic user registration on first fax
4. **`emailToFax.test.ts`** - Email-to-fax bridge functionality
5. **`shoppingWorkflow.test.ts`** - Shopping workflow with product selection and payment
6. **`contextRecovery.test.ts`** - Context recovery with multiple conversation scenarios
7. **`spamFiltering.test.ts`** - Spam filtering for incoming emails
8. **`smartReplyGeneration.test.ts`** - Smart reply generation for emails with questions
9. **`testHarness.test.ts`** - Test harness functionality validation

### Test Coverage

The integration tests cover all major requirements from the specification:

#### Fax Processing Pipeline (Requirements 1-2)
- ✅ Complete fax processing from webhook to response
- ✅ AI vision interpretation of fax images
- ✅ Intent extraction and parameter parsing
- ✅ Visual annotation detection (circles, checkmarks)
- ✅ Error handling and retry logic

#### Email Integration (Requirement 3)
- ✅ Email sending through fax system
- ✅ Address book lookup and management
- ✅ Email-to-fax conversion
- ✅ Smart reply generation for questions
- ✅ Spam filtering for incoming emails

#### Shopping Workflow (Requirements 4-5)
- ✅ Product search and selection
- ✅ Payment processing with registered methods
- ✅ Barcode generation for convenience store payment
- ✅ Order confirmation and tracking

#### AI Chat (Requirement 6)
- ✅ AI assistant interaction via fax
- ✅ Conversation context maintenance
- ✅ Response formatting for fax delivery

#### Response Generation (Requirement 7)
- ✅ Fax-compatible response formatting
- ✅ TIFF generation and delivery
- ✅ Retry logic for failed deliveries

#### User Management (Requirements 8, 11)
- ✅ Automatic user registration on first fax
- ✅ Email address generation (phone@me.faxi.jp)
- ✅ Address book management
- ✅ Welcome fax generation

#### System Operations (Requirements 9-10)
- ✅ Audit logging of all operations
- ✅ Error handling and user feedback
- ✅ System monitoring and troubleshooting

#### Context Recovery
- ✅ Reference ID-based context recovery
- ✅ Visual pattern recognition
- ✅ Temporal context matching
- ✅ Multiple conversation disambiguation

## Running the Tests

### Prerequisites

For full integration testing, you need:

1. **PostgreSQL** - Database for user data, audit logs, etc.
2. **Redis** - Queue system for background job processing
3. **Test Environment Variables** - Copy `.env.test` and configure

### Basic Test Mode (No External Dependencies)

Run basic infrastructure tests without database/Redis:

```bash
npm run test -- src/test/integration/basic.test.ts
```

This tests:
- Test harness functionality
- Test fixture generation
- Mock webhook endpoints
- Error handling

### Full Integration Tests (Requires Infrastructure)

1. Start PostgreSQL and Redis:
```bash
# Using Docker
docker run -d --name faxi-test-postgres -e POSTGRES_DB=faxi_test -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:15
docker run -d --name faxi-test-redis -p 6379:6379 redis:7
```

2. Run database migrations:
```bash
npm run migrate
```

3. Run all integration tests:
```bash
npm run test:integration
```

### Individual Test Suites

Run specific test categories:

```bash
# Fax processing pipeline
npm run test -- src/test/integration/faxProcessingPipeline.test.ts

# User registration
npm run test -- src/test/integration/userRegistration.test.ts

# Email-to-fax bridge
npm run test -- src/test/integration/emailToFax.test.ts

# Shopping workflow
npm run test -- src/test/integration/shoppingWorkflow.test.ts

# Context recovery
npm run test -- src/test/integration/contextRecovery.test.ts

# Spam filtering
npm run test -- src/test/integration/spamFiltering.test.ts

# Smart reply generation
npm run test -- src/test/integration/smartReplyGeneration.test.ts
```

## Test Fixtures

The tests use generated test fixtures that simulate real fax images:

- `email_request.png` - Simple email request
- `shopping_request.png` - Product purchase request
- `ai_chat_request.png` - Questions for AI assistant
- `payment_registration.png` - Credit card registration
- `email_reply_with_circles.png` - Email reply with circled options
- `product_selection_with_checkmarks.png` - Product selection with checkmarks
- `ambiguous_request.png` - Unclear request requiring clarification
- `poor_handwriting.png` - Email with poor handwriting
- `multi_action_request.png` - Multiple actions in one fax
- `blank_reply_with_reference.png` - Handwritten reply with reference ID

## Test Scenarios

### End-to-End Workflows

1. **New User First Fax**
   - User sends first fax → Auto-registration → Welcome fax sent
   - Validates: User creation, email address generation, welcome fax

2. **Email Request Flow**
   - User requests email → AI extracts recipient/content → Email sent → Confirmation fax
   - Validates: Intent extraction, email sending, confirmation generation

3. **Shopping Flow**
   - User requests product → Product search → Selection form → Payment → Order confirmation
   - Validates: Product search, payment processing, order management

4. **Context Recovery**
   - Initial request → Response with reference ID → Follow-up with reference → Context matched
   - Validates: Reference ID generation, context storage, recovery logic

5. **Spam Filtering**
   - Promotional email received → Spam filter applied → No fax generated
   - Personal email received → Passes filter → Fax generated
   - Validates: Spam detection, allowlist management

6. **Smart Replies**
   - Email with question received → Smart reply options generated → User circles option → Reply sent
   - Validates: Question detection, reply generation, visual annotation processing

### Error Scenarios

1. **Processing Failures**
   - Malformed fax → Error handling → User feedback fax
   - Service unavailable → Retry logic → Eventually succeeds or fails gracefully

2. **Context Ambiguity**
   - Multiple active conversations → Disambiguation fax → User clarifies → Correct context used

3. **Payment Failures**
   - No payment method → Barcode generated → Payment completed → Order processed
   - Payment declined → Error fax → Alternative payment options provided

## Test Data Management

### Cleanup

Tests automatically clean up after themselves:
- Test fax files are stored in memory during test execution
- Mock data is cleared between tests
- Database transactions are rolled back (when using test database)

### Isolation

Each test is isolated:
- Unique phone numbers for different test scenarios
- Separate conversation contexts
- Independent user accounts

## Monitoring and Debugging

### Test Output

Tests provide detailed output:
- Processing step logs
- Error messages and stack traces
- Performance timing information
- Mock service interaction logs

### Debug Mode

Enable verbose logging:
```bash
DEBUG=faxi:* npm run test:integration
```

### Test UI

Use the test UI for manual testing and debugging:
```bash
npm run dev
# Open http://localhost:4000/test
```

## Continuous Integration

### GitHub Actions

The tests are designed to run in CI environments:
- Use Docker containers for PostgreSQL and Redis
- Environment variables configured via secrets
- Test results exported in JUnit format

### Performance Benchmarks

Integration tests include performance validation:
- Email processing within 2 minutes
- Fax processing within 3 minutes
- Context recovery within 1 second

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure PostgreSQL is running on port 5432
   - Check DATABASE_URL in .env.test
   - Run migrations: `npm run migrate`

2. **Redis Connection Errors**
   - Ensure Redis is running on port 6379
   - Check REDIS_URL in .env.test
   - Use different Redis database for tests (e.g., DB 15)

3. **Test Fixtures Not Found**
   - Run fixture generation: `npm run generate-fixtures`
   - Check Canvas dependencies are installed
   - Verify file permissions in test directory

4. **Timeout Errors**
   - Increase test timeout in vitest.config.ts
   - Check for infinite loops in processing pipeline
   - Verify mock services are responding

### Debug Commands

```bash
# Check test environment
npm run test -- --reporter=verbose

# Run single test with full output
npm run test -- src/test/integration/basic.test.ts --reporter=verbose

# Generate fresh test fixtures
npm run generate-fixtures

# Check test database connection
psql postgresql://test:test@localhost:5432/faxi_test -c "SELECT 1"

# Check Redis connection
redis-cli -h localhost -p 6379 ping
```

## Contributing

When adding new integration tests:

1. Follow the existing test structure and naming conventions
2. Use the test harness to avoid external service costs
3. Include both success and failure scenarios
4. Add appropriate cleanup in afterEach hooks
5. Document any new test fixtures or scenarios
6. Update this README with new test coverage

## Test Results Summary

As of the current implementation:

- ✅ **Test Infrastructure**: Test harness, fixture generation, mock services
- ✅ **Basic Functionality**: File upload, endpoint validation, error handling
- 🔄 **Full Pipeline**: Requires database/Redis setup for complete validation
- 🔄 **External Integrations**: Mock implementations for Telnyx, Stripe, email services

The integration tests provide comprehensive coverage of the Faxi system requirements and can be used to validate the complete implementation once the infrastructure dependencies are available.