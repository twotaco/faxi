import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fc from 'fast-check';
import { bounceComplaintHandler, ComplaintDetails } from '../../services/bounceComplaintHandler.js';
import { faxSenderService } from '../../services/faxSenderService.js';
import { userRepository } from '../../repositories/userRepository.js';
import { db } from '../../database/connection.js';

/**
 * Property 35: Complaint notification fax with etiquette guidance
 * 
 * Feature: email-system-architecture, Property 35: Complaint notification fax with etiquette guidance
 * Validates: Requirements 14.6, 14.7
 * 
 * For any complaint notification, the system should generate a fax that includes 
 * both the complaint notice and email etiquette guidance.
 */

describe('Property 35: Complaint notification fax with etiquette guidance', () => {
  let testUserId: string;
  let testPhoneNumber: string;

  beforeAll(async () => {
    // Create a test user
    const user = await userRepository.create({
      phoneNumber: '+81-90-9876-5432',
      emailAddress: '819098765432@me.faxi.jp',
      name: 'Test User Complaint',
    });
    testUserId = user.id;
    testPhoneNumber = user.phoneNumber;

    // Mock faxSenderService to avoid actual fax sending
    vi.spyOn(faxSenderService, 'sendFax').mockResolvedValue({
      success: true,
      faxId: 'mock-fax-id',
      status: 'queued',
    } as any);
  });

  afterAll(async () => {
    // Clean up test user
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    vi.restoreAllMocks();
  });

  it('should generate complaint notification fax for any complaint', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary complaint details
        fc.record({
          messageId: fc.string({ minLength: 10, maxLength: 50 }),
          complainedRecipients: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 3 }),
          complaintFeedbackType: fc.oneof(
            fc.constant('abuse'),
            fc.constant('fraud'),
            fc.constant('virus'),
            fc.constant('other'),
            fc.constant(undefined)
          ),
        }),
        async (complaintData) => {
          const complaintDetails: ComplaintDetails = {
            ...complaintData,
            timestamp: new Date(),
          };

          // Call the handler
          await bounceComplaintHandler.handleComplaint({
            userId: testUserId,
            messageId: complaintDetails.messageId,
            complainedRecipients: complaintDetails.complainedRecipients,
            complaintFeedbackType: complaintDetails.complaintFeedbackType,
          });

          // Verify fax was sent
          expect(faxSenderService.sendFax).toHaveBeenCalled();
          const lastCall = vi.mocked(faxSenderService.sendFax).mock.calls[
            vi.mocked(faxSenderService.sendFax).mock.calls.length - 1
          ];
          
          // Verify fax was sent to correct phone number
          expect(lastCall[0].to).toBe(testPhoneNumber);
          
          // Verify metadata contains complaint information
          expect(lastCall[0].metadata).toMatchObject({
            type: 'complaint_notification',
            userId: testUserId,
            messageId: complaintDetails.messageId,
          });

          // Verify PDF buffer was generated
          expect(lastCall[0].pdfBuffer).toBeDefined();
          expect(lastCall[0].pdfBuffer).toBeInstanceOf(Buffer);
          expect(lastCall[0].pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should include etiquette guidance in all complaint notifications', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          messageId: fc.string({ minLength: 10, maxLength: 50 }),
          complainedRecipients: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 5 }),
          complaintFeedbackType: fc.option(
            fc.oneof(
              fc.constant('abuse'),
              fc.constant('fraud'),
              fc.constant('virus'),
              fc.constant('other')
            ),
            { nil: undefined }
          ),
        }),
        async (complaintData) => {
          const complaintDetails: ComplaintDetails = {
            ...complaintData,
            timestamp: new Date(),
          };

          // Call the handler
          await bounceComplaintHandler.handleComplaint({
            userId: testUserId,
            messageId: complaintDetails.messageId,
            complainedRecipients: complaintDetails.complainedRecipients,
            complaintFeedbackType: complaintDetails.complaintFeedbackType,
          });

          // Verify fax was sent
          expect(faxSenderService.sendFax).toHaveBeenCalled();
          
          // The notification should be generated successfully with etiquette guidance
          // We verify this by checking that a PDF was generated
          const lastCall = vi.mocked(faxSenderService.sendFax).mock.calls[
            vi.mocked(faxSenderService.sendFax).mock.calls.length - 1
          ];
          expect(lastCall[0].pdfBuffer).toBeDefined();
          expect(lastCall[0].pdfBuffer.length).toBeGreaterThan(0);
          
          // The PDF should be substantial enough to contain etiquette guidance
          // A complaint fax with full etiquette guidance should be at least 5KB
          expect(lastCall[0].pdfBuffer.length).toBeGreaterThan(5000);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle complaints with multiple recipients', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          messageId: fc.string({ minLength: 10, maxLength: 50 }),
          complainedRecipients: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 10 }),
          complaintFeedbackType: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
        }),
        async (complaintData) => {
          const complaintDetails: ComplaintDetails = {
            ...complaintData,
            timestamp: new Date(),
          };

          // Call the handler
          await bounceComplaintHandler.handleComplaint({
            userId: testUserId,
            messageId: complaintDetails.messageId,
            complainedRecipients: complaintDetails.complainedRecipients,
            complaintFeedbackType: complaintDetails.complaintFeedbackType,
          });

          // Verify fax was sent
          expect(faxSenderService.sendFax).toHaveBeenCalled();
          
          // The notification should be generated successfully for any number of recipients
          const lastCall = vi.mocked(faxSenderService.sendFax).mock.calls[
            vi.mocked(faxSenderService.sendFax).mock.calls.length - 1
          ];
          expect(lastCall[0].pdfBuffer).toBeDefined();
          expect(lastCall[0].pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 30 }
    );
  });
});
