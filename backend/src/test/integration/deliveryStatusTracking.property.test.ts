/**
 * Property-based tests for email delivery status tracking
 * Feature: email-system-architecture, Property 25: Delivery status tracking
 * 
 * Tests that delivery or bounce notifications correctly update the corresponding 
 * email message status in the database.
 * 
 * Validates: Requirements 10.4, 10.5
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { db } from '../../database/connection';
import { emailDeliveryTracker } from '../../services/emailDeliveryTracker';
import { emailThreadRepository, emailMessageRepository } from '../../repositories/emailThreadRepository';
import { userRepository } from '../../repositories/userRepository';

describe('**Feature: email-system-architecture, Property 25: Delivery status tracking**', () => {
  let testUserId: string;
  let testThreadId: string;

  beforeAll(async () => {
    // Create a test user
    const { user } = await userRepository.findOrCreate('+81901234567890');
    testUserId = user.id;

    // Create a test email thread
    const thread = await emailThreadRepository.create({
      userId: testUserId,
      threadId: 'test-thread-delivery-tracking',
      subject: 'Test Email Thread',
      participants: ['test@example.com', '81901234567890@me.faxi.jp'],
      lastMessageAt: new Date(),
    });
    testThreadId = thread.threadId;
  });

  afterAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM email_messages WHERE thread_id IN (SELECT id FROM email_threads WHERE user_id = $1)', [testUserId]);
    await db.query('DELETE FROM email_threads WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  beforeEach(async () => {
    // Clean up any messages from previous tests
    await db.query('DELETE FROM email_messages WHERE thread_id IN (SELECT id FROM email_threads WHERE thread_id = $1)', [testThreadId]);
  });

  /**
   * Property 25: Delivery status tracking
   * For any delivery notification, the system should update the corresponding 
   * email message status to 'delivered'
   * Validates: Requirements 10.4
   */
  it('should update message status to delivered when delivery notification is received', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          messageId: fc.uuid().map(id => `msg-del-${id}`),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 500 }),
          deliveryTimestamp: fc.date({ min: new Date('2025-01-01'), max: new Date('2025-12-31') }),
        }),
        async (data) => {
          // Create a test email message with pending status
          await emailMessageRepository.create({
            threadId: testThreadId,
            messageId: data.messageId,
            fromAddress: '81901234567890@me.faxi.jp',
            toAddresses: ['recipient@example.com'],
            subject: data.subject,
            body: data.body,
            direction: 'outbound',
            sentAt: new Date(),
          });

          // Verify initial status is pending
          const beforeStatus = await emailDeliveryTracker.getDeliveryStatus(data.messageId);
          expect(beforeStatus).not.toBeNull();
          expect(beforeStatus?.status).toBe('pending');

          // Handle delivery notification
          await emailDeliveryTracker.handleDelivery(data.messageId, data.deliveryTimestamp);

          // Verify status was updated to delivered
          const afterStatus = await emailDeliveryTracker.getDeliveryStatus(data.messageId);
          expect(afterStatus).not.toBeNull();
          expect(afterStatus?.status).toBe('delivered');
          expect(afterStatus?.timestamp).toEqual(data.deliveryTimestamp);
          expect(afterStatus?.details).toContain('delivered successfully');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 25: Delivery status tracking
   * For any bounce notification, the system should update the corresponding 
   * email message status to 'bounced'
   * Validates: Requirements 10.5
   * 
   * Note: Reduced to 10 runs because each bounce generates a fax notification
   */
  it('should update message status to bounced when bounce notification is received', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          messageId: fc.uuid().map(id => `msg-bounce-${id}`),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 500 }),
          bounceType: fc.constantFrom('Permanent', 'Transient'),
          bounceReason: fc.constantFrom(
            'Mailbox does not exist',
            'Mailbox full',
            'Message too large',
            'Domain does not exist',
            'Temporary server error'
          ),
          bouncedRecipients: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 3 }),
        }),
        async (data) => {
          // Create a test email message with pending status
          await emailMessageRepository.create({
            threadId: testThreadId,
            messageId: data.messageId,
            fromAddress: '81901234567890@me.faxi.jp',
            toAddresses: data.bouncedRecipients,
            subject: data.subject,
            body: data.body,
            direction: 'outbound',
            sentAt: new Date(),
          });

          // Verify initial status is pending
          const beforeStatus = await emailDeliveryTracker.getDeliveryStatus(data.messageId);
          expect(beforeStatus).not.toBeNull();
          expect(beforeStatus?.status).toBe('pending');

          // Handle bounce notification
          await emailDeliveryTracker.handleBounce(
            data.messageId,
            data.bounceType as 'Permanent' | 'Transient',
            data.bounceReason,
            data.bouncedRecipients
          );

          // Verify status was updated to bounced
          const afterStatus = await emailDeliveryTracker.getDeliveryStatus(data.messageId);
          expect(afterStatus).not.toBeNull();
          expect(afterStatus?.status).toBe('bounced');
          expect(afterStatus?.details).toContain(data.bounceType);
          expect(afterStatus?.details).toContain(data.bounceReason);
        }
      ),
      { numRuns: 10 } // Reduced from 100 because each bounce generates a fax
    );
  }, 120000); // 2 minute timeout for fax generation

  /**
   * Property 25: Delivery status tracking
   * For any complaint notification, the system should update the corresponding 
   * email message status to 'complained'
   * Validates: Requirements 10.5
   */
  it('should update message status to complained when complaint notification is received', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          messageId: fc.uuid().map(id => `msg-complaint-${id}`),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 500 }),
          complaintType: fc.constantFrom('abuse', 'fraud', 'virus', 'other'),
          complainedRecipients: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 3 }),
        }),
        async (data) => {
          // Create a test email message with pending status
          await emailMessageRepository.create({
            threadId: testThreadId,
            messageId: data.messageId,
            fromAddress: '81901234567890@me.faxi.jp',
            toAddresses: data.complainedRecipients,
            subject: data.subject,
            body: data.body,
            direction: 'outbound',
            sentAt: new Date(),
          });

          // Verify initial status is pending
          const beforeStatus = await emailDeliveryTracker.getDeliveryStatus(data.messageId);
          expect(beforeStatus).not.toBeNull();
          expect(beforeStatus?.status).toBe('pending');

          // Handle complaint notification
          await emailDeliveryTracker.handleComplaint(
            data.messageId,
            data.complaintType,
            data.complainedRecipients
          );

          // Verify status was updated to complained
          const afterStatus = await emailDeliveryTracker.getDeliveryStatus(data.messageId);
          expect(afterStatus).not.toBeNull();
          expect(afterStatus?.status).toBe('complained');
          expect(afterStatus?.details).toContain('Complaint');
          expect(afterStatus?.details).toContain(data.complaintType);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 25: Delivery status tracking - Idempotency
   * Handling the same delivery event multiple times should not cause errors
   * and should maintain the correct status
   */
  it('should handle duplicate delivery notifications idempotently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          messageId: fc.uuid().map(id => `msg-idem-${id}`),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 500 }),
          deliveryTimestamp: fc.date({ min: new Date('2025-01-01'), max: new Date('2025-12-31') }),
          repeatCount: fc.integer({ min: 2, max: 5 }),
        }),
        async (data) => {
          // Create a test email message
          await emailMessageRepository.create({
            threadId: testThreadId,
            messageId: data.messageId,
            fromAddress: '81901234567890@me.faxi.jp',
            toAddresses: ['recipient@example.com'],
            subject: data.subject,
            body: data.body,
            direction: 'outbound',
            sentAt: new Date(),
          });

          // Handle delivery notification multiple times
          for (let i = 0; i < data.repeatCount; i++) {
            await emailDeliveryTracker.handleDelivery(data.messageId, data.deliveryTimestamp);
          }

          // Verify status is still delivered (not corrupted by multiple updates)
          const finalStatus = await emailDeliveryTracker.getDeliveryStatus(data.messageId);
          expect(finalStatus).not.toBeNull();
          expect(finalStatus?.status).toBe('delivered');
          expect(finalStatus?.timestamp).toEqual(data.deliveryTimestamp);
        }
      ),
      { numRuns: 50 }
    );
  });
});
