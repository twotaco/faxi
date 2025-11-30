import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { blocklistService } from '../../services/blocklistService';
import { db } from '../../database/connection';

/**
 * Property 36: Blocklist enforcement
 * 
 * For any inbound email from a blocked sender, the system should reject 
 * the email without converting to fax
 * 
 * Validates: Requirements 15.2, 15.3
 */

describe('Property 36: Blocklist enforcement', () => {
  let testUserIds: string[] = [];
  let testCounter = 0;

  beforeEach(async () => {
    // Clean up test data
    await db.query(`DELETE FROM email_blocklist WHERE user_id IN (
      SELECT id FROM users WHERE phone_number LIKE 'BL%'
    )`);
    await db.query(`DELETE FROM users WHERE phone_number LIKE 'BL%'`);
    testCounter = 0;
  });

  afterEach(async () => {
    // Clean up test users
    if (testUserIds.length > 0) {
      await db.query(
        `DELETE FROM email_blocklist WHERE user_id = ANY($1)`,
        [testUserIds]
      );
      await db.query(
        `DELETE FROM users WHERE id = ANY($1)`,
        [testUserIds]
      );
    }
    testUserIds = [];
  });

  it('should reject emails from blocked senders', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.emailAddress(),
        async (blockedEmail, allowedEmail) => {
          // Skip if emails are the same
          if (blockedEmail.toLowerCase() === allowedEmail.toLowerCase()) {
            return true;
          }

          // Create test user with unique phone number
          const phoneNumber = `BL${Date.now().toString().slice(-5)}${testCounter++}`;
          const userResult = await db.query(
            `INSERT INTO users (phone_number, email_address, created_at)
             VALUES ($1, $2, NOW())
             RETURNING id`,
            [phoneNumber, `${phoneNumber}@me.faxi.jp`]
          );
          const userId = userResult.rows[0].id;
          testUserIds.push(userId);

          // Block the sender
          await blocklistService.blockSender(userId, blockedEmail);

          // Check that blocked email is blocked
          const isBlockedResult = await blocklistService.isBlocked(userId, blockedEmail);
          expect(isBlockedResult).toBe(true);

          // Check that allowed email is not blocked
          const isAllowedResult = await blocklistService.isBlocked(userId, allowedEmail);
          expect(isAllowedResult).toBe(false);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject emails from blocked senders regardless of case', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        async (email) => {
          // Create test user with unique phone number
          const phoneNumber = `BL${Date.now().toString().slice(-5)}${testCounter++}`;
          const userResult = await db.query(
            `INSERT INTO users (phone_number, email_address, created_at)
             VALUES ($1, $2, NOW())
             RETURNING id`,
            [phoneNumber, `${phoneNumber}@me.faxi.jp`]
          );
          const userId = userResult.rows[0].id;
          testUserIds.push(userId);

          // Block the sender in lowercase
          await blocklistService.blockSender(userId, email.toLowerCase());

          // Check various case variations
          const variations = [
            email.toLowerCase(),
            email.toUpperCase(),
            email,
          ];

          for (const variation of variations) {
            const isBlocked = await blocklistService.isBlocked(userId, variation);
            expect(isBlocked).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should allow emails after unblocking', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        async (email) => {
          // Create test user with unique phone number
          const phoneNumber = `BL${Date.now().toString().slice(-5)}${testCounter++}`;
          const userResult = await db.query(
            `INSERT INTO users (phone_number, email_address, created_at)
             VALUES ($1, $2, NOW())
             RETURNING id`,
            [phoneNumber, `${phoneNumber}@me.faxi.jp`]
          );
          const userId = userResult.rows[0].id;
          testUserIds.push(userId);

          // Block then unblock
          await blocklistService.blockSender(userId, email);
          const isBlockedBefore = await blocklistService.isBlocked(userId, email);
          expect(isBlockedBefore).toBe(true);

          await blocklistService.unblockSender(userId, email);
          const isBlockedAfter = await blocklistService.isBlocked(userId, email);
          expect(isBlockedAfter).toBe(false);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain separate blocklists per user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        async (email) => {
          // Create two test users with unique phone numbers
          const phoneNumber1 = `BL${Date.now().toString().slice(-5)}${testCounter++}`;
          const phoneNumber2 = `BL${Date.now().toString().slice(-5)}${testCounter++}`;
          
          const user1Result = await db.query(
            `INSERT INTO users (phone_number, email_address, created_at)
             VALUES ($1, $2, NOW())
             RETURNING id`,
            [phoneNumber1, `${phoneNumber1}@me.faxi.jp`]
          );
          const userId1 = user1Result.rows[0].id;
          testUserIds.push(userId1);

          const user2Result = await db.query(
            `INSERT INTO users (phone_number, email_address, created_at)
             VALUES ($1, $2, NOW())
             RETURNING id`,
            [phoneNumber2, `${phoneNumber2}@me.faxi.jp`]
          );
          const userId2 = user2Result.rows[0].id;
          testUserIds.push(userId2);

          // Block email for user1 only
          await blocklistService.blockSender(userId1, email);

          // Check that it's blocked for user1 but not user2
          const isBlockedUser1 = await blocklistService.isBlocked(userId1, email);
          const isBlockedUser2 = await blocklistService.isBlocked(userId2, email);

          expect(isBlockedUser1).toBe(true);
          expect(isBlockedUser2).toBe(false);

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });
});
