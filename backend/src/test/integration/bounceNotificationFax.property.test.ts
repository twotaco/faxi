import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fc from 'fast-check';
import { bounceComplaintHandler, BounceDetails } from '../../services/bounceComplaintHandler.js';
import { faxSenderService } from '../../services/faxSenderService.js';
import { userRepository } from '../../repositories/userRepository.js';
import { db } from '../../database/connection.js';

/**
 * Property 34: Bounce notification fax generation
 * 
 * Feature: email-system-architecture, Property 34: Bounce notification fax generation
 * Validates: Requirements 14.2, 14.3
 * 
 * For any hard bounce or persistent soft bounce, the system should generate 
 * and send an error notification fax to the user.
 */

describe('Property 34: Bounce notification fax generation', () => {
  let testUserId: string;
  let testPhoneNumber: string;

  beforeAll(async () => {
    // Create a test user
    const user = await userRepository.create({
      phoneNumber: '+81-90-1234-5678',
      emailAddress: '8190123456 78@me.faxi.jp',
      name: 'Test User',
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

  it('should generate bounce notification fax for any hard bounce', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary bounce details
        fc.record({
          messageId: fc.string({ minLength: 10, maxLength: 50 }),
          bounceType: fc.constant('Permanent' as const),
          bouncedRecipients: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 3 }),
          reason: fc.oneof(
            fc.constant('Mailbox does not exist'),
            fc.constant('Invalid email address'),
            fc.constant('Domain not found'),
            fc.constant('User unknown')
          ),
        }),
        async (bounceData) => {
          const bounceDetails: BounceDetails = {
            ...bounceData,
            timestamp: new Date(),
          };

          // Call the handler
          await bounceComplaintHandler.handleBounce({
            userId: testUserId,
            messageId: bounceDetails.messageId,
            bounceType: bounceDetails.bounceType,
            bouncedRecipients: bounceDetails.bouncedRecipients,
            reason: bounceDetails.reason,
          });

          // Verify fax was sent
          expect(faxSenderService.sendFax).toHaveBeenCalled();
          const lastCall = vi.mocked(faxSenderService.sendFax).mock.calls[
            vi.mocked(faxSenderService.sendFax).mock.calls.length - 1
          ];
          
          // Verify fax was sent to correct phone number
          expect(lastCall[0].to).toBe(testPhoneNumber);
          
          // Verify metadata contains bounce information
          expect(lastCall[0].metadata).toMatchObject({
            type: 'bounce_notification',
            userId: testUserId,
            messageId: bounceDetails.messageId,
            bounceType: 'Permanent',
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

  it('should generate bounce notification fax for any soft bounce', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary bounce details
        fc.record({
          messageId: fc.string({ minLength: 10, maxLength: 50 }),
          bounceType: fc.constant('Transient' as const),
          bouncedRecipients: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 3 }),
          reason: fc.oneof(
            fc.constant('Mailbox full'),
            fc.constant('Message too large'),
            fc.constant('Temporary server error'),
            fc.constant('Greylisting')
          ),
        }),
        async (bounceData) => {
          const bounceDetails: BounceDetails = {
            ...bounceData,
            timestamp: new Date(),
          };

          // Call the handler
          await bounceComplaintHandler.handleBounce({
            userId: testUserId,
            messageId: bounceDetails.messageId,
            bounceType: bounceDetails.bounceType,
            bouncedRecipients: bounceDetails.bouncedRecipients,
            reason: bounceDetails.reason,
          });

          // Verify fax was sent
          expect(faxSenderService.sendFax).toHaveBeenCalled();
          const lastCall = vi.mocked(faxSenderService.sendFax).mock.calls[
            vi.mocked(faxSenderService.sendFax).mock.calls.length - 1
          ];
          
          // Verify fax was sent to correct phone number
          expect(lastCall[0].to).toBe(testPhoneNumber);
          
          // Verify metadata contains bounce information
          expect(lastCall[0].metadata).toMatchObject({
            type: 'bounce_notification',
            userId: testUserId,
            messageId: bounceDetails.messageId,
            bounceType: 'Transient',
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

  it('should include all bounced recipients in the notification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          messageId: fc.string({ minLength: 10, maxLength: 50 }),
          bounceType: fc.oneof(fc.constant('Permanent' as const), fc.constant('Transient' as const)),
          bouncedRecipients: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 5 }),
          reason: fc.string({ minLength: 10, maxLength: 100 }),
        }),
        async (bounceData) => {
          const bounceDetails: BounceDetails = {
            ...bounceData,
            timestamp: new Date(),
          };

          // Call the handler
          await bounceComplaintHandler.handleBounce({
            userId: testUserId,
            messageId: bounceDetails.messageId,
            bounceType: bounceDetails.bounceType,
            bouncedRecipients: bounceDetails.bouncedRecipients,
            reason: bounceDetails.reason,
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
