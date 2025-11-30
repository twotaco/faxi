import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { testFaxFixtureGenerator } from '../fixtures/createTestFaxes';
import { userRepository } from '../../repositories/userRepository';

let app: Express;

describe('Automatic User Registration Integration Tests', () => {
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

  describe('First-time User Registration', () => {
    it('should automatically register new user on first fax', async () => {
      const newUserPhone = '+1555123456';
      
      // Verify user doesn't exist initially
      const existingUser = await userRepository.findByPhoneNumber(newUserPhone);
      expect(existingUser).toBeNull();

      // Send first fax from new user
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(emailFixture).toBeDefined();

      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', newUserPhone)
        .field('to_number', '+0987654321')
        .field('test_user_phone', newUserPhone);

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

      // Verify user was created
      const newUser = await userRepository.findByPhoneNumber(newUserPhone);
      expect(newUser).toBeDefined();
      expect(newUser?.phoneNumber).toBe(newUserPhone);
      expect(newUser?.emailAddress).toBe(`${newUserPhone.replace('+', '')}@me.faxi.jp`);
      expect(newUser?.isActive).toBe(true);
    });

    it('should generate welcome fax for new users', async () => {
      const newUserPhone = '+1555987654';
      
      // Send first fax from new user
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(emailFixture).toBeDefined();

      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', newUserPhone)
        .field('to_number', '+0987654321')
        .field('test_user_phone', newUserPhone);

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

      // Check for welcome fax generation in processing steps
      const statusResponse = await request(app)
        .get(`/test/fax/status/${faxId}`);

      const stepOperations = statusResponse.body.processing_steps.map((step: any) => step.operation);
      
      // Should have welcome fax generation step
      expect(stepOperations.some((op: string) => op.includes('welcome') || op.includes('onboarding'))).toBe(true);
    });

    it('should not duplicate user registration for existing users', async () => {
      const existingUserPhone = '+1234567890';
      
      // Create user first
      await userRepository.create({
        phoneNumber: existingUserPhone,
        emailAddress: `${existingUserPhone.replace('+', '')}@me.faxi.jp`,
        isActive: true,
        preferences: {},
      });

      const userCountBefore = await userRepository.findByPhoneNumber(existingUserPhone);
      expect(userCountBefore).toBeDefined();

      // Send fax from existing user
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(emailFixture).toBeDefined();

      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', existingUserPhone)
        .field('to_number', '+0987654321')
        .field('test_user_phone', existingUserPhone);

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

      // Verify user wasn't duplicated
      const userCountAfter = await userRepository.findByPhoneNumber(existingUserPhone);
      expect(userCountAfter).toBeDefined();
      expect(userCountAfter?.id).toBe(userCountBefore?.id);
    });

    it('should initialize default preferences for new users', async () => {
      const newUserPhone = '+1555111222';
      
      // Send first fax from new user
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(emailFixture).toBeDefined();

      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', newUserPhone)
        .field('to_number', '+0987654321')
        .field('test_user_phone', newUserPhone);

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

      // Verify user has default preferences
      const newUser = await userRepository.findByPhoneNumber(newUserPhone);
      expect(newUser).toBeDefined();
      expect(newUser?.preferences).toBeDefined();
      
      // Should have default spam filtering and other preferences
      expect(typeof newUser?.preferences).toBe('object');
    });
  });

  describe('Email Address Generation', () => {
    it('should generate correct email format for phone numbers', async () => {
      const testCases = [
        { phone: '+1234567890', expected: '1234567890@me.faxi.jp' },
        { phone: '+81901234567', expected: '81901234567@me.faxi.jp' },
        { phone: '+44207123456', expected: '44207123456@me.faxi.jp' },
      ];

      for (const testCase of testCases) {
        // Send fax to trigger user creation
        const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
        expect(emailFixture).toBeDefined();

        const uploadResponse = await request(app)
          .post('/test/fax/receive')
          .attach('fax_file', emailFixture!, 'email_request.png')
          .field('from_number', testCase.phone)
          .field('to_number', '+0987654321')
          .field('test_user_phone', testCase.phone);

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

        // Verify email address format
        const user = await userRepository.findByPhoneNumber(testCase.phone);
        expect(user).toBeDefined();
        expect(user?.emailAddress).toBe(testCase.expected);
      }
    });
  });
});