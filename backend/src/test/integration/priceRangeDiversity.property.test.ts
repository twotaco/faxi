/**
 * Property-Based Test: Price Range Diversity
 * 
 * Feature: amazon-shopping-mcp, Property 19: Price Range Diversity
 * Validates: Requirements 8.4
 * 
 * For any curated product list with 3 or more products, the products SHALL include representation 
 * across at least two different price ranges (low, medium, or premium).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { productSearchService, PAAPIProduct } from '../../services/productSearchService';

describe('Property 19: Price Range Diversity', () => {
  /**
   * Property: Curated products span at least 2 different price ranges
   */
  it('property: curated products include at least 2 different price ranges', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate products with diverse prices
        fc.array(
          fc.record({
            asin: fc.string({ minLength: 10, maxLength: 10 }),
            title: fc.string({ minLength: 10, maxLength: 200 }),
            price: fc.record({
              amount: fc.integer({ min: 1000, max: 50000 }), // Wide price range
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
          { minLength: 6, maxLength: 15 } // Enough products to ensure diversity
        ),
        fc.string({ minLength: 1, maxLength: 100 }),
      async (products, query) => {
        const curated = await productSearchService.curateProducts(products as PAAPIProduct[], query);
        
        // Skip if we got fewer than 3 products (edge case)
        if (curated.length < 3) {
          return;
        }
        
        // Calculate price range thresholds
        const prices = curated.map(p => p.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice;
        
        // Define thresholds (low: bottom 33%, mid: middle 34%, premium: top 33%)
        const lowThreshold = minPrice + priceRange * 0.33;
        const premiumThreshold = minPrice + priceRange * 0.67;
        
        // Categorize products
        const hasLow = prices.some(p => p <= lowThreshold);
        const hasMid = prices.some(p => p > lowThreshold && p <= premiumThreshold);
        const hasPremium = prices.some(p => p > premiumThreshold);
        
        // Count how many different price ranges are represented
        const rangeCount = [hasLow, hasMid, hasPremium].filter(Boolean).length;
        
        // Property: At least 2 different price ranges should be represented
        expect(rangeCount).toBeGreaterThanOrEqual(2);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Price diversity is maintained even with similar-priced products
   */
  it('property: selects products across price spectrum when available', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate products with intentionally diverse prices
        fc.tuple(
          // Low-priced products
          fc.array(
            fc.record({
              asin: fc.string({ minLength: 10, maxLength: 10 }),
              title: fc.string({ minLength: 10, maxLength: 200 }),
              price: fc.record({
                amount: fc.integer({ min: 1000, max: 5000 }),
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
            { minLength: 2, maxLength: 5 }
          ),
          // Mid-priced products
          fc.array(
            fc.record({
              asin: fc.string({ minLength: 10, maxLength: 10 }),
              title: fc.string({ minLength: 10, maxLength: 200 }),
              price: fc.record({
                amount: fc.integer({ min: 10000, max: 20000 }),
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
            { minLength: 2, maxLength: 5 }
          ),
          // Premium-priced products
          fc.array(
            fc.record({
              asin: fc.string({ minLength: 10, maxLength: 10 }),
              title: fc.string({ minLength: 10, maxLength: 200 }),
              price: fc.record({
                amount: fc.integer({ min: 30000, max: 50000 }),
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
            { minLength: 2, maxLength: 5 }
          )
        ),
        fc.string({ minLength: 1, maxLength: 100 }),
      async ([lowProducts, midProducts, premiumProducts], query) => {
        // Combine all products
        const allProducts = [...lowProducts, ...midProducts, ...premiumProducts];
        
        const curated = await productSearchService.curateProducts(allProducts as PAAPIProduct[], query);
        
        // Property: Should include products from multiple price tiers
        const prices = curated.map(p => p.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        
        // Verify we have meaningful price spread
        // (not all products clustered in one price range)
        const priceSpread = maxPrice - minPrice;
        const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        
        // Price spread should be at least 20% of average price
        expect(priceSpread).toBeGreaterThanOrEqual(avgPrice * 0.2);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Edge case: When all products have similar prices, still return valid results
   */
  it('property: handles products with similar prices gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1000, max: 50000 }),
        fc.array(
          fc.record({
            asin: fc.string({ minLength: 10, maxLength: 10 }),
            title: fc.string({ minLength: 10, maxLength: 200 }),
            price: fc.record({
              amount: fc.integer({ min: -100, max: 100 }), // Small variation
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
          { minLength: 5, maxLength: 10 }
        ),
        fc.string({ minLength: 1, maxLength: 100 }),
      async (basePrice, products, query) => {
        // Adjust all prices to be close to basePrice
        const adjustedProducts = products.map(p => ({
          ...p,
          price: {
            ...p.price,
            amount: basePrice + p.price.amount
          }
        }));
        
        const curated = await productSearchService.curateProducts(adjustedProducts as PAAPIProduct[], query);
        
        // Property: Should still return 3-5 products even with similar prices
        expect(curated.length).toBeGreaterThanOrEqual(3);
        expect(curated.length).toBeLessThanOrEqual(5);
      }),
      { numRuns: 100 }
    );
  });
});
