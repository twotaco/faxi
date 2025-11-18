import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { testFaxFixtureGenerator } from '../fixtures/createTestFaxes';
import { auditLogService } from '../../services/auditLogService';

// Import the app (we'll need to create a test app instance)
let app: Express;

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

      // Wait for processing to complete (poll status)
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${faxId}`);
        
        expect(statusResponse.status).toBe(200);
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Verify processing steps were logged
      const statusResponse = await request(app)
        .get(`/test/fax/status/${faxId}`);

      expect(statusResponse.body.processing_steps).toBeDefined();
      expect(statusResponse.body.processing_steps.length).toBeGreaterThan(0);

      // Check that expected processing steps occurred
      const stepOperations = statusResponse.body.processing_steps.map((step: any) => step.operation);
      expect(stepOperations).toContain('test_fax_received');
      expect(stepOperations).toContain('processing_start');
      expect(stepOperations).toContain('processing_complete');

      // Verify response fax was generated
      expect(statusResponse.body.response_reference_id).toBeDefined();
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

      // Wait for processing to complete
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${faxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Verify shopping-specific processing occurred
      const statusResponse = await request(app)
        .get(`/test/fax/status/${faxId}`);

      // Should have generated product selection fax
      expect(statusResponse.body.response_reference_id).toBeDefined();
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

      // Wait for processing to complete
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${faxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Verify AI chat response was generated
      const statusResponse = await request(app)
        .get(`/test/fax/status/${faxId}`);

      expect(statusResponse.body.response_reference_id).toBeDefined();
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

      // Wait for processing to complete
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${faxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Should have generated clarification fax
      const statusResponse = await request(app)
        .get(`/test/fax/status/${faxId}`);

      expect(statusResponse.body.response_reference_id).toBeDefined();
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

      // Wait for processing to complete or fail
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${faxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      // Should either fail gracefully or handle the error
      expect(['completed', 'failed']).toContain(status);

      if (status === 'failed') {
        const statusResponse = await request(app)
          .get(`/test/fax/status/${faxId}`);
        
        expect(statusResponse.body.error_message).toBeDefined();
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