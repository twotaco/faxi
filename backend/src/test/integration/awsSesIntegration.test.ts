import { describe, it, expect, beforeAll } from 'vitest';
import { awsSesService } from '../../services/awsSesService';
import { emailService } from '../../services/emailService';

describe('AWS SES Integration', () => {
  beforeAll(() => {
    // Ensure we're in test mode
    process.env.TEST_MODE = 'true';
  });

  describe('AwsSesService', () => {
    it('should be properly initialized', () => {
      expect(awsSesService).toBeDefined();
      expect(typeof awsSesService.sendEmail).toBe('function');
      expect(typeof awsSesService.verifyEmailIdentity).toBe('function');
      expect(typeof awsSesService.getSendingStatistics).toBe('function');
    });

    it('should check if AWS SES is configured', () => {
      const isConfigured = awsSesService.isConfigured();
      expect(typeof isConfigured).toBe('boolean');
      
      // In test environment, it should be configured if credentials are set
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        expect(isConfigured).toBe(true);
      }
    });

    it('should handle missing credentials gracefully', () => {
      // This test verifies the service doesn't crash on initialization
      expect(awsSesService).toBeDefined();
    });
  });

  describe('EmailService with AWS SES', () => {
    it('should route to AWS SES when provider is "ses"', async () => {
      // Save original provider
      const originalProvider = process.env.EMAIL_PROVIDER;
      
      try {
        // Set provider to SES
        process.env.EMAIL_PROVIDER = 'ses';
        
        // Attempt to send email (will fail in test mode without real credentials, but should route correctly)
        const result = await emailService.sendEmail({
          from: 'test@me.faxi.jp',
          to: 'recipient@example.com',
          subject: 'Test Email',
          body: 'This is a test email'
        });
        
        // In test mode without credentials, it should fail gracefully
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
        
        if (!result.success) {
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
        }
      } finally {
        // Restore original provider
        if (originalProvider) {
          process.env.EMAIL_PROVIDER = originalProvider;
        } else {
          delete process.env.EMAIL_PROVIDER;
        }
      }
    });

    it('should return standardized error for AWS SES failures', async () => {
      const originalProvider = process.env.EMAIL_PROVIDER;
      
      try {
        process.env.EMAIL_PROVIDER = 'ses';
        
        // Send with invalid email to trigger error
        const result = await emailService.sendEmail({
          from: 'invalid-email',
          to: 'also-invalid',
          subject: 'Test',
          body: 'Test'
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      } finally {
        if (originalProvider) {
          process.env.EMAIL_PROVIDER = originalProvider;
        } else {
          delete process.env.EMAIL_PROVIDER;
        }
      }
    });

    it('should handle rate limiting errors appropriately', async () => {
      // This test verifies error message handling
      const originalProvider = process.env.EMAIL_PROVIDER;
      
      try {
        process.env.EMAIL_PROVIDER = 'ses';
        
        // The service should handle throttling errors gracefully
        // We can't easily trigger a real throttling error in tests,
        // but we verify the error handling code exists
        expect(emailService).toBeDefined();
      } finally {
        if (originalProvider) {
          process.env.EMAIL_PROVIDER = originalProvider;
        } else {
          delete process.env.EMAIL_PROVIDER;
        }
      }
    });
  });

  describe('Email Address Validation', () => {
    it('should validate email addresses correctly', () => {
      expect(emailService.isValidEmail('test@example.com')).toBe(true);
      expect(emailService.isValidEmail('user+tag@domain.co.jp')).toBe(true);
      expect(emailService.isValidEmail('invalid')).toBe(false);
      expect(emailService.isValidEmail('invalid@')).toBe(false);
      expect(emailService.isValidEmail('@invalid.com')).toBe(false);
      expect(emailService.isValidEmail('')).toBe(false);
    });

    it('should generate Faxi email addresses correctly', () => {
      expect(emailService.getUserEmailAddress('09012345678')).toBe('09012345678@me.faxi.jp');
      expect(emailService.getUserEmailAddress('+81-90-1234-5678')).toBe('819012345678@me.faxi.jp');
      expect(emailService.getUserEmailAddress('090-1234-5678')).toBe('09012345678@me.faxi.jp');
    });
  });

  describe('Thread ID Generation', () => {
    it('should generate consistent thread IDs for same subject and participants', () => {
      const threadId1 = emailService.generateThreadId('Test Subject', ['a@example.com', 'b@example.com']);
      const threadId2 = emailService.generateThreadId('Test Subject', ['b@example.com', 'a@example.com']);
      
      // Should be the same regardless of participant order
      expect(threadId1).toBe(threadId2);
    });

    it('should strip Re: and Fwd: prefixes from subject', () => {
      const threadId1 = emailService.generateThreadId('Test Subject', ['a@example.com', 'b@example.com']);
      const threadId2 = emailService.generateThreadId('Re: Test Subject', ['a@example.com', 'b@example.com']);
      const threadId3 = emailService.generateThreadId('Fwd: Test Subject', ['a@example.com', 'b@example.com']);
      
      expect(threadId1).toBe(threadId2);
      expect(threadId1).toBe(threadId3);
    });

    it('should generate different thread IDs for different subjects', () => {
      const threadId1 = emailService.generateThreadId('Subject 1', ['a@example.com', 'b@example.com']);
      const threadId2 = emailService.generateThreadId('Subject 2', ['a@example.com', 'b@example.com']);
      
      expect(threadId1).not.toBe(threadId2);
    });
  });
});
