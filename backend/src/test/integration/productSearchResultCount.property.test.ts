/**
 * Property-Based Test: Product Search Result Count Bounds
 * 
 * Feature: amazon-shopping-mcp, Property 1: Product Search Result Count Bounds
 * Validates: Requirements 1.3
 * 
 * For any product search query, the system SHALL return between 3 and 5 curated product options (inclusive).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { productSearchService, PAAPIProduct } from '../../services/productSearchService';

describe('Property 1: Product Search Result Count Bounds', () => {
  /**
   * Property: For any valid product list, curateProducts returns 3-5 products
   */
  it('property: curated products count is always between 3 and 5', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random product lists with varying sizes
        fc.array(
          fc.record({
            asin: fc.string({ minLength: 10, maxLength: 10 }),
            title: fc.string({ minLength: 10, maxLength: 200 }),
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
            rating: fc.float({ min: 3.5, max: 5.0 }), // Only valid ratings
            reviewCount: fc.integer({ min: 10, max: 10000 }),
            isPrime: fc.constant(true), // Only Prime products
            availability: fc.record({
              message: fc.constant('在庫あり'),
              type: fc.constant('Now' as const)
            }),
            detailPageURL: fc.webUrl()
          }),
          { minLength: 3, maxLength: 20 } // Ensure we have enough products to curate from
        ),
        fc.string({ minLength: 1, maxLength: 100 }), // Search query
      async (products, query) => {
        const curated = await productSearchService.curateProducts(products as PAAPIProduct[], query);
        
        // Property: Result count must be between 3 and 5 (inclusive)
        expect(curated.length).toBeGreaterThanOrEqual(3);
        expect(curated.length).toBeLessThanOrEqual(5);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Edge case: When input has exactly 3 products, return all 3
   */
  it('property: with exactly 3 valid products, returns all 3', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            asin: fc.string({ minLength: 10, maxLength: 10 }),
            title: fc.string({ minLength: 10, maxLength: 200 }),
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
          { minLength: 3, maxLength: 3 } // Exactly 3 products
        ),
        fc.string({ minLength: 1, maxLength: 100 }),
      async (products, query) => {
        const curated = await productSearchService.curateProducts(products as PAAPIProduct[], query);
        
        // With exactly 3 valid products, should return all 3
        expect(curated.length).toBe(3);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Edge case: When input has more than 5 products, return exactly 5
   */
  it('property: with more than 5 valid products, returns exactly 5', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            asin: fc.string({ minLength: 10, maxLength: 10 }),
            title: fc.string({ minLength: 10, maxLength: 200 }),
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
          { minLength: 6, maxLength: 20 } // More than 5 products
        ),
        fc.string({ minLength: 1, maxLength: 100 }),
      async (products, query) => {
        const curated = await productSearchService.curateProducts(products as PAAPIProduct[], query);
        
        // With more than 5 valid products, should return exactly 5
        expect(curated.length).toBe(5);
      }),
      { numRuns: 100 }
    );
  });
});
