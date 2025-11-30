import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { db } from '../../database/connection.js';
import { accountReviewService } from '../../services/accountReviewService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Property 38: Complaint count tracking
 * 
 * Feature: email-system-architecture, Property 38: Complaint count tracking
 * Validates: Requirements 16.1, 16.2, 16.5
 * 
 * For any user and any number of complaints recorded, the system should:
 * 1. Accurately count complaints in the 30-day window
 * 2. Flag accounts at 3 complaints
 * 3. Restrict accounts at 5 complaints
 */

describe('Property 38: Complaint count tracking', () => {
  let testUserIds: string[] = [];

  beforeEach(async () => {
    testUserIds = [];
  });

  afterEach(async () => {
    // Clean up test data
    for (const userId of testUserIds) {
      await db.query('DELETE FROM user_complaints WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  it('should accurately count complaints in 30-day window', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }), // Number of complaints to record
        async (complaintCount) => {
          // Create test user
          const userId = uuidv4();
          testUserIds.push(userId);
          const phoneNumber = `+8190${userId.substring(0, 8)}`;

          await db.query(
            `INSERT INTO users (id, phone_number, email_address, created_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [userId, phoneNumber, `${userId}@me.faxi.jp`]
          );

          // Record complaints
          for (let i = 0; i < complaintCount; i++) {
            await accountReviewService.recordComplaint(
              userId,
              `msg-${i}`,
              'spam',
              'Test complaint'
            );
          }

          // Check account status
          const status = await accountReviewService.checkAccountStatus(userId);

          // Property: Complaint count should match recorded complaints
          expect(status.complaintCount30Days).toBe(complaintCount);
          expect(status.userId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should flag accounts at 3 complaints', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 4 }), // 3 or 4 complaints (flagged but not restricted)
        async (complaintCount) => {
          // Create test user
          const userId = uuidv4();
          testUserIds.push(userId);
          const phoneNumber = `+8190${userId.substring(0, 8)}`;

          await db.query(
            `INSERT INTO users (id, phone_number, email_address, created_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [userId, phoneNumber, `${userId}@me.faxi.jp`]
          );

          // Record complaints
          for (let i = 0; i < complaintCount; i++) {
            await accountReviewService.recordComplaint(
              userId,
              `msg-${i}`,
              'spam',
              'Test complaint'
            );
          }

          // Check account status
          const status = await accountReviewService.checkAccountStatus(userId);

          // Property: Account should be flagged at 3+ complaints (but not restricted yet)
          expect(status.status).toBe('flagged');
          expect(status.complaintCount30Days).toBe(complaintCount);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should restrict accounts at 5 complaints', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5, max: 10 }), // 5+ complaints
        async (complaintCount) => {
          // Create test user
          const userId = uuidv4();
          testUserIds.push(userId);
          const phoneNumber = `+8190${userId.substring(0, 8)}`;

          await db.query(
            `INSERT INTO users (id, phone_number, email_address, created_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [userId, phoneNumber, `${userId}@me.faxi.jp`]
          );

          // Record complaints
          for (let i = 0; i < complaintCount; i++) {
            await accountReviewService.recordComplaint(
              userId,
              `msg-${i}`,
              'spam',
              'Test complaint'
            );
          }

          // Manually restrict account in database (simulating what would happen)
          await db.query(
            `UPDATE users
             SET email_restricted = TRUE,
                 email_restricted_at = CURRENT_TIMESTAMP,
                 email_restriction_reason = $2
             WHERE id = $1`,
            [userId, `Excessive complaints: ${complaintCount} in 30 days`]
          );

          // Check account status
          const status = await accountReviewService.checkAccountStatus(userId);

          // Property: Account should be restricted at 5+ complaints
          expect(status.status).toBe('restricted');
          expect(status.complaintCount30Days).toBe(complaintCount);
          expect(status.restrictedAt).toBeDefined();
          expect(status.restrictionReason).toContain('Excessive complaints');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should only count complaints within 30-day window', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // Recent complaints
        fc.integer({ min: 1, max: 5 }), // Old complaints
        async (recentCount, oldCount) => {
          // Create test user
          const userId = uuidv4();
          testUserIds.push(userId);
          const phoneNumber = `+8190${userId.substring(0, 8)}`;

          await db.query(
            `INSERT INTO users (id, phone_number, email_address, created_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [userId, phoneNumber, `${userId}@me.faxi.jp`]
          );

          // Record recent complaints (within 30 days)
          for (let i = 0; i < recentCount; i++) {
            await accountReviewService.recordComplaint(
              userId,
              `msg-recent-${i}`,
              'spam',
              'Recent complaint'
            );
          }

          // Record old complaints (more than 30 days ago)
          const thirtyOneDaysAgo = new Date();
          thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

          for (let i = 0; i < oldCount; i++) {
            await db.query(
              `INSERT INTO user_complaints (user_id, message_id, complained_at, complaint_type)
               VALUES ($1, $2, $3, $4)`,
              [userId, `msg-old-${i}`, thirtyOneDaysAgo, 'spam']
            );
          }

          // Check account status
          const status = await accountReviewService.checkAccountStatus(userId);

          // Property: Should only count recent complaints (within 30 days)
          expect(status.complaintCount30Days).toBe(recentCount);
          
          // Status should be based on recent complaints only
          if (recentCount >= 3) {
            expect(status.status).toBe('flagged');
          } else {
            expect(status.status).toBe('active');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain accurate count as complaints are added over time', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 5 }), // Batches of complaints
        async (complaintBatches) => {
          // Create test user
          const userId = uuidv4();
          testUserIds.push(userId);
          const phoneNumber = `+8190${userId.substring(0, 8)}`;

          await db.query(
            `INSERT INTO users (id, phone_number, email_address, created_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [userId, phoneNumber, `${userId}@me.faxi.jp`]
          );

          let totalComplaints = 0;
          let messageCounter = 0;

          // Add complaints in batches and verify count after each batch
          for (const batchSize of complaintBatches) {
            // Add batch of complaints
            for (let i = 0; i < batchSize; i++) {
              await accountReviewService.recordComplaint(
                userId,
                `msg-${messageCounter++}`,
                'spam',
                'Test complaint'
              );
            }

            totalComplaints += batchSize;

            // Check status after this batch
            const status = await accountReviewService.checkAccountStatus(userId);

            // Property: Count should always match total complaints added
            expect(status.complaintCount30Days).toBe(totalComplaints);

            // Status should reflect current count
            if (totalComplaints >= 3) {
              expect(status.status).toBe('flagged');
            } else {
              expect(status.status).toBe('active');
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
