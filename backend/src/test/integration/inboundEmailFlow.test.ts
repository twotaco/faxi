import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { userRepository } from '../../repositories/userRepository';
import { addressBookRepository } from '../../repositories/addressBookRepository';
import { emailThreadRepository, emailMessageRepository } from '../../repositories/emailThreadRepository';

let app: Express;

/**
 * Integration Test: Inbound Email Flow
 * 
 * Tests the complete flow: External email → SNS webhook → User creation → 
 * Contact registration → Email-to-fax → Fax send
 * 
 * Requirements: 3.1-3.8, 13.1
 */
describe('Inbound Email Flow Integration Tests', () => {
  beforeEach(async () => {
    // Initialize test app
    const { createTestApp } = await import('../testApp');
    app = await createTestApp();
  });

  afterEach(async () => {
    // Clean up test data
    await request(app).delete('/test/fax/clear');
  });

  describe('Complete Inbound Email Flow', () => {
    it('should process external email through complete pipeline', async () => {
      const testPhoneNumber = '+1555000111';
      const senderEmail = 'external@example.com';
      const senderName = 'External Sender';
      
      // Verify user doesn't exist initially
      const existingUser = await userRepository.findByPhoneNumber(testPhoneNumber);
      expect(existingUser).toBeNull();

      // Simulate AWS SES SNS webhook notification for inbound email
      const snsNotification = {
        Type: 'Notification',
        MessageId: 'test-message-id-123',
        TopicArn: 'arn:aws:sns:us-east-1:123456789:faxi-email-notifications',
        Subject: 'Amazon SES Email Receipt Notification',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: senderEmail,
            destination: [`${testPhoneNumber.replace('+', '')}@me.faxi.jp`],
            commonHeaders: {
              from: [`${senderName} <${senderEmail}>`],
              subject: 'Test Email Subject',
              date: new Date().toISOString()
            }
          },
          content: 'This is a test email body that should be converted to fax format.'
        }),
        Timestamp: new Date().toISOString(),
        SignatureVersion: '1',
        Signature: 'test-signature',
        SigningCertURL: 'https://sns.us-east-1.amazonaws.com/test.pem'
      };

      // Send SNS webhook notification
      const webhookResponse = await request(app)
        .post('/webhooks/email/sns')
        .send(snsNotification);

      // Requirement 3.1: AWS SES should accept email and trigger webhook
      expect(webhookResponse.status).toBe(200);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Requirement 3.4: User should be created
      const user = await userRepository.findByPhoneNumber(testPhoneNumber);
      expect(user).toBeDefined();
      expect(user?.phoneNumber).toBe(testPhoneNumber);
      
      // Requirement 3.2: Email address should be extracted from recipient
      const expectedEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      expect(user?.emailAddress).toBe(expectedEmail);

      // Requirement 13.1: Sender should be registered as contact
      const contact = await addressBookRepository.findByEmail(user!.id, senderEmail);
      expect(contact).toBeDefined();
      expect(contact?.emailAddress).toBe(senderEmail);
      expect(contact?.name).toBe(senderName);

      // Requirement 3.5: Email should be stored in database
      const threads = await emailThreadRepository.findByUserId(user!.id);
      expect(threads.length).toBeGreaterThan(0);
      
      const thread = threads[0];
      expect(thread.subject).toBe('Test Email Subject');
      expect(thread.participants).toContain(senderEmail);

      // Requirement 3.6: Email-to-fax job should be enqueued
      const faxListResponse = await request(app).get('/test/fax/list');
      expect(faxListResponse.status).toBe(200);
      
      const faxJobs = faxListResponse.body.test_faxes;
      const emailFax = faxJobs.find((fax: any) => 
        fax.details?.source === 'email' || fax.details?.type === 'email_to_fax'
      );
      
      // Requirement 3.7: Fax should be generated and sent
      expect(emailFax).toBeDefined();
      expect(emailFax.to_number).toBe(testPhoneNumber);
    });

    it('should handle multiple emails to same user', async () => {
      const testPhoneNumber = '+1555000222';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      
      // Create user first
      await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send first email
      const firstEmail = {
        Type: 'Notification',
        MessageId: 'msg-1',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: 'sender1@example.com',
            destination: [userEmail],
            commonHeaders: {
              from: ['Sender One <sender1@example.com>'],
              subject: 'First Email',
              date: new Date().toISOString()
            }
          },
          content: 'First email content'
        })
      };

      await request(app).post('/webhooks/email/sns').send(firstEmail);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send second email from different sender
      const secondEmail = {
        Type: 'Notification',
        MessageId: 'msg-2',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: 'sender2@example.com',
            destination: [userEmail],
            commonHeaders: {
              from: ['Sender Two <sender2@example.com>'],
              subject: 'Second Email',
              date: new Date().toISOString()
            }
          },
          content: 'Second email content'
        })
      };

      await request(app).post('/webhooks/email/sns').send(secondEmail);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify both contacts were registered
      const user = await userRepository.findByPhoneNumber(testPhoneNumber);
      const contact1 = await addressBookRepository.findByEmail(user!.id, 'sender1@example.com');
      const contact2 = await addressBookRepository.findByEmail(user!.id, 'sender2@example.com');
      
      expect(contact1).toBeDefined();
      expect(contact2).toBeDefined();

      // Verify both emails were stored
      const threads = await emailThreadRepository.findByUserId(user!.id);
      expect(threads.length).toBeGreaterThanOrEqual(2);

      // Verify both faxes were generated
      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      const emailFaxes = faxJobs.filter((fax: any) => 
        fax.details?.source === 'email' || fax.details?.type === 'email_to_fax'
      );
      
      expect(emailFaxes.length).toBeGreaterThanOrEqual(2);
    });

    it('should reject email to invalid Faxi address', async () => {
      // Requirement 3.3: Validate recipient email format
      const invalidEmail = {
        Type: 'Notification',
        MessageId: 'invalid-msg',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: 'sender@example.com',
            destination: ['invalid@wrongdomain.com'],
            commonHeaders: {
              from: ['Sender <sender@example.com>'],
              subject: 'Invalid Email',
              date: new Date().toISOString()
            }
          },
          content: 'This should be rejected'
        })
      };

      const webhookResponse = await request(app)
        .post('/webhooks/email/sns')
        .send(invalidEmail);

      // Webhook should accept (200) but not process
      expect(webhookResponse.status).toBe(200);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // No fax should be generated for invalid email
      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      const invalidFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'sender@example.com'
      );
      
      expect(invalidFax).toBeUndefined();
    });

    it('should handle email with HTML content', async () => {
      const testPhoneNumber = '+1555000333';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      
      const htmlEmail = {
        Type: 'Notification',
        MessageId: 'html-msg',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: 'html@example.com',
            destination: [userEmail],
            commonHeaders: {
              from: ['HTML Sender <html@example.com>'],
              subject: 'HTML Email',
              date: new Date().toISOString()
            }
          },
          content: '<html><body><h1>HTML Email</h1><p>This is <strong>bold</strong> text.</p></body></html>'
        })
      };

      const webhookResponse = await request(app)
        .post('/webhooks/email/sns')
        .send(htmlEmail);

      expect(webhookResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify HTML email was processed
      const user = await userRepository.findByPhoneNumber(testPhoneNumber);
      expect(user).toBeDefined();

      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      const htmlFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'html@example.com'
      );
      
      expect(htmlFax).toBeDefined();
    });

    it('should update existing contact when receiving email from known sender', async () => {
      const testPhoneNumber = '+1555000444';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const senderEmail = 'known@example.com';
      
      // Create user and contact
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      await addressBookRepository.create({
        userId: user.id,
        name: 'Old Name',
        emailAddress: senderEmail,
        relationship: 'friend'
      });

      // Send email with updated name
      const email = {
        Type: 'Notification',
        MessageId: 'update-msg',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: senderEmail,
            destination: [userEmail],
            commonHeaders: {
              from: ['New Name <known@example.com>'],
              subject: 'Update Test',
              date: new Date().toISOString()
            }
          },
          content: 'Testing contact update'
        })
      };

      await request(app).post('/webhooks/email/sns').send(email);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify contact was updated
      const contact = await addressBookRepository.findByEmail(user.id, senderEmail);
      expect(contact).toBeDefined();
      expect(contact?.name).toBe('New Name');
    });
  });

  describe('Email Storage and Threading', () => {
    it('should create email thread for new conversation', async () => {
      const testPhoneNumber = '+1555000555';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      
      const email = {
        Type: 'Notification',
        MessageId: 'thread-msg',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: 'thread@example.com',
            destination: [userEmail],
            commonHeaders: {
              from: ['Thread Sender <thread@example.com>'],
              subject: 'New Thread',
              date: new Date().toISOString()
            }
          },
          content: 'Starting a new thread'
        })
      };

      await request(app).post('/webhooks/email/sns').send(email);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const user = await userRepository.findByPhoneNumber(testPhoneNumber);
      const threads = await emailThreadRepository.findByUserId(user!.id);
      
      expect(threads.length).toBeGreaterThan(0);
      expect(threads[0].subject).toBe('New Thread');
      expect(threads[0].messageCount).toBeGreaterThan(0);
    });

    it('should store email message in database', async () => {
      const testPhoneNumber = '+1555000666';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      
      const email = {
        Type: 'Notification',
        MessageId: 'store-msg',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: 'store@example.com',
            destination: [userEmail],
            commonHeaders: {
              from: ['Store Sender <store@example.com>'],
              subject: 'Storage Test',
              date: new Date().toISOString()
            }
          },
          content: 'Testing message storage'
        })
      };

      await request(app).post('/webhooks/email/sns').send(email);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const user = await userRepository.findByPhoneNumber(testPhoneNumber);
      const threads = await emailThreadRepository.findByUserId(user!.id);
      
      expect(threads.length).toBeGreaterThan(0);
      
      const messages = await emailMessageRepository.findByThreadId(threads[0].threadId);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].fromAddress).toBe('store@example.com');
      expect(messages[0].subject).toBe('Storage Test');
      expect(messages[0].direction).toBe('inbound');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed SNS notification gracefully', async () => {
      const malformedNotification = {
        Type: 'Notification',
        MessageId: 'malformed-msg',
        Message: 'not-valid-json'
      };

      const webhookResponse = await request(app)
        .post('/webhooks/email/sns')
        .send(malformedNotification);

      // Should still return 200 to prevent SNS retries
      expect(webhookResponse.status).toBe(200);
    });

    it('should handle missing email fields gracefully', async () => {
      const incompleteEmail = {
        Type: 'Notification',
        MessageId: 'incomplete-msg',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            // Missing source and destination
            commonHeaders: {
              subject: 'Incomplete Email'
            }
          },
          content: 'Missing fields'
        })
      };

      const webhookResponse = await request(app)
        .post('/webhooks/email/sns')
        .send(incompleteEmail);

      expect(webhookResponse.status).toBe(200);
    });
  });
});
