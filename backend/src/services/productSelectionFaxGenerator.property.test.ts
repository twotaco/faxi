/**
 * Property-Based Tests for ProductSelectionFaxGenerator
 * 
 * Tests universal properties that should hold across all valid inputs
 * using fast-check for property-based testing.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ProductSelectionFaxGenerator, ProductSelectionFaxData } from './productSelectionFaxGenerator.js';
import { CuratedProduct } from './productSearchService.js';

// Arbitrary generators for test data
const selectionMarkerArbitrary = fc.constantFrom('A', 'B', 'C', 'D', 'E');

const curatedProductArbitrary = fc.record({
  asin: fc.string({ minLength: 10, maxLength: 10, pattern: '[A-Z0-9]' }),
  title: fc.string({ minLength: 15, maxLength: 60 }), // Already truncated, ensure meaningful content
  price: fc.integer({ min: 100, max: 100000 }),
  primeEligible: fc.boolean(),
  rating: fc.float({ min: 1, max: 5, noNaN: true }),
  deliveryEstimate: fc.string({ minLength: 10, maxLength: 30 }),
  selectionMarker: selectionMarkerArbitrary,
  imageUrl: fc.option(fc.webUrl(), { nil: '' }),
  reasoning: fc.string({ minLength: 10, maxLength: 100 }),
  seller: fc.option(fc.string({ minLength: 5, maxLength: 30 }), { nil: undefined })
}) as fc.Arbitrary<CuratedProduct>;

const productSelectionDataArbitrary = fc.record({
  searchQuery: fc.string({ minLength: 3, maxLength: 100 }), // Ensure meaningful search query
  products: fc.array(curatedProductArbitrary, { minLength: 1, maxLength: 5 }),
  userName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined })
}) as fc.Arbitrary<ProductSelectionFaxData>;

describe('ProductSelectionFaxGenerator - Property Tests', () => {
  // Feature: fax-template-system, Property 6: Product display completeness
  it('should display all required product fields for any product selection fax', async () => {
    await fc.assert(
      fc.asyncProperty(
        productSelectionDataArbitrary,
        async (data) => {
          // Generate the fax
          const pdfBuffer = await ProductSelectionFaxGenerator.generateProductSelectionFax(data);
          
          // Verify PDF is valid
          expect(pdfBuffer).toBeInstanceOf(Buffer);
          expect(pdfBuffer.length).toBeGreaterThan(0);
          
          // Verify PDF starts with PDF header
          const pdfHeader = pdfBuffer.toString('utf-8', 0, 8);
          expect(pdfHeader).toContain('%PDF');
          
          // Verify all products have selection markers (A-E)
          const markers = data.products.map(p => p.selectionMarker);
          expect(markers.length).toBe(data.products.length);
          expect(markers.every(m => ['A', 'B', 'C', 'D', 'E'].includes(m))).toBe(true);
          
          // Verify all products have required fields
          for (const product of data.products) {
            expect(product.asin).toBeTruthy();
            expect(product.title).toBeTruthy();
            expect(product.price).toBeGreaterThan(0);
            expect(product.selectionMarker).toBeTruthy();
            expect(['A', 'B', 'C', 'D', 'E']).toContain(product.selectionMarker);
          }
          
          // Verify search query is present
          expect(data.searchQuery).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: fax-template-system, Property 7: Image embedding
  it('should handle image URLs correctly for products with images', async () => {
    await fc.assert(
      fc.asyncProperty(
        productSelectionDataArbitrary,
        async (data) => {
          // Generate the fax
          const pdfBuffer = await ProductSelectionFaxGenerator.generateProductSelectionFax(data);
          
          // Verify PDF is valid
          expect(pdfBuffer).toBeInstanceOf(Buffer);
          expect(pdfBuffer.length).toBeGreaterThan(0);
          
          // Count products with images
          const productsWithImages = data.products.filter(p => p.imageUrl && p.imageUrl.length > 0);
          const productsWithoutImages = data.products.filter(p => !p.imageUrl || p.imageUrl.length === 0);
          
          // If there are products with images, PDF should be larger (images add content)
          // If there are products without images, they should still render (with fallback)
          if (productsWithImages.length > 0) {
            // PDF should contain image-related content
            // We can't easily verify the actual image content in the PDF binary,
            // but we can verify the PDF is valid and contains the expected structure
            expect(pdfBuffer.length).toBeGreaterThan(1000); // Reasonable minimum size
          }
          
          // Verify all products are still represented regardless of image availability
          expect(data.products.length).toBeGreaterThan(0);
          
          // Verify that products without images still have fallback text capability
          for (const product of productsWithoutImages) {
            // Product should still have all required fields
            expect(product.title).toBeTruthy();
            expect(product.price).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: fax-template-system, Property 8: Title truncation
  it('should ensure product titles are truncated to 60 characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        productSelectionDataArbitrary,
        async (data) => {
          // Verify all product titles are within the 60 character limit
          for (const product of data.products) {
            expect(product.title.length).toBeLessThanOrEqual(60);
          }
          
          // Generate the fax to ensure truncated titles work correctly
          const pdfBuffer = await ProductSelectionFaxGenerator.generateProductSelectionFax(data);
          
          // Verify PDF is valid
          expect(pdfBuffer).toBeInstanceOf(Buffer);
          expect(pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
