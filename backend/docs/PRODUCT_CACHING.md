# Product Search Caching

## Overview

The product search caching system uses Redis to cache Amazon Product Advertising API (PA-API) search results and product details, significantly improving performance and reducing API calls.

## Architecture

```
┌─────────────────┐
│  Product Search │
│    Request      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Check Cache    │◄──────┐
└────────┬────────┘       │
         │                │
    ┌────┴────┐           │
    │ Hit?    │           │
    └────┬────┘           │
         │                │
    ┌────┴────┐           │
    │  Yes    │           │
    └────┬────┘           │
         │                │
         ▼                │
┌─────────────────┐       │
│ Return Cached   │       │
│    Results      │       │
└─────────────────┘       │
                          │
    ┌────┴────┐           │
    │   No    │           │
    └────┬────┘           │
         │                │
         ▼                │
┌─────────────────┐       │
│  Call PA-API    │       │
└────────┬────────┘       │
         │                │
         ▼                │
┌─────────────────┐       │
│  Cache Results  │───────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Return Results  │
└─────────────────┘
```

## Cache Configuration

### TTL (Time To Live)

| Cache Type | TTL | Reason |
|------------|-----|--------|
| Search Results | 5 minutes | Balances freshness with performance |
| Product Details | 1 hour | Product info changes less frequently |

### Cache Keys

- **Search Results:** `product_cache:search:{hash}`
  - Hash includes query and all filters
  - Different queries/filters get separate cache entries

- **Product Details:** `product_cache:product:{asin}`
  - One cache entry per ASIN
  - Shared across all users

## Usage

### Automatic Caching

Caching is automatic and transparent. No code changes needed:

```typescript
// This automatically uses cache
const results = await productSearchService.searchProducts('shampoo', {
  primeOnly: true,
  minRating: 3.5
});

// This also automatically uses cache
const product = await productSearchService.getProductDetails('B08XYZ123');
```

### Cache Invalidation

#### Automatic Invalidation

Cache is automatically invalidated when:
- Price changes by more than ¥50
- Detected during `validateProduct()` call

```typescript
// This will invalidate cache if price changed significantly
const validation = await productSearchService.validateProduct(
  'B08XYZ123',
  quotedPrice // Price shown to user
);
```

#### Manual Invalidation

```typescript
import { productCacheService } from './services/productCacheService';

// Invalidate specific product
await productCacheService.invalidateProductCache('B08XYZ123');

// Invalidate all search caches
await productCacheService.invalidateAllSearchCaches();
```

## Monitoring

### Cache Metrics

Get cache performance metrics:

```typescript
import { productCacheService } from './services/productCacheService';

const metrics = productCacheService.getCacheMetrics();
console.log(metrics);
// {
//   hits: 150,
//   misses: 50,
//   invalidations: 5,
//   hitRate: 0.75
// }
```

### Health Endpoint

Cache metrics are included in the health endpoint:

```bash
curl http://localhost:4000/health
```

Response includes:
```json
{
  "status": "healthy",
  "metrics": {
    "cache": {
      "hits": 150,
      "misses": 50,
      "invalidations": 5,
      "hitRate": 0.75
    }
  }
}
```

### Prometheus Metrics

Cache metrics are exposed in Prometheus format:

```bash
curl http://localhost:4000/metrics
```

Metrics available:
- `faxi_cache_hits_total` - Total cache hits
- `faxi_cache_misses_total` - Total cache misses
- `faxi_cache_invalidations_total` - Total invalidations
- `faxi_cache_hit_rate` - Current hit rate (0-1)

## Performance Impact

### Expected Improvements

| Metric | Without Cache | With Cache | Improvement |
|--------|---------------|------------|-------------|
| Search Response Time | 500-2000ms | 5-10ms | 50-200x faster |
| Product Details Time | 300-1000ms | 5-10ms | 30-100x faster |
| PA-API Calls | 100% | 30-50% | 50-70% reduction |

### Cache Hit Rate Targets

- **Search Results:** 40-60% (users search similar terms)
- **Product Details:** 70-80% (same products viewed multiple times)

## Troubleshooting

### Cache Not Working

1. **Check Redis Connection:**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. **Check Cache Keys:**
   ```bash
   redis-cli keys "product_cache:*"
   # Should show cache keys
   ```

3. **Check Logs:**
   ```bash
   # Look for cache-related logs
   grep "Cache hit\|Cache miss" logs/app.log
   ```

### Low Hit Rate

If cache hit rate is lower than expected:

1. **Check TTL:** May be too short
2. **Check Query Patterns:** Users may be searching unique terms
3. **Check Invalidation Rate:** Too many invalidations reduce effectiveness

### High Memory Usage

If Redis memory usage is high:

1. **Check Cache Size:**
   ```bash
   redis-cli info memory
   ```

2. **Monitor Key Count:**
   ```bash
   redis-cli dbsize
   ```

3. **Consider:**
   - Reducing TTLs
   - Implementing LRU eviction
   - Compressing cached data

## Best Practices

### Do's

✅ **Let caching happen automatically** - No need to manually manage cache

✅ **Monitor cache metrics** - Track hit rate and adjust TTLs if needed

✅ **Use cache invalidation** - Invalidate when data changes significantly

✅ **Test with cache** - Include cache in integration tests

### Don'ts

❌ **Don't bypass cache** - Always use the service methods

❌ **Don't cache user-specific data** - Cache is shared across users

❌ **Don't rely on cache for critical data** - Cache can fail gracefully

❌ **Don't manually manage Redis keys** - Use the service methods

## Configuration

### Environment Variables

Uses existing Redis configuration:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Adjusting TTLs

To change cache TTLs, edit `backend/src/services/productCacheService.ts`:

```typescript
private readonly SEARCH_CACHE_TTL = 5 * 60; // 5 minutes
private readonly PRODUCT_CACHE_TTL = 60 * 60; // 1 hour
```

## Testing

### Unit Tests

```bash
npm test -- productCacheService.test.ts
```

Tests:
- Cache storage and retrieval
- TTL configuration
- Cache invalidation
- Metrics tracking

### Integration Tests

```bash
npm test -- productCaching.test.ts
```

Tests:
- Full integration with PA-API
- Cache behavior with real searches
- Price-based invalidation

## Future Enhancements

### Planned Improvements

1. **Configurable TTLs** - Environment variable configuration
2. **Cache Warming** - Pre-populate with popular products
3. **Smart Invalidation** - Invalidate on stock changes
4. **Cache Compression** - Reduce Redis memory usage
5. **Distributed Caching** - Redis Cluster support

### Performance Tuning

1. **TTL Optimization** - Adjust based on usage patterns
2. **Memory Management** - Implement LRU eviction
3. **Batch Operations** - Support batch cache operations

## Support

For issues or questions:
1. Check logs: `logs/app.log`
2. Check Redis: `redis-cli monitor`
3. Check metrics: `curl http://localhost:4000/health`
4. Review code: `backend/src/services/productCacheService.ts`
