# Design Document

## Overview

This design addresses the failing fax processing pipeline integration tests by implementing synchronous processing in test mode and fixing database query issues. The solution ensures tests can verify the complete pipeline without depending on background workers or queue infrastructure.

## Architecture

### Current Architecture Issues

1. **Async Queue Processing**: Production uses BullMQ for async processing, but tests have no worker running
2. **Database Type Mismatches**: UUID columns compared with text parameters causing SQL errors
3. **Missing Test Infrastructure**: No mechanism to process faxes synchronously in tests
4. **Incomplete Direct Processing**: Started implementation but has type errors and missing dependencies

### Proposed Architecture

```
Test Mode Flow:
┌─────────────────┐
│  Test Upload    │
│  /test/fax/     │
│  receive        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Test Webhook    │
│ Controller      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ TEST_MODE?      │────▶│ Queue Processing │ (Production)
└────────┬────────┘     └──────────────────┘
         │ Yes
         ▼
┌─────────────────┐
│ Direct Sync     │
│ Processing      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Status Endpoint │
│ /test/fax/      │
│ status/:id      │
└─────────────────┘
```

## Components and Interfaces

### 1. Test Webhook Controller

**File**: `backend/src/webhooks/testWebhookController.ts`

**Methods to Fix**:

```typescript
class TestWebhookController {
  // Fix database query type casting
  async getTestFaxStatus(req: Request, res: Response): Promise<void>
  
  // Implement complete synchronous processing
  private async processTestFaxDirectly(payload: TelnyxWebhookPayload): Promise<void>
}
```

**Key Changes**:
- Fix UUID/text comparison in SQL query
- Complete the `processTestFaxDirectly` implementation
- Fix type errors with service interfaces
- Add proper error handling and logging

### 2. Service Interface Fixes

**Files to Update**:
- `backend/src/services/aiVisionInterpreter.ts`
- `backend/src/services/responseGenerator.ts`
- `backend/src/services/mockFaxSender.ts`

**Interface Corrections**:

```typescript
// AI Vision Interpreter
interface InterpretationRequest {
  imageBuffer: Buffer;
  // ... other fields
}

// Response Generator
interface ResponseGeneratorRequest {
  interpretation: InterpretationResult;
  userId: string;
  faxJobId: string;
}

interface ResponseGeneratorResult {
  success: boolean;
  template: FaxTemplate;  // Not faxTemplate
  pdfBuffer: Buffer;      // PDF format for Telnyx
  referenceId: string;
  // ... other fields
}

// Mock Fax Sender
interface MockFaxSendRequest {
  toNumber: string;
  fromNumber: string;
  referenceId: string;
  mediaUrl: string;  // Required field
  mediaBuffer?: Buffer;  // Optional
}
```

### 3. Test Setup

**File**: `backend/src/test/setup.ts`

**Enhancements**:
- Ensure TEST_MODE is set before any imports
- Mock external service dependencies
- Set up test database with proper schema

## Data Models

### Audit Log Query

**Current Issue**:
```sql
-- Fails: operator does not exist: uuid = text
WHERE fax_job_id = $1  -- $1 is text, fax_job_id is UUID
```

**Solution**:
```sql
-- Cast UUID to text for comparison
WHERE fax_job_id::text = $1 OR (event_data->>'entityId')::text = $1
```

### Fax Job Status Flow

```
pending → processing → completed
                    ↘ failed
```

**Status Determination Logic**:
1. Check for `test_fax.test_fax_received` → status = 'received'
2. Check for `fax_job.processing_start` → status = 'processing'
3. Check for `fax_job.processing_complete` → status = 'completed'
4. Check for `fax_job.processing_failed` → status = 'failed'
5. Default → status = 'unknown'

## Correctness Properties

Before writing properties, let me analyze the acceptance criteria:

### Acceptance Criteria Testing Prework

**1.1** WHEN a test fax is uploaded THEN the system SHALL process it through the complete pipeline
- Thoughts: This is about the entire system working end-to-end. We can test this by uploading a test fax and verifying all processing steps occur and complete successfully.
- Testable: yes - example (specific end-to-end flow)

**1.2** WHEN checking fax status THEN the system SHALL return the current processing state without errors
- Thoughts: This is about the status endpoint working correctly for any fax ID. We can generate random fax IDs and verify the endpoint returns valid responses without 500 errors.
- Testable: yes - property

**1.3** WHEN processing completes THEN the system SHALL update the fax job status to 'completed'
- Thoughts: This should hold for all successful processing. We can test that any fax that processes successfully ends with status 'completed'.
- Testable: yes - property

**1.4** WHEN processing fails THEN the system SHALL update the fax job status to 'failed' with an error message
- Thoughts: This should hold for all failed processing. We can test that any fax that fails to process ends with status 'failed' and has an error message.
- Testable: yes - property

**1.5** WHEN tests run THEN the system SHALL complete processing within 60 seconds
- Thoughts: This is a performance requirement about timing, not correctness.
- Testable: no

**2.1** WHEN TEST_MODE is enabled THEN the system SHALL process faxes synchronously without queuing
- Thoughts: This is about implementation strategy - whether we use queues or not. We can verify by checking that processing completes immediately without queue jobs.
- Testable: yes - example

**2.2** WHEN processing synchronously THEN the system SHALL complete all steps before returning
- Thoughts: This is about synchronous behavior - that the function doesn't return until done. We can test by verifying job status is final (completed/failed) immediately after the function returns.
- Testable: yes - property

**2.3** WHEN an error occurs THEN the system SHALL handle it gracefully and update job status
- Thoughts: This should hold for all errors. We can generate various error conditions and verify they're handled without crashes.
- Testable: yes - property

**2.4** WHEN processing completes THEN the system SHALL log all processing steps to audit logs
- Thoughts: This should hold for all processing. We can verify that specific audit log entries exist after processing.
- Testable: yes - property

**3.1** WHEN querying by fax_id THEN the system SHALL handle both UUID and text comparisons correctly
- Thoughts: This is about the query working with different ID formats. We can test with both UUID-format and text-format IDs.
- Testable: yes - property

**3.2** WHEN audit logs exist THEN the system SHALL return them in chronological order
- Thoughts: This is about ordering. For any set of audit logs, they should be returned in time order.
- Testable: yes - property

**3.3** WHEN determining status THEN the system SHALL parse event types correctly
- Thoughts: This is about the status determination logic. For any set of events, the final status should match the most recent event type.
- Testable: yes - property

**3.4** WHEN no logs exist THEN the system SHALL return 'unknown' status without errors
- Thoughts: This is a specific edge case - querying for a non-existent fax.
- Testable: yes - edge-case

**4.1** WHEN tests start THEN the system SHALL generate all required test fixtures
- Thoughts: This is about test setup. We can verify all expected fixtures exist.
- Testable: yes - example

**4.2** WHEN fixtures are generated THEN the system SHALL store them in memory for the test session
- Thoughts: This is about fixture availability. We can verify fixtures can be retrieved after generation.
- Testable: yes - example

**4.3** WHEN a test requests a fixture THEN the system SHALL return the correct image buffer
- Thoughts: This should hold for all fixtures. For any fixture name, requesting it should return a valid buffer.
- Testable: yes - property

**4.4** WHEN tests complete THEN the system SHALL clean up temporary test data
- Thoughts: This is about cleanup. We can verify test data is removed after tests.
- Testable: yes - example

### Property Reflection

Looking at the properties:
- **1.2, 3.1, 3.2, 3.3** are all about the status endpoint working correctly - these can be combined
- **1.3, 1.4, 2.3** are all about status updates - these overlap significantly
- **2.2, 2.4** are both about synchronous processing behavior - can be combined

After reflection, here are the unique properties:

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Property 1: Status endpoint returns valid responses**
*For any* fax ID (UUID or text format), querying the status endpoint should return a 200 response with a valid status field and audit logs in chronological order
**Validates: Requirements 1.2, 3.1, 3.2, 3.3**

**Property 2: Successful processing results in completed status**
*For any* valid test fax, if processing completes without errors, the final job status should be 'completed' with a response reference ID
**Validates: Requirements 1.3**

**Property 3: Failed processing results in failed status with error**
*For any* test fax that causes processing errors, the final job status should be 'failed' with a non-empty error message
**Validates: Requirements 1.4, 2.3**

**Property 4: Synchronous processing completes all steps**
*For any* test fax in TEST_MODE, after the processing function returns, the job status should be final (completed or failed) and all audit log entries should exist
**Validates: Requirements 2.2, 2.4**

**Property 5: Fixture retrieval returns valid buffers**
*For any* generated fixture name, requesting that fixture should return a non-empty buffer
**Validates: Requirements 4.3**

## Error Handling

### Database Query Errors

**Issue**: Type mismatch between UUID columns and text parameters

**Solution**:
```typescript
// Cast UUID columns to text for comparison
const result = await db.query(
  `SELECT id, user_id, fax_job_id, event_type, event_data, created_at
   FROM audit_logs
   WHERE fax_job_id::text = $1 OR (event_data->>'entityId')::text = $1
   ORDER BY created_at DESC
   LIMIT 50`,
  [fax_id]
);
```

### Service Interface Errors

**Issue**: Type mismatches in service calls

**Solutions**:
1. **AI Vision Interpreter**: Pass buffer directly, not wrapped in object
2. **Response Generator**: Use correct property names (`template` not `faxTemplate`)
3. **Mock Fax Sender**: Include required `mediaUrl` field

### Processing Errors

**Strategy**:
1. Wrap all processing in try-catch
2. Update job status to 'failed' on error
3. Log error details to audit logs
4. Return gracefully without crashing

## Testing Strategy

### Unit Tests

Focus on individual components:
- Status endpoint query logic
- Status determination from audit logs
- Fixture generation and retrieval
- Error handling in direct processing

### Integration Tests

Test complete flows:
- Upload → Process → Complete (happy path)
- Upload → Process → Fail (error path)
- Status polling during processing
- Multiple concurrent test faxes

### Property-Based Tests

Use **vitest** with **fast-check** library for property testing:

```typescript
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Property Tests', () => {
  it('Property 1: Status endpoint returns valid responses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // Generate random UUIDs
        async (faxId) => {
          const response = await request(app).get(`/test/fax/status/${faxId}`);
          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('status');
          expect(response.body).toHaveProperty('processing_steps');
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Test Configuration

**File**: `vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    testTimeout: 60000, // 60 seconds for integration tests
    hookTimeout: 30000,
    setupFiles: ['./src/test/setup.ts'],
    env: {
      TEST_MODE: 'true',
      NODE_ENV: 'test',
    },
  },
});
```

## Implementation Notes

### Phase 1: Fix Database Queries
1. Update `getTestFaxStatus` to cast UUID to text
2. Test status endpoint with various fax IDs
3. Verify no 500 errors

### Phase 2: Complete Direct Processing
1. Fix type errors in `processTestFaxDirectly`
2. Correct service interface calls
3. Add comprehensive error handling
4. Test with valid and invalid faxes

### Phase 3: Update Tests
1. Ensure TEST_MODE is set in test setup
2. Add property-based tests
3. Update timeout configurations
4. Add test cleanup

### Phase 4: Verify End-to-End
1. Run all integration tests
2. Verify processing completes within timeout
3. Check all audit logs are created
4. Validate response faxes are generated

## Dependencies

- **vitest**: Test framework (already installed)
- **fast-check**: Property-based testing library (needs installation)
- **supertest**: HTTP testing (already installed)
- **PostgreSQL**: Database with proper schema
- **Redis**: For queue health checks (mocked in tests)

## Performance Considerations

- Synchronous processing in tests may be slower than async
- Set appropriate test timeouts (60s for integration tests)
- Clean up test data after each test to avoid memory leaks
- Use test database to avoid polluting production data
