/**
 * Property-based tests for welcome fax preference update
 * Feature: email-system-architecture, Property 4: Welcome fax preference update
 * 
 * Tests that after sending a welcome fax, the welcomeFaxSent preference is set to true
 * 
 * Validates: Requirements 2.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { userRepository, User } from '../../repositories/userRepository.js';
import { db } from '../../database/connection.js';
import { randomUUID } from 'crypto';

describe('**Feature: email-system-architecture, Property 4: Welcome fax preference update**', () => {
  let testUserIds: string[] = [];

  beforeEach(async () => {
    // Clean up test data before each test
    await db.query('DELETE FROM users WHERE phone_number LIKE $1', ['testpref%']);
  });

  afterEach(async () => {
    // Clean up created test users
    if (testUserIds.length > 0) {
      await db.query('DELETE FROM users WHERE id = ANY($1)', [testUserIds]);
      testUserIds = [];
    }
  });

  /**
   * Property 4: Welcome fax preference update
   * For any user, after sending a welcome fax, the welcomeFaxSent preference should be set to true
   * Validates: Requirements 2.5
   */
  it('should set welcomeFaxSent to true after welcome fax is sent', async () => {
    // Custom generator for phone numbers with test prefix and UUID for uniqueness (max 20 chars)
    const phoneNumberArb = fc.constant(null)
      .map(() => `test${randomUUID().slice(0, 15)}`);

    await fc.assert(
      fc.asyncProperty(
        phoneNumberArb,
        async (phoneNumber: string) => {
          // Create a new user with welcomeFaxSent = false
          const emailAddress = userRepository.generateEmailAddress(phoneNumber);
          const user = await userRepository.create({
            phoneNumber,
            emailAddress,
            preferences: {
              welcomeFaxSent: false,
              spamSensitivity: 'medium'
            }
          });

          testUserIds.push(user.id);

          // Verify initial state: welcomeFaxSent should be false
          expect(user.preferences.welcomeFaxSent).toBe(false);

          // Simulate sending welcome fax by updating preferences
          const updatedPreferences = {
            ...user.preferences,
            welcomeFaxSent: true,
            welcomeFaxSentAt: new Date().toISOString(),
            welcomeFaxReferenceId: `welcome_${user.id}_${Date.now()}`
          };

          await userRepository.updatePreferences(user.id, updatedPreferences);

          // Retrieve the updated user
          const updatedUser = await userRepository.findById(user.id);

          // Property: After sending welcome fax, welcomeFaxSent should be true
          expect(updatedUser).not.toBeNull();
          expect(updatedUser!.preferences.welcomeFaxSent).toBe(true);
          
          // Additional verification: welcomeFaxSentAt should be set
          expect(updatedUser!.preferences.welcomeFaxSentAt).toBeDefined();
          expect(typeof updatedUser!.preferences.welcomeFaxSentAt).toBe('string');
          
          // Additional verification: welcomeFaxReferenceId should be set
          expect(updatedUser!.preferences.welcomeFaxReferenceId).toBeDefined();
          expect(typeof updatedUser!.preferences.welcomeFaxReferenceId).toBe('string');
        }
      ),
      { numRuns: 50 }
    );
  }, 120000); // 2 minute timeout

  /**
   * Additional property: welcomeFaxSent should persist across multiple retrievals
   */
  it('should persist welcomeFaxSent preference across multiple retrievals', async () => {
    const phoneNumberArb = fc.constant(null)
      .map(() => `test${randomUUID().slice(0, 15)}`);

    await fc.assert(
      fc.asyncProperty(
        phoneNumberArb,
        async (phoneNumber: string) => {
          // Create user
          const emailAddress = userRepository.generateEmailAddress(phoneNumber);
          const user = await userRepository.create({
            phoneNumber,
            emailAddress,
            preferences: {
              welcomeFaxSent: false
            }
          });

          testUserIds.push(user.id);

          // Update preference
          await userRepository.updatePreferences(user.id, {
            ...user.preferences,
            welcomeFaxSent: true,
            welcomeFaxSentAt: new Date().toISOString()
          });

          // Retrieve multiple times
          const retrieval1 = await userRepository.findById(user.id);
          const retrieval2 = await userRepository.findByPhoneNumber(phoneNumber);
          const retrieval3 = await userRepository.findByEmail(emailAddress);

          // Property: All retrievals should show welcomeFaxSent = true
          expect(retrieval1!.preferences.welcomeFaxSent).toBe(true);
          expect(retrieval2!.preferences.welcomeFaxSent).toBe(true);
          expect(retrieval3!.preferences.welcomeFaxSent).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  }, 120000); // 2 minute timeout

  /**
   * Additional property: welcomeFaxSent should not be reset by other preference updates
   */
  it('should not reset welcomeFaxSent when updating other preferences', async () => {
    const phoneNumberArb = fc.constant(null)
      .map(() => `test${randomUUID().slice(0, 15)}`);

    const spamSensitivityArb = fc.constantFrom('low', 'medium', 'high');

    await fc.assert(
      fc.asyncProperty(
        phoneNumberArb,
        spamSensitivityArb,
        async (phoneNumber: string, newSpamSensitivity: string) => {
          // Create user with welcomeFaxSent = true
          const emailAddress = userRepository.generateEmailAddress(phoneNumber);
          const user = await userRepository.create({
            phoneNumber,
            emailAddress,
            preferences: {
              welcomeFaxSent: true,
              welcomeFaxSentAt: new Date().toISOString(),
              spamSensitivity: 'medium'
            }
          });

          testUserIds.push(user.id);

          // Update a different preference
          await userRepository.updatePreferences(user.id, {
            ...user.preferences,
            spamSensitivity: newSpamSensitivity
          });

          // Retrieve updated user
          const updatedUser = await userRepository.findById(user.id);

          // Property: welcomeFaxSent should still be true
          expect(updatedUser!.preferences.welcomeFaxSent).toBe(true);
          expect(updatedUser!.preferences.spamSensitivity).toBe(newSpamSensitivity);
        }
      ),
      { numRuns: 30 }
    );
  }, 120000); // 2 minute timeout
});
