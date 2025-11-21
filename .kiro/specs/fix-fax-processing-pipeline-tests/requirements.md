# Requirements Document

## Introduction

The fax processing pipeline integration tests are currently failing due to multiple issues:
1. Database query errors when checking fax status (UUID vs text comparison)
2. Tests timing out because faxes aren't being processed
3. Missing worker/queue infrastructure in test environment
4. Complex async processing that doesn't complete within test timeouts

This spec aims to fix these integration tests to ensure the fax processing pipeline works correctly end-to-end.

## Glossary

- **Fax Processing Pipeline**: The complete workflow from receiving a fax to generating and sending a response
- **Test Webhook Controller**: Controller that simulates fax reception for testing purposes
- **Integration Test**: Test that verifies multiple components working together
- **BullMQ**: Job queue system used for async processing
- **Test Mode**: Special mode where processing happens synchronously without queues

## Requirements

### Requirement 1

**User Story:** As a developer, I want integration tests to verify the complete fax processing pipeline, so that I can ensure all components work together correctly.

#### Acceptance Criteria

1. WHEN a test fax is uploaded THEN the system SHALL process it through the complete pipeline
2. WHEN checking fax status THEN the system SHALL return the current processing state without errors
3. WHEN processing completes THEN the system SHALL update the fax job status to 'completed'
4. WHEN processing fails THEN the system SHALL update the fax job status to 'failed' with an error message
5. WHEN tests run THEN the system SHALL complete processing within 60 seconds

### Requirement 2

**User Story:** As a developer, I want test faxes to be processed synchronously in test mode, so that tests don't depend on background workers.

#### Acceptance Criteria

1. WHEN TEST_MODE is enabled THEN the system SHALL process faxes synchronously without queuing
2. WHEN processing synchronously THEN the system SHALL complete all steps before returning
3. WHEN an error occurs THEN the system SHALL handle it gracefully and update job status
4. WHEN processing completes THEN the system SHALL log all processing steps to audit logs

### Requirement 3

**User Story:** As a developer, I want the test status endpoint to correctly query audit logs, so that tests can track processing progress.

#### Acceptance Criteria

1. WHEN querying by fax_id THEN the system SHALL handle both UUID and text comparisons correctly
2. WHEN audit logs exist THEN the system SHALL return them in chronological order
3. WHEN determining status THEN the system SHALL parse event types correctly
4. WHEN no logs exist THEN the system SHALL return 'unknown' status without errors

### Requirement 4

**User Story:** As a developer, I want test fixtures to be generated reliably, so that tests have consistent input data.

#### Acceptance Criteria

1. WHEN tests start THEN the system SHALL generate all required test fixtures
2. WHEN fixtures are generated THEN the system SHALL store them in memory for the test session
3. WHEN a test requests a fixture THEN the system SHALL return the correct image buffer
4. WHEN tests complete THEN the system SHALL clean up temporary test data
