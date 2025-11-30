import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { testFaxFixtureGenerator } from '../fixtures/createTestFaxes';
import { userRepository } from '../../repositories/userRepository';
import { conversationContextRepository } from '../../repositories/conversationContextRepository';

let app: Express;

describe('Context Recovery Integration Tests', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Initialize test app
    const { createTestApp } = await import('../testApp');
    app = await createTestApp();
    
    // Generate test fixtures if they don't exist
    testFaxFixtureGenerator.generateAllFixtures();

    // Create test user
    const user = await userRepository.create({
      phoneNumber: '+1234567890',
      emailAddress: '1234567890@me.faxi.jp',
      isActive: true,
      preferences: {},
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    // Clean up test data
    await request(app).delete('/test/fax/clear');
  });

  describe('Reference ID Context Recovery', () => {
    it('should recover context using reference ID from fax', async () => {
      // First, send initial request to establish context
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(emailFixture).toBeDefined();

      const initialResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(initialResponse.status).toBe(200);
      const initialFaxId = initialResponse.body.fax_id;

      // Wait for initial processing
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${initialFaxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Get the reference ID from the response
      const initialStatusResponse = await request(app)
        .get(`/test/fax/status/${initialFaxId}`);

      const referenceId = initialStatusResponse.body.response_reference_id;
      expect(referenceId).toBeDefined();

      // Now send a reply with reference ID
      const replyFixture = testFaxFixtureGenerator.getFixture('blank_reply_with_reference.png');
      expect(replyFixture).toBeDefined();

      const replyResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', replyFixture!, 'blank_reply_with_reference.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(replyResponse.status).toBe(200);
      const replyFaxId = replyResponse.body.fax_id;

      // Wait for reply processing
      status = 'pending';
      attempts = 0;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${replyFaxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Verify context recovery occurred
      const replyStatusResponse = await request(app)
        .get(`/test/fax/status/${replyFaxId}`);

      const stepOperations = replyStatusResponse.body.processing_steps.map((step: any) => step.operation);
      expect(stepOperations.some((op: string) => 
        op.includes('context_recovery') || 
        op.includes('reference_id') ||
        op.includes('context_match')
      )).toBe(true);
    });

    it('should handle multiple active conversations', async () => {
      // Create multiple conversation contexts
      const contexts = [];
      
      // Send multiple different requests to create contexts
      const fixtures = ['email_request.png', 'shopping_request.png', 'ai_chat_request.png'];
      
      for (const fixtureFile of fixtures) {
        const fixture = testFaxFixtureGenerator.getFixture(fixtureFile);
        expect(fixture).toBeDefined();

        const response = await request(app)
          .post('/test/fax/receive')
          .attach('fax_file', fixture!, fixtureFile)
          .field('from_number', '+1234567890')
          .field('to_number', '+0987654321')
          .field('test_user_phone', '+1234567890');

        expect(response.status).toBe(200);
        contexts.push(response.body.fax_id);

        // Wait for processing
        let status = 'pending';
        let attempts = 0;
        const maxAttempts = 30;

        while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const statusResponse = await request(app)
            .get(`/test/fax/status/${response.body.fax_id}`);
          
          status = statusResponse.body.status;
          attempts++;
        }

        expect(status).toBe('completed');
      }

      // Now send an ambiguous reply that should trigger disambiguation
      const ambiguousFixture = testFaxFixtureGenerator.getFixture('ambiguous_request.png');
      expect(ambiguousFixture).toBeDefined();

      const ambiguousResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', ambiguousFixture!, 'ambiguous_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(ambiguousResponse.status).toBe(200);
      const ambiguousFaxId = ambiguousResponse.body.fax_id;

      // Wait for processing
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${ambiguousFaxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Should have generated disambiguation fax
      const statusResponse = await request(app)
        .get(`/test/fax/status/${ambiguousFaxId}`);

      const stepOperations = statusResponse.body.processing_steps.map((step: any) => step.operation);
      expect(stepOperations.some((op: string) => 
        op.includes('disambiguation') || 
        op.includes('clarification') ||
        op.includes('multiple_contexts')
      )).toBe(true);
    });
  });

  describe('Visual Pattern Context Recovery', () => {
    it('should recognize Faxi template patterns for context recovery', async () => {
      // First, send shopping request to get product selection form
      const shoppingFixture = testFaxFixtureGenerator.getFixture('shopping_request.png');
      expect(shoppingFixture).toBeDefined();

      const shoppingResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', shoppingFixture!, 'shopping_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(shoppingResponse.status).toBe(200);
      const shoppingFaxId = shoppingResponse.body.fax_id;

      // Wait for processing
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${shoppingFaxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Now send product selection with checkmarks (should recognize template)
      const selectionFixture = testFaxFixtureGenerator.getFixture('product_selection_with_checkmarks.png');
      expect(selectionFixture).toBeDefined();

      const selectionResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', selectionFixture!, 'product_selection_with_checkmarks.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(selectionResponse.status).toBe(200);
      const selectionFaxId = selectionResponse.body.fax_id;

      // Wait for processing
      status = 'pending';
      attempts = 0;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${selectionFaxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Verify template pattern recognition occurred
      const statusResponse = await request(app)
        .get(`/test/fax/status/${selectionFaxId}`);

      const stepOperations = statusResponse.body.processing_steps.map((step: any) => step.operation);
      expect(stepOperations.some((op: string) => 
        op.includes('template_recognition') || 
        op.includes('pattern_match') ||
        op.includes('visual_context')
      )).toBe(true);
    });

    it('should handle email reply with circled options', async () => {
      // First, send email request that should generate smart reply options
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(emailFixture).toBeDefined();

      const emailResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(emailResponse.status).toBe(200);
      const emailFaxId = emailResponse.body.fax_id;

      // Wait for processing
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${emailFaxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Now send email reply with circles
      const replyFixture = testFaxFixtureGenerator.getFixture('email_reply_with_circles.png');
      expect(replyFixture).toBeDefined();

      const replyResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', replyFixture!, 'email_reply_with_circles.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(replyResponse.status).toBe(200);
      const replyFaxId = replyResponse.body.fax_id;

      // Wait for processing
      status = 'pending';
      attempts = 0;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${replyFaxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Verify circle detection and context recovery
      const statusResponse = await request(app)
        .get(`/test/fax/status/${replyFaxId}`);

      const stepOperations = statusResponse.body.processing_steps.map((step: any) => step.operation);
      expect(stepOperations.some((op: string) => 
        op.includes('circle_detection') || 
        op.includes('visual_annotation') ||
        op.includes('reply_option')
      )).toBe(true);
    });
  });

  describe('Temporal Context Recovery', () => {
    it('should use recent conversation history for context recovery', async () => {
      // Send initial request
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(emailFixture).toBeDefined();

      const initialResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(initialResponse.status).toBe(200);
      const initialFaxId = initialResponse.body.fax_id;

      // Wait for processing
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${initialFaxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Wait a bit to simulate time passing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send follow-up without explicit reference
      const followUpResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png') // Same content
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(followUpResponse.status).toBe(200);
      const followUpFaxId = followUpResponse.body.fax_id;

      // Wait for processing
      status = 'pending';
      attempts = 0;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${followUpFaxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Verify temporal context recovery was attempted
      const statusResponse = await request(app)
        .get(`/test/fax/status/${followUpFaxId}`);

      const stepOperations = statusResponse.body.processing_steps.map((step: any) => step.operation);
      expect(stepOperations.some((op: string) => 
        op.includes('temporal_context') || 
        op.includes('recent_history') ||
        op.includes('context_recovery')
      )).toBe(true);
    });
  });

  describe('Context Expiration', () => {
    it('should handle expired conversation contexts', async () => {
      // Create an old conversation context manually
      const oldContext = await conversationContextRepository.create({
        userId: testUserId,
        referenceId: 'FX-2024-000001',
        contextType: 'email',
        contextData: {
          threadId: 'old_thread',
          subject: 'Old Email',
        },
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      });

      // Send a fax that might try to reference the expired context
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(emailFixture).toBeDefined();

      const response = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(response.status).toBe(200);
      const faxId = response.body.fax_id;

      // Wait for processing
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

      // Should have processed as new request since context expired
      const statusResponse = await request(app)
        .get(`/test/fax/status/${faxId}`);

      expect(statusResponse.body.response_reference_id).toBeDefined();
      
      // Should not have used expired context
      const stepOperations = statusResponse.body.processing_steps.map((step: any) => step.operation);
      expect(stepOperations.some((op: string) => 
        op.includes('expired_context') || 
        op.includes('context_cleanup')
      )).toBe(true);
    });
  });
});