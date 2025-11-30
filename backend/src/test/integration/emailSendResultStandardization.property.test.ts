/**
 * Property-based tests for email send result standardization
 * Feature: email-system-architecture, Property 16: Email send result standardization
 * 
 * Tests that all email send operations return a standardized result structure
 * with success status and either message ID or error reason, regardless of
 * which provider is used or what type of error occurs.
 * 
 * Validates: Requirements 6.6, 6.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { EmailService, EmailMessage, EmailSendResult } from '../../services/emailService';
import { config } from '../../config';
import { awsSesService } from '../../services/awsSesService';
import axios from 'axios';

describe('**Feature: email-system-architecture, Property 16: Email send result standardization**', () => {
  let originalProvider: string;
  let originalApiKey: string | undefined;
  let emailService: EmailService;

  beforeEach(() => {
    // Store original configuration
    originalProvider = config.email.provider;
    originalApiKey = config.email.sendgridApiKey;
    // Create fresh instance for each test
    emailService = new EmailService();
  });

  afterEach(() => {
    // Restore original configuration
    (config.email as any).provider = originalProvider;
    (config.email as any).sendgridApiKey = originalApiKey;
    // Clear all mocks
    vi.clearAllMocks();
  });

  /**
   * Property 16: Email send result standardization
   * For any email send operation, the result should have a standardized structure 
   * with success status and either message ID or error reason
   * Validates: Requirements 6.6, 6.7
   */
  it('should always return EmailSendResult with success boolean', async () => {
    // Mock AWS SES with various outcomes
    const mockSendEmail = vi.spyOn(awsSesService, 'sendEmail');
    const mockIsConfigured = vi.spyOn(awsSesService, 'isConfigured');
    
    // Mock SendGrid
    const mockPost = vi.spyOn(axios, 'post');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          from: fc.emailAddress(),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 1000 }),
          provider: fc.constantFrom('ses', 'sendgrid', 'postfix', 'invalid'),
          shouldSucceed: fc.boolean()
        }),
        async ({ provider, shouldSucceed, ...message }) => {
          // Configure provider
          (config.email as any).provider = provider;

          // Setup mocks based on provider and success flag
          if (provider === 'ses') {
            mockIsConfigured.mockReturnValue(true);
            if (shouldSucceed) {
              mockSendEmail.mockResolvedValue({ messageId: `ses-${Date.now()}` });
            } else {
              mockSendEmail.mockRejectedValue(new Error('SES error'));
            }
          } else if (provider === 'sendgrid') {
            (config.email as any).sendgridApiKey = 'test-key';
            if (shouldSucceed) {
              mockPost.mockResolvedValue({
                status: 202,
                headers: { 'x-message-id': `sg-${Date.now()}` }
              });
            } else {
              mockPost.mockRejectedValue(new Error('SendGrid error'));
            }
          }

          // Send email
          const result = await emailService.sendEmail(message);

          // Verify result structure
          expect(result).toBeDefined();
          expect(result).toHaveProperty('success');
          expect(typeof result.success).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );

    mockSendEmail.mockRestore();
    mockIsConfigured.mockRestore();
    mockPost.mockRestore();
  });

  it('should return messageId when success is true', async () => {
    // Mock successful AWS SES send
    const mockSendEmail = vi.spyOn(awsSesService, 'sendEmail').mockImplementation(
      async () => ({ messageId: `test-msg-${Math.random()}` })
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

          // When success is true, messageId must be present
          if (result.success) {
            expect(result).toHaveProperty('messageId');
            expect(typeof result.messageId).toBe('string');
            expect(result.messageId).toBeTruthy();
            expect(result.messageId!.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );

    mockSendEmail.mockRestore();
    mockIsConfigured.mockRestore();
  });

  it('should return error when success is false', async () => {
    // Test various error scenarios
    const errorScenarios = [
      { provider: 'ses', error: new Error('Throttling: Rate exceeded'), expectedErrorSubstring: 'rate limit' },
      { provider: 'ses', error: new Error('InvalidParameterValue: Invalid email'), expectedErrorSubstring: 'Invalid email' },
      { provider: 'ses', error: new Error('MessageRejected'), expectedErrorSubstring: 'rejected' },
      { provider: 'ses', error: new Error('Generic AWS error'), expectedErrorSubstring: 'AWS SES' },
      { provider: 'sendgrid', error: new Error('SendGrid API error'), expectedErrorSubstring: 'error' },
      { provider: 'postfix', error: new Error('Not implemented'), expectedErrorSubstring: 'Postfix' },
      { provider: 'invalid', error: new Error('Unsupported'), expectedErrorSubstring: 'Unsupported' }
    ];

    for (const scenario of errorScenarios) {
      const mockSendEmail = vi.spyOn(awsSesService, 'sendEmail');
      const mockIsConfigured = vi.spyOn(awsSesService, 'isConfigured');
      const mockPost = vi.spyOn(axios, 'post');

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            to: fc.emailAddress(),
            from: fc.emailAddress(),
            subject: fc.string({ minLength: 1, maxLength: 100 }),
            body: fc.string({ minLength: 1, maxLength: 1000 })
          }),
          async (message: EmailMessage) => {
            // Configure provider
            (config.email as any).provider = scenario.provider;

            // Setup mocks to fail
            if (scenario.provider === 'ses') {
              mockIsConfigured.mockReturnValue(true);
              mockSendEmail.mockRejectedValue(scenario.error);
            } else if (scenario.provider === 'sendgrid') {
              (config.email as any).sendgridApiKey = 'test-key';
              mockPost.mockRejectedValue(scenario.error);
            }

            // Send email
            const result = await emailService.sendEmail(message);

            // When success is false, error must be present
            if (!result.success) {
              expect(result).toHaveProperty('error');
              expect(typeof result.error).toBe('string');
              expect(result.error).toBeTruthy();
              expect(result.error!.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 30 }
      );

      mockSendEmail.mockRestore();
      mockIsConfigured.mockRestore();
      mockPost.mockRestore();
    }
  });

  it('should never return both messageId and error', async () => {
    // Mock various scenarios
    const mockSendEmail = vi.spyOn(awsSesService, 'sendEmail');
    const mockIsConfigured = vi.spyOn(awsSesService, 'isConfigured');
    const mockPost = vi.spyOn(axios, 'post');

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          from: fc.emailAddress(),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 1000 }),
          provider: fc.constantFrom('ses', 'sendgrid'),
          shouldSucceed: fc.boolean()
        }),
        async ({ provider, shouldSucceed, ...message }) => {
          // Configure provider
          (config.email as any).provider = provider;

          // Setup mocks
          if (provider === 'ses') {
            mockIsConfigured.mockReturnValue(true);
            if (shouldSucceed) {
              mockSendEmail.mockResolvedValue({ messageId: 'test-id' });
            } else {
              mockSendEmail.mockRejectedValue(new Error('Test error'));
            }
          } else if (provider === 'sendgrid') {
            (config.email as any).sendgridApiKey = 'test-key';
            if (shouldSucceed) {
              mockPost.mockResolvedValue({
                status: 202,
                headers: { 'x-message-id': 'test-id' }
              });
            } else {
              mockPost.mockRejectedValue(new Error('Test error'));
            }
          }

          // Send email
          const result = await emailService.sendEmail(message);

          // Result should have either messageId OR error, never both
          const hasMessageId = result.messageId !== undefined;
          const hasError = result.error !== undefined;
          
          // XOR: exactly one should be true
          expect(hasMessageId !== hasError).toBe(true);
        }
      ),
      { numRuns: 100 }
    );

    mockSendEmail.mockRestore();
    mockIsConfigured.mockRestore();
    mockPost.mockRestore();
  });

  it('should standardize AWS SES specific errors', async () => {
    const awsErrors = [
      { error: 'Throttling: Rate exceeded', expectedSubstring: 'rate limit' },
      { error: 'InvalidParameterValue: Bad email', expectedSubstring: 'Invalid email' },
      { error: 'MessageRejected: Sender not verified', expectedSubstring: 'rejected' },
      { error: 'Some other AWS error', expectedSubstring: 'AWS SES' }
    ];

    const mockIsConfigured = vi.spyOn(awsSesService, 'isConfigured').mockReturnValue(true);

    for (const { error, expectedSubstring } of awsErrors) {
      const mockSendEmail = vi.spyOn(awsSesService, 'sendEmail').mockRejectedValue(
        new Error(error)
      );

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

            // Verify standardized error
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error!.toLowerCase()).toContain(expectedSubstring.toLowerCase());
          }
        ),
        { numRuns: 30 }
      );

      mockSendEmail.mockRestore();
    }

    mockIsConfigured.mockRestore();
  });

  it('should return consistent result structure across all providers', async () => {
    // Mock all providers
    const mockSendEmail = vi.spyOn(awsSesService, 'sendEmail').mockResolvedValue({
      messageId: 'ses-id'
    });
    const mockIsConfigured = vi.spyOn(awsSesService, 'isConfigured').mockReturnValue(true);
    const mockPost = vi.spyOn(axios, 'post').mockResolvedValue({
      status: 202,
      headers: { 'x-message-id': 'sg-id' }
    });

    (config.email as any).sendgridApiKey = 'test-key';

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          from: fc.emailAddress(),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 1000 }),
          provider: fc.constantFrom('ses', 'sendgrid', 'postfix')
        }),
        async ({ provider, ...message }) => {
          // Configure provider
          (config.email as any).provider = provider;

          // Send email
          const result = await emailService.sendEmail(message);

          // Verify consistent structure
          expect(result).toMatchObject({
            success: expect.any(Boolean)
          });

          // Verify type consistency
          if (result.messageId !== undefined) {
            expect(typeof result.messageId).toBe('string');
          }
          if (result.error !== undefined) {
            expect(typeof result.error).toBe('string');
          }

          // Verify no unexpected properties
          const allowedKeys = ['success', 'messageId', 'error'];
          const resultKeys = Object.keys(result);
          for (const key of resultKeys) {
            expect(allowedKeys).toContain(key);
          }
        }
      ),
      { numRuns: 100 }
    );

    mockSendEmail.mockRestore();
    mockIsConfigured.mockRestore();
    mockPost.mockRestore();
  });

  it('should handle unconfigured providers with standardized error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          from: fc.emailAddress(),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 1000 })
        }),
        async (message: EmailMessage) => {
          // Test SES without configuration
          const mockIsConfigured = vi.spyOn(awsSesService, 'isConfigured').mockReturnValue(false);
          (config.email as any).provider = 'ses';

          let result = await emailService.sendEmail(message);
          
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('not configured');
          expect(result.messageId).toBeUndefined();

          mockIsConfigured.mockRestore();

          // Test SendGrid without API key
          (config.email as any).provider = 'sendgrid';
          (config.email as any).sendgridApiKey = undefined;

          result = await emailService.sendEmail(message);
          
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('not configured');
          expect(result.messageId).toBeUndefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve error information while standardizing format', async () => {
    const specificErrors = [
      'Throttling: Maximum sending rate exceeded',
      'InvalidParameterValue: Email address is not verified',
      'MessageRejected: Email address is on suppression list',
      'ServiceUnavailable: Temporary service failure'
    ];

    const mockIsConfigured = vi.spyOn(awsSesService, 'isConfigured').mockReturnValue(true);

    for (const errorMessage of specificErrors) {
      const mockSendEmail = vi.spyOn(awsSesService, 'sendEmail').mockRejectedValue(
        new Error(errorMessage)
      );

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            to: fc.emailAddress(),
            from: fc.emailAddress(),
            subject: fc.string({ minLength: 1, maxLength: 100 }),
            body: fc.string({ minLength: 1, maxLength: 1000 })
          }),
          async (message: EmailMessage) => {
            (config.email as any).provider = 'ses';

            const result = await emailService.sendEmail(message);

            // Error should be standardized but preserve key information
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(typeof result.error).toBe('string');
            
            // Error should contain useful information for debugging
            expect(result.error!.length).toBeGreaterThan(10);
          }
        ),
        { numRuns: 20 }
      );

      mockSendEmail.mockRestore();
    }

    mockIsConfigured.mockRestore();
  });
});
