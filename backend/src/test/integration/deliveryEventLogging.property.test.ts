/**
 * Property-based tests for delivery event logging
 * Feature: email-system-architecture, Property 26: Delivery event logging
 * 
 * Tests that all email delivery events (success, bounce, complaint) are logged
 * in the audit log.
 * 
 * Validates: Requirements 10.7
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { db } from '../../database/connection';
import { emailDeliveryTracker } from '../../services/emailDeliveryTracker';
import { emailThreadRepository, emailMessageRepository } from '../../repositories/emailThreadRepository';
import { userRepository } from '../../repositories/userRepository';
import { auditLogRepository } from '../../repositories/auditLogRepository';

describe('**Feature: email-system-architecture, Property 26: Delivery event logging**', () => {
  let testUserId: string;
  let testThreadId: string;

  beforeAll(async () => {
    // Create a test user
    const { user } = await userRepository.findOrCreate('+81901234567891');
    testUserId = user.id;

    // Create a test email thread
    const thread = await emailThreadRepository.create({
      userId: testUserId,
      threadId: 'test-thread-delivery-logging',
      subject: 'Test Email Thread for Logging',
      participants: ['test@example.com', '81901234567891@me.faxi.jp'],
      lastMessageAt: new Date(),
    });
    testThreadId = thread.threadId;
  });

  afterAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM audit_logs WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM email_messages WHERE thread_id IN (SELECT id FROM email_threads WHERE user_id = $1)', [testUserId]);
    await db.query('DELETE FROM email_threads WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  beforeEach(async () => {
    // Clean up any messages and logs from previous tests
    await db.query('DELETE FROM audit_logs WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM email_messages WHERE thread_id IN (SELECT id FROM email_threads WHERE thread_id = $1)', [testThreadId]);
  });

  /**
   * Property 26: Delivery event logging
   * For any email delivery event (success), the system should create an audit log entry
   * Validates: Requirements 10.7
   */
  it('should log delivery events in audit log', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          messageId: fc.uuid().map(id => `msg-log-del-${id}`),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 500 }),
          deliveryTimestamp: fc.date({ min: new Date('2025-01-01'), max: new Date('2025-12-31') }),
        }),
        async (data) => {
          // Create a test email message
          await emailMessageRepository.create({
            threadId: testThreadId,
            messageId: data.messageId,
            fromAddress: '81901234567891@me.faxi.jp',
            toAddresses: ['recipient@example.com'],
            subject: data.subject,
            body: data.body,
            direction: 'outbound',
            sentAt: new Date(),
          });

          // Handle delivery notification
          await emailDeliveryTracker.handleDelivery(data.messageId, data.deliveryTimestamp);

          // Verify audit log entry was created
          const logs = await auditLogRepository.findByEventType('email.delivered', 10);
          
          // Find the log entry for this specific message
          const logEntry = logs.find(log => 
            log.eventData && 
            typeof log.eventData === 'object' && 
            'messageId' in log.eventData &&
            log.eventData.messageId === data.messageId
          );

          expect(logEntry).toBeDefined();
          expect(logEntry?.eventType).toBe('email.delivered');
          expect(logEntry?.eventData).toHaveProperty('messageId', data.messageId);
          expect(logEntry?.eventData).toHaveProperty('status', 'delivered');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 26: Delivery event logging
   * For any bounce event, the system should create an audit log entry
   * Validates: Requirements 10.7
   */
  it('should log bounce events in audit log', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          messageId: fc.uuid().map(id => `msg-log-bounce-${id}`),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 500 }),
          bounceType: fc.constantFrom('Permanent', 'Transient'),
          bounceReason: fc.constantFrom(
            'Mailbox does not exist',
            'Mailbox full',
            'Message too large'
          ),
          bouncedRecipients: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 2 }),
        }),
        async (data) => {
          // Create a test email message
          await emailMessageRepository.create({
            threadId: testThreadId,
            messageId: data.messageId,
            fromAddress: '81901234567891@me.faxi.jp',
            toAddresses: data.bouncedRecipients,
            subject: data.subject,
            body: data.body,
            direction: 'outbound',
            sentAt: new Date(),
          });

          // Handle bounce notification
          await emailDeliveryTracker.handleBounce(
            data.messageId,
            data.bounceType as 'Permanent' | 'Transient',
            data.bounceReason,
            data.bouncedRecipients
          );

          // Verify audit log entry was created
          const logs = await auditLogRepository.findByUserId(testUserId, 100);
          
          // Find the log entry for this specific bounce
          const logEntry = logs.find(log => 
            log.eventType === 'email.bounced' &&
            log.eventData && 
            typeof log.eventData === 'object' && 
            'messageId' in log.eventData &&
            log.eventData.messageId === data.messageId
          );

          expect(logEntry).toBeDefined();
          expect(logEntry?.eventType).toBe('email.bounced');
          expect(logEntry?.eventData).toHaveProperty('messageId', data.messageId);
          expect(logEntry?.eventData).toHaveProperty('bounceType', data.bounceType);
          expect(logEntry?.eventData).toHaveProperty('reason', data.bounceReason);
        }
      ),
      { numRuns: 10 } // Reduced because each bounce generates a fax
    );
  }, 120000); // 2 minute timeout

  /**
   * Property 26: Delivery event logging
   * For any complaint event, the system should create an audit log entry
   * Validates: Requirements 10.7
   */
  it('should log complaint events in audit log', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          messageId: fc.uuid().map(id => `msg-log-complaint-${id}`),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          body: fc.string({ minLength: 1, maxLength: 500 }),
          complaintType: fc.constantFrom('abuse', 'fraud', 'virus'),
          complainedRecipients: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 2 }),
        }),
        async (data) => {
          // Create a test email message
          await emailMessageRepository.create({
            threadId: testThreadId,
            messageId: data.messageId,
            fromAddress: '81901234567891@me.faxi.jp',
            toAddresses: data.complainedRecipients,
            subject: data.subject,
            body: data.body,
            direction: 'outbound',
            sentAt: new Date(),
          });

          // Handle complaint notification
          await emailDeliveryTracker.handleComplaint(
            data.messageId,
            data.complaintType,
            data.complainedRecipients
          );

          // Verify audit log entry was created
          const logs = await auditLogRepository.findByUserId(testUserId, 100);
          
          // Find the log entry for this specific complaint
          const logEntry = logs.find(log => 
            log.eventType === 'email.complained' &&
            log.eventData && 
            typeof log.eventData === 'object' && 
            'messageId' in log.eventData &&
            log.eventData.messageId === data.messageId
          );

          expect(logEntry).toBeDefined();
          expect(logEntry?.eventType).toBe('email.complained');
          expect(logEntry?.eventData).toHaveProperty('messageId', data.messageId);
          expect(logEntry?.eventData).toHaveProperty('complaintType', data.complaintType);
        }
      ),
      { numRuns: 50 }
    );
  });
});
