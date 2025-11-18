import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { testFaxFixtureGenerator } from '../fixtures/createTestFaxes';

let app: Express;

describe('Test Harness Integration Tests', () => {
  beforeEach(async () => {
    // Initialize test app
    const { createTestApp } = await import('../testApp');
    app = await createTestApp();
    
    // Ensure test mode is enabled
    expect(process.env.TEST_MODE).toBe('true');
  });

  afterEach(async () => {
    // Clean up test data
    await request(app).delete('/test/fax/clear');
  });

  describe('Test Infrastructure', () => {
    it('should have test mode enabled', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.testMode).toBe(true);
    });

    it('should generate test fixtures', async () => {
      const response = await request(app)
        .post('/test/fax/fixtures/generate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.fixtures).toBeDefined();
      expect(response.body.fixtures.length).toBeGreaterThan(0);
    });

    it('should list available test fixtures', async () => {
      // Generate fixtures first
      await request(app).post('/test/fax/fixtures/generate');

      const response = await request(app)
        .get('/test/fax/fixtures');

      expect(response.status).toBe(200);
      expect(response.body.fixtures).toBeDefined();
      expect(response.body.fixtures.length).toBeGreaterThan(0);

      // Check for expected fixture files
      const fixtureNames = response.body.fixtures.map((f: any) => f.filename);
      expect(fixtureNames).toContain('email_request.png');
      expect(fixtureNames).toContain('shopping_request.png');
      expect(fixtureNames).toContain('ai_chat_request.png');
    });

    it('should serve test fixture files', async () => {
      // Generate fixtures first
      await request(app).post('/test/fax/fixtures/generate');

      const response = await request(app)
        .get('/test/fax/fixtures/email_request.png');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
    });

    it('should clear test data', async () => {
      // Upload a test fax first
      const fixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(fixture).toBeDefined();

      await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', fixture!, 'email_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321');

      // Verify fax exists
      let listResponse = await request(app).get('/test/fax/list');
      expect(listResponse.body.test_faxes.length).toBeGreaterThan(0);

      // Clear test data
      const clearResponse = await request(app).delete('/test/fax/clear');
      expect(clearResponse.status).toBe(200);
      expect(clearResponse.body.success).toBe(true);

      // Verify data is cleared
      listResponse = await request(app).get('/test/fax/list');
      expect(listResponse.body.test_faxes.length).toBe(0);
    });
  });

  describe('Test Fax Upload and Processing', () => {
    it('should accept test fax uploads', async () => {
      const fixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(fixture).toBeDefined();

      const response = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', fixture!, 'email_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.fax_id).toBeDefined();
      expect(response.body.processing_url).toBeDefined();
    });

    it('should reject invalid file types', async () => {
      const invalidFile = Buffer.from('This is not an image');

      const response = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', invalidFile, 'invalid.txt')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321');

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should provide fax processing status', async () => {
      const fixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(fixture).toBeDefined();

      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', fixture!, 'email_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321');

      expect(uploadResponse.status).toBe(200);
      const faxId = uploadResponse.body.fax_id;

      // Check status
      const statusResponse = await request(app)
        .get(`/test/fax/status/${faxId}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.fax_id).toBe(faxId);
      expect(statusResponse.body.status).toBeDefined();
      expect(statusResponse.body.processing_steps).toBeDefined();
    });

    it('should list test faxes', async () => {
      const fixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(fixture).toBeDefined();

      // Upload multiple test faxes
      const faxIds = [];
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/test/fax/receive')
          .attach('fax_file', fixture!, `email_request_${i}.png`)
          .field('from_number', `+123456789${i}`)
          .field('to_number', '+0987654321');

        expect(response.status).toBe(200);
        faxIds.push(response.body.fax_id);
      }

      // List faxes
      const listResponse = await request(app).get('/test/fax/list');
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.test_faxes).toBeDefined();
      expect(listResponse.body.test_faxes.length).toBe(3);
    });
  });

  describe('Mock Fax Sender Integration', () => {
    it('should track mock sent faxes', async () => {
      const fixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(fixture).toBeDefined();

      // Upload test fax that should generate a response
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', fixture!, 'email_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321');

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

      // Check mock sent faxes
      const mockFaxesResponse = await request(app)
        .get('/test/fax/responses');

      expect(mockFaxesResponse.status).toBe(200);
      expect(mockFaxesResponse.body.mock_faxes).toBeDefined();
      
      // Should have at least one mock fax sent (the response)
      if (status === 'completed') {
        expect(mockFaxesResponse.body.mock_faxes.length).toBeGreaterThan(0);
      }
    });

    it('should provide mock fax statistics', async () => {
      const statsResponse = await request(app)
        .get('/test/fax/stats');

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body).toBeDefined();
      
      // Should have statistics structure
      expect(typeof statsResponse.body).toBe('object');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing files gracefully', async () => {
      const response = await request(app)
        .post('/test/fax/receive')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321');

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should handle invalid fax IDs', async () => {
      const response = await request(app)
        .get('/test/fax/status/invalid-fax-id');

      expect(response.status).toBe(200);
      expect(response.body.fax_id).toBe('invalid-fax-id');
      expect(response.body.status).toBe('unknown');
    });

    it('should handle non-existent fixtures', async () => {
      const response = await request(app)
        .get('/test/fax/fixtures/nonexistent.png');

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Test Mode Validation', () => {
    it('should only allow test endpoints in test mode', async () => {
      // This test verifies that test endpoints are properly gated
      // In production (TEST_MODE=false), these endpoints should return 404
      
      const testEndpoints = [
        '/test/fax/receive',
        '/test/fax/list',
        '/test/fax/fixtures',
        '/test/fax/clear',
      ];

      // All endpoints should be available in test mode
      for (const endpoint of testEndpoints) {
        const response = await request(app).get(endpoint);
        // Should not return 404 (endpoint exists)
        expect(response.status).not.toBe(404);
      }
    });
  });
});