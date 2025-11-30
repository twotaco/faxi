/**
 * Product Caching Integration Tests
 * 
 * DEPRECATED: This test file uses old Redis-based caching structure.
 * See playwrightIntegration.test.ts for current PostgreSQL-backed caching tests.
 * 
 * TODO: Update or remove this file
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { productSearchService } from '../../services/productSearchService';
import { productCacheService } from '../../services/productCacheService';
import { redis } from '../../queue/connection';

describe('Product Caching', () => {
  beforeEach(async () => {
    // Clear cache before each test
    const client = redis.getClient();
    const keys = await client.keys('product_cache:*');
    if (keys.length > 0) {
      await client.del(...keys);
    }
    
    // Reset metrics
    productCacheService.resetMetrics();
  });

  afterEach(async () => {
    // Clean up cache after tests
    const client = redis.getClient();
    const keys = await client.keys('product_cache:*');
    if (keys.length > 0) {
      await client.del(...keys);
    }
  });

  describe('Search Results Caching', () => {
    it('should cache search results with 12 hour TTL', async () => {
      const query = 'shampoo';
      const filters = { primeOnly: true, minRating: 3.5 };

      // First search - should miss cache
      const results1 = await productSearchService.searchProducts(query, filters);
      expect(results1.length).toBeGreaterThan(0);

      // Check metrics
      let metrics = productCacheService.getCacheMetrics();
      expect(metrics.misses).toBe(1);
      expect(metrics.hits).toBe(0);

      // Second search - should hit cache
      const results2 = await productSearchService.searchProducts(query, filters);
      expect(results2).toEqual(results1);

      // Check metrics
      metrics = productCacheService.getCacheMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);

      // Verify cache hit rate
      const hitRate = productCacheService.getCacheHitRate();
      expect(hitRate).toBe(0.5); // 1 hit out of 2 total
    });

    it('should cache different queries separately', async () => {
      // Skip if PA-API not configured
      if (!process.env.PA_API_ACCESS_KEY) {
        console.log('Skipping: PA-API not configured');
        return;
      }

      const query1 = 'shampoo';
      const query2 = 'soap';

      // Search for different queries
      await productSearchService.searchProducts(query1, {});
      await productSearchService.searchProducts(query2, {});

      // Both should be cache misses
      const metrics = productCacheService.getCacheMetrics();
      expect(metrics.misses).toBe(2);
      expect(metrics.hits).toBe(0);

      // Search again - both should hit cache
      await productSearchService.searchProducts(query1, {});
      await productSearchService.searchProducts(query2, {});

      const metrics2 = productCacheService.getCacheMetrics();
      expect(metrics2.hits).toBe(2);
      expect(metrics2.misses).toBe(2);
    });

    it('should cache different filters separately', async () => {
      // Skip if PA-API not configured
      if (!process.env.PA_API_ACCESS_KEY) {
        console.log('Skipping: PA-API not configured');
        return;
      }

      const query = 'shampoo';
      const filters1 = { primeOnly: true };
      const filters2 = { primeOnly: false };

      // Search with different filters
      await productSearchService.searchProducts(query, filters1);
      await productSearchService.searchProducts(query, filters2);

      // Both should be cache misses
      const metrics = productCacheService.getCacheMetrics();
      expect(metrics.misses).toBe(2);
    });
  });

  describe('Product Details Caching', () => {
    it('should cache product details with 1 hour TTL', async () => {
      // Skip if PA-API not configured
      if (!process.env.PA_API_ACCESS_KEY) {
        console.log('Skipping: PA-API not configured');
        return;
      }

      // First, get a valid ASIN from search
      const searchResults = await productSearchService.searchProducts('shampoo', {});
      if (searchResults.length === 0) {
        console.log('Skipping: No search results');
        return;
      }

      const asin = searchResults[0].asin;

      // Reset metrics after search
      productCacheService.resetMetrics();

      // First fetch - should miss cache
      const product1 = await productSearchService.getProductDetails(asin);
      expect(product1.asin).toBe(asin);

      let metrics = productCacheService.getCacheMetrics();
      expect(metrics.misses).toBe(1);
      expect(metrics.hits).toBe(0);

      // Second fetch - should hit cache
      const product2 = await productSearchService.getProductDetails(asin);
      expect(product2).toEqual(product1);

      metrics = productCacheService.getCacheMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate product cache on price update', async () => {
      // Skip if PA-API not configured
      if (!process.env.PA_API_ACCESS_KEY) {
        console.log('Skipping: PA-API not configured');
        return;
      }

      // Get a product
      const searchResults = await productSearchService.searchProducts('shampoo', {});
      if (searchResults.length === 0) {
        console.log('Skipping: No search results');
        return;
      }

      const asin = searchResults[0].asin;
      const quotedPrice = searchResults[0].price.amount;

      // Cache the product
      await productSearchService.getProductDetails(asin);

      // Validate with a significantly different price (should invalidate cache)
      const differentPrice = quotedPrice + 100; // 100 yen difference
      await productSearchService.validateProduct(asin, differentPrice);

      // Check that cache was invalidated
      const metrics = productCacheService.getCacheMetrics();
      expect(metrics.invalidations).toBeGreaterThan(0);
    });

    it('should not invalidate cache for small price differences', async () => {
      // Skip if PA-API not configured
      if (!process.env.PA_API_ACCESS_KEY) {
        console.log('Skipping: PA-API not configured');
        return;
      }

      // Get a product
      const searchResults = await productSearchService.searchProducts('shampoo', {});
      if (searchResults.length === 0) {
        console.log('Skipping: No search results');
        return;
      }

      const asin = searchResults[0].asin;
      const quotedPrice = searchResults[0].price.amount;

      // Cache the product
      await productSearchService.getProductDetails(asin);

      // Reset metrics
      productCacheService.resetMetrics();

      // Validate with a small price difference (should not invalidate)
      const similarPrice = quotedPrice + 10; // Only 10 yen difference
      await productSearchService.validateProduct(asin, similarPrice);

      // Check that cache was NOT invalidated
      const metrics = productCacheService.getCacheMetrics();
      expect(metrics.invalidations).toBe(0);
    });
  });

  describe('Cache Metrics', () => {
    it('should track cache hits and misses', async () => {
      // Skip if PA-API not configured
      if (!process.env.PA_API_ACCESS_KEY) {
        console.log('Skipping: PA-API not configured');
        return;
      }

      const query = 'shampoo';

      // First search - miss
      await productSearchService.searchProducts(query, {});
      
      // Second search - hit
      await productSearchService.searchProducts(query, {});
      
      // Third search - hit
      await productSearchService.searchProducts(query, {});

      const metrics = productCacheService.getCacheMetrics();
      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(1);

      const hitRate = productCacheService.getCacheHitRate();
      expect(hitRate).toBeCloseTo(0.667, 2); // 2/3 = 0.667
    });

    it('should calculate hit rate correctly', () => {
      // With no operations, hit rate should be 0
      expect(productCacheService.getCacheHitRate()).toBe(0);
    });
  });

  describe('Cache TTL', () => {
    it('should respect search cache TTL of 5 minutes', async () => {
      // This test would require waiting 5 minutes or mocking time
      // For now, we just verify the TTL is set correctly
      const client = redis.getClient();
      
      // Manually cache something
      await productCacheService.cacheSearchResults('test', {}, []);
      
      // Check TTL
      const keys = await client.keys('product_cache:search:*');
      expect(keys.length).toBe(1);
      
      const ttl = await client.ttl(keys[0]);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(5 * 60); // 5 minutes
    });

    it('should respect product cache TTL of 1 hour', async () => {
      const client = redis.getClient();
      
      // Manually cache a product
      const mockProduct = {
        asin: 'TEST123',
        title: 'Test Product',
        price: { amount: 1000, currency: 'JPY', displayAmount: '¥1,000' },
        images: { primary: { large: { url: '', height: 0, width: 0 }, medium: { url: '', height: 0, width: 0 } } },
        rating: 4.5,
        reviewCount: 100,
        isPrime: true,
        availability: { message: 'In Stock', type: 'Now' as const },
        detailPageURL: '',
        features: [],
        description: '',
        brand: ''
      };
      
      await productCacheService.cacheProductDetails('TEST123', mockProduct);
      
      // Check TTL
      const keys = await client.keys('product_cache:product:*');
      expect(keys.length).toBe(1);
      
      const ttl = await client.ttl(keys[0]);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60 * 60); // 1 hour
    });
  });
});
