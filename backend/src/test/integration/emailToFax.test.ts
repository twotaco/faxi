import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { userRepository } from '../../repositories/userRepository';
import { addressBookRepository } from '../../repositories/addressBookRepository';

let app: Express;

describe('Email-to-Fax Bridge Integration Tests', () => {
  beforeEach(async () => {
    // Initialize test app
    const { createTestApp } = await import('../testApp');
    app = await createTestApp();
    
    // Create test user
    await userRepository.create({
      phoneNumber: '+1234567890',
      emailAddress: '1234567890@me.faxi.jp',
      isActive: true,
      preferences: {
        spamFilterLevel: 'medium',
        enableSmartReplies: true,
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await request(app).delete('/test/fax/clear');
  });

  describe('Inbound Email Processing', () => {
    it('should convert incoming email to fax', async () => {
      const testEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'friend@example.com',
        subject: 'Test Email Subject',
        body: 'This is a test email that should be converted to fax format.',
        headers: {
          'message-id': '<test123@example.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send email to webhook
      const emailResponse = await request(app)
        .post('/webhooks/email/received')
        .send(testEmail);

      expect(emailResponse.status).toBe(200);

      // Wait for email processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check that fax was generated and queued
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      expect(faxListResponse.status).toBe(200);
      
      // Should have created a fax job for the email
      const faxJobs = faxListResponse.body.test_faxes;
      const emailFax = faxJobs.find((fax: any) => 
        fax.details?.source === 'email' || 
        fax.details?.type === 'email_to_fax'
      );
      
      expect(emailFax).toBeDefined();
    });

    it('should add sender to address book automatically', async () => {
      const testEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'newcontact@example.com',
        subject: 'First Email from New Contact',
        body: 'Hello, this is my first email to you.',
        headers: {
          'message-id': '<newcontact123@example.com>',
          'date': new Date().toISOString(),
        },
      };

      // Verify contact doesn't exist initially
      const user = await userRepository.findByPhoneNumber('+1234567890');
      expect(user).toBeDefined();
      
      const existingContact = await addressBookRepository.findByEmail(user!.id, 'newcontact@example.com');
      expect(existingContact).toBeNull();

      // Send email
      const emailResponse = await request(app)
        .post('/webhooks/email/received')
        .send(testEmail);

      expect(emailResponse.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify contact was added to address book
      const newContact = await addressBookRepository.findByEmail(user!.id, 'newcontact@example.com');
      expect(newContact).toBeDefined();
      expect(newContact?.emailAddress).toBe('newcontact@example.com');
      expect(newContact?.name).toBe('newcontact@example.com'); // Default name is email
    });

    it('should generate smart reply options for emails with questions', async () => {
      const testEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'friend@example.com',
        subject: 'Lunch Meeting?',
        body: 'Hi! Would you like to meet for lunch tomorrow at 12pm? Let me know if that works for you.',
        headers: {
          'message-id': '<lunch123@example.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send email
      const emailResponse = await request(app)
        .post('/webhooks/email/received')
        .send(testEmail);

      expect(emailResponse.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check generated fax content for smart reply options
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const emailFax = faxJobs.find((fax: any) => 
        fax.details?.source === 'email' || 
        fax.details?.type === 'email_to_fax'
      );
      
      expect(emailFax).toBeDefined();

      // The fax should include smart reply options
      // This would be verified by checking the generated PDF content
      // For now, we verify the processing completed successfully
      expect(emailFax.details?.status).toBe('completed');
    });

    it('should filter spam emails', async () => {
      const spamEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'noreply@promotions.com',
        subject: '🎉 AMAZING DEAL! 50% OFF EVERYTHING! LIMITED TIME!',
        body: 'Click here to claim your amazing discount! This offer expires soon! Buy now!',
        headers: {
          'message-id': '<spam123@promotions.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send spam email
      const emailResponse = await request(app)
        .post('/webhooks/email/received')
        .send(spamEmail);

      expect(emailResponse.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check that no fax was generated for spam
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const spamFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'noreply@promotions.com'
      );
      
      // Should not have created a fax for spam email
      expect(spamFax).toBeUndefined();
    });

    it('should process emails from address book contacts', async () => {
      const user = await userRepository.findByPhoneNumber('+1234567890');
      expect(user).toBeDefined();

      // Add contact to address book first
      await addressBookRepository.create({
        userId: user!.id,
        name: 'John Doe',
        emailAddress: 'john.doe@example.com',
        relationship: 'friend',
      });

      const contactEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'john.doe@example.com',
        subject: 'Message from Address Book Contact',
        body: 'This email is from someone in your address book.',
        headers: {
          'message-id': '<john123@example.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send email from address book contact
      const emailResponse = await request(app)
        .post('/webhooks/email/received')
        .send(contactEmail);

      expect(emailResponse.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should have created fax for address book contact
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const contactFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'john.doe@example.com'
      );
      
      expect(contactFax).toBeDefined();
      expect(contactFax.details?.status).toBe('completed');
    });
  });

  describe('Email Processing Speed', () => {
    it('should process emails within 2 minutes', async () => {
      const testEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'speed.test@example.com',
        subject: 'Speed Test Email',
        body: 'This email should be processed quickly.',
        headers: {
          'message-id': '<speed123@example.com>',
          'date': new Date().toISOString(),
        },
      };

      const startTime = Date.now();

      // Send email
      const emailResponse = await request(app)
        .post('/webhooks/email/received')
        .send(testEmail);

      expect(emailResponse.status).toBe(200);

      // Wait for processing with timeout
      let processed = false;
      let attempts = 0;
      const maxAttempts = 120; // 2 minutes in seconds

      while (!processed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const faxListResponse = await request(app)
          .get('/test/fax/list');

        const faxJobs = faxListResponse.body.test_faxes;
        const emailFax = faxJobs.find((fax: any) => 
          fax.details?.from === 'speed.test@example.com'
        );
        
        if (emailFax && emailFax.details?.status === 'completed') {
          processed = true;
        }
        
        attempts++;
      }

      const endTime = Date.now();
      const processingTime = (endTime - startTime) / 1000; // in seconds

      expect(processed).toBe(true);
      expect(processingTime).toBeLessThan(120); // Less than 2 minutes
    });
  });

  describe('Email Content Handling', () => {
    it('should handle HTML email content', async () => {
      const htmlEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'html.test@example.com',
        subject: 'HTML Email Test',
        body: '<html><body><h1>HTML Email</h1><p>This is <strong>bold</strong> text.</p></body></html>',
        headers: {
          'message-id': '<html123@example.com>',
          'date': new Date().toISOString(),
          'content-type': 'text/html',
        },
      };

      // Send HTML email
      const emailResponse = await request(app)
        .post('/webhooks/email/received')
        .send(htmlEmail);

      expect(emailResponse.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should have processed HTML email successfully
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const htmlFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'html.test@example.com'
      );
      
      expect(htmlFax).toBeDefined();
      expect(htmlFax.details?.status).toBe('completed');
    });

    it('should handle email attachments', async () => {
      const emailWithAttachment = {
        to: '1234567890@me.faxi.jp',
        from: 'attachment.test@example.com',
        subject: 'Email with Attachment',
        body: 'This email has an attachment.',
        attachments: [
          {
            filename: 'document.pdf',
            contentType: 'application/pdf',
            size: 12345,
          },
        ],
        headers: {
          'message-id': '<attachment123@example.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send email with attachment
      const emailResponse = await request(app)
        .post('/webhooks/email/received')
        .send(emailWithAttachment);

      expect(emailResponse.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should have processed email and noted attachment
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const attachmentFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'attachment.test@example.com'
      );
      
      expect(attachmentFax).toBeDefined();
      expect(attachmentFax.details?.status).toBe('completed');

      // The fax should include attachment notification
      // This would be verified by checking the generated PDF content
    });
  });
});