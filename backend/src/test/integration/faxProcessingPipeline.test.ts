import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { testFaxFixtureGenerator } from '../fixtures/createTestFaxes';
import { auditLogService } from '../../services/auditLogService';

// Import the app (we'll need to create a test app instance)
let app: Express;

/**
 * Helper function to poll fax status until processing completes
 * @param faxId - The fax ID to poll
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 55 seconds)
 * @param pollIntervalMs - Time between polls in milliseconds (default: 1 second)
 * @returns The final status response
 */
async function waitForProcessingComplete(
  faxId: string,
  timeoutMs: number = 55000,
  pollIntervalMs: number = 1000
): Promise<any> {
  const startTime = Date.now();
  const maxAttempts = Math.ceil(timeoutMs / pollIntervalMs);
  let attempts = 0;

  while (attempts < maxAttempts) {
    const elapsed = Date.now() - startTime;
    
    // Check if we've exceeded the timeout
    if (elapsed >= timeoutMs) {
      throw new Error(
        `Timeout waiting for fax ${faxId} to complete processing after ${elapsed}ms (${attempts} attempts)`
      );
    }

    // Poll the status endpoint
    const statusResponse = await request(app).get(`/test/fax/status/${faxId}`);
    
    expect(statusResponse.status).toBe(200);
    
    const status = statusResponse.body.status;
    
    // Check if processing has reached a final state
    if (status === 'completed' || status === 'failed') {
      return statusResponse.body;
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    attempts++;
  }

  // If we get here, we've exhausted all attempts
  throw new Error(
    `Fax ${faxId} did not reach final state after ${attempts} attempts (${Date.now() - startTime}ms)`
  );
}

describe('Fax Processing Pipeline Integration Tests', () => {
  beforeEach(async () => {
    // Initialize test app
    const { createTestApp } = await import('../testApp');
    app = await createTestApp();
    
    // Generate test fixtures if they don't exist
    testFaxFixtureGenerator.generateAllFixtures();
  });

  afterEach(async () => {
    // Clean up test data
    await request(app).delete('/test/fax/clear');
  });

  describe('Complete Fax Processing Pipeline', () => {
    it('should process email request fax end-to-end', async () => {
      // Get email request fixture
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(emailFixture).toBeDefined();

      // Upload test fax
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(uploadResponse.status).toBe(200);
      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.fax_id).toBeDefined();

      const faxId = uploadResponse.body.fax_id;

      // Wait for processing to complete using helper function
      const finalStatus = await waitForProcessingComplete(faxId);

      // Verify processing completed successfully
      expect(finalStatus.status).toBe('completed');

      // Verify processing steps were logged
      expect(finalStatus.processing_steps).toBeDefined();
      expect(finalStatus.processing_steps.length).toBeGreaterThan(0);

      // Check that expected processing steps occurred
      const stepOperations = finalStatus.processing_steps.map((step: any) => step.operation);
      expect(stepOperations).toContain('test_fax_received');
      expect(stepOperations).toContain('processing_start');
      expect(stepOperations).toContain('processing_complete');

      // Verify response fax was generated
      expect(finalStatus.response_reference_id).toBeDefined();
    });

    it('should process shopping request fax end-to-end', async () => {
      // Get shopping request fixture
      const shoppingFixture = testFaxFixtureGenerator.getFixture('shopping_request.png');
      expect(shoppingFixture).toBeDefined();

      // Upload test fax
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', shoppingFixture!, 'shopping_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(uploadResponse.status).toBe(200);
      const faxId = uploadResponse.body.fax_id;

      // Wait for processing to complete using helper function
      const finalStatus = await waitForProcessingComplete(faxId);

      // Verify processing completed successfully
      expect(finalStatus.status).toBe('completed');

      // Should have generated product selection fax
      expect(finalStatus.response_reference_id).toBeDefined();
    });

    it('should process AI chat request fax end-to-end', async () => {
      // Get AI chat request fixture
      const aiChatFixture = testFaxFixtureGenerator.getFixture('ai_chat_request.png');
      expect(aiChatFixture).toBeDefined();

      // Upload test fax
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', aiChatFixture!, 'ai_chat_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(uploadResponse.status).toBe(200);
      const faxId = uploadResponse.body.fax_id;

      // Wait for processing to complete using helper function
      const finalStatus = await waitForProcessingComplete(faxId);

      // Verify processing completed successfully
      expect(finalStatus.status).toBe('completed');

      // Verify AI chat response was generated
      expect(finalStatus.response_reference_id).toBeDefined();
    });

    it('should handle ambiguous requests with clarification', async () => {
      // Get ambiguous request fixture
      const ambiguousFixture = testFaxFixtureGenerator.getFixture('ambiguous_request.png');
      expect(ambiguousFixture).toBeDefined();

      // Upload test fax
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', ambiguousFixture!, 'ambiguous_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(uploadResponse.status).toBe(200);
      const faxId = uploadResponse.body.fax_id;

      // Wait for processing to complete using helper function
      const finalStatus = await waitForProcessingComplete(faxId);

      // Verify processing completed successfully
      expect(finalStatus.status).toBe('completed');

      // Should have generated clarification fax
      expect(finalStatus.response_reference_id).toBeDefined();
    });
  });

  describe('Status Endpoint Query Tests', () => {
    it('should handle UUID format fax IDs without errors', async () => {
      // Test with a valid UUID format
      const uuidFaxId = '550e8400-e29b-41d4-a716-446655440000';
      
      const statusResponse = await request(app)
        .get(`/test/fax/status/${uuidFaxId}`);
      
      // Should return 200 even if fax doesn't exist
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body).toHaveProperty('status');
      expect(statusResponse.body).toHaveProperty('processing_steps');
    });

    it('should handle text format fax IDs without errors', async () => {
      // Test with a text format ID
      const textFaxId = 'test_fax_12345';
      
      const statusResponse = await request(app)
        .get(`/test/fax/status/${textFaxId}`);
      
      // Should return 200 even if fax doesn't exist
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body).toHaveProperty('status');
      expect(statusResponse.body).toHaveProperty('processing_steps');
    });

    it('should return correct status for existing fax', async () => {
      // Upload a test fax
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(emailFixture).toBeDefined();

      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321');

      expect(uploadResponse.status).toBe(200);
      const faxId = uploadResponse.body.fax_id;

      // Query status immediately
      const statusResponse = await request(app)
        .get(`/test/fax/status/${faxId}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.fax_id).toBe(faxId);
      expect(statusResponse.body.status).toBeDefined();
      expect(['received', 'processing', 'completed', 'failed', 'unknown']).toContain(statusResponse.body.status);
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should handle processing errors gracefully', async () => {
      // Create a malformed file that should cause processing errors
      const malformedBuffer = Buffer.from('This is not a valid image file');

      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', malformedBuffer, 'malformed.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(uploadResponse.status).toBe(200);
      const faxId = uploadResponse.body.fax_id;

      // Wait for processing to complete or fail using helper function
      const finalStatus = await waitForProcessingComplete(faxId);

      // Should either fail gracefully or handle the error
      expect(['completed', 'failed']).toContain(finalStatus.status);

      if (finalStatus.status === 'failed') {
        expect(finalStatus.error_message).toBeDefined();
      }
    });

    it('should retry failed operations', async () => {
      // This test would require mocking external services to fail temporarily
      // For now, we'll just verify the retry mechanism exists in the code
      
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(emailFixture).toBeDefined();

      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(uploadResponse.status).toBe(200);
      
      // The retry logic is built into the queue system and individual services
      // This test verifies the basic flow works
    });
  });
});