import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { blocklistService } from '../../services/blocklistService';
import { db } from '../../database/connection';

/**
 * Property 37: Blocklist case-insensitive matching
 * 
 * For any email address check against blocklist, the system should perform 
 * case-insensitive matching
 * 
 * Validates: Requirements 15.6, 15.7
 */

describe('Property 37: Blocklist case-insensitive matching', () => {
  let testUserIds: string[] = [];
  let testCounter = 0;

  beforeEach(async () => {
    // Clean up test data
    await db.query(`DELETE FROM email_blocklist WHERE user_id IN (
      SELECT id FROM users WHERE phone_number LIKE 'CI%'
    )`);
    await db.query(`DELETE FROM users WHERE phone_number LIKE 'CI%'`);
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

  it('should match blocked emails case-insensitively when blocking in lowercase', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        async (email) => {
          // Create test user
          const phoneNumber = `CI${Date.now().toString().slice(-5)}${testCounter++}`;
          const userResult = await db.query(
            `INSERT INTO users (phone_number, email_address, created_at)
             VALUES ($1, $2, NOW())
             RETURNING id`,
            [phoneNumber, `${phoneNumber}@me.faxi.jp`]
          );
          const userId = userResult.rows[0].id;
          testUserIds.push(userId);

          // Block in lowercase
          await blocklistService.blockSender(userId, email.toLowerCase());

          // Check all case variations are blocked
          const variations = [
            email.toLowerCase(),
            email.toUpperCase(),
            email,
            // Mixed case variations
            email.split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join('')
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

  it('should match blocked emails case-insensitively when blocking in uppercase', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        async (email) => {
          // Create test user
          const phoneNumber = `CI${Date.now().toString().slice(-5)}${testCounter++}`;
          const userResult = await db.query(
            `INSERT INTO users (phone_number, email_address, created_at)
             VALUES ($1, $2, NOW())
             RETURNING id`,
            [phoneNumber, `${phoneNumber}@me.faxi.jp`]
          );
          const userId = userResult.rows[0].id;
          testUserIds.push(userId);

          // Block in uppercase
          await blocklistService.blockSender(userId, email.toUpperCase());

          // Check all case variations are blocked
          const variations = [
            email.toLowerCase(),
            email.toUpperCase(),
            email
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

  it('should match blocked emails case-insensitively when blocking in mixed case', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        async (email) => {
          // Create test user
          const phoneNumber = `CI${Date.now().toString().slice(-5)}${testCounter++}`;
          const userResult = await db.query(
            `INSERT INTO users (phone_number, email_address, created_at)
             VALUES ($1, $2, NOW())
             RETURNING id`,
            [phoneNumber, `${phoneNumber}@me.faxi.jp`]
          );
          const userId = userResult.rows[0].id;
          testUserIds.push(userId);

          // Block in mixed case
          const mixedCase = email.split('').map((c, i) => 
            i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()
          ).join('');
          await blocklistService.blockSender(userId, mixedCase);

          // Check all case variations are blocked
          const variations = [
            email.toLowerCase(),
            email.toUpperCase(),
            email,
            mixedCase
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

  it('should unblock emails case-insensitively', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        async (email) => {
          // Create test user
          const phoneNumber = `CI${Date.now().toString().slice(-5)}${testCounter++}`;
          const userResult = await db.query(
            `INSERT INTO users (phone_number, email_address, created_at)
             VALUES ($1, $2, NOW())
             RETURNING id`,
            [phoneNumber, `${phoneNumber}@me.faxi.jp`]
          );
          const userId = userResult.rows[0].id;
          testUserIds.push(userId);

          // Block in lowercase
          await blocklistService.blockSender(userId, email.toLowerCase());
          
          // Verify it's blocked
          expect(await blocklistService.isBlocked(userId, email)).toBe(true);

          // Unblock in uppercase
          await blocklistService.unblockSender(userId, email.toUpperCase());

          // Verify it's unblocked for all case variations
          const variations = [
            email.toLowerCase(),
            email.toUpperCase(),
            email
          ];

          for (const variation of variations) {
            const isBlocked = await blocklistService.isBlocked(userId, variation);
            expect(isBlocked).toBe(false);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
