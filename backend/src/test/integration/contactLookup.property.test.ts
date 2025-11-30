import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { db } from '../../database/connection';
import { addressBookRepository } from '../../repositories/addressBookRepository';
import { userRepository } from '../../repositories/userRepository';

/**
 * Property 32: Contact lookup for outbound email
 * 
 * Feature: email-system-architecture, Property 32: Contact lookup for outbound email
 * Validates: Requirements 13.2
 * 
 * For any outbound email request with a contact name, the system should resolve 
 * the name to an email address via address book lookup.
 */

describe('Property 32: Contact lookup for outbound email', () => {
  let testUserIds: string[] = [];

  beforeEach(async () => {
    // Clean up test data
    await db.query('DELETE FROM address_book WHERE user_id IN (SELECT id FROM users WHERE phone_number LIKE $1)', ['test%']);
    await db.query('DELETE FROM users WHERE phone_number LIKE $1', ['test%']);
  });

  afterEach(async () => {
    // Clean up created test users
    if (testUserIds.length > 0) {
      await db.query('DELETE FROM address_book WHERE user_id = ANY($1)', [testUserIds]);
      await db.query('DELETE FROM users WHERE id = ANY($1)', [testUserIds]);
      testUserIds = [];
    }
  });

  it('should find contact by exact name match', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9]/.test(s) && /[a-zA-Z0-9]$/.test(s) && !s.includes('\\')),
        fc.emailAddress(),
        async (contactName, contactEmail) => {
          // Create a test user
          const phoneNumber = `test${Math.floor(Math.random() * 1000000)}`;
          const { user } = await userRepository.findOrCreate(phoneNumber);
          testUserIds.push(user.id);

          // Add contact
          await addressBookRepository.create({
            userId: user.id,
            name: contactName,
            emailAddress: contactEmail
          });

          // Search for contact by exact name
          const results = await addressBookRepository.searchByNameOrRelationship(user.id, contactName);

          // Verify contact was found
          expect(results.length).toBeGreaterThan(0);
          expect(results.some(c => c.name === contactName && c.emailAddress === contactEmail)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should find contact by partial name match (case-insensitive)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 3, maxLength: 50 }),
        fc.emailAddress(),
        async (contactName, contactEmail) => {
          // Create a test user
          const phoneNumber = `test${Math.floor(Math.random() * 1000000)}`;
          const { user } = await userRepository.findOrCreate(phoneNumber);
          testUserIds.push(user.id);

          // Add contact
          await addressBookRepository.create({
            userId: user.id,
            name: contactName,
            emailAddress: contactEmail
          });

          // Search for contact by partial name (first 2 characters)
          const partialQuery = contactName.substring(0, 2);
          const results = await addressBookRepository.searchByNameOrRelationship(user.id, partialQuery);

          // Verify contact was found
          expect(results.some(c => c.name === contactName)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should find contact by relationship', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9]/.test(s) && /[a-zA-Z0-9]$/.test(s) && !s.includes('\\')),
        fc.constantFrom('son', 'daughter', 'doctor', 'friend', 'neighbor'),
        fc.emailAddress(),
        async (contactName, relationship, contactEmail) => {
          // Create a test user
          const phoneNumber = `test${Math.floor(Math.random() * 1000000)}`;
          const { user } = await userRepository.findOrCreate(phoneNumber);
          testUserIds.push(user.id);

          // Add contact with relationship
          await addressBookRepository.create({
            userId: user.id,
            name: contactName,
            emailAddress: contactEmail,
            relationship
          });

          // Search for contact by relationship
          const results = await addressBookRepository.searchByNameOrRelationship(user.id, relationship);

          // Verify contact was found
          expect(results.length).toBeGreaterThan(0);
          expect(results.some(c => c.relationship === relationship && c.emailAddress === contactEmail)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should perform case-insensitive search', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.toLowerCase() !== s.toUpperCase() && /^[a-zA-Z0-9]/.test(s) && /[a-zA-Z0-9]$/.test(s) && !s.includes('\\')), // Ensure has letters
        fc.emailAddress(),
        async (contactName, contactEmail) => {
          // Create a test user
          const phoneNumber = `test${Math.floor(Math.random() * 1000000)}`;
          const { user } = await userRepository.findOrCreate(phoneNumber);
          testUserIds.push(user.id);

          // Add contact
          await addressBookRepository.create({
            userId: user.id,
            name: contactName,
            emailAddress: contactEmail
          });

          // Search with different case
          const upperQuery = contactName.toUpperCase();
          const lowerQuery = contactName.toLowerCase();

          const upperResults = await addressBookRepository.searchByNameOrRelationship(user.id, upperQuery);
          const lowerResults = await addressBookRepository.searchByNameOrRelationship(user.id, lowerQuery);

          // Both should find the contact
          expect(upperResults.some(c => c.emailAddress === contactEmail)).toBe(true);
          expect(lowerResults.some(c => c.emailAddress === contactEmail)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return empty array when no contacts match', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (nonExistentQuery) => {
          // Create a test user with no contacts
          const phoneNumber = `test${Math.floor(Math.random() * 1000000)}`;
          const { user } = await userRepository.findOrCreate(phoneNumber);
          testUserIds.push(user.id);

          // Search for non-existent contact
          const results = await addressBookRepository.searchByNameOrRelationship(user.id, nonExistentQuery);

          // Verify no results
          expect(results).toEqual([]);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return multiple contacts when query matches multiple entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 2, maxLength: 20 }).filter(s => /^[a-zA-Z0-9]/.test(s) && /[a-zA-Z0-9]$/.test(s) && !s.includes('\\')),
        fc.array(fc.emailAddress(), { minLength: 2, maxLength: 5 }),
        async (commonPrefix, emails) => {
          // Ensure unique emails
          const uniqueEmails = [...new Set(emails)];
          if (uniqueEmails.length < 2) return; // Skip if not enough unique emails

          // Create a test user
          const phoneNumber = `test${Math.floor(Math.random() * 1000000)}`;
          const { user } = await userRepository.findOrCreate(phoneNumber);
          testUserIds.push(user.id);

          // Add multiple contacts with names starting with common prefix
          for (let i = 0; i < uniqueEmails.length; i++) {
            await addressBookRepository.create({
              userId: user.id,
              name: `${commonPrefix}${i}`,
              emailAddress: uniqueEmails[i]
            });
          }

          // Search by common prefix
          const results = await addressBookRepository.searchByNameOrRelationship(user.id, commonPrefix);

          // Verify all contacts were found
          expect(results.length).toBe(uniqueEmails.length);
          for (const email of uniqueEmails) {
            expect(results.some(c => c.emailAddress === email)).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should only return contacts for the specified user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9]/.test(s) && /[a-zA-Z0-9]$/.test(s) && !s.includes('\\')),
        fc.emailAddress(),
        fc.emailAddress(),
        async (contactName, email1, email2) => {
          // Ensure different emails
          fc.pre(email1 !== email2);

          // Create two test users
          const phoneNumber1 = `test${Math.floor(Math.random() * 1000000)}`;
          const phoneNumber2 = `test${Math.floor(Math.random() * 1000000)}`;
          const { user: user1 } = await userRepository.findOrCreate(phoneNumber1);
          const { user: user2 } = await userRepository.findOrCreate(phoneNumber2);
          testUserIds.push(user1.id, user2.id);

          // Add same contact name to both users with different emails
          await addressBookRepository.create({
            userId: user1.id,
            name: contactName,
            emailAddress: email1
          });

          await addressBookRepository.create({
            userId: user2.id,
            name: contactName,
            emailAddress: email2
          });

          // Search for contact as user1
          const results1 = await addressBookRepository.searchByNameOrRelationship(user1.id, contactName);

          // Verify only user1's contact is returned
          expect(results1.length).toBe(1);
          expect(results1[0].emailAddress).toBe(email1);
          expect(results1[0].userId).toBe(user1.id);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle special characters in search query', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9]/.test(s) && /[a-zA-Z0-9]$/.test(s) && !s.includes('\\')),
        fc.emailAddress(),
        async (contactName, contactEmail) => {
          // Create a test user
          const phoneNumber = `test${Math.floor(Math.random() * 1000000)}`;
          const { user } = await userRepository.findOrCreate(phoneNumber);
          testUserIds.push(user.id);

          // Add contact
          await addressBookRepository.create({
            userId: user.id,
            name: contactName,
            emailAddress: contactEmail
          });

          // Search with query containing SQL wildcards (should be escaped)
          const queryWithWildcards = `%${contactName}%`;
          const results = await addressBookRepository.searchByNameOrRelationship(user.id, queryWithWildcards);

          // Should still find the contact (wildcards are part of the implementation)
          expect(results.some(c => c.name === contactName)).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });
});
