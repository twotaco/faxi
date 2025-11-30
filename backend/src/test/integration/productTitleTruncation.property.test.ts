/**
 * Property-Based Test: Product Title Truncation
 * 
 * Feature: amazon-shopping-mcp, Property 3: Product Title Truncation
 * Validates: Requirements 8.5
 * 
 * For any product title in a generated fax, the formatted title SHALL be 60 characters or fewer.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { productSearchService, PAAPIProduct } from '../../services/productSearchService';

describe('Property 3: Product Title Truncation', () => {
  /**
   * Property: For any product, the curated title is at most 60 characters
   */
  it('property: all curated product titles are 60 characters or fewer', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate products with varying title lengths
        fc.array(
          fc.record({
            asin: fc.string({ minLength: 10, maxLength: 10 }),
            title: fc.string({ minLength: 1, maxLength: 500 }), // Very long titles
            price: fc.record({
              amount: fc.integer({ min: 100, max: 100000 }),
              currency: fc.constant('JPY'),
              displayAmount: fc.string()
            }),
            images: fc.record({
              primary: fc.record({
                large: fc.record({
                  url: fc.webUrl(),
                  height: fc.integer({ min: 100, max: 1000 }),
                  width: fc.integer({ min: 100, max: 1000 })
                }),
                medium: fc.record({
                  url: fc.webUrl(),
                  height: fc.integer({ min: 50, max: 500 }),
                  width: fc.integer({ min: 50, max: 500 })
                })
              })
            }),
            rating: fc.float({ min: 3.5, max: 5.0 }),
            reviewCount: fc.integer({ min: 10, max: 10000 }),
            isPrime: fc.constant(true),
            availability: fc.record({
              message: fc.constant('在庫あり'),
              type: fc.constant('Now' as const)
            }),
            detailPageURL: fc.webUrl()
          }),
          { minLength: 3, maxLength: 10 }
        ),
        fc.string({ minLength: 1, maxLength: 100 }),
      async (products, query) => {
        const curated = await productSearchService.curateProducts(products as PAAPIProduct[], query);
        
        // Property: Every curated product title must be 60 characters or fewer
        curated.forEach(product => {
          expect(product.title.length).toBeLessThanOrEqual(60);
        });
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Short titles remain unchanged
   */
  it('property: titles under 60 characters are not truncated', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            asin: fc.string({ minLength: 10, maxLength: 10 }),
            title: fc.string({ minLength: 1, maxLength: 60 }), // Short titles
            price: fc.record({
              amount: fc.integer({ min: 100, max: 100000 }),
              currency: fc.constant('JPY'),
              displayAmount: fc.string()
            }),
            images: fc.record({
              primary: fc.record({
                large: fc.record({
                  url: fc.webUrl(),
                  height: fc.integer({ min: 100, max: 1000 }),
                  width: fc.integer({ min: 100, max: 1000 })
                }),
                medium: fc.record({
                  url: fc.webUrl(),
                  height: fc.integer({ min: 50, max: 500 }),
                  width: fc.integer({ min: 50, max: 500 })
                })
              })
            }),
            rating: fc.float({ min: 3.5, max: 5.0 }),
            reviewCount: fc.integer({ min: 10, max: 10000 }),
            isPrime: fc.constant(true),
            availability: fc.record({
              message: fc.constant('在庫あり'),
              type: fc.constant('Now' as const)
            }),
            detailPageURL: fc.webUrl()
          }),
          { minLength: 3, maxLength: 10 }
        ),
        fc.string({ minLength: 1, maxLength: 100 }),
      async (products, query) => {
        const curated = await productSearchService.curateProducts(products as PAAPIProduct[], query);
        
        // Property: Short titles should not have "..." appended
        curated.forEach((product) => {
          // Find the original product by ASIN
          const originalProduct = (products as PAAPIProduct[]).find(p => p.asin === product.asin);
          if (originalProduct && originalProduct.title.length <= 60) {
            expect(product.title).toBe(originalProduct.title);
          }
        });
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Long titles are truncated with ellipsis
   */
  it('property: titles over 60 characters are truncated with ellipsis', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            asin: fc.string({ minLength: 10, maxLength: 10 }),
            title: fc.string({ minLength: 61, maxLength: 500 }), // Long titles only
            price: fc.record({
              amount: fc.integer({ min: 100, max: 100000 }),
              currency: fc.constant('JPY'),
              displayAmount: fc.string()
            }),
            images: fc.record({
              primary: fc.record({
                large: fc.record({
                  url: fc.webUrl(),
                  height: fc.integer({ min: 100, max: 1000 }),
                  width: fc.integer({ min: 100, max: 1000 })
                }),
                medium: fc.record({
                  url: fc.webUrl(),
                  height: fc.integer({ min: 50, max: 500 }),
                  width: fc.integer({ min: 50, max: 500 })
                })
              })
            }),
            rating: fc.float({ min: 3.5, max: 5.0 }),
            reviewCount: fc.integer({ min: 10, max: 10000 }),
            isPrime: fc.constant(true),
            availability: fc.record({
              message: fc.constant('在庫あり'),
              type: fc.constant('Now' as const)
            }),
            detailPageURL: fc.webUrl()
          }),
          { minLength: 3, maxLength: 10 }
        ),
        fc.string({ minLength: 1, maxLength: 100 }),
      async (products, query) => {
        const curated = await productSearchService.curateProducts(products as PAAPIProduct[], query);
        
        // Property: Long titles should end with "..."
        curated.forEach(product => {
          if (product.title.length === 60) {
            expect(product.title.endsWith('...')).toBe(true);
          }
        });
      }),
      { numRuns: 100 }
    );
  });
});
