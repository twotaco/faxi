/**
 * Property-based tests for welcome fax content completeness
 * Feature: email-system-architecture, Property 3: Welcome fax content completeness
 * 
 * Tests that welcome faxes include all required information: email address,
 * sending instructions, receiving instructions, and example formats.
 * 
 * Validates: Requirements 1.5, 2.2, 2.3, 2.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { WelcomeFaxGenerator, WelcomeFaxData } from '../../services/welcomeFaxGenerator.js';

// Use dynamic import for pdf-parse
const { PDFParse } = require('pdf-parse');
const pdfParse = PDFParse;

describe('**Feature: email-system-architecture, Property 3: Welcome fax content completeness**', () => {
  /**
   * Property 3: Welcome fax content completeness
   * For any welcome fax, it should include the user's email address, sending instructions,
   * receiving instructions, and example formats
   * Validates: Requirements 1.5, 2.2, 2.3, 2.4
   */
  it('should include email address, sending instructions, receiving instructions, and examples in all welcome faxes', async () => {
    // Custom generator for phone numbers (digits only)
    const phoneNumberArb = fc.string({ minLength: 10, maxLength: 15 })
      .map(s => s.replace(/\D/g, ''))
      .filter(s => s.length >= 10);

    // Custom generator for email addresses based on phone numbers
    const welcomeFaxDataArb = phoneNumberArb.map(phoneNumber => ({
      phoneNumber,
      emailAddress: `${phoneNumber}@me.faxi.jp`,
      userName: fc.sample(fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }), 1)[0]
    }));

    await fc.assert(
      fc.asyncProperty(
        welcomeFaxDataArb,
        async (data: WelcomeFaxData) => {
          // Generate welcome fax PDF
          const pdfBuffer = await WelcomeFaxGenerator.generateWelcomeFax(data);

          // Parse PDF to extract text content
          const pdfData = await pdfParse(pdfBuffer);
          const text = pdfData.text;

          // Requirement 1.5 & 2.2: Email address should be prominently displayed
          expect(text).toContain(data.emailAddress);
          expect(text).toContain('YOUR DEDICATED EMAIL ADDRESS');

          // Requirement 2.2: Instructions for sending emails via fax
          // Should contain information about how to send emails
          const hasSendingInstructions = 
            text.includes('SEND EMAIL') || 
            text.includes('Send email to') ||
            text.includes('send email');
          expect(hasSendingInstructions).toBe(true);

          // Requirement 2.3: Instructions for receiving emails via fax
          // Should mention that emails sent to the address will be faxed
          const hasReceivingInstructions = 
            text.includes('send emails to this address') ||
            text.includes('fax them to you') ||
            text.includes('receive email');
          expect(hasReceivingInstructions).toBe(true);

          // Requirement 2.4: Example email request formats
          // Should contain at least one example showing the format
          const hasExampleFormats = 
            text.includes('example.com') ||
            text.includes('Send email to') ||
            text.includes('EXAMPLE');
          expect(hasExampleFormats).toBe(true);

          // Additional verification: Should contain "FAXI" branding
          expect(text).toContain('FAXI');
          expect(text).toContain('Faxi');

          // Should contain welcome message
          const hasWelcomeMessage = 
            text.includes('WELCOME') || 
            text.includes('Welcome') ||
            text.includes('Thank you');
          expect(hasWelcomeMessage).toBe(true);
        }
      ),
      { numRuns: 3 }
    );
  }, 180000); // 3 minute timeout
});
