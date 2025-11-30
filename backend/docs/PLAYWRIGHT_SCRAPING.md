# Playwright Scraping Architecture

## Overview

The Faxi backend uses Playwright-based web scraping to search Amazon.co.jp products, replacing the previous PA-API integration. This approach provides:

- **No API costs**: Free web scraping vs paid API
- **No approval needed**: Bypass PA-API approval process
- **Aggressive caching**: 12-hour cache reduces scraping frequency
- **Rate limiting**: Conservative limits prevent detection

## Architecture

```
User Request
    ↓
productSearchService.searchProducts()
    ↓
Check PostgreSQL Cache (12hr TTL)
    ↓
Cache Hit? → Return cached results
    ↓
Cache Miss? → Scrape with Playwright
    ↓
Store in PostgreSQL Cache
    ↓
Return results
```

## Components

### 1. Playwright Scraping Service
**File**: `src/services/playwrightScrapingService.ts`

- Launches headless Chromium browser
- Scrapes Amazon.co.jp search results
- Parses product cards (title, price, ASIN, rating, Prime, seller)
- Implements anti-detection measures:
  - Realistic user agent
  - Japanese locale (ja-JP)
  - Human-like delays (150-600ms)
  - Logged-out sessions

### 2. Product Cache Service
**File**: `src/services/productCacheService.ts`

- PostgreSQL-backed caching (not Redis)
- 12-hour TTL for both searches and products
- MD5 hash for query + filters
- Tracks cache hits/misses/invalidations

**Database Tables**:
- `product_cache`: Individual products by ASIN
- `product_search_cache`: Search query results
- `scraping_metrics`: Scraping activity tracking

### 3. Rate Limiting Service
**File**: `src/services/scrapingRateLimitService.ts`

- Redis-backed rate limiting
- 30 searches per hour maximum
- 8-15 second delays between scrapes
- Randomized human-like delays

### 4. Product Search Service
**File**: `src/services/productSearchService.ts`

- Cache-first strategy
- Falls back to scraping on cache miss
- Quality filtering (Prime + 3.5+ rating)
- Product curation (3-5 diverse products)
- Fresh scraping before purchase (`forceFresh` flag)

## Configuration

Environment variables in `.env`:

```bash
# Scraping Configuration
SCRAPING_HEADLESS=true                    # Use headless browser
SCRAPING_MAX_SEARCHES_PER_HOUR=30         # Rate limit
SCRAPING_MIN_DELAY=8000                   # Min delay (ms)
SCRAPING_MAX_DELAY=15000                  # Max delay (ms)
```

## Rate Limiting

**Conservative limits to avoid detection**:
- 30 searches per hour
- 8-15 second delays between scrapes
- Random delays (150-600ms) between actions
- Tracked in Redis with sliding window

## Caching Strategy

**Aggressive 12-hour cache**:
- Search results cached for 12 hours
- Individual products cached for 12 hours
- Cache invalidation on significant price changes (>50 yen)
- Fresh scrape always performed before purchase

**Cache Hit Rate**: Typically 60-80% after warm-up

## Anti-Detection Measures

1. **Realistic Browser Fingerprint**:
   - Chrome user agent for macOS
   - Standard desktop viewport (1920x1080)
   - Japanese locale and timezone

2. **Human-like Behavior**:
   - Random delays between actions
   - Randomized search delays
   - Logged-out sessions (no cookies)

3. **Conservative Rate Limiting**:
   - 30 searches/hour = 1 every 2 minutes
   - Well below detection thresholds

## Selectors

Amazon.co.jp CSS selectors in `src/config/playwrightConfig.ts`:

```typescript
export const AMAZON_SELECTORS = {
  productCard: '[data-component-type="s-search-result"]',
  title: 'h2 a span',
  price: '.a-price .a-offscreen',
  primeBadge: 'i.a-icon-prime',
  rating: '.a-icon-star-small .a-icon-alt',
  // ... more selectors
};
```

**Note**: Selectors may need updates if Amazon changes their UI.

## Testing

### Integration Tests
**File**: `src/test/integration/playwrightIntegration.test.ts`

Tests:
- ✅ Full flow: scrape → cache → curate → validate
- ✅ Cache expiration with TTL
- ✅ Rate limiting enforcement
- ✅ Cache metrics tracking

Run tests:
```bash
npm test -- playwrightIntegration.test.ts
```

### Property Tests
**File**: `src/test/integration/productQualityFiltering.property.test.ts`

Tests quality filters with fast-check:
- Prime eligibility enforcement
- Rating filter (3.5+ stars)
- Price range filters

## Monitoring

### Cache Metrics
```typescript
const metrics = productCacheService.getCacheMetrics();
// { hits: 10, misses: 5, invalidations: 1 }

const hitRate = productCacheService.getCacheHitRate();
// 0.667 (66.7%)
```

### Rate Limit Status
```typescript
const status = await scrapingRateLimitService.getStatus();
// { allowed: true, searchesInLastHour: 5, maxSearchesPerHour: 30 }
```

### Scraping Metrics
Database table `scraping_metrics` tracks:
- Search scrapes (success/failure)
- Product detail scrapes
- Duration and errors

## Maintenance

### Cache Cleanup
```typescript
// Clean expired cache (older than 24 hours)
await productCacheService.cleanExpiredCache(24);
```

### Rate Limit Reset
```typescript
// Reset rate limits (admin/testing only)
await scrapingRateLimitService.reset();
```

### Invalidate Product
```typescript
// Force fresh scrape for a product
await productCacheService.invalidateProduct(asin);
```

## Troubleshooting

### Scraping Failures
1. Check rate limits: `scrapingRateLimitService.getStatus()`
2. Verify browser launch: Check logs for Chromium errors
3. Test selectors: Amazon may have changed their HTML

### Cache Issues
1. Check database: `SELECT * FROM product_cache LIMIT 10;`
2. Verify TTL: Products older than 12 hours should be expired
3. Check metrics: `productCacheService.getCacheMetrics()`

### Rate Limit Exceeded
1. Wait for window to reset (1 hour)
2. Adjust limits in `.env` if needed
3. Check Redis: `redis-cli ZRANGE scraping:search_history 0 -1`

## Performance

**Typical Response Times**:
- Cache hit: < 100ms
- Cache miss (scrape): 5-15 seconds
- Fresh validation: 5-10 seconds

**Cache Hit Rate**:
- Cold start: 0%
- After 1 hour: 40-60%
- Steady state: 60-80%

## Migration from PA-API

**Completed**:
- ✅ Removed `paapi5-nodejs-sdk` dependency
- ✅ Removed PA-API environment variables
- ✅ Updated all services to use Playwright
- ✅ Updated tests to remove PA-API checks
- ✅ All integration tests passing

**Breaking Changes**:
- Product structure changed (ScrapedProduct vs PAAPIProduct)
- Price is now `number` instead of `{ amount, currency, displayAmount }`
- `isPrime` → `primeEligible`
- `images.primary.large.url` → `imageUrl`

## Future Improvements

1. **Selector Monitoring**: Alert when selectors break
2. **Cache Warming**: Pre-populate cache for popular searches
3. **Proxy Rotation**: Use proxies if detection becomes an issue
4. **Captcha Handling**: Implement captcha solving if needed
5. **Admin Dashboard**: UI for cache management and metrics

## References

- Playwright Documentation: https://playwright.dev/
- Amazon.co.jp: https://www.amazon.co.jp/
- Rate Limiting: Redis sorted sets with sliding window
- Caching: PostgreSQL with JSONB for flexibility
