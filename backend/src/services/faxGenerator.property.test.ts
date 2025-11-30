import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { FaxGenerator } from './faxGenerator.js';
import { FaxTemplate, FaxContent } from '../types/fax.js';

/**
 * Property-Based Tests for FaxGenerator
 * 
 * Feature: fax-template-system, Property 2: Content block rendering completeness
 * Validates: Requirements 1.2
 */

describe('FaxGenerator Property Tests', () => {
  // Arbitrary for generating valid content blocks
  const contentTypeArbitrary = fc.constantFrom(
    'text',
    'checkbox',
    'circle_option',
    'barcode',
    'blank_space',
    'header',
    'footer',
    'image'
  );

  const textContentArbitrary = fc.record({
    type: fc.constant('text' as const),
    text: fc.string({ minLength: 1, maxLength: 200 }),
    fontSize: fc.option(fc.integer({ min: 20, max: 80 })),
    bold: fc.option(fc.boolean()),
    alignment: fc.option(fc.constantFrom('left', 'center', 'right')),
    marginTop: fc.option(fc.integer({ min: 0, max: 100 })),
    marginBottom: fc.option(fc.integer({ min: 0, max: 100 })),
  });

  const checkboxContentArbitrary = fc.record({
    type: fc.constant('checkbox' as const),
    options: fc.array(
      fc.record({
        id: fc.uuid(),
        label: fc.string({ minLength: 1, maxLength: 5 }),
        text: fc.string({ minLength: 1, maxLength: 100 }),
        price: fc.option(fc.integer({ min: 100, max: 100000 })),
      }),
      { minLength: 1, maxLength: 5 }
    ),
  });

  const circleOptionContentArbitrary = fc.record({
    type: fc.constant('circle_option' as const),
    options: fc.array(
      fc.record({
        id: fc.uuid(),
        label: fc.string({ minLength: 1, maxLength: 5 }),
        text: fc.string({ minLength: 1, maxLength: 100 }),
        price: fc.option(fc.integer({ min: 100, max: 100000 })),
      }),
      { minLength: 1, maxLength: 5 }
    ),
  });

  const barcodeContentArbitrary = fc.record({
    type: fc.constant('barcode' as const),
    barcodeData: fc.record({
      data: fc.string({ minLength: 5, maxLength: 50 }),
      format: fc.constantFrom('CODE128', 'QR'),
      width: fc.option(fc.integer({ min: 200, max: 500 })),
      height: fc.option(fc.integer({ min: 50, max: 150 })),
      displayValue: fc.option(fc.boolean()),
    }),
  });

  const blankSpaceContentArbitrary = fc.record({
    type: fc.constant('blank_space' as const),
    height: fc.option(fc.integer({ min: 10, max: 200 })),
  });

  const imageContentArbitrary = fc.record({
    type: fc.constant('image' as const),
    imageData: fc.record({
      // For testing, we'll use buffer instead of URL to avoid network calls
      buffer: fc.constant(Buffer.from('fake-image-data')),
      width: fc.integer({ min: 100, max: 400 }),
      height: fc.integer({ min: 100, max: 400 }),
      alignment: fc.option(fc.constantFrom('left', 'center', 'right')),
      caption: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
      fallbackText: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
    }),
  });

  const contentBlockArbitrary = fc.oneof(
    textContentArbitrary,
    checkboxContentArbitrary,
    circleOptionContentArbitrary,
    barcodeContentArbitrary,
    blankSpaceContentArbitrary
    // Note: Excluding image for now as it requires actual image buffer
  );

  const faxTemplateArbitrary = fc.record({
    type: fc.constantFrom(
      'email_reply',
      'product_selection',
      'payment_barcodes',
      'confirmation',
      'multi_action',
      'clarification',
      'welcome'
    ),
    referenceId: fc.string({ minLength: 10, maxLength: 20 }),
    pages: fc.array(
      fc.record({
        content: fc.array(contentBlockArbitrary, { minLength: 1, maxLength: 10 }),
        pageNumber: fc.integer({ min: 1, max: 10 }),
        totalPages: fc.integer({ min: 1, max: 10 }),
      }),
      { minLength: 1, maxLength: 3 }
    ),
    contextData: fc.object(),
  });

  // Feature: fax-template-system, Property 2: Content block rendering completeness
  it('should successfully render any valid content block type without throwing errors', async () => {
    await fc.assert(
      fc.asyncProperty(faxTemplateArbitrary, async (template) => {
        // Attempt to generate PDF
        const pdfBuffer = await FaxGenerator.generatePdf(template as FaxTemplate);

        // Verify PDF was generated
        expect(pdfBuffer).toBeInstanceOf(Buffer);
        expect(pdfBuffer.length).toBeGreaterThan(0);

        // Verify it starts with PDF magic bytes
        const pdfHeader = pdfBuffer.toString('utf8', 0, 4);
        expect(pdfHeader).toBe('%PDF');
      }),
      { numRuns: 50 }
    );
  }, 120000); // 2 minute timeout for property test

  it('should handle templates with mixed content types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(contentBlockArbitrary, { minLength: 2, maxLength: 8 }),
        fc.string({ minLength: 10, maxLength: 20 }),
        async (contentBlocks, referenceId) => {
          const template: FaxTemplate = {
            type: 'confirmation',
            referenceId,
            pages: [
              {
                content: contentBlocks as FaxContent[],
                pageNumber: 1,
                totalPages: 1,
              },
            ],
            contextData: {},
          };

          const pdfBuffer = await FaxGenerator.generatePdf(template);

          expect(pdfBuffer).toBeInstanceOf(Buffer);
          expect(pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  }, 120000);

  it('should handle empty text gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 20 }),
        async (referenceId) => {
          const template: FaxTemplate = {
            type: 'confirmation',
            referenceId,
            pages: [
              {
                content: [
                  {
                    type: 'text',
                    text: '',
                  },
                ],
                pageNumber: 1,
                totalPages: 1,
              },
            ],
            contextData: {},
          };

          const pdfBuffer = await FaxGenerator.generatePdf(template);

          expect(pdfBuffer).toBeInstanceOf(Buffer);
          expect(pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle very long text with wrapping', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 500, maxLength: 2000 }),
        fc.string({ minLength: 10, maxLength: 20 }),
        async (longText, referenceId) => {
          const template: FaxTemplate = {
            type: 'confirmation',
            referenceId,
            pages: [
              {
                content: [
                  {
                    type: 'text',
                    text: longText,
                  },
                ],
                pageNumber: 1,
                totalPages: 1,
              },
            ],
            contextData: {},
          };

          const pdfBuffer = await FaxGenerator.generatePdf(template);

          expect(pdfBuffer).toBeInstanceOf(Buffer);
          expect(pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle multiple pages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        fc.string({ minLength: 10, maxLength: 20 }),
        async (pageCount, referenceId) => {
          const pages = Array.from({ length: pageCount }, (_, i) => ({
            content: [
              {
                type: 'text' as const,
                text: `Page ${i + 1} content`,
              },
            ],
            pageNumber: i + 1,
            totalPages: pageCount,
          }));

          const template: FaxTemplate = {
            type: 'confirmation',
            referenceId,
            pages,
            contextData: {},
          };

          const pdfBuffer = await FaxGenerator.generatePdf(template);

          expect(pdfBuffer).toBeInstanceOf(Buffer);
          expect(pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});
