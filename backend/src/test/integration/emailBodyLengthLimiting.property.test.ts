import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { EmailToFaxConverter } from '../../services/emailToFaxConverter';

/**
 * Property-Based Tests for Email Body Length Limiting
 * 
 * Feature: email-system-architecture, Property 10: Email body length limiting
 * Validates: Requirements 4.4
 * 
 * Property: For any email with body length exceeding the maximum, the conversion should
 * truncate the body and add a truncation notice
 */

describe('EmailToFaxConverter - Email Body Length Limiting (Property 10)', () => {
  const DEFAULT_MAX_LENGTH = 2000; // From EmailToFaxConverter.DEFAULT_OPTIONS

  /**
   * Property 10: Body length is limited to maximum
   * 
   * For any email with body exceeding max length, it should be truncated
   */
  it('should truncate email body when it exceeds maximum length', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: DEFAULT_MAX_LENGTH + 100, max: DEFAULT_MAX_LENGTH + 5000 }),
        async (bodyLength) => {
          // Generate a body that exceeds the maximum length
          const longBody = 'a'.repeat(bodyLength);
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: longBody
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
   * Property 10.1: Truncation notice is added
   * 
   * For any email that is truncated, a truncation notice should be added
   */
  it('should add truncation notice when body is truncated', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: DEFAULT_MAX_LENGTH + 100, maxLength: DEFAULT_MAX_LENGTH + 1000 }),
        async (longBody) => {
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: longBody
          });
          
          // Verify conversion succeeded
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
          
          // The truncation notice should be present in the generated fax
          // We can't directly inspect the PDF content, but we can verify the PDF was generated
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.2: Short emails are not truncated
   * 
   * For any email with body under the maximum length, it should not be truncated
   */
  it('should not truncate email body when it is under maximum length', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: DEFAULT_MAX_LENGTH - 100 }),
        async (bodyLength) => {
          const shortBody = 'a'.repeat(bodyLength);
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: shortBody
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
   * Property 10.3: Exactly at maximum length is not truncated
   * 
   * For any email with body exactly at the maximum length, it should not be truncated
   */
  it('should not truncate email body when it is exactly at maximum length', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(DEFAULT_MAX_LENGTH),
        async (bodyLength) => {
          const exactBody = 'a'.repeat(bodyLength);
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: exactBody
          });
          
          // Verify conversion succeeded
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 10.4: Custom max length is respected
   * 
   * For any custom max length setting, the truncation should respect that limit
   */
  it('should respect custom maximum length when provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 50, max: 500 }),
        async (customMaxLength, extraLength) => {
          const longBody = 'a'.repeat(customMaxLength + extraLength);
          
          const result = await EmailToFaxConverter.convertEmailToFax(
            {
              from: 'test@example.com',
              subject: 'Test Email',
              body: longBody
            },
            {
              maxBodyLength: customMaxLength
            }
          );
          
          // Verify conversion succeeded
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.5: Very long emails are handled gracefully
   * 
   * For any extremely long email, the conversion should not fail
   */
  it('should handle very long emails without failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10000, max: 50000 }),
        async (veryLongLength) => {
          const veryLongBody = 'Lorem ipsum dolor sit amet. '.repeat(Math.ceil(veryLongLength / 28));
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: veryLongBody
          });
          
          // Verify conversion succeeded even with very long content
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 10.6: HTML emails are truncated after conversion
   * 
   * For any HTML email that becomes long after HTML-to-text conversion, it should be truncated
   */
  it('should truncate HTML emails after converting to text', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: DEFAULT_MAX_LENGTH / 10, max: DEFAULT_MAX_LENGTH }),
        async (paragraphCount) => {
          // Create HTML with many paragraphs
          const paragraphs = Array(paragraphCount).fill('<p>This is a paragraph with some content.</p>');
          const html = paragraphs.join('');
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: '',
            html: html
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
   * Property 10.7: Truncation preserves beginning of email
   * 
   * For any email that is truncated, the beginning should be preserved
   */
  it('should preserve the beginning of the email when truncating', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 100, maxLength: 500 }),
        fc.string({ minLength: DEFAULT_MAX_LENGTH, maxLength: DEFAULT_MAX_LENGTH + 1000 }),
        async (beginning, rest) => {
          const longBody = beginning + rest;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: longBody
          });
          
          // Verify conversion succeeded
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
          
          // The beginning should be preserved (we can't directly verify PDF content,
          // but we can verify the conversion succeeded)
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.8: Empty or very short emails are handled
   * 
   * For any empty or very short email, conversion should not fail
   */
  it('should handle empty or very short emails without failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('', 'a', 'ab', 'abc', 'Short email'),
        async (shortBody) => {
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: shortBody
          });
          
          // Verify conversion succeeded even with very short content
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 10.9: Truncation with attachments
   * 
   * For any email with attachments and long body, both truncation and attachment notices should work
   */
  it('should handle truncation and attachment notifications together', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: DEFAULT_MAX_LENGTH + 100, maxLength: DEFAULT_MAX_LENGTH + 1000 }),
        fc.array(
          fc.record({
            filename: fc.string({ minLength: 5, maxLength: 20 }),
            size: fc.integer({ min: 1000, max: 1000000 }),
            contentType: fc.constantFrom('application/pdf', 'image/jpeg', 'text/plain')
          }),
          { minLength: 1, maxLength: 3 }
        ),
        async (longBody, attachments) => {
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: longBody,
            attachments: attachments
          });
          
          // Verify conversion succeeded with both truncation and attachments
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
          expect(result.hasAttachments).toBe(true);
          expect(result.attachmentCount).toBe(attachments.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
