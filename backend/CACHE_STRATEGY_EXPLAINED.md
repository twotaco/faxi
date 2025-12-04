# Product Cache Strategy Explained

## Two-Tier Caching System

### Tier 1: Exact Query Hash Cache (Precise)
Creates separate caches based on:

1. **Query text** - "red pencil" ≠ "pencil"
2. **priceMin** - Different cache for each minimum price
3. **priceMax** - Different cache for each maximum price  
4. **primeOnly** - Prime vs non-Prime separate
5. **minRating** - Different rating thresholds separate
6. **category** - Different categories separate

**Example:**
```
"pencil" + {priceMax: 500} → Cache A
"pencil" + {priceMax: 1000} → Cache B (different!)
"red pencil" + {priceMax: 500} → Cache C (different!)
```

### Tier 2: Category Cache (Flexible)
Falls back to category-only matching:
- Only uses **category** (e.g., "pencil", "shampoo")
- Ignores query variations ("red pencil" uses "pencil" cache)
- Ignores all filters
- Then applies filters in-memory

**Example:**
```
"pencil" → Category: "pencil"
"red pencil" → Category: "pencil" (same cache!)
"mechanical pencil" → Category: "pencil" (same cache!)
```

## What Creates Restrictive Caches?

### Filters That Create Separate Caches (Tier 1):

1. **Price Filters** ⚠️ RESTRICTIVE
   - `priceMax: 500` creates budget cache
   - `priceMax: 5000` creates premium cache
   - No price filter = different cache

2. **Prime Filter** ⚠️ RESTRICTIVE
   - `primeOnly: true` (default) = Prime products only
   - `primeOnly: false` = All products
   - Different caches!

3. **Rating Filter** ⚠️ RESTRICTIVE
   - `minRating: 3.5` (default) = Decent quality
   - `minRating: 4.5` = High quality only
   - Different caches!

### Query Variations (Tier 1 vs Tier 2):

**Tier 1 (Exact Hash):**
- "red pencil" ≠ "pencil" → Different caches
- "shampoo for dry hair" ≠ "shampoo" → Different caches

**Tier 2 (Category):**
- "red pencil" = "pencil" → Same cache (category extraction)
- "shampoo for dry hair" = "shampoo" → Same cache

## Cache Pollution Scenarios

### Scenario 1: Price Filter Pollution ✅ FIXED
```
User A: "shampoo" + {priceMax: 500}
  → Tier 1: Cache with 5 budget shampoos

User B: "shampoo" + {no price filter}
  → Tier 1: Cache miss (different filters!)
  → Tier 2: Category cache returns budget shampoos
  → applyPriceFilters: All pass (no max price)
  → Quality check: Low rating detected
  → Falls through to scraping ✅
```

### Scenario 2: Prime Filter Pollution
```
User A: "pencil" + {primeOnly: false}
  → Tier 1: Cache with non-Prime pencils

User B: "pencil" + {primeOnly: true} (default)
  → Tier 1: Cache miss (different filters!)
  → Tier 2: Category cache returns non-Prime pencils
  → applyPriceFilters: Removes non-Prime products
  → May have insufficient results → Scrapes ✅
```

### Scenario 3: Rating Filter Pollution
```
User A: "shampoo" + {minRating: 3.0}
  → Tier 1: Cache with low-rated shampoos

User B: "shampoo" + {minRating: 3.5} (default)
  → Tier 1: Cache miss (different filters!)
  → Tier 2: Category cache returns low-rated shampoos
  → applyPriceFilters: Removes products < 3.5 rating
  → May have insufficient results → Scrapes ✅
```

## Current Protections

### 1. Filter Application (Fix #1)
All filters are applied to category cache results:
- Price min/max
- Prime eligibility
- Minimum rating

### 2. Minimum Result Threshold (Fix #2)
Requires ≥3 products after filtering, else scrapes

### 3. Quality Check (Fix #3)
For unfiltered searches with low-quality cache:
- No price filter + avg rating < 4.0 + < 10 products → Scrapes

## Recommendations

### Current System: GOOD ✅
The two-tier system with in-memory filtering works well because:
1. Exact matches use precise cache (fast)
2. Category fallback provides flexibility
3. Filters applied in-memory ensure correctness
4. Quality checks prevent bad UX

### Potential Improvements (Future):
1. **Cache metadata**: Store original filters with cache
2. **Smart fallback**: Prefer less-filtered caches for unfiltered searches
3. **Cache scoring**: Rank caches by "representativeness"

But for MVP, current system is solid!

## Summary

**Filters that create separate caches:**
- ✅ Price (min/max)
- ✅ Prime eligibility
- ✅ Minimum rating
- ✅ Category
- ✅ Query text (Tier 1 only)

**All are handled correctly** with in-memory filtering and quality checks!
