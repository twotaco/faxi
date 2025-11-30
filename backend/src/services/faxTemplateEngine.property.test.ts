import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { FaxTemplateEngine } from './faxTemplateEngine.js';
import {
  EmailReplyData,
  ProductSelectionData,
  PaymentBarcodeData,
  ConfirmationData,
  ClarificationData,
  FaxTemplate,
  FaxContent
} from '../types/fax.js';

/**
 * Property-Based Tests for Fax Template Engine
 * Feature: fax-template-system, Property 3: Branding consistency
 * Validates: Requirements 1.3, 11.1, 11.2, 11.3
 */

describe('FaxTemplateEngine - Property-Based Tests', () => {
  // Constants for branding validation
  const FAXI_BRANDING = 'Faxi - Your Fax to Internet Bridge';
  const SUPPORT_CONTACT = 'Support: help@faxi.jp | +81-3-1234-5678';
  const HEADER_FOOTER_FONT_SIZE = 34; // 12pt
  const STANDARD_FONT_SIZES = [34, 45, 51, 57, 68]; // 12pt, 16pt, 18pt, 20pt, 24pt

  /**
   * Helper function to check if a template has consistent branding
   */
  function hasConsistentBranding(template: FaxTemplate): {
    hasHeader: boolean;
    hasFooter: boolean;
    hasReferenceId: boolean;
    headerCorrect: boolean;
    footerCorrect: boolean;
    fontsConsistent: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    let hasHeader = false;
    let hasFooter = false;
    let hasReferenceId = false;
    let headerCorrect = false;
    let footerCorrect = false;
    let fontsConsistent = true;

    // Check all pages
    for (const page of template.pages) {
      let pageHasHeader = false;
      let pageHasFooter = false;

      for (const content of page.content) {
        // Check for header
        if (content.type === 'header') {
          pageHasHeader = true;
          hasHeader = true;
          if (content.text === FAXI_BRANDING && content.fontSize === HEADER_FOOTER_FONT_SIZE) {
            headerCorrect = true;
          } else {
            issues.push(`Header text or font size incorrect: "${content.text}" (${content.fontSize})`);
          }
        }

        // Check for footer
        if (content.type === 'footer') {
          pageHasFooter = true;
          hasFooter = true;
          if (content.text?.includes(template.referenceId) && 
              content.text?.includes(SUPPORT_CONTACT) &&
              content.fontSize === HEADER_FOOTER_FONT_SIZE) {
            footerCorrect = true;
            hasReferenceId = true;
          } else {
            issues.push(`Footer missing reference ID or support contact, or font size incorrect: "${content.text}" (${content.fontSize})`);
          }
        }

        // Check font consistency (all fonts should be from standard sizes)
        if (content.fontSize && !STANDARD_FONT_SIZES.includes(content.fontSize)) {
          fontsConsistent = false;
          issues.push(`Non-standard font size: ${content.fontSize}`);
        }
      }

      if (!pageHasHeader) {
        issues.push(`Page ${page.pageNumber} missing header`);
      }
      if (!pageHasFooter) {
        issues.push(`Page ${page.pageNumber} missing footer`);
      }
    }

    return {
      hasHeader,
      hasFooter,
      hasReferenceId,
      headerCorrect,
      footerCorrect,
      fontsConsistent,
      issues
    };
  }

  // Arbitraries for generating test data
  const emailReplyDataArbitrary = fc.record({
    from: fc.emailAddress(),
    subject: fc.string({ minLength: 5, maxLength: 100 }),
    body: fc.string({ minLength: 10, maxLength: 500 }),
    threadId: fc.option(fc.uuid(), { nil: undefined }),
    hasQuickReplies: fc.boolean(),
    quickReplies: fc.option(fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 3 }), { nil: undefined }),
    attachmentCount: fc.option(fc.integer({ min: 0, max: 5 }), { nil: undefined })
  });

  const productSelectionDataArbitrary = fc.record({
    products: fc.array(
      fc.record({
        id: fc.uuid(),
        name: fc.string({ minLength: 5, maxLength: 50 }),
        price: fc.integer({ min: 100, max: 100000 }),
        currency: fc.constant('JPY'),
        description: fc.string({ minLength: 10, maxLength: 100 })
      }),
      { minLength: 1, maxLength: 5 }
    ),
    complementaryItems: fc.option(
      fc.array(
        fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 5, maxLength: 50 }),
          price: fc.integer({ min: 100, max: 10000 }),
          currency: fc.constant('JPY'),
          description: fc.string({ minLength: 10, maxLength: 100 })
        }),
        { minLength: 0, maxLength: 3 }
      ),
      { nil: undefined }
    ),
    hasPaymentMethod: fc.boolean(),
    deliveryAddress: fc.option(fc.string({ minLength: 10, maxLength: 100 }), { nil: undefined })
  });

  const confirmationDataArbitrary = fc.record({
    type: fc.constantFrom('order', 'email', 'general'),
    message: fc.string({ minLength: 10, maxLength: 200 }),
    orderId: fc.option(fc.uuid(), { nil: undefined }),
    trackingNumber: fc.option(fc.string({ minLength: 10, maxLength: 20 }), { nil: undefined }),
    emailRecipient: fc.option(fc.emailAddress(), { nil: undefined })
  });

  const clarificationDataArbitrary = fc.record({
    question: fc.string({ minLength: 10, maxLength: 200 }),
    requiredInfo: fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
    recentConversations: fc.option(
      fc.array(
        fc.record({
          referenceId: fc.string({ minLength: 10, maxLength: 20 }),
          topic: fc.string({ minLength: 5, maxLength: 50 }),
          daysAgo: fc.integer({ min: 1, max: 30 })
        }),
        { minLength: 0, maxLength: 3 }
      ),
      { nil: undefined }
    ),
    supportContact: fc.constant('Support: help@faxi.jp | +81-3-1234-5678')
  });

  // Feature: fax-template-system, Property 3: Branding consistency
  describe('Property 3: Branding consistency', () => {
    it('should include consistent header with Faxi branding in all email reply templates', () => {
      fc.assert(
        fc.property(emailReplyDataArbitrary, (data) => {
          const template = FaxTemplateEngine.createEmailReplyTemplate(data);
          const branding = hasConsistentBranding(template);

          expect(branding.hasHeader, `Missing header. Issues: ${branding.issues.join(', ')}`).toBe(true);
          expect(branding.headerCorrect, `Header incorrect. Issues: ${branding.issues.join(', ')}`).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should include consistent footer with reference ID and support contact in all email reply templates', () => {
      fc.assert(
        fc.property(emailReplyDataArbitrary, (data) => {
          const template = FaxTemplateEngine.createEmailReplyTemplate(data);
          const branding = hasConsistentBranding(template);

          expect(branding.hasFooter, `Missing footer. Issues: ${branding.issues.join(', ')}`).toBe(true);
          expect(branding.footerCorrect, `Footer incorrect. Issues: ${branding.issues.join(', ')}`).toBe(true);
          expect(branding.hasReferenceId, `Missing reference ID. Issues: ${branding.issues.join(', ')}`).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should use consistent font sizes (Arial at standard sizes) in all email reply templates', () => {
      fc.assert(
        fc.property(emailReplyDataArbitrary, (data) => {
          const template = FaxTemplateEngine.createEmailReplyTemplate(data);
          const branding = hasConsistentBranding(template);

          expect(branding.fontsConsistent, `Non-standard fonts found. Issues: ${branding.issues.join(', ')}`).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should include consistent header with Faxi branding in all product selection templates', () => {
      fc.assert(
        fc.property(productSelectionDataArbitrary, (data) => {
          const template = FaxTemplateEngine.createProductSelectionTemplate(data);
          const branding = hasConsistentBranding(template);

          expect(branding.hasHeader, `Missing header. Issues: ${branding.issues.join(', ')}`).toBe(true);
          expect(branding.headerCorrect, `Header incorrect. Issues: ${branding.issues.join(', ')}`).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should include consistent footer with reference ID and support contact in all product selection templates', () => {
      fc.assert(
        fc.property(productSelectionDataArbitrary, (data) => {
          const template = FaxTemplateEngine.createProductSelectionTemplate(data);
          const branding = hasConsistentBranding(template);

          expect(branding.hasFooter, `Missing footer. Issues: ${branding.issues.join(', ')}`).toBe(true);
          expect(branding.footerCorrect, `Footer incorrect. Issues: ${branding.issues.join(', ')}`).toBe(true);
          expect(branding.hasReferenceId, `Missing reference ID. Issues: ${branding.issues.join(', ')}`).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should use consistent font sizes in all product selection templates', () => {
      fc.assert(
        fc.property(productSelectionDataArbitrary, (data) => {
          const template = FaxTemplateEngine.createProductSelectionTemplate(data);
          const branding = hasConsistentBranding(template);

          expect(branding.fontsConsistent, `Non-standard fonts found. Issues: ${branding.issues.join(', ')}`).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should include consistent header with Faxi branding in all confirmation templates', () => {
      fc.assert(
        fc.property(confirmationDataArbitrary, (data) => {
          const template = FaxTemplateEngine.createConfirmationTemplate(data);
          const branding = hasConsistentBranding(template);

          expect(branding.hasHeader, `Missing header. Issues: ${branding.issues.join(', ')}`).toBe(true);
          expect(branding.headerCorrect, `Header incorrect. Issues: ${branding.issues.join(', ')}`).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should include consistent footer with reference ID and support contact in all confirmation templates', () => {
      fc.assert(
        fc.property(confirmationDataArbitrary, (data) => {
          const template = FaxTemplateEngine.createConfirmationTemplate(data);
          const branding = hasConsistentBranding(template);

          expect(branding.hasFooter, `Missing footer. Issues: ${branding.issues.join(', ')}`).toBe(true);
          expect(branding.footerCorrect, `Footer incorrect. Issues: ${branding.issues.join(', ')}`).toBe(true);
          expect(branding.hasReferenceId, `Missing reference ID. Issues: ${branding.issues.join(', ')}`).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should use consistent font sizes in all confirmation templates', () => {
      fc.assert(
        fc.property(confirmationDataArbitrary, (data) => {
          const template = FaxTemplateEngine.createConfirmationTemplate(data);
          const branding = hasConsistentBranding(template);

          expect(branding.fontsConsistent, `Non-standard fonts found. Issues: ${branding.issues.join(', ')}`).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should include consistent header with Faxi branding in all clarification templates', () => {
      fc.assert(
        fc.property(clarificationDataArbitrary, (data) => {
          const template = FaxTemplateEngine.createClarificationTemplate(data);
          const branding = hasConsistentBranding(template);

          expect(branding.hasHeader, `Missing header. Issues: ${branding.issues.join(', ')}`).toBe(true);
          expect(branding.headerCorrect, `Header incorrect. Issues: ${branding.issues.join(', ')}`).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should include consistent footer with reference ID and support contact in all clarification templates', () => {
      fc.assert(
        fc.property(clarificationDataArbitrary, (data) => {
          const template = FaxTemplateEngine.createClarificationTemplate(data);
          const branding = hasConsistentBranding(template);

          expect(branding.hasFooter, `Missing footer. Issues: ${branding.issues.join(', ')}`).toBe(true);
          expect(branding.footerCorrect, `Footer incorrect. Issues: ${branding.issues.join(', ')}`).toBe(true);
          expect(branding.hasReferenceId, `Missing reference ID. Issues: ${branding.issues.join(', ')}`).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should use consistent font sizes in all clarification templates', () => {
      fc.assert(
        fc.property(clarificationDataArbitrary, (data) => {
          const template = FaxTemplateEngine.createClarificationTemplate(data);
          const branding = hasConsistentBranding(template);

          expect(branding.fontsConsistent, `Non-standard fonts found. Issues: ${branding.issues.join(', ')}`).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });
});
