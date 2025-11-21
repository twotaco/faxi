# Test Setup and Configuration

## Overview

This document describes the test environment setup, cleanup procedures, and external service mocking strategy for the Faxi backend integration tests.

## Test Environment Configuration

### Environment Variables

Tests use a separate `.env.test` file to isolate test configuration from development and production environments.

**Key test environment variables:**
- `TEST_MODE=true` - Enables test mode in services
- `NODE_ENV=test` - Sets Node environment to test
- `DATABASE_URL` - Points to test database (faxi_test)
- `REDIS_URL` - Points to test Redis database (DB 15)
- API keys - Mock values for external services

### Critical Setup Order

The test setup follows a specific order to ensure proper initialization:

1. **Set TEST_MODE** - Must be set BEFORE any imports
2. **Load .env.test** - Loads test-specific configuration
3. **Verify environment** - Checks required variables are set
4. **Initialize fixtures** - Generates test fax images
5. **Setup global storage** - Initializes test data maps

## External Service Mocking

### Mocking Strategy

External services are mocked at the **service implementation level** when `TEST_MODE=true`, not via `vi.mock()`.

**Why this approach:**
- Services are already imported before vi.mock() can take effect
- TEST_MODE allows services to use mock implementations internally
- Provides more realistic integration testing
- Easier to maintain and debug

### Services That Respect TEST_MODE

1. **Fax Sending (Telnyx)**
   - Uses `mockFaxSender` instead of real Telnyx API
   - Stores sent faxes in memory for verification
   - See: `backend/src/services/mockFaxSender.ts`

2. **Database**
   - Uses test database: `faxi_test`
   - Isolated from development/production data
   - Cleaned between test runs

3. **Redis**
   - Uses test database: DB 15
   - Isolated from other environments
   - Cleaned between test runs

4. **S3 Storage**
   - Uses mock storage in TEST_MODE
   - Stores files in memory or temp directory
   - No actual AWS API calls

### Services That Need Real APIs

Some services currently make real API calls even in TEST_MODE:

1. **Google Gemini AI** (`aiVisionInterpreter`)
   - Makes real API calls to Gemini
   - Requires valid `GEMINI_API_KEY`
   - **TODO**: Add TEST_MODE check to use mock responses

2. **Stripe**
   - May make real API calls
   - Uses test API keys
   - **TODO**: Verify TEST_MODE handling

### Adding Service-Level Mocks

To add TEST_MODE support to a service:

```typescript
import { config } from '../config';

export class MyService {
  async doSomething() {
    // Check TEST_MODE
    if (config.app.testMode) {
      // Return mock response
      return { success: true, data: 'mock data' };
    }
    
    // Real implementation
    return await this.callExternalAPI();
  }
}
```

## Test Data Management

### Global Test Storage

Tests use global variables to store test data:

```typescript
global.testFaxFiles: Map<string, Buffer>
global.testResponseFaxes: Map<string, Buffer>
global.testDatabaseConnections: any[]
```

### Cleanup Strategy

**Before Each Test:**
- Clear test fax files map
- Clear test response faxes map
- Reset test-specific state

**After Each Test:**
- Clear test data via API (`/test/fax/clear`)
- Clear global test data maps
- Clear all vitest mocks

**After All Tests:**
- Close database connections
- Clear all test data
- Clean up temporary files

### Test Fixtures

Test fixtures are generated once during setup and reused across tests:

**Location:** `backend/src/test/fixtures/fax-images/`

**Fixtures include:**
- email_request.png
- shopping_request.png
- ai_chat_request.png
- payment_registration.png
- email_reply_with_circles.png
- product_selection_with_checkmarks.png
- ambiguous_request.png
- poor_handwriting.png
- multi_action_request.png
- blank_reply_with_reference.png

**Generation:**
- Automatically generated in `beforeAll()` hook
- Stored on disk for reuse
- Can be regenerated with `npm run generate-fixtures`

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npx vitest run src/test/integration/faxProcessingPipeline.property.test.ts
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Integration Tests Only
```bash
npm run test:integration
```

## Test Timeouts

Tests have extended timeouts to accommodate processing:

- **Test timeout:** 60 seconds (default)
- **Hook timeout:** 30 seconds (setup/teardown)
- **Property tests:** May have custom timeouts (up to 120s)

Configure in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    testTimeout: 60000,
    hookTimeout: 30000,
  },
});
```

## Troubleshooting

### Tests Fail with "API key not valid"

**Problem:** Service is making real API calls instead of using mocks

**Solution:**
1. Verify `TEST_MODE=true` is set before imports
2. Check if service respects TEST_MODE
3. Add TEST_MODE check to service implementation
4. Or provide valid test API key in `.env.test`

### Tests Timeout

**Problem:** Processing takes longer than timeout

**Solution:**
1. Increase test timeout in test file: `{ timeout: 120000 }`
2. Check if async processing is completing
3. Verify TEST_MODE enables synchronous processing

### Database Connection Errors

**Problem:** Cannot connect to test database

**Solution:**
1. Ensure PostgreSQL is running
2. Create test database: `createdb faxi_test`
3. Run migrations: `npm run migrate`
4. Check `DATABASE_URL` in `.env.test`

### Redis Connection Errors

**Problem:** Cannot connect to Redis

**Solution:**
1. Ensure Redis is running: `redis-server`
2. Check `REDIS_URL` in `.env.test`
3. Verify Redis is accessible on port 6379

### Test Data Not Cleaned

**Problem:** Tests interfere with each other

**Solution:**
1. Verify `afterEach()` cleanup is running
2. Check `/test/fax/clear` endpoint works
3. Manually clear: `global.testFaxFiles.clear()`

## Best Practices

### Writing New Tests

1. **Use beforeEach/afterEach for cleanup**
   ```typescript
   beforeEach(async () => {
     // Clear test data
     global.testFaxFiles.clear();
   });
   
   afterEach(async () => {
     // Clean up after test
     await request(app).delete('/test/fax/clear');
   });
   ```

2. **Verify TEST_MODE is enabled**
   ```typescript
   if (process.env.TEST_MODE !== 'true') {
     throw new Error('TEST_MODE must be enabled');
   }
   ```

3. **Use test fixtures**
   ```typescript
   const fixture = testFaxFixtureGenerator.getFixture('email_request.png');
   ```

4. **Handle async operations**
   ```typescript
   // Wait for processing to complete
   await new Promise(resolve => setTimeout(resolve, 1000));
   ```

5. **Clean up resources**
   ```typescript
   afterAll(async () => {
     await db.close();
     await redis.disconnect();
   });
   ```

### Property-Based Testing

1. **Reduce numRuns for expensive tests**
   ```typescript
   { numRuns: 5 } // Instead of default 100
   ```

2. **Use appropriate generators**
   ```typescript
   fc.constantFrom(...fixtureNames) // Use real fixtures
   fc.uuid() // Generate valid UUIDs
   ```

3. **Handle edge cases**
   ```typescript
   // Filter out invalid inputs
   fc.string().filter(s => s.length > 0)
   ```

## Future Improvements

1. **Add TEST_MODE to all external services**
   - aiVisionInterpreter
   - Stripe integration
   - Email service

2. **Improve mock data quality**
   - More realistic mock responses
   - Better error simulation

3. **Add test database seeding**
   - Consistent test data
   - Faster test setup

4. **Implement test isolation**
   - Separate test database per test
   - Transaction rollback after each test

5. **Add performance monitoring**
   - Track test execution time
   - Identify slow tests
