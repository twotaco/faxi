import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { userRepository } from '../../repositories/userRepository';
import { addressBookRepository } from '../../repositories/addressBookRepository';
import { emailThreadRepository, emailMessageRepository } from '../../repositories/emailThreadRepository';
import { testFaxFixtureGenerator } from '../fixtures/createTestFaxes';
import { awsSesService } from '../../services/awsSesService';

let app: Express;

/**
 * Integration Test: Outbound Email Flow
 * 
 * Tests the complete flow: Fax request → Email extraction → Contact lookup → 
 * Email send → Confirmation fax
 * 
 * Requirements: 5.1-5.7, 13.2
 */
describe('Outbound Email Flow Integration Tests', () => {
  beforeEach(async () => {
    // Initialize test app
    const { createTestApp } = await import('../testApp');
    app = await createTestApp();
    
    // Generate test fixtures
    testFaxFixtureGenerator.generateAllFixtures();
    
    // Mock AWS SES in test mode
    vi.spyOn(awsSesService, 'sendEmail').mockResolvedValue({
      messageId: `test-msg-${Date.now()}`
    });
  });

  afterEach(async () => {
    // Clean up test data
    await request(app).delete('/test/fax/clear');
    vi.restoreAllMocks();
  });

  describe('Outbound Email with Direct Email Address', () => {
    it('should send email when fax contains email address', async () => {
      const testPhoneNumber = '+1555111000';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const recipientEmail = 'recipient@example.com';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send fax with email request
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      expect(emailFixture).toBeDefined();

      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', testPhoneNumber)
        .field('to_number', '+0987654321')
        .field('test_user_phone', testPhoneNumber)
        .field('test_email_recipient', recipientEmail)
        .field('test_email_subject', 'Test Email Subject')
        .field('test_email_body', 'This is a test email body');

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

      // Requirement 5.4: Email should be sent via AWS SES
      expect(awsSesService.sendEmail).toHaveBeenCalled();
      const sendCall = vi.mocked(awsSesService.sendEmail).mock.calls[0][0];
      
      // Requirement 5.3: Sender should be user's Faxi email
      expect(sendCall.from).toBe(userEmail);
      expect(sendCall.to).toBe(recipientEmail);

      // Requirement 5.5: Email should be stored in database
      const threads = await emailThreadRepository.findByUserId(user.id);
      expect(threads.length).toBeGreaterThan(0);
      
      const messages = await emailMessageRepository.findByThreadId(threads[0].threadId);
      const outboundMessage = messages.find(m => m.direction === 'outbound');
      expect(outboundMessage).toBeDefined();
      expect(outboundMessage?.toAddresses).toContain(recipientEmail);

      // Requirement 5.6: Confirmation fax should be sent
      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      const confirmationFax = faxJobs.find((fax: any) => 
        fax.details?.type === 'confirmation' || fax.details?.type === 'email_confirmation'
      );
      
      expect(confirmationFax).toBeDefined();
    });

    it('should handle email send failure with error fax', async () => {
      const testPhoneNumber = '+1555111001';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      
      // Create user
      await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Mock AWS SES to fail
      vi.mocked(awsSesService.sendEmail).mockRejectedValue(
        new Error('Email sending failed')
      );

      // Send fax with email request
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', testPhoneNumber)
        .field('to_number', '+0987654321')
        .field('test_user_phone', testPhoneNumber)
        .field('test_email_recipient', 'fail@example.com')
        .field('test_email_subject', 'Fail Test')
        .field('test_email_body', 'This should fail');

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Requirement 5.7: Error notification fax should be sent
      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      const errorFax = faxJobs.find((fax: any) => 
        fax.details?.type === 'error' || fax.details?.type === 'email_error'
      );
      
      expect(errorFax).toBeDefined();
    });
  });

  describe('Outbound Email with Contact Name Lookup', () => {
    it('should resolve contact name to email address', async () => {
      const testPhoneNumber = '+1555111002';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const contactEmail = 'john.doe@example.com';
      const contactName = 'John Doe';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Add contact to address book
      await addressBookRepository.create({
        userId: user.id,
        name: contactName,
        emailAddress: contactEmail,
        relationship: 'friend'
      });

      // Send fax with contact name
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', testPhoneNumber)
        .field('to_number', '+0987654321')
        .field('test_user_phone', testPhoneNumber)
        .field('test_email_recipient', contactName) // Use contact name instead of email
        .field('test_email_subject', 'Contact Lookup Test')
        .field('test_email_body', 'Testing contact name resolution');

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Requirement 13.2: Contact name should be resolved to email
      expect(awsSesService.sendEmail).toHaveBeenCalled();
      const sendCall = vi.mocked(awsSesService.sendEmail).mock.calls[0][0];
      expect(sendCall.to).toBe(contactEmail);
    });

    it('should handle partial contact name match', async () => {
      const testPhoneNumber = '+1555111003';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Add contact
      await addressBookRepository.create({
        userId: user.id,
        name: 'Jane Smith',
        emailAddress: 'jane.smith@example.com',
        relationship: 'colleague'
      });

      // Send fax with partial name
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', testPhoneNumber)
        .field('to_number', '+0987654321')
        .field('test_user_phone', testPhoneNumber)
        .field('test_email_recipient', 'Jane') // Partial name
        .field('test_email_subject', 'Partial Match Test')
        .field('test_email_body', 'Testing partial name match');

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Should resolve partial name to full contact
      expect(awsSesService.sendEmail).toHaveBeenCalled();
      const sendCall = vi.mocked(awsSesService.sendEmail).mock.calls[0][0];
      expect(sendCall.to).toBe('jane.smith@example.com');
    });

    it('should send clarification fax when multiple contacts match', async () => {
      const testPhoneNumber = '+1555111004';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Add multiple contacts with similar names
      await addressBookRepository.create({
        userId: user.id,
        name: 'John Smith',
        emailAddress: 'john.smith@example.com',
        relationship: 'friend'
      });

      await addressBookRepository.create({
        userId: user.id,
        name: 'John Doe',
        emailAddress: 'john.doe@example.com',
        relationship: 'colleague'
      });

      // Send fax with ambiguous name
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', testPhoneNumber)
        .field('to_number', '+0987654321')
        .field('test_user_phone', testPhoneNumber)
        .field('test_email_recipient', 'John') // Ambiguous name
        .field('test_email_subject', 'Ambiguous Test')
        .field('test_email_body', 'Testing multiple matches');

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Should send clarification fax instead of email
      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      const clarificationFax = faxJobs.find((fax: any) => 
        fax.details?.type === 'clarification' || fax.details?.type === 'multiple_contacts'
      );
      
      expect(clarificationFax).toBeDefined();
    });

    it('should send error fax when contact not found', async () => {
      const testPhoneNumber = '+1555111005';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      
      // Create user
      await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send fax with unknown contact name
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', testPhoneNumber)
        .field('to_number', '+0987654321')
        .field('test_user_phone', testPhoneNumber)
        .field('test_email_recipient', 'Unknown Person')
        .field('test_email_subject', 'Not Found Test')
        .field('test_email_body', 'Testing contact not found');

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Should send error fax for contact not found
      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      const errorFax = faxJobs.find((fax: any) => 
        fax.details?.type === 'error' || fax.details?.type === 'contact_not_found'
      );
      
      expect(errorFax).toBeDefined();
    });
  });

  describe('Email Content Extraction', () => {
    it('should extract email details from fax content', async () => {
      const testPhoneNumber = '+1555111006';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      
      // Create user
      await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send fax with email request
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', testPhoneNumber)
        .field('to_number', '+0987654321')
        .field('test_user_phone', testPhoneNumber)
        .field('test_email_recipient', 'extract@example.com')
        .field('test_email_subject', 'Extraction Test Subject')
        .field('test_email_body', 'This is the email body content that should be extracted.');

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Requirement 5.1: Recipient email should be extracted
      // Requirement 5.2: Subject and body should be extracted
      expect(awsSesService.sendEmail).toHaveBeenCalled();
      const sendCall = vi.mocked(awsSesService.sendEmail).mock.calls[0][0];
      
      expect(sendCall.to).toBe('extract@example.com');
      expect(sendCall.subject).toBe('Extraction Test Subject');
      expect(sendCall.body).toContain('email body content');
    });

    it('should handle email with special characters', async () => {
      const testPhoneNumber = '+1555111007';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      
      // Create user
      await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send fax with special characters
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', testPhoneNumber)
        .field('to_number', '+0987654321')
        .field('test_user_phone', testPhoneNumber)
        .field('test_email_recipient', 'special@example.com')
        .field('test_email_subject', 'Test: Special & Characters!')
        .field('test_email_body', 'Body with "quotes" and <brackets>');

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Should handle special characters correctly
      expect(awsSesService.sendEmail).toHaveBeenCalled();
      const sendCall = vi.mocked(awsSesService.sendEmail).mock.calls[0][0];
      
      expect(sendCall.subject).toContain('Special');
      expect(sendCall.body).toContain('quotes');
    });
  });

  describe('Email Storage and Confirmation', () => {
    it('should store outbound email in thread', async () => {
      const testPhoneNumber = '+1555111008';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const recipientEmail = 'storage@example.com';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send email
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', testPhoneNumber)
        .field('to_number', '+0987654321')
        .field('test_user_phone', testPhoneNumber)
        .field('test_email_recipient', recipientEmail)
        .field('test_email_subject', 'Storage Test')
        .field('test_email_body', 'Testing email storage');

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify email was stored
      const threads = await emailThreadRepository.findByUserId(user.id);
      expect(threads.length).toBeGreaterThan(0);
      
      const messages = await emailMessageRepository.findByThreadId(threads[0].threadId);
      const outboundMessage = messages.find(m => m.direction === 'outbound');
      
      expect(outboundMessage).toBeDefined();
      expect(outboundMessage?.fromAddress).toBe(userEmail);
      expect(outboundMessage?.toAddresses).toContain(recipientEmail);
      expect(outboundMessage?.subject).toBe('Storage Test');
    });

    it('should send confirmation fax after successful send', async () => {
      const testPhoneNumber = '+1555111009';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      
      // Create user
      await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send email
      const emailFixture = testFaxFixtureGenerator.getFixture('email_request.png');
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', emailFixture!, 'email_request.png')
        .field('from_number', testPhoneNumber)
        .field('to_number', '+0987654321')
        .field('test_user_phone', testPhoneNumber)
        .field('test_email_recipient', 'confirm@example.com')
        .field('test_email_subject', 'Confirmation Test')
        .field('test_email_body', 'Testing confirmation');

      expect(uploadResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify confirmation fax was sent
      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      const confirmationFax = faxJobs.find((fax: any) => 
        fax.details?.type === 'confirmation' && fax.to_number === testPhoneNumber
      );
      
      expect(confirmationFax).toBeDefined();
    });
  });
});
