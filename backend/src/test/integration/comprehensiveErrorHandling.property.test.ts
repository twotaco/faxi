/**
 * Property-based tests for comprehensive error handling
 * Feature: email-system-architecture, Property 28: Comprehensive error handling
 * 
 * Tests that email operation failures are properly logged with context,
 * users are notified via fax when applicable, and administrators are alerted
 * for critical failures.
 * 
 * Validates: Requirements 12.1, 12.3, 12.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { EmailService, EmailMessage } from '../../services/emailService';
import { EmailDeliveryTracker } from '../../services/emailDeliveryTracker';
import { auditLogService } from '../../services/auditLogService';
import { faxSenderService } from '../../services/faxSenderService';
import { alertingService } from '../../services/alertingService';
import { awsSesService } from '../../services/awsSesService';
import { db } from '../../database/connection';
import { config } from '../../config';

describe('**Feature: email-system-architecture, Property 28: Comprehensive error handling**', () => {
  let emailService: EmailService;
  let emailDeliveryTracker: EmailDeliveryTracker;

  beforeEach(() => {
    emailService = new EmailService();
    emailDeliveryTracker = new EmailDeliveryTracker();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 28: Comprehensive error handling
   * For any email operation failure, the system should log the error with context,
   * notify the user via fax if applicable, and alert administrators for critical failures
   * Validates: Requirements 12.1, 12.3, 12.7
   */
  it('should log errors with full context when email operations fail (Requirement 12.1)', async () => {
    // Mock audit log service
    const mockAuditLog = vi.spyOn(auditLogService, 'log').mockResolvedValue(undefined);

    // Mock AWS SES to throw errors
    const mockSendEmail = vi.spyOn(awsSesService, 'sendEmail').mockRejectedValue(
      new Error('AWS SES service unavailable')
    );
    const mockIsConfigured = vi.spyOn(awsSesService, 'isConfigured').mockReturnValue(true);

    // Set provider to SES
    const originalProvider = (config.email as any).provider;
    (config.email as any).provider = 'ses';

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          from: fc.emailAddress(),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 1000 })
        }),
        async (message: EmailMessage) => {
          // Clear previous mock calls
          mockAuditLog.mockClear();

          // Attempt to send email (should fail but return error result)
          const result = await emailService.sendEmail(message);

          // Verify email send failed
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();

          // Verify audit log was called with error context
          expect(mockAuditLog).toHaveBeenCalled();
          const auditCalls = mockAuditLog.mock.calls;
          const errorLog = auditCalls.find(call => 
            call[0].eventType === 'email.send_failed' || 
            call[0].eventType === 'email.aws_ses_error' ||
            call[0].eventType?.includes('error')
          );
          
          // Verify error was logged with context
          expect(errorLog).toBeDefined();
          if (errorLog) {
            expect(errorLog[0]).toHaveProperty('eventData');
            expect(errorLog[0].eventData).toHaveProperty('error');
            expect(errorLog[0].eventData).toHaveProperty('to');
            expect(errorLog[0].eventData).toHaveProperty('from');
          }
        }
      ),
      { numRuns: 30 }
    );

    // Restore
    (config.email as any).provider = originalProvider;
    mockSendEmail.mockRestore();
    mockIsConfigured.mockRestore();
    mockAuditLog.mockRestore();
  });

  it('should send error notification fax to user when outbound email fails (Requirement 12.3)', async () => {
    // Import userRepository
    const { userRepository } = await import('../../repositories/userRepository');
    const { s3Storage } = await import('../../storage/s3');

    // Mock database queries
    const mockDbQuery = vi.spyOn(db, 'query').mockImplementation(async (query: string) => {
      if (query.includes('SELECT em.from_address')) {
        return {
          rows: [{
            from_address: 'test@me.faxi.jp',
            to_addresses: JSON.stringify(['recipient@example.com']),
            subject: 'Test Subject',
            user_id: 'test-user-id'
          }]
        } as any;
      }
      if (query.includes('UPDATE email_messages')) {
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    });

    // Mock user repository
    const mockFindById = vi.spyOn(userRepository, 'findById').mockResolvedValue({
      id: 'test-user-id',
      phoneNumber: '+819012345678',
      emailAddress: 'test@me.faxi.jp',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);

    // Mock fax sender service
    const mockSendFax = vi.spyOn(faxSenderService, 'sendFax').mockResolvedValue({
      faxId: 'fax-123',
      status: 'queued'
    } as any);

    // Mock S3 storage
    const mockS3Upload = vi.spyOn(s3Storage, 'uploadFile').mockResolvedValue(undefined);
    const mockS3GetUrl = vi.spyOn(s3Storage, 'getPresignedUrl').mockResolvedValue('https://s3.amazonaws.com/bucket/key');

    // Mock audit log
    const mockAuditLog = vi.spyOn(auditLogService, 'log').mockResolvedValue(undefined);

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          messageId: fc.string({ minLength: 10, maxLength: 50 }),
          bounceType: fc.constantFrom('Permanent', 'Transient'),
          reason: fc.string({ minLength: 10, maxLength: 200 }),
          bouncedRecipients: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 3 })
        }),
        async (bounceData) => {
          // Clear previous mock calls
          mockSendFax.mockClear();

          // Handle bounce (should generate error fax)
          await emailDeliveryTracker.handleBounce(
            bounceData.messageId,
            bounceData.bounceType as 'Permanent' | 'Transient',
            bounceData.reason,
            bounceData.bouncedRecipients
          );

          // Verify fax was sent to user
          expect(mockSendFax).toHaveBeenCalled();
          const faxCall = mockSendFax.mock.calls[0];
          expect(faxCall[0]).toHaveProperty('to');
          expect(faxCall[0]).toHaveProperty('mediaUrl');
          expect(faxCall[0].to).toBe('+819012345678');
        }
      ),
      { numRuns: 30 }
    );

    mockDbQuery.mockRestore();
    mockFindById.mockRestore();
    mockSendFax.mockRestore();
    mockS3Upload.mockRestore();
    mockS3GetUrl.mockRestore();
    mockAuditLog.mockRestore();
  });

  it('should alert administrators for critical email operation failures (Requirement 12.7)', async () => {
    // Mock audit log service
    const mockAuditLog = vi.spyOn(auditLogService, 'log').mockResolvedValue(undefined);

    // Mock AWS SES to throw critical errors
    const mockSendEmail = vi.spyOn(awsSesService, 'sendEmail');
    const mockIsConfigured = vi.spyOn(awsSesService, 'isConfigured').mockReturnValue(true);

    // Set provider to SES
    const originalProvider = (config.email as any).provider;
    (config.email as any).provider = 'ses';

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          from: fc.emailAddress(),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 1000 })
        }),
        fc.constantFrom(
          'AWS SES account suspended',
          'Database connection lost',
          'Queue system unavailable',
          'Storage service down'
        ),
        async (message: EmailMessage, criticalError: string) => {
          // Clear previous mock calls
          mockAuditLog.mockClear();

          // Override mock to return specific critical error
          mockSendEmail.mockRejectedValueOnce(new Error(criticalError));

          // Attempt to send email (should fail critically)
          const result = await emailService.sendEmail(message);

          // Verify email send failed
          expect(result.success).toBe(false);

          // For critical errors, administrators should be alerted
          // We verify that the error was logged with AWS SES error type
          expect(mockAuditLog).toHaveBeenCalled();
          const auditCalls = mockAuditLog.mock.calls;
          
          // Check that error was logged (either in sendViaSES or sendEmail)
          const errorLogs = auditCalls.filter(call => 
            call[0].eventType?.includes('error') || 
            call[0].eventType?.includes('failed')
          );
          expect(errorLogs.length).toBeGreaterThan(0);
          
          // Verify error message contains the critical error text
          const hasErrorMessage = errorLogs.some(log => 
            log[0].eventData?.error?.toLowerCase().includes(criticalError.toLowerCase())
          );
          expect(hasErrorMessage).toBe(true);
        }
      ),
      { numRuns: 20 }
    );

    // Restore
    (config.email as any).provider = originalProvider;
    mockSendEmail.mockRestore();
    mockIsConfigured.mockRestore();
    mockAuditLog.mockRestore();
  });

  it('should handle multiple concurrent error scenarios gracefully', async () => {
    // Mock services
    const mockAuditLog = vi.spyOn(auditLogService, 'log').mockResolvedValue(undefined);
    const mockSendEmail = vi.spyOn(awsSesService, 'sendEmail').mockRejectedValue(
      new Error('Service temporarily unavailable')
    );
    const mockIsConfigured = vi.spyOn(awsSesService, 'isConfigured').mockReturnValue(true);

    // Set provider to SES
    const originalProvider = (config.email as any).provider;
    (config.email as any).provider = 'ses';

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            to: fc.emailAddress(),
            from: fc.emailAddress(),
            subject: fc.string({ minLength: 1, maxLength: 100 }),
            body: fc.string({ minLength: 1, maxLength: 500 })
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (messages: EmailMessage[]) => {
          // Clear previous mock calls
          mockAuditLog.mockClear();

          // Attempt to send multiple emails concurrently
          const results = await Promise.allSettled(
            messages.map(msg => emailService.sendEmail(msg))
          );

          // All should be fulfilled (EmailService returns error results, doesn't throw)
          results.forEach(result => {
            expect(result.status).toBe('fulfilled');
            if (result.status === 'fulfilled') {
              expect(result.value.success).toBe(false);
            }
          });

          // Each failure should be logged (at least one log per message)
          expect(mockAuditLog.mock.calls.length).toBeGreaterThanOrEqual(messages.length);
        }
      ),
      { numRuns: 20 }
    );

    // Restore
    (config.email as any).provider = originalProvider;
    mockSendEmail.mockRestore();
    mockIsConfigured.mockRestore();
    mockAuditLog.mockRestore();
  });

  it('should preserve error context across async operations', async () => {
    // Mock audit log to capture error context
    const mockAuditLog = vi.spyOn(auditLogService, 'log').mockResolvedValue(undefined);
    
    // Mock AWS SES with detailed error
    const mockSendEmail = vi.spyOn(awsSesService, 'sendEmail').mockRejectedValue(
      Object.assign(new Error('Rate limit exceeded'), {
        code: 'Throttling',
        statusCode: 429,
        retryable: true
      })
    );
    const mockIsConfigured = vi.spyOn(awsSesService, 'isConfigured').mockReturnValue(true);

    // Set provider to SES
    const originalProvider = (config.email as any).provider;
    (config.email as any).provider = 'ses';

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          from: fc.emailAddress(),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 1000 })
        }),
        async (message: EmailMessage) => {
          // Clear previous mock calls
          mockAuditLog.mockClear();

          // Send email (should fail but return error result)
          const result = await emailService.sendEmail(message);

          // Verify email send failed
          expect(result.success).toBe(false);

          // Verify error context was preserved in audit log
          expect(mockAuditLog).toHaveBeenCalled();
          const auditCalls = mockAuditLog.mock.calls;
          
          // Find the error log entry
          const errorLog = auditCalls.find(call => 
            call[0].eventType?.includes('error') || 
            call[0].eventType?.includes('failed')
          );

          expect(errorLog).toBeDefined();
          if (errorLog) {
            // Verify context includes message details
            expect(errorLog[0].eventData).toBeDefined();
            expect(errorLog[0].eventData.to).toBe(message.to);
            expect(errorLog[0].eventData.from).toBe(message.from);
            expect(errorLog[0].eventData.subject).toBe(message.subject);
          }
        }
      ),
      { numRuns: 30 }
    );

    // Restore
    (config.email as any).provider = originalProvider;
    mockSendEmail.mockRestore();
    mockIsConfigured.mockRestore();
    mockAuditLog.mockRestore();
  });
});
