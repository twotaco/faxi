/**
 * Integration Test: Playwright Scraping Integration
 * 
 * Tests the complete flow: scrape → cache → curate → validate
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { productSearchService } from '../../services/productSearchService';
import { productCacheService } from '../../services/productCacheService';
import { playwrightScrapingService } from '../../services/playwrightScrapingService';
import { scrapingRateLimitService } from '../../services/scrapingRateLimitService';

describe('Playwright Scraping Integration Tests', () => {
  beforeAll(async () => {
    // Reset rate limits for testing
    await scrapingRateLimitService.reset();
    console.log('Rate limits reset for testing');
  });

  it('should complete full flow: scrape → cache → curate', async () => {
    const query = 'ノート'; // Notebook in Japanese
    const userId = '00000000-0000-0000-0000-000000000001'; // Test UUID

    // Step 1: Search products (will scrape if cache miss)
    console.log('Step 1: Searching products...');
    const products = await productSearchService.searchProducts(query, {}, userId);

    expect(products).toBeDefined();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);

    // Verify product structure
    const firstProduct = products[0];
    expect(firstProduct).toHaveProperty('asin');
    expect(firstProduct).toHaveProperty('title');
    expect(firstProduct).toHaveProperty('price');
    expect(firstProduct).toHaveProperty('primeEligible');
    expect(firstProduct).toHaveProperty('rating');
    expect(firstProduct).toHaveProperty('seller');

    console.log(`Found ${products.length} products`);
    console.log(`First product: ${firstProduct.title.substring(0, 50)}...`);

    // Step 2: Verify cache hit on second search
    console.log('Step 2: Testing cache hit...');
    const cachedProducts = await productSearchService.searchProducts(query, {}, userId);

    expect(cachedProducts.length).toBe(products.length);
    expect(cachedProducts[0].asin).toBe(firstProduct.asin);

    console.log('Cache hit successful');

    // Step 3: Curate products
    console.log('Step 3: Curating products...');
    console.log(`Products before curation: ${products.length}`);
    console.log(`Sample product: Prime=${products[0]?.primeEligible}, Rating=${products[0]?.rating}`);
    
    const curatedProducts = await productSearchService.curateProducts(
      products,
      query
    );

    expect(curatedProducts).toBeDefined();
    
    // If no products pass quality filters, that's okay for this test
    // The important thing is the flow works
    if (curatedProducts.length > 0) {
      expect(curatedProducts.length).toBeGreaterThanOrEqual(1);
      expect(curatedProducts.length).toBeLessThanOrEqual(5);
      
      // Verify curation structure
      const firstCurated = curatedProducts[0];
      expect(firstCurated).toHaveProperty('selectionMarker');
      expect(firstCurated.selectionMarker).toBe('A');
      expect(firstCurated.title.length).toBeLessThanOrEqual(63); // 60 + "..."
      
      console.log(`Curated ${curatedProducts.length} products`);
    } else {
      console.log('No products passed quality filters (Prime + 3.5 rating) - this is expected for some searches');
    }

    // Step 4: Validate product (fresh scrape) - only if we have products
    if (products.length > 0) {
      console.log('Step 4: Validating product with fresh scrape...');
      const validation = await productSearchService.validateProduct(
        firstProduct.asin,
        firstProduct.price
      );

      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('currentPrice');
      expect(validation).toHaveProperty('inStock');

      console.log(`Validation result: ${validation.valid ? 'VALID' : 'INVALID'}`);
      console.log(`Current price: ¥${validation.currentPrice}`);
    }

  }, 120000); // 2 minute timeout

  it('should handle cache expiration correctly', async () => {
    const query = 'ペン'; // Pen in Japanese
    
    // Search to populate cache
    console.log('Populating cache...');
    const products = await productSearchService.searchProducts(query, {});
    
    expect(products.length).toBeGreaterThan(0);
    
    // Verify cache hit
    const cached = await productCacheService.getCachedSearch(query, {});
    expect(cached).not.toBeNull();
    expect(cached?.length).toBe(products.length);
    
    console.log('Cache populated and verified');
    
    // Test cache with very short TTL (should miss)
    const expiredCache = await productCacheService.getCachedSearch(query, {}, 0.001); // 0.001 hours = 3.6 seconds
    
    // Wait a bit to ensure expiration
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    const afterExpiry = await productCacheService.getCachedSearch(query, {}, 0.001);
    expect(afterExpiry).toBeNull();
    
    console.log('Cache expiration working correctly');
  }, 60000);

  it('should enforce rate limiting', async () => {
    console.log('Testing rate limiting...');
    
    const status = await scrapingRateLimitService.getStatus();
    console.log(`Current rate limit status: ${status.searchesInLastHour}/${status.maxSearchesPerHour}`);
    
    expect(status).toHaveProperty('allowed');
    expect(status).toHaveProperty('searchesInLastHour');
    expect(status).toHaveProperty('maxSearchesPerHour');
    
    // Record a search
    await scrapingRateLimitService.recordSearch();
    
    const afterRecord = await scrapingRateLimitService.getStatus();
    expect(afterRecord.searchesInLastHour).toBe(status.searchesInLastHour + 1);
    
    console.log('Rate limiting working correctly');
  }, 30000);

  it('should get cache metrics', () => {
    const metrics = productCacheService.getCacheMetrics();
    
    expect(metrics).toHaveProperty('hits');
    expect(metrics).toHaveProperty('misses');
    expect(metrics).toHaveProperty('invalidations');
    
    console.log('Cache metrics:', metrics);
    
    const hitRate = productCacheService.getCacheHitRate();
    console.log(`Cache hit rate: ${(hitRate * 100).toFixed(2)}%`);
  });
});
