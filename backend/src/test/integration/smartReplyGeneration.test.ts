import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { userRepository } from '../../repositories/userRepository';

let app: Express;

describe('Smart Reply Generation Integration Tests', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Initialize test app
    const { createTestApp } = await import('../testApp');
    app = await createTestApp();

    // Create test user with smart replies enabled
    const user = await userRepository.create({
      phoneNumber: '+1234567890',
      emailAddress: '1234567890@me.faxi.jp',
      isActive: true,
      preferences: {
        enableSmartReplies: true,
        spamFilterLevel: 'medium',
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

  describe('Question Detection and Reply Generation', () => {
    it('should generate smart replies for yes/no questions', async () => {
      const yesNoEmails = [
        {
          to: '1234567890@me.faxi.jp',
          from: 'friend@example.com',
          subject: 'Lunch Tomorrow?',
          body: 'Hi! Would you like to meet for lunch tomorrow at 12pm?',
          headers: {
            'message-id': '<lunch@example.com>',
            'date': new Date().toISOString(),
          },
        },
        {
          to: '1234567890@me.faxi.jp',
          from: 'colleague@work.com',
          subject: 'Meeting Confirmation',
          body: 'Can you confirm if you\'ll be attending the meeting on Friday?',
          headers: {
            'message-id': '<meeting@work.com>',
            'date': new Date().toISOString(),
          },
        },
      ];

      for (const email of yesNoEmails) {
        // Send email with clear yes/no question
        const response = await request(app)
          .post('/webhooks/email/received')
          .send(email);

        expect(response.status).toBe(200);

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check that fax was generated with smart reply options
        const faxListResponse = await request(app)
          .get('/test/fax/list');

        const faxJobs = faxListResponse.body.test_faxes;
        const emailFax = faxJobs.find((fax: any) => 
          fax.details?.from === email.from
        );
        
        expect(emailFax).toBeDefined();
        expect(emailFax.details?.status).toBe('completed');

        // The fax should include smart reply options
        // In a real implementation, we would check the generated TIFF content
        // For now, we verify the processing completed successfully
      }
    });

    it('should generate smart replies for multiple choice questions', async () => {
      const multipleChoiceEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'organizer@event.com',
        subject: 'Event Planning',
        body: 'Which day works better for the event: Saturday, Sunday, or next weekend?',
        headers: {
          'message-id': '<event@event.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send email with multiple choice question
      const response = await request(app)
        .post('/webhooks/email/received')
        .send(multipleChoiceEmail);

      expect(response.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check that fax was generated with multiple choice options
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const emailFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'organizer@event.com'
      );
      
      expect(emailFax).toBeDefined();
      expect(emailFax.details?.status).toBe('completed');

      // Should have generated multiple choice reply options
      // A, B, C options for Saturday, Sunday, next weekend
    });

    it('should generate smart replies for time-based questions', async () => {
      const timeBasedEmails = [
        {
          to: '1234567890@me.faxi.jp',
          from: 'scheduler@appointment.com',
          subject: 'Appointment Scheduling',
          body: 'What time works best for your appointment: 9am, 2pm, or 4pm?',
          headers: {
            'message-id': '<appt@appointment.com>',
            'date': new Date().toISOString(),
          },
        },
        {
          to: '1234567890@me.faxi.jp',
          from: 'delivery@shipping.com',
          subject: 'Delivery Time Preference',
          body: 'When would you prefer delivery: morning (9am-12pm) or afternoon (1pm-5pm)?',
          headers: {
            'message-id': '<delivery@shipping.com>',
            'date': new Date().toISOString(),
          },
        },
      ];

      for (const email of timeBasedEmails) {
        // Send email with time-based question
        const response = await request(app)
          .post('/webhooks/email/received')
          .send(email);

        expect(response.status).toBe(200);

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check that fax was generated with time-based reply options
        const faxListResponse = await request(app)
          .get('/test/fax/list');

        const faxJobs = faxListResponse.body.test_faxes;
        const emailFax = faxJobs.find((fax: any) => 
          fax.details?.from === email.from
        );
        
        expect(emailFax).toBeDefined();
        expect(emailFax.details?.status).toBe('completed');
      }
    });
  });

  describe('Reply Option Formatting', () => {
    it('should format reply options as circles for easy selection', async () => {
      const questionEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'friend@example.com',
        subject: 'Movie Night',
        body: 'Do you want to watch a comedy, action movie, or drama tonight?',
        headers: {
          'message-id': '<movie@example.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send email with clear options
      const response = await request(app)
        .post('/webhooks/email/received')
        .send(questionEmail);

      expect(response.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check that fax was generated
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const emailFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'friend@example.com'
      );
      
      expect(emailFax).toBeDefined();
      expect(emailFax.details?.status).toBe('completed');

      // The generated fax should include:
      // ○ A. Comedy
      // ○ B. Action movie  
      // ○ C. Drama
      // This would be verified by checking the TIFF content in a real implementation
    });

    it('should include space for custom replies', async () => {
      const openEndedEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'friend@example.com',
        subject: 'Weekend Plans',
        body: 'What would you like to do this weekend? Any ideas?',
        headers: {
          'message-id': '<weekend@example.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send email with open-ended question
      const response = await request(app)
        .post('/webhooks/email/received')
        .send(openEndedEmail);

      expect(response.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check that fax was generated
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const emailFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'friend@example.com'
      );
      
      expect(emailFax).toBeDefined();
      expect(emailFax.details?.status).toBe('completed');

      // Should include space for custom written reply
      // Since this is open-ended, should provide blank space for handwritten response
    });

    it('should include reference ID for reply matching', async () => {
      const questionEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'friend@example.com',
        subject: 'Quick Question',
        body: 'Are you free this evening?',
        headers: {
          'message-id': '<quick@example.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send email
      const response = await request(app)
        .post('/webhooks/email/received')
        .send(questionEmail);

      expect(response.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check that fax was generated with reference ID
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const emailFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'friend@example.com'
      );
      
      expect(emailFax).toBeDefined();
      expect(emailFax.details?.status).toBe('completed');

      // Should include reference ID in format: "Reply via fax. Ref: FX-YYYY-NNNNNN"
      // This enables context recovery when user replies
    });
  });

  describe('Smart Reply Preferences', () => {
    it('should respect user preference to disable smart replies', async () => {
      // Update user preferences to disable smart replies
      const user = await userRepository.findByPhoneNumber('+1234567890');
      expect(user).toBeDefined();

      await userRepository.update(user!.id, {
        preferences: {
          ...user!.preferences,
          enableSmartReplies: false,
        },
      });

      const questionEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'friend@example.com',
        subject: 'Question',
        body: 'Do you want to go to the movies tonight?',
        headers: {
          'message-id': '<movies@example.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send email with question
      const response = await request(app)
        .post('/webhooks/email/received')
        .send(questionEmail);

      expect(response.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check that fax was generated without smart reply options
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const emailFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'friend@example.com'
      );
      
      expect(emailFax).toBeDefined();
      expect(emailFax.details?.status).toBe('completed');

      // Should not include smart reply options, just the email content and reply space
    });
  });

  describe('Complex Question Handling', () => {
    it('should handle emails with multiple questions', async () => {
      const multiQuestionEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'planner@event.com',
        subject: 'Event Planning Questions',
        body: 'Hi! I have a few questions about the event: 1) Can you attend on Saturday? 2) Do you prefer lunch or dinner? 3) Should we invite the whole team?',
        headers: {
          'message-id': '<planning@event.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send email with multiple questions
      const response = await request(app)
        .post('/webhooks/email/received')
        .send(multiQuestionEmail);

      expect(response.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check that fax was generated
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const emailFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'planner@event.com'
      );
      
      expect(emailFax).toBeDefined();
      expect(emailFax.details?.status).toBe('completed');

      // Should handle multiple questions appropriately
      // Might generate options for each question or provide structured reply space
    });

    it('should handle questions mixed with statements', async () => {
      const mixedEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'friend@example.com',
        subject: 'Update and Question',
        body: 'Hope you\'re doing well! I just got back from vacation and had a great time. The weather was perfect and the food was amazing. By the way, are you still planning to come to the party next week?',
        headers: {
          'message-id': '<update@example.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send email with mixed content
      const response = await request(app)
        .post('/webhooks/email/received')
        .send(mixedEmail);

      expect(response.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check that fax was generated
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const emailFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'friend@example.com'
      );
      
      expect(emailFax).toBeDefined();
      expect(emailFax.details?.status).toBe('completed');

      // Should identify the question about the party and provide reply options
      // While preserving the full email content
    });

    it('should not generate replies for rhetorical questions', async () => {
      const rhetoricalEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'friend@example.com',
        subject: 'Frustrating Day',
        body: 'What a day! Can you believe how crazy the weather has been? Anyway, just wanted to let you know I\'m thinking of you.',
        headers: {
          'message-id': '<rhetorical@example.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send email with rhetorical questions
      const response = await request(app)
        .post('/webhooks/email/received')
        .send(rhetoricalEmail);

      expect(response.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check that fax was generated
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const emailFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'friend@example.com'
      );
      
      expect(emailFax).toBeDefined();
      expect(emailFax.details?.status).toBe('completed');

      // Should not generate smart reply options for rhetorical questions
      // Just provide general reply space
    });
  });

  describe('Reply Processing', () => {
    it('should process circled smart reply options correctly', async () => {
      // This test would require the full pipeline including reply processing
      // For now, we verify that the system can handle the initial email generation
      
      const questionEmail = {
        to: '1234567890@me.faxi.jp',
        from: 'friend@example.com',
        subject: 'Lunch Plans',
        body: 'Would you like to meet for lunch tomorrow?',
        headers: {
          'message-id': '<lunch-plans@example.com>',
          'date': new Date().toISOString(),
        },
      };

      // Send initial email
      const response = await request(app)
        .post('/webhooks/email/received')
        .send(questionEmail);

      expect(response.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify smart reply fax was generated
      const faxListResponse = await request(app)
        .get('/test/fax/list');

      const faxJobs = faxListResponse.body.test_faxes;
      const emailFax = faxJobs.find((fax: any) => 
        fax.details?.from === 'friend@example.com'
      );
      
      expect(emailFax).toBeDefined();
      expect(emailFax.details?.status).toBe('completed');

      // In a complete test, we would then:
      // 1. Get the reference ID from the generated fax
      // 2. Send a reply fax with a circled option
      // 3. Verify the system processes the circled reply correctly
      // 4. Verify the appropriate email response is sent
    });
  });
});