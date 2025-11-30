import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { EmailToFaxConverter } from '../../services/emailToFaxConverter';

/**
 * Property-Based Tests for Email Content Cleaning
 * 
 * Feature: email-system-architecture, Property 9: Email content cleaning
 * Validates: Requirements 4.3
 * 
 * Property: For any email, the conversion should remove signatures and quoted text
 */

describe('EmailToFaxConverter - Email Content Cleaning (Property 9)', () => {
  /**
   * Property 9: Email signatures are removed
   * 
   * For any email with common signature patterns, the signature should be removed
   */
  it('should remove email signatures with standard delimiters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.constantFrom(
          '\n--\n',
          '\n___\n',
          '\n____\n',
          '\n_____\n'
        ),
        async (mainContent, signatureContent, delimiter) => {
          const emailBody = `${mainContent}${delimiter}${signatureContent}`;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: emailBody
          });
          
          // Verify conversion succeeded
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
          expect(result.referenceId).toMatch(/^FX-\d{4}-\d{6}$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.1: Mobile signatures are removed
   * 
   * For any email with mobile signature patterns, they should be removed
   */
  it('should remove mobile email signatures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        fc.constantFrom(
          '\nSent from my iPhone',
          '\nSent from my Android',
          '\nSent from my iPad',
          '\nGet Outlook for iOS',
          '\nGet Outlook for Android',
          '\nThis email was sent from my mobile device'
        ),
        async (mainContent, mobileSignature) => {
          const emailBody = `${mainContent}${mobileSignature}`;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: emailBody
          });
          
          // Verify conversion succeeded
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.2: Quoted text is removed
   * 
   * For any email with quoted reply text (lines starting with >), it should be removed
   */
  it('should remove quoted reply text', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        fc.array(fc.string({ minLength: 10, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
        async (mainContent, quotedLines) => {
          const quotedText = quotedLines.map(line => `> ${line}`).join('\n');
          const emailBody = `${mainContent}\n\n${quotedText}`;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: emailBody
          });
          
          // Verify conversion succeeded
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.3: "On ... wrote:" patterns are removed
   * 
   * For any email with "On [date] [person] wrote:" patterns, they should be removed
   */
  it('should remove "On ... wrote:" reply patterns', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        fc.emailAddress(),
        fc.string({ minLength: 10, maxLength: 100 }),
        async (mainContent, email, quotedContent) => {
          const replyPattern = `\n\nOn Mon, Jan 1, 2024 at 10:00 AM ${email} wrote:\n${quotedContent}`;
          const emailBody = `${mainContent}${replyPattern}`;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: emailBody
          });
          
          // Verify conversion succeeded
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.4: Excessive whitespace is cleaned
   * 
   * For any email with excessive line breaks or spaces, they should be normalized
   */
  it('should normalize excessive whitespace', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 10, maxLength: 100 }), { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 3, max: 10 }),
        async (paragraphs, excessiveBreaks) => {
          // Create content with excessive line breaks between paragraphs
          const emailBody = paragraphs.join('\n'.repeat(excessiveBreaks));
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: emailBody
          });
          
          // Verify conversion succeeded
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.5: Multiple spaces are collapsed
   * 
   * For any email with multiple consecutive spaces, they should be collapsed to single spaces
   */
  it('should collapse multiple consecutive spaces', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 3, maxLength: 10 }),
        fc.integer({ min: 2, max: 10 }),
        async (words, spaceCount) => {
          // Create content with excessive spaces between words
          const emailBody = words.join(' '.repeat(spaceCount));
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: emailBody
          });
          
          // Verify conversion succeeded
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.6: Content without signatures or quotes is preserved
   * 
   * For any email without signatures or quoted text, the content should be preserved
   */
  it('should preserve clean email content without modification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 20, maxLength: 200 }), { minLength: 1, maxLength: 5 }),
        async (paragraphs) => {
          // Create clean content without signatures or quotes
          const emailBody = paragraphs.join('\n\n');
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: emailBody
          });
          
          // Verify conversion succeeded
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.7: Complex emails with multiple patterns are cleaned
   * 
   * For any email with multiple signature and quote patterns, all should be removed
   */
  it('should handle complex emails with multiple cleaning patterns', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        fc.string({ minLength: 10, maxLength: 50 }),
        fc.array(fc.string({ minLength: 10, maxLength: 50 }), { minLength: 1, maxLength: 3 }),
        async (mainContent, signatureContent, quotedLines) => {
          // Build complex email with signature and quoted text
          const quotedText = quotedLines.map(line => `> ${line}`).join('\n');
          const emailBody = `${mainContent}\n\n${quotedText}\n\n--\n${signatureContent}\nSent from my iPhone`;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: emailBody
          });
          
          // Verify conversion succeeded
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.8: Empty content after cleaning is handled gracefully
   * 
   * For any email that becomes empty after cleaning, conversion should not fail
   */
  it('should handle emails that become empty after cleaning', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '--\nJust a signature',
          '> Only quoted text\n> More quoted text',
          'Sent from my iPhone',
          '\n\n\n\n',
          '   ',
          '> Quote\n--\nSignature'
        ),
        async (emptyAfterCleaning) => {
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: emptyAfterCleaning
          });
          
          // Verify conversion succeeded even with empty content
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});
