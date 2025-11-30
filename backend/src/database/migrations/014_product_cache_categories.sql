-- Migration: Add category-based caching support
-- Purpose: Enable category-based product cache lookups instead of exact query-hash matching

-- Add category and structured fields to product_cache
ALTER TABLE product_cache
  ADD COLUMN IF NOT EXISTS category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
  ADD COLUMN IF NOT EXISTS quantity VARCHAR(50),
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Index for category lookups (main query pattern)
CREATE INDEX IF NOT EXISTS idx_product_cache_category ON product_cache(category);

-- Composite index for category + rating (for filtering top-rated products)
CREATE INDEX IF NOT EXISTS idx_product_cache_category_rating ON product_cache(category, rating DESC);

-- Comment on the new architecture
COMMENT ON COLUMN product_cache.category IS 'Normalized product category (shampoo, soap, etc.) for cache lookups';
COMMENT ON COLUMN product_cache.product_name IS 'Short product name without brand (extracted by LLM)';
COMMENT ON COLUMN product_cache.brand IS 'Manufacturer/brand name (extracted by LLM)';
COMMENT ON COLUMN product_cache.quantity IS 'Size/amount (e.g., 500ml, 2pack) for filtering';
COMMENT ON COLUMN product_cache.description IS 'Brief description for order form display';
