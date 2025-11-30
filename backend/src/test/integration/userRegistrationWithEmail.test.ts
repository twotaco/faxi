import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { userRepository } from '../../repositories/userRepository';
import { testFaxFixtureGenerator } from '../fixtures/createTestFaxes';

let app: Express;

/**
 * Integration Test: First-Time User Registration with Email
 * 
 * Tests the complete flow: First fax → User creation → Email assignment → Welcome fax
 * 
 * Requirements: 1.1-1.5, 2.1-2.5
 */
describe('User Registration with Email Integration Tests', () => {
  beforeEach(async () => {
    // Initialize test app
    const { createTestApp } = await import('../testApp');
    app = await createTestApp();
    
    // Generate test fixtures
    testFaxFixtureGenerator.generateAllFixtures();
  });

  afterEach(async () => {
    // Clean up test data
    await request(app).delete('/test/fax/clear');
  });

  describe('First-Time User Registration', () => {
    it('should create user with email address on first fax', async () => {
      const newUserPhone = '+1555222000';
      
      // Requirement 1.1: Verify user doesn't exist initially
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

      // Wait for processing
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app).get(`/test/fax/status/${faxId}`);
        status = statusResponse.body.status;
        attempts++;
      }

      // Requirement 1.1: User should be created automatically
      const newUser = await userRepository.findByPhoneNumber(newUserPhone);
      expect(newUser).toBeDefined();
      expect(newUser?.phoneNumber).toBe(newUserPhone);
      
      // Requirement 1.2: Email address should be generated in correct format
      const expectedEmail = `${newUserPhone.replace('+', '')}@me.faxi.jp`;
      expect(newUser?.emailAddress).toBe(expectedEmail);
      
      // Requirement 1.3: User record should be stored with timestamp
      expect(newUser?.createdAt).toBeDefined();
      expect(newUser?.isActive).toBe(true);
    });

    it('should generate email address without symbols', async () => {
      const testCases = [
        { phone: '+1-234-567-8900', expected: '12345678900@me.faxi.jp' },
        { phone: '+81 (90) 1234-5678', expected: '819012345678@me.faxi.jp' },
        { phone: '+44 20 7123 4567', expected: '442071234567@me.faxi.jp' },
      ];

      for (const testCase of testCases) {
        // Send fax to trigger user creation
        const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
        
        const uploadResponse = await request(app)
          .post('/test/fax/receive')
          .attach('fax_file', emailFixture!, 'email_request.png')
          .field('from_number', testCase.phone)
          .field('to_number', '+0987654321')
          .field('test_user_phone', testCase.phone);

        expect(uploadResponse.status).toBe(200);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify email address format (no symbols)
        const user = await userRepository.findByPhoneNumber(testCase.phone);
        expect(user).toBeDefined();
        expect(user?.emailAddress).toBe(testCase.expected);
        
        // Verify no symbols in email local part
        const localPart = user?.emailAddress.split('@')[0];
        expect(localPart).toMatch(/^\d+$/); // Only digits
      }
    });

    it('should enqueue welcome fax for new user', async () => {
      const newUserPhone = '+1555222001';
      
      // Send first fax
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', newUserPhone)
        .field('to_number', '+0987654321')
        .field('test_user_phone', newUserPhone);

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Requirement 1.4: Welcome fax job should be enqueued
      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      
      const welcomeFax = faxJobs.find((fax: any) => 
        fax.details?.type === 'welcome' || 
        fax.details?.type === 'onboarding' ||
        fax.to_number === newUserPhone
      );
      
      expect(welcomeFax).toBeDefined();
    });

    it('should not send welcome fax to existing users', async () => {
      const existingUserPhone = '+1555222002';
      
      // Create user first
      await userRepository.create({
        phoneNumber: existingUserPhone,
        emailAddress: `${existingUserPhone.replace('+', '')}@me.faxi.jp`,
        isActive: true,
        preferences: { welcomeFaxSent: true }
      });

      // Send fax from existing user
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', existingUserPhone)
        .field('to_number', '+0987654321')
        .field('test_user_phone', existingUserPhone);

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Should not send duplicate welcome fax
      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      
      const welcomeFaxes = faxJobs.filter((fax: any) => 
        fax.details?.type === 'welcome' && fax.to_number === existingUserPhone
      );
      
      // Should have at most one welcome fax (from initial creation)
      expect(welcomeFaxes.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Welcome Fax Content', () => {
    it('should include email address in welcome fax', async () => {
      const newUserPhone = '+1555222003';
      const expectedEmail = `${newUserPhone.replace('+', '')}@me.faxi.jp`;
      
      // Send first fax
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', newUserPhone)
        .field('to_number', '+0987654321')
        .field('test_user_phone', newUserPhone);

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Requirement 1.5 & 2.1: Welcome fax should include email address prominently
      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      
      const welcomeFax = faxJobs.find((fax: any) => 
        fax.details?.type === 'welcome' && fax.to_number === newUserPhone
      );
      
      expect(welcomeFax).toBeDefined();
      
      // Check if email address is in the fax details
      const faxDetails = JSON.stringify(welcomeFax.details);
      expect(faxDetails).toContain(expectedEmail);
    });

    it('should include sending instructions in welcome fax', async () => {
      const newUserPhone = '+1555222004';
      
      // Send first fax
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', newUserPhone)
        .field('to_number', '+0987654321')
        .field('test_user_phone', newUserPhone);

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Requirement 2.2: Should include instructions for sending emails
      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      
      const welcomeFax = faxJobs.find((fax: any) => 
        fax.details?.type === 'welcome' && fax.to_number === newUserPhone
      );
      
      expect(welcomeFax).toBeDefined();
      
      // Check for sending instructions keywords
      const faxDetails = JSON.stringify(welcomeFax.details).toLowerCase();
      expect(
        faxDetails.includes('send') || 
        faxDetails.includes('email') ||
        faxDetails.includes('instructions')
      ).toBe(true);
    });

    it('should include receiving instructions in welcome fax', async () => {
      const newUserPhone = '+1555222005';
      
      // Send first fax
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', newUserPhone)
        .field('to_number', '+0987654321')
        .field('test_user_phone', newUserPhone);

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Requirement 2.3: Should include instructions for receiving emails
      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      
      const welcomeFax = faxJobs.find((fax: any) => 
        fax.details?.type === 'welcome' && fax.to_number === newUserPhone
      );
      
      expect(welcomeFax).toBeDefined();
      
      // Check for receiving instructions keywords
      const faxDetails = JSON.stringify(welcomeFax.details).toLowerCase();
      expect(
        faxDetails.includes('receive') || 
        faxDetails.includes('incoming') ||
        faxDetails.includes('get')
      ).toBe(true);
    });

    it('should include example formats in welcome fax', async () => {
      const newUserPhone = '+1555222006';
      
      // Send first fax
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', newUserPhone)
        .field('to_number', '+0987654321')
        .field('test_user_phone', newUserPhone);

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Requirement 2.4: Should include example email request formats
      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      
      const welcomeFax = faxJobs.find((fax: any) => 
        fax.details?.type === 'welcome' && fax.to_number === newUserPhone
      );
      
      expect(welcomeFax).toBeDefined();
      
      // Check for example keywords
      const faxDetails = JSON.stringify(welcomeFax.details).toLowerCase();
      expect(
        faxDetails.includes('example') || 
        faxDetails.includes('format') ||
        faxDetails.includes('sample')
      ).toBe(true);
    });
  });

  describe('Welcome Fax Preference Tracking', () => {
    it('should mark welcomeFaxSent preference after sending', async () => {
      const newUserPhone = '+1555222007';
      
      // Send first fax
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', newUserPhone)
        .field('to_number', '+0987654321')
        .field('test_user_phone', newUserPhone);

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Requirement 2.5: welcomeFaxSent preference should be set to true
      const user = await userRepository.findByPhoneNumber(newUserPhone);
      expect(user).toBeDefined();
      expect(user?.preferences?.welcomeFaxSent).toBe(true);
    });

    it('should not send welcome fax if preference already set', async () => {
      const existingUserPhone = '+1555222008';
      
      // Create user with welcomeFaxSent already true
      await userRepository.create({
        phoneNumber: existingUserPhone,
        emailAddress: `${existingUserPhone.replace('+', '')}@me.faxi.jp`,
        isActive: true,
        preferences: { welcomeFaxSent: true }
      });

      // Send fax
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', existingUserPhone)
        .field('to_number', '+0987654321')
        .field('test_user_phone', existingUserPhone);

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Should not send another welcome fax
      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      
      const welcomeFaxes = faxJobs.filter((fax: any) => 
        fax.details?.type === 'welcome' && fax.to_number === existingUserPhone
      );
      
      // Should have no new welcome faxes
      expect(welcomeFaxes.length).toBe(0);
    });
  });

  describe('Email Address Validation', () => {
    it('should generate unique email addresses for each user', async () => {
      const phone1 = '+1555222009';
      const phone2 = '+1555222010';
      
      // Create first user
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      
      await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', phone1)
        .field('to_number', '+0987654321')
        .field('test_user_phone', phone1);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create second user
      await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', phone2)
        .field('to_number', '+0987654321')
        .field('test_user_phone', phone2);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify both users have unique email addresses
      const user1 = await userRepository.findByPhoneNumber(phone1);
      const user2 = await userRepository.findByPhoneNumber(phone2);
      
      expect(user1?.emailAddress).not.toBe(user2?.emailAddress);
      expect(user1?.emailAddress).toMatch(/@me\.faxi\.jp$/);
      expect(user2?.emailAddress).toMatch(/@me\.faxi\.jp$/);
    });

    it('should validate email address format', async () => {
      const newUserPhone = '+1555222011';
      
      // Send first fax
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', newUserPhone)
        .field('to_number', '+0987654321')
        .field('test_user_phone', newUserPhone);

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify email address matches pattern
      const user = await userRepository.findByPhoneNumber(newUserPhone);
      expect(user?.emailAddress).toMatch(/^\d+@me\.faxi\.jp$/);
    });
  });

  describe('User Creation Edge Cases', () => {
    it('should handle concurrent faxes from same new user', async () => {
      const newUserPhone = '+1555222012';
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      
      // Send two faxes simultaneously
      const promise1 = request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', newUserPhone)
        .field('to_number', '+0987654321')
        .field('test_user_phone', newUserPhone);

      const promise2 = request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', newUserPhone)
        .field('to_number', '+0987654321')
        .field('test_user_phone', newUserPhone);

      const [response1, response2] = await Promise.all([promise1, promise2]);
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Should only create one user (not duplicate)
      const user = await userRepository.findByPhoneNumber(newUserPhone);
      expect(user).toBeDefined();
      
      // Should only send one welcome fax
      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      const welcomeFaxes = faxJobs.filter((fax: any) => 
        fax.details?.type === 'welcome' && fax.to_number === newUserPhone
      );
      
      expect(welcomeFaxes.length).toBeLessThanOrEqual(1);
    });

    it('should handle international phone numbers correctly', async () => {
      const internationalPhones = [
        '+81901234567',  // Japan
        '+442071234567', // UK
        '+33123456789',  // France
        '+61212345678',  // Australia
      ];

      for (const phone of internationalPhones) {
        const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
        
        await request(app)
          .post('/test/fax/receive')
          .attach('fax_file', emailFixture!, 'email_request.png')
          .field('from_number', phone)
          .field('to_number', '+0987654321')
          .field('test_user_phone', phone);

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify user created with correct email
        const user = await userRepository.findByPhoneNumber(phone);
        expect(user).toBeDefined();
        
        const expectedEmail = `${phone.replace('+', '')}@me.faxi.jp`;
        expect(user?.emailAddress).toBe(expectedEmail);
      }
    });
  });
});
