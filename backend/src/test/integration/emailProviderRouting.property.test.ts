/**
 * Property-based tests for email provider routing
 * Feature: email-system-architecture, Property 15: Email provider routing
 * 
 * Tests that the EmailService correctly routes email send requests to the 
 * configured provider (AWS SES, SendGrid, or Postfix) and returns standardized results.
 * 
 * Validates: Requirements 6.2, 6.3, 6.4, 6.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { EmailService, EmailMessage } from '../../services/emailService';
import { config } from '../../config';
import { awsSesService } from '../../services/awsSesService';
import axios from 'axios';

describe('**Feature: email-system-architecture, Property 15: Email provider routing**', () => {
  let originalProvider: string;
  let emailService: EmailService;

  beforeEach(() => {
    // Store original provider
    originalProvider = config.email.provider;
    // Create fresh instance for each test
    emailService = new EmailService();
  });

  afterEach(() => {
    // Restore original provider
    (config.email as any).provider = originalProvider;
    // Clear all mocks
    vi.clearAllMocks();
  });

  /**
   * Property 15: Email provider routing
   * For any email send request, the Email Service should route to the configured 
   * provider (AWS SES, SendGrid, or Postfix)
   * Validates: Requirements 6.2, 6.3, 6.4, 6.5
   */
  it('should route to AWS SES when provider is configured as "ses"', async () => {
    // Mock AWS SES service
    const mockSendEmail = vi.spyOn(awsSesService, 'sendEmail').mockResolvedValue({
      messageId: 'ses-message-id-123'
    });
    
    const mockIsConfigured = vi.spyOn(awsSesService, 'isConfigured').mockReturnValue(true);

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          from: fc.emailAddress(),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 1000 })
        }),
        async (message: EmailMessage) => {
          // Configure provider as SES
          (config.email as any).provider = 'ses';

          // Send email
          const result = await emailService.sendEmail(message);

          // Verify AWS SES was called
          expect(mockSendEmail).toHaveBeenCalledWith({
            from: message.from,
            to: message.to,
            subject: message.subject,
            body: message.body
          });

          // Verify result is standardized
          expect(result).toHaveProperty('success');
          expect(result.success).toBe(true);
          expect(result).toHaveProperty('messageId');
          expect(result.messageId).toBe('ses-message-id-123');
        }
      ),
      { numRuns: 50 }
    );

    mockSendEmail.mockRestore();
    mockIsConfigured.mockRestore();
  });

  it('should route to SendGrid when provider is configured as "sendgrid"', async () => {
    // Mock axios for SendGrid API
    const mockPost = vi.spyOn(axios, 'post').mockResolvedValue({
      status: 202,
      headers: { 'x-message-id': 'sendgrid-message-id-456' }
    });

    // Mock SendGrid API key
    const originalApiKey = config.email.sendgridApiKey;
    (config.email as any).sendgridApiKey = 'test-sendgrid-api-key';

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          from: fc.emailAddress(),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 1000 })
        }),
        async (message: EmailMessage) => {
          // Configure provider as SendGrid
          (config.email as any).provider = 'sendgrid';

          // Send email
          const result = await emailService.sendEmail(message);

          // Verify SendGrid API was called
          expect(mockPost).toHaveBeenCalledWith(
            'https://api.sendgrid.com/v3/mail/send',
            expect.objectContaining({
              personalizations: expect.arrayContaining([
                expect.objectContaining({
                  to: expect.arrayContaining([{ email: message.to }]),
                  subject: message.subject
                })
              ]),
              from: { email: message.from },
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'text/plain',
                  value: message.body
                })
              ])
            }),
            expect.objectContaining({
              headers: expect.objectContaining({
                'Authorization': 'Bearer test-sendgrid-api-key',
                'Content-Type': 'application/json'
              })
            })
          );

          // Verify result is standardized
          expect(result).toHaveProperty('success');
          expect(result.success).toBe(true);
          expect(result).toHaveProperty('messageId');
        }
      ),
      { numRuns: 50 }
    );

    mockPost.mockRestore();
    (config.email as any).sendgridApiKey = originalApiKey;
  });

  it('should throw error for Postfix provider (not yet implemented)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          from: fc.emailAddress(),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 1000 })
        }),
        async (message: EmailMessage) => {
          // Configure provider as Postfix
          (config.email as any).provider = 'postfix';

          // Send email - should return error result
          const result = await emailService.sendEmail(message);

          // Verify error result is standardized
          expect(result).toHaveProperty('success');
          expect(result.success).toBe(false);
          expect(result).toHaveProperty('error');
          expect(result.error).toContain('Postfix');
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should throw error for unsupported provider', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          from: fc.emailAddress(),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 1000 })
        }),
        async (message: EmailMessage) => {
          // Configure unsupported provider
          (config.email as any).provider = 'unsupported-provider';

          // Send email - should return error result
          const result = await emailService.sendEmail(message);

          // Verify error result is standardized
          expect(result).toHaveProperty('success');
          expect(result.success).toBe(false);
          expect(result).toHaveProperty('error');
          expect(result.error).toContain('Unsupported email provider');
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should return standardized error when AWS SES is not configured', async () => {
    // Mock AWS SES as not configured
    const mockIsConfigured = vi.spyOn(awsSesService, 'isConfigured').mockReturnValue(false);

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          from: fc.emailAddress(),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 1000 })
        }),
        async (message: EmailMessage) => {
          // Configure provider as SES
          (config.email as any).provider = 'ses';

          // Send email
          const result = await emailService.sendEmail(message);

          // Verify error result is standardized
          expect(result).toHaveProperty('success');
          expect(result.success).toBe(false);
          expect(result).toHaveProperty('error');
          expect(result.error).toContain('AWS SES is not configured');
        }
      ),
      { numRuns: 30 }
    );

    mockIsConfigured.mockRestore();
  });

  it('should return standardized error when SendGrid API key is missing', async () => {
    // Remove SendGrid API key
    const originalApiKey = config.email.sendgridApiKey;
    (config.email as any).sendgridApiKey = undefined;

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          from: fc.emailAddress(),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 1000 })
        }),
        async (message: EmailMessage) => {
          // Configure provider as SendGrid
          (config.email as any).provider = 'sendgrid';

          // Send email
          const result = await emailService.sendEmail(message);

          // Verify error result is standardized
          expect(result).toHaveProperty('success');
          expect(result.success).toBe(false);
          expect(result).toHaveProperty('error');
          expect(result.error).toContain('SendGrid API key not configured');
        }
      ),
      { numRuns: 30 }
    );

    (config.email as any).sendgridApiKey = originalApiKey;
  });

  it('should handle AWS SES throttling errors with standardized error message', async () => {
    // Mock AWS SES to throw throttling error
    const mockSendEmail = vi.spyOn(awsSesService, 'sendEmail').mockRejectedValue(
      new Error('Throttling: Rate exceeded')
    );
    
    const mockIsConfigured = vi.spyOn(awsSesService, 'isConfigured').mockReturnValue(true);

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          from: fc.emailAddress(),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 1000 })
        }),
        async (message: EmailMessage) => {
          // Configure provider as SES
          (config.email as any).provider = 'ses';

          // Send email
          const result = await emailService.sendEmail(message);

          // Verify error result mentions rate limiting
          expect(result).toHaveProperty('success');
          expect(result.success).toBe(false);
          expect(result).toHaveProperty('error');
          expect(result.error).toContain('rate limit');
        }
      ),
      { numRuns: 30 }
    );

    mockSendEmail.mockRestore();
    mockIsConfigured.mockRestore();
  });

  it('should handle AWS SES invalid parameter errors with standardized error message', async () => {
    // Mock AWS SES to throw invalid parameter error
    const mockSendEmail = vi.spyOn(awsSesService, 'sendEmail').mockRejectedValue(
      new Error('InvalidParameterValue: Invalid email address')
    );
    
    const mockIsConfigured = vi.spyOn(awsSesService, 'isConfigured').mockReturnValue(true);

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          from: fc.emailAddress(),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 1000 })
        }),
        async (message: EmailMessage) => {
          // Configure provider as SES
          (config.email as any).provider = 'ses';

          // Send email
          const result = await emailService.sendEmail(message);

          // Verify error result mentions invalid parameters
          expect(result).toHaveProperty('success');
          expect(result.success).toBe(false);
          expect(result).toHaveProperty('error');
          expect(result.error).toContain('Invalid email address');
        }
      ),
      { numRuns: 30 }
    );

    mockSendEmail.mockRestore();
    mockIsConfigured.mockRestore();
  });

  it('should always return a result with success boolean and either messageId or error', async () => {
    // Test with all providers
    const providers = ['ses', 'sendgrid', 'postfix'] as const;
    
    // Mock AWS SES
    const mockSendEmail = vi.spyOn(awsSesService, 'sendEmail').mockResolvedValue({
      messageId: 'test-message-id'
    });
    const mockIsConfigured = vi.spyOn(awsSesService, 'isConfigured').mockReturnValue(true);
    
    // Mock SendGrid
    const mockPost = vi.spyOn(axios, 'post').mockResolvedValue({
      status: 202,
      headers: { 'x-message-id': 'sendgrid-id' }
    });
    
    // Set SendGrid API key
    const originalApiKey = config.email.sendgridApiKey;
    (config.email as any).sendgridApiKey = 'test-key';

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          from: fc.emailAddress(),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 1000 }),
          provider: fc.constantFrom(...providers)
        }),
        async ({ provider, ...message }) => {
          // Configure provider
          (config.email as any).provider = provider;

          // Send email
          const result = await emailService.sendEmail(message);

          // Verify result structure
          expect(result).toHaveProperty('success');
          expect(typeof result.success).toBe('boolean');
          
          if (result.success) {
            // Success should have messageId
            expect(result).toHaveProperty('messageId');
            expect(typeof result.messageId).toBe('string');
            expect(result.messageId).toBeTruthy();
          } else {
            // Failure should have error
            expect(result).toHaveProperty('error');
            expect(typeof result.error).toBe('string');
            expect(result.error).toBeTruthy();
          }
        }
      ),
      { numRuns: 100 }
    );

    mockSendEmail.mockRestore();
    mockIsConfigured.mockRestore();
    mockPost.mockRestore();
    (config.email as any).sendgridApiKey = originalApiKey;
  });
});
