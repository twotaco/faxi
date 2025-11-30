/**
 * Property-Based Test: Product Quality Filtering
 * 
 * Feature: amazon-shopping-mcp, Property 2: Product Quality Filtering
 * Validates: Requirements 1.4, 8.1, 8.2
 * 
 * For any product search results, all returned products SHALL be Prime-eligible
 * with ratings of 3.5 stars or higher.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { productSearchService, SearchFilters } from '../../services/productSearchService';

describe('Product Quality Filtering Property Tests', () => {
  beforeAll(() => {
    // Using Playwright scraping with aggressive caching
    console.log('Using Playwright scraping for product search tests');
  });

  /**
   * Feature: amazon-shopping-mcp, Property 2: Product Quality Filtering
   * Validates: Requirements 1.4, 8.1, 8.2
   */
  it('property: all search results meet quality standards (Prime + 3.5+ rating)', async () => {

    await fc.assert(
      fc.asyncProperty(
        // Generate random search queries
        fc.constantFrom(
          'shampoo',
          'toothpaste',
          'rice',
          'tea',
          'soap',
          'towel',
          'notebook',
          'pen',
          'batteries',
          'tissues'
        ),
        // Generate random filters with quality requirements
        fc.record({
          primeOnly: fc.constant(true), // Always require Prime
          minRating: fc.constant(3.5), // Always require 3.5+ rating
          priceMin: fc.option(fc.integer({ min: 100, max: 1000 }), { nil: undefined }),
          priceMax: fc.option(fc.integer({ min: 1000, max: 10000 }), { nil: undefined })
        }),
        async (query, filters) => {
          try {
            // Execute search
            const results = await productSearchService.searchProducts(
              query,
              filters as SearchFilters,
              'test-user-id'
            );

            // Property: All results must be Prime-eligible
            for (const product of results) {
              expect(product.primeEligible).toBe(true);
            }

            // Property: All results must have rating >= 3.5
            for (const product of results) {
              // Only check products that have ratings
              if (product.reviewCount > 0) {
                expect(product.rating).toBeGreaterThanOrEqual(3.5);
              }
            }

            // Property: All results must have valid prices
            for (const product of results) {
              expect(product.price).toBeGreaterThan(0);
              expect(product.currency).toBe('JPY');
            }

            // Property: If price filters specified, results must be within range
            if (filters.priceMin !== undefined) {
              for (const product of results) {
                expect(product.price).toBeGreaterThanOrEqual(filters.priceMin);
              }
            }

            if (filters.priceMax !== undefined) {
              for (const product of results) {
                expect(product.price).toBeLessThanOrEqual(filters.priceMax);
              }
            }
          } catch (error: any) {
            // Handle rate limiting gracefully
            if (error.message.includes('Rate limit')) {
              console.log('Rate limit encountered, skipping iteration');
              return;
            }
            throw error;
          }
        }
      ),
      { 
        numRuns: 10, // Reduced from 100 to avoid rate limiting during tests
        timeout: 60000 // 60 second timeout for API calls
      }
    );
  }, 120000); // 2 minute test timeout

  /**
   * Additional property: Prime filter enforcement
   */
  it('property: primeOnly filter excludes non-Prime products', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('shampoo', 'toothpaste', 'rice'),
        async (query) => {
          try {
            // Search with Prime filter
            const primeResults = await productSearchService.searchProducts(
              query,
              { primeOnly: true },
              'test-user-id'
            );

            // All results must be Prime-eligible
            for (const product of primeResults) {
              expect(product.primeEligible).toBe(true);
            }
          } catch (error: any) {
            if (error.message.includes('Rate limit')) {
              console.log('Rate limit encountered, skipping iteration');
              return;
            }
            throw error;
          }
        }
      ),
      { 
        numRuns: 5,
        timeout: 60000
      }
    );
  }, 120000);

  /**
   * Additional property: Rating filter enforcement
   */
  it('property: minRating filter excludes low-rated products', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('shampoo', 'toothpaste', 'rice'),
        fc.constantFrom(3.5, 4.0, 4.5),
        async (query, minRating) => {
          try {
            // Search with rating filter
            const results = await productSearchService.searchProducts(
              query,
              { minRating },
              'test-user-id'
            );

            // All results with reviews must meet minimum rating
            for (const product of results) {
              if (product.reviewCount > 0) {
                expect(product.rating).toBeGreaterThanOrEqual(minRating);
              }
            }
          } catch (error: any) {
            if (error.message.includes('Rate limit')) {
              console.log('Rate limit encountered, skipping iteration');
              return;
            }
            throw error;
          }
        }
      ),
      { 
        numRuns: 5,
        timeout: 60000
      }
    );
  }, 120000);

  /**
   * Edge case: Empty results should still satisfy properties
   */
  it('property: empty results are valid', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Use very specific/unlikely search terms
        fc.constantFrom('xyzabc123unlikely', 'qwerty999impossible'),
        async (query) => {
          try {
            const results = await productSearchService.searchProducts(
              query,
              { primeOnly: true, minRating: 3.5 },
              'test-user-id'
            );

            // Empty results are valid
            expect(Array.isArray(results)).toBe(true);
            
            // If there are results, they must meet quality standards
            for (const product of results) {
              expect(product.primeEligible).toBe(true);
              if (product.reviewCount > 0) {
                expect(product.rating).toBeGreaterThanOrEqual(3.5);
              }
            }
          } catch (error: any) {
            if (error.message.includes('Rate limit')) {
              console.log('Rate limit encountered, skipping iteration');
              return;
            }
            throw error;
          }
        }
      ),
      { 
        numRuns: 3,
        timeout: 60000
      }
    );
  }, 120000);
});
