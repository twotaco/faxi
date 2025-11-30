import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { db } from '../../database/connection';
import { addressBookRepository } from '../../repositories/addressBookRepository';
import { userRepository } from '../../repositories/userRepository';

/**
 * Property 31: Automatic contact registration from inbound email
 * 
 * Feature: email-system-architecture, Property 31: Automatic contact registration from inbound email
 * Validates: Requirements 13.1
 * 
 * For any inbound email from a new sender, the system should automatically create 
 * an address book entry for that sender.
 */

describe('Property 31: Automatic contact registration from inbound email', () => {
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

  it('should automatically create address book entry for new sender', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary email addresses
        fc.emailAddress(),
        // Generate arbitrary sender names (optional)
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        async (senderEmail, senderName) => {
          // Create a test user with short phone number (max 20 chars)
          const phoneNumber = `test${Math.floor(Math.random() * 1000000)}`;
          const { user } = await userRepository.findOrCreate(phoneNumber);
          testUserIds.push(user.id);

          // Check that contact doesn't exist initially
          const existingContact = await addressBookRepository.findByUserAndEmail(user.id, senderEmail);
          expect(existingContact).toBeNull();

          // Add contact from email (simulating inbound email processing)
          const contact = await addressBookRepository.addFromEmail(user.id, senderEmail, senderName);

          // Verify contact was created
          expect(contact).toBeDefined();
          expect(contact.userId).toBe(user.id);
          expect(contact.emailAddress).toBe(senderEmail);
          
          // Verify name handling
          if (senderName) {
            expect(contact.name).toBe(senderName);
          } else {
            // Should use email prefix as default name
            expect(contact.name).toBe(senderEmail.split('@')[0]);
          }

          // Verify contact can be retrieved
          const retrievedContact = await addressBookRepository.findByUserAndEmail(user.id, senderEmail);
          expect(retrievedContact).not.toBeNull();
          expect(retrievedContact?.emailAddress).toBe(senderEmail);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should update existing contact name if new name provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (senderEmail, firstName, secondName) => {
          // Ensure names are different
          fc.pre(firstName !== secondName);

          // Create a test user with short phone number (max 20 chars)
          const phoneNumber = `test${Math.floor(Math.random() * 1000000)}`;
          const { user } = await userRepository.findOrCreate(phoneNumber);
          testUserIds.push(user.id);

          // Add contact with first name
          const firstContact = await addressBookRepository.addFromEmail(user.id, senderEmail, firstName);
          expect(firstContact.name).toBe(firstName);

          // Add same contact with different name (simulating second email from same sender)
          const updatedContact = await addressBookRepository.addFromEmail(user.id, senderEmail, secondName);
          
          // Verify name was updated
          expect(updatedContact.id).toBe(firstContact.id); // Same contact
          expect(updatedContact.name).toBe(secondName); // Name updated
          expect(updatedContact.emailAddress).toBe(senderEmail); // Email unchanged
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should not create duplicate contacts for same email', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        fc.integer({ min: 2, max: 5 }),
        async (senderEmail, senderName, numAttempts) => {
          // Create a test user with short phone number (max 20 chars)
          const phoneNumber = `test${Math.floor(Math.random() * 1000000)}`;
          const { user } = await userRepository.findOrCreate(phoneNumber);
          testUserIds.push(user.id);

          // Add same contact multiple times
          const contacts = [];
          for (let i = 0; i < numAttempts; i++) {
            const contact = await addressBookRepository.addFromEmail(user.id, senderEmail, senderName);
            contacts.push(contact);
          }

          // Verify all returned contacts have the same ID (no duplicates)
          const uniqueIds = new Set(contacts.map(c => c.id));
          expect(uniqueIds.size).toBe(1);

          // Verify only one contact exists in database
          const allContacts = await addressBookRepository.findByUserId(user.id);
          const matchingContacts = allContacts.filter(c => c.emailAddress === senderEmail);
          expect(matchingContacts.length).toBe(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle contacts with special characters in email', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate emails with special characters
        fc.tuple(
          fc.array(fc.constantFrom('a', 'b', 'c', '1', '2', '.', '_', '-'), { minLength: 1, maxLength: 20 }).map(arr => arr.join('')),
          fc.constantFrom('example.com', 'test-domain.org', 'my_domain.co.jp')
        ).map(([local, domain]) => `${local}@${domain}`),
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        async (senderEmail, senderName) => {
          // Create a test user with short phone number (max 20 chars)
          const phoneNumber = `test${Math.floor(Math.random() * 1000000)}`;
          const { user } = await userRepository.findOrCreate(phoneNumber);
          testUserIds.push(user.id);

          // Add contact with special characters
          const contact = await addressBookRepository.addFromEmail(user.id, senderEmail, senderName);

          // Verify contact was created correctly
          expect(contact.emailAddress).toBe(senderEmail);
          expect(contact.userId).toBe(user.id);

          // Verify contact can be retrieved
          const retrieved = await addressBookRepository.findByUserAndEmail(user.id, senderEmail);
          expect(retrieved).not.toBeNull();
          expect(retrieved?.emailAddress).toBe(senderEmail);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve contact relationship and notes when updating name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (senderEmail, firstName, secondName) => {
          fc.pre(firstName !== secondName);

          // Create a test user with short phone number (max 20 chars)
          const phoneNumber = `test${Math.floor(Math.random() * 1000000)}`;
          const { user } = await userRepository.findOrCreate(phoneNumber);
          testUserIds.push(user.id);

          // Add contact with first name
          const firstContact = await addressBookRepository.addFromEmail(user.id, senderEmail, firstName);
          
          // Manually add relationship and notes
          const updatedWithMetadata = await addressBookRepository.update(firstContact.id, {
            relationship: 'friend',
            notes: 'Test notes'
          });

          // Add same contact with different name
          const finalContact = await addressBookRepository.addFromEmail(user.id, senderEmail, secondName);
          
          // Verify name was updated but relationship and notes preserved
          expect(finalContact.name).toBe(secondName);
          expect(finalContact.relationship).toBe('friend');
          expect(finalContact.notes).toBe('Test notes');
        }
      ),
      { numRuns: 30 }
    );
  });
});
