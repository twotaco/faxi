import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { extractPhoneFromEmail, isFaxiUserEmail, generateFaxiEmail } from '../../config/email';

/**
 * Property 5: Email address parsing and validation
 * Feature: email-system-architecture, Property 5: Email address parsing and validation
 * Validates: Requirements 3.2, 3.3, 11.4, 11.5
 * 
 * For any email address string, the system should correctly extract the phone number if valid,
 * or reject if invalid according to pattern ^\d+@me\.faxi\.jp$
 */

describe('Property 5: Email Address Parsing and Validation', () => {
  /**
   * Property: Valid Faxi email addresses should be recognized
   */
  it('should recognize valid Faxi email addresses', () => {
    fc.assert(
      fc.property(
        // Generate valid phone numbers (digits only)
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 8, maxLength: 15 }).map(arr => arr.join('')),
        (phoneNumber) => {
          const email = `${phoneNumber}@me.faxi.jp`;
          
          // Should be recognized as valid Faxi email
          expect(isFaxiUserEmail(email)).toBe(true);
          
          // Should extract the phone number correctly
          const extracted = extractPhoneFromEmail(email);
          expect(extracted).toBe(phoneNumber);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid email addresses should be rejected
   */
  it('should reject invalid email addresses', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Wrong domain
          fc.tuple(
            fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 8, maxLength: 15 }).map(arr => arr.join('')),
            fc.oneof(
              fc.constant('@gmail.com'),
              fc.constant('@yahoo.com'),
              fc.constant('@faxi.jp'),
              fc.constant('@example.com')
            )
          ).map(([phone, domain]) => phone + domain),
          
          // Non-digit local part
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => /[^\d]/.test(s)),
            fc.constant('@me.faxi.jp')
          ).map(([local, domain]) => local + domain),
          
          // Empty local part
          fc.constant('@me.faxi.jp'),
          
          // No @ symbol
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => !s.includes('@')),
          
          // Multiple @ symbols
          fc.constant('123@456@me.faxi.jp'),
          
          // Special characters in local part
          fc.tuple(
            fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 5, maxLength: 10 }).map(arr => arr.join('')),
            fc.oneof(fc.constant('+'), fc.constant('-'), fc.constant('_'), fc.constant('.')),
            fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 5, maxLength: 10 }).map(arr => arr.join(''))
          ).map(([prefix, special, suffix]) => `${prefix}${special}${suffix}@me.faxi.jp`)
        ),
        (invalidEmail) => {
          // Should not be recognized as valid Faxi email
          expect(isFaxiUserEmail(invalidEmail)).toBe(false);
          
          // Should not extract a phone number
          const extracted = extractPhoneFromEmail(invalidEmail);
          expect(extracted).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Round-trip conversion (phone -> email -> phone)
   */
  it('should maintain phone number through round-trip conversion', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 8, maxLength: 15 }).map(arr => arr.join('')),
        (phoneNumber) => {
          // Generate email from phone
          const email = generateFaxiEmail(phoneNumber);
          
          // Extract phone from email
          const extracted = extractPhoneFromEmail(email);
          
          // Should get back the original phone number
          expect(extracted).toBe(phoneNumber);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: generateFaxiEmail should clean non-digit characters
   */
  it('should clean non-digit characters when generating email', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 8, maxLength: 15 }).map(arr => arr.join('')),
          fc.array(fc.oneof(fc.constant('+'), fc.constant('-'), fc.constant(' '), fc.constant('('), fc.constant(')')), { maxLength: 5 })
        ),
        ([digits, nonDigits]) => {
          // Create a phone number with non-digit characters interspersed
          const phoneWithNonDigits = digits.split('').map((d, i) => 
            i < nonDigits.length ? d + nonDigits[i] : d
          ).join('');
          
          // Generate email
          const email = generateFaxiEmail(phoneWithNonDigits);
          
          // Should only contain the digits
          expect(email).toBe(`${digits}@me.faxi.jp`);
          
          // Should be valid
          expect(isFaxiUserEmail(email)).toBe(true);
          
          // Should extract the clean digits
          const extracted = extractPhoneFromEmail(email);
          expect(extracted).toBe(digits);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Email validation should be case-sensitive for domain
   */
  it('should be case-sensitive for domain validation', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 8, maxLength: 15 }).map(arr => arr.join('')),
        (phoneNumber) => {
          // Valid lowercase domain
          const validEmail = `${phoneNumber}@me.faxi.jp`;
          expect(isFaxiUserEmail(validEmail)).toBe(true);
          
          // Invalid uppercase/mixed case domains
          const invalidEmails = [
            `${phoneNumber}@ME.FAXI.JP`,
            `${phoneNumber}@Me.Faxi.Jp`,
            `${phoneNumber}@me.FAXI.jp`,
            `${phoneNumber}@ME.faxi.jp`
          ];
          
          invalidEmails.forEach(email => {
            expect(isFaxiUserEmail(email)).toBe(false);
            expect(extractPhoneFromEmail(email)).toBeNull();
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Empty or very short phone numbers should still be valid if they're digits
   */
  it('should handle edge cases for phone number length', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Single digit
          fc.integer({ min: 0, max: 9 }).map(n => n.toString()),
          // Two digits
          fc.tuple(
            fc.integer({ min: 0, max: 9 }),
            fc.integer({ min: 0, max: 9 })
          ).map(([a, b]) => `${a}${b}`),
          // Very long (but still valid)
          fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 20, maxLength: 30 }).map(arr => arr.join(''))
        ),
        (phoneNumber) => {
          const email = `${phoneNumber}@me.faxi.jp`;
          
          // Should be valid as long as it's all digits
          expect(isFaxiUserEmail(email)).toBe(true);
          expect(extractPhoneFromEmail(email)).toBe(phoneNumber);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Leading zeros should be preserved
   */
  it('should preserve leading zeros in phone numbers', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: 1, max: 5 }).map(n => '0'.repeat(n)), // Leading zeros
          fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 5, maxLength: 10 }).map(arr => arr.join(''))
        ),
        ([leadingZeros, restOfNumber]) => {
          const phoneNumber = leadingZeros + restOfNumber;
          const email = generateFaxiEmail(phoneNumber);
          
          // Should preserve leading zeros
          const extracted = extractPhoneFromEmail(email);
          expect(extracted).toBe(phoneNumber);
          expect(extracted?.startsWith('0')).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});
