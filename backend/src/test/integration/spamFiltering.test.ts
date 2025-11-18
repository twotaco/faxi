import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { userRepository } from '../../repositories/userRepository';
import { addressBookRepository } from '../../repositories/addressBookRepository';

let app: Express;

describe('Spam Filtering Integration Tests', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Initialize test app
    const { createTestApp } = await import('../testApp');
    app = await createTestApp();

    // Create test user with spam filtering preferences
    const user = await userRepository.create({
      phoneNumber: '+1234567890',
      emailAddress: '1234567890@me.faxi.jp',
      isActive: true,
      preferences: {
        spamFilterLevel: 'medium',
        enableSmartReplies: true,
        allowPromotionalEmails: false,
        allowNewsletters: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    // Clean up test data
    await request(app).delete('/test/fax/clear');
  });

  describe('Promotional Email Filtering', () => {
    it('should filter out promotional emails', async () => {
      const promotionalEmails = [
        {
          to: '1234567890@me.faxi.jp',
          from: 'sales@bigstore.com',
          subject: '🎉 HUGE SALE! 70% OFF EVERYTHING!',
          body: 'Limited time offer! Click here to save big on all items. Sale ends soon!',
          headers: {
            'message-id': '<promo1@bigstore.com>',
            'date': new Date().toISOString(),
          },
        },
        {
          to: '1234567890@me.faxi.jp',
          from: 'deals@shopping.com',
          subject: 'Flash Sale - 24 Hours Only!',
          body: 'Don\'t miss out on these incredible deals. Shop now and save up to 80%!',
          headers: {
            'message-id': '<flash@shopping.com>',
            'date': new Date().toISOString(),
          },
        },
        {
          to: '1234567890@me.faxi.jp',
          from: 'noreply@promotions.net',
          subject: 'Exclusive Offer Just for You!',
          body: 'You\'ve been selected for this special promotion. Act now!',
          headers: {
            'message-id': '<exclusive@promotions.net>',
            'date': new Date().toISOString(),
          },
        },
      ];

      // Send promotional emails
      for (const email of promotionalEmails) {
        const response = await request(app)
          .post('/webhooks/email/received')
          .send(email);

        expect(response.status).toBe(200);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check that no faxes were generated for promotional emails
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      expect(faxListResponse.status).toBe(200);
      
      const faxJobs = faxListResponse.body.test_faxes;
      const promotionalFaxes = faxJobs.filter((fax: any) => 
        promotionalEmails.some(email => email.from === fax.details?.from)
      );
      
      expect(promotionalFaxes).toHaveLength(0);
    });

    it('should filter out newsletter emails', async () => {
      const newsletterEmails = [
        {
          to: '1234567890@me.faxi.jp',
          from: 'newsletter@techblog.com',
          subject: 'Weekly Tech Newsletter - Issue #42',
          body: 'Here are this week\'s top tech stories and updates.',
          headers: {
            'message-id': '<newsletter42@techblog.com>',
            'date': new Date().toISOString(),
            'list-unsubscribe': '<mailto:unsubscribe@techblog.com>',
          },
        },
        {
          to: '1234567890@me.faxi.jp',
          from: 'updates@company.com',
          subject: 'Monthly Company Update',
          body: 'Our monthly newsletter with company news and updates.',
          headers: {
            'message-id': '<monthly@company.com>',
            'date': new Date().toISOString(),
            'list-id': '<company-updates.company.com>',
          },
        },
      ];

      // Send newsletter emails
      for (const email of newsletterEmails) {
        const response = await request(app)
          .post('/webhooks/email/received')
          .send(email);

        expect(response.status).toBe(200);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check that no faxes were generated for newsletters
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const newsletterFaxes = faxJobs.filter((fax: any) => 
        newsletterEmails.some(email => email.from === fax.details?.from)
      );
      
      expect(newsletterFaxes).toHaveLength(0);
    });

    it('should filter out automated notifications', async () => {
      const automatedEmails = [
        {
          to: '1234567890@me.faxi.jp',
          from: 'noreply@service.com',
          subject: 'Password Reset Confirmation',
          body: 'Your password has been successfully reset. If you did not request this, please contact support.',
          headers: {
            'message-id': '<reset@service.com>',
            'date': new Date().toISOString(),
            'auto-submitted': 'auto-generated',
          },
        },
        {
          to: '1234567890@me.faxi.jp',
          from: 'notifications@platform.com',
          subject: 'Account Activity Alert',
          body: 'We detected a new login to your account from a new device.',
          headers: {
            'message-id': '<activity@platform.com>',
            'date': new Date().toISOString(),
            'precedence': 'bulk',
          },
        },
      ];

      // Send automated emails
      for (const email of automatedEmails) {
        const response = await request(app)
          .post('/webhooks/email/received')
          .send(email);

        expect(response.status).toBe(200);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check that no faxes were generated for automated emails
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const automatedFaxes = faxJobs.filter((fax: any) => 
        automatedEmails.some(email => email.from === fax.details?.from)
      );
      
      expect(automatedFaxes).toHaveLength(0);
    });
  });

  describe('Personal Email Allowlist', () => {
    it('should allow personal emails through spam filter', async () => {
      const personalEmails = [
        {
          to: '1234567890@me.faxi.jp',
          from: 'friend@gmail.com',
          subject: 'How are you doing?',
          body: 'Hi! Just wanted to check in and see how you\'ve been. Hope all is well!',
          headers: {
            'message-id': '<personal1@gmail.com>',
            'date': new Date().toISOString(),
          },
        },
        {
          to: '1234567890@me.faxi.jp',
          from: 'family@yahoo.com',
          subject: 'Family Dinner This Sunday',
          body: 'Don\'t forget about family dinner this Sunday at 6pm. Looking forward to seeing you!',
          headers: {
            'message-id': '<family@yahoo.com>',
            'date': new Date().toISOString(),
          },
        },
      ];

      // Send personal emails
      for (const email of personalEmails) {
        const response = await request(app)
          .post('/webhooks/email/received')
          .send(email);

        expect(response.status).toBe(200);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check that faxes were generated for personal emails
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const personalFaxes = faxJobs.filter((fax: any) => 
        personalEmails.some(email => email.from === fax.details?.from)
      );
      
      expect(personalFaxes.length).toBeGreaterThan(0);
    });

    it('should allow emails from address book contacts', async () => {
      // Add contact to address book
      await addressBookRepository.create({
        userId: testUserId,
        name: 'John Doe',
        emailAddress: 'john.doe@example.com',
        relationship: 'friend',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const contactEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'john.doe@example.com',
        subject: 'Message from Address Book Contact',
        body: 'This email is from someone in your address book.',
        headers: {
          'message-id': '<john@example.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send email from address book contact
      const response = await request(app)
        .post('/webhooks/email/received')
        .send(contactEmail);

      expect(response.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Should have created fax for address book contact
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const contactFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'john.doe@example.com'
      );
      
      expect(contactFax).toBeDefined();
    });

    it('should allow important transactional emails', async () => {
      const transactionalEmails = [
        {
          to: '1234567890@me.faxi.jp',
          from: 'orders@amazon.com',
          subject: 'Your Order Has Shipped',
          body: 'Your order #123456789 has shipped and is on its way. Tracking number: 1Z999AA1234567890',
          headers: {
            'message-id': '<order@amazon.com>',
            'date': new Date().toISOString(),
          },
        },
        {
          to: '1234567890@me.faxi.jp',
          from: 'billing@utilities.com',
          subject: 'Your Monthly Bill is Ready',
          body: 'Your monthly utility bill for $125.50 is now available. Due date: March 15, 2024.',
          headers: {
            'message-id': '<bill@utilities.com>',
            'date': new Date().toISOString(),
          },
        },
      ];

      // Send transactional emails
      for (const email of transactionalEmails) {
        const response = await request(app)
          .post('/webhooks/email/received')
          .send(email);

        expect(response.status).toBe(200);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Should have created faxes for important transactional emails
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const transactionalFaxes = faxJobs.filter((fax: any) => 
        transactionalEmails.some(email => email.from === fax.details?.from)
      );
      
      expect(transactionalFaxes.length).toBeGreaterThan(0);
    });
  });

  describe('Spam Filter Sensitivity Levels', () => {
    it('should respect user spam filter sensitivity settings', async () => {
      // Update user preferences to strict filtering
      const user = await userRepository.findByPhoneNumber('+1234567890');
      expect(user).toBeDefined();

      await userRepository.update(user!.id, {
        preferences: {
          ...user!.preferences,
          spamFilterLevel: 'strict',
        },
      });

      const borderlineEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'info@company.com',
        subject: 'Important Update About Your Account',
        body: 'We have some important information about your account that requires your attention.',
        headers: {
          'message-id': '<info@company.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send borderline email
      const response = await request(app)
        .post('/webhooks/email/received')
        .send(borderlineEmail);

      expect(response.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // With strict filtering, borderline emails should be filtered
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const borderlineFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'info@company.com'
      );
      
      // Should be filtered out with strict settings
      expect(borderlineFax).toBeUndefined();
    });

    it('should allow more emails with lenient filtering', async () => {
      // Update user preferences to lenient filtering
      const user = await userRepository.findByPhoneNumber('+1234567890');
      expect(user).toBeDefined();

      await userRepository.update(user!.id, {
        preferences: {
          ...user!.preferences,
          spamFilterLevel: 'lenient',
          allowPromotionalEmails: true,
        },
      });

      const promotionalEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'offers@store.com',
        subject: 'Special Offer for You',
        body: 'We have a special offer that might interest you. Check it out!',
        headers: {
          'message-id': '<offer@store.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send promotional email
      const response = await request(app)
        .post('/webhooks/email/received')
        .send(promotionalEmail);

      expect(response.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // With lenient filtering and promotional emails allowed, should pass through
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const promotionalFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'offers@store.com'
      );
      
      expect(promotionalFax).toBeDefined();
    });
  });

  describe('Spam Detection Accuracy', () => {
    it('should correctly identify spam characteristics', async () => {
      const spamEmails = [
        {
          to: '1234567890@me.faxi.jp',
          from: 'winner@lottery.scam',
          subject: 'CONGRATULATIONS! YOU WON $1,000,000!!!',
          body: 'You have won the international lottery! Send us your bank details to claim your prize!',
          headers: {
            'message-id': '<scam@lottery.scam>',
            'date': new Date().toISOString(),
          },
        },
        {
          to: '1234567890@me.faxi.jp',
          from: 'urgent@phishing.com',
          subject: 'URGENT: Verify Your Account Now!',
          body: 'Your account will be suspended unless you click this link and verify your information immediately!',
          headers: {
            'message-id': '<phish@phishing.com>',
            'date': new Date().toISOString(),
          },
        },
      ];

      // Send obvious spam emails
      for (const email of spamEmails) {
        const response = await request(app)
          .post('/webhooks/email/received')
          .send(email);

        expect(response.status).toBe(200);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Should have filtered all obvious spam
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const spamFaxes = faxJobs.filter((fax: any) => 
        spamEmails.some(email => email.from === fax.details?.from)
      );
      
      expect(spamFaxes).toHaveLength(0);
    });

    it('should not filter legitimate emails as spam', async () => {
      const legitimateEmails = [
        {
          to: '1234567890@me.faxi.jp',
          from: 'doctor@clinic.com',
          subject: 'Appointment Reminder',
          body: 'This is a reminder of your appointment tomorrow at 2:00 PM. Please arrive 15 minutes early.',
          headers: {
            'message-id': '<reminder@clinic.com>',
            'date': new Date().toISOString(),
          },
        },
        {
          to: '1234567890@me.faxi.jp',
          from: 'teacher@school.edu',
          subject: 'Parent-Teacher Conference',
          body: 'I would like to schedule a parent-teacher conference to discuss your child\'s progress.',
          headers: {
            'message-id': '<conference@school.edu>',
            'date': new Date().toISOString(),
          },
        },
      ];

      // Send legitimate emails
      for (const email of legitimateEmails) {
        const response = await request(app)
          .post('/webhooks/email/received')
          .send(email);

        expect(response.status).toBe(200);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Should have allowed legitimate emails through
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const legitimateFaxes = faxJobs.filter((fax: any) => 
        legitimateEmails.some(email => email.from === fax.details?.from)
      );
      
      expect(legitimateFaxes.length).toBe(legitimateEmails.length);
    });
  });
});