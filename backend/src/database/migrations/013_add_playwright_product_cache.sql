-- Migration: Add Playwright Product Cache Tables
-- Description: Creates tables for caching scraped Amazon product data
-- This dramatically reduces scraping frequency by storing products with 12-hour TTL

-- Product cache table: stores individual scraped products
CREATE TABLE IF NOT EXISTS product_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asin VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(500) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'JPY',
  prime_eligible BOOLEAN NOT NULL DEFAULT false,
  rating DECIMAL(2, 1),
  review_count INTEGER,
  seller VARCHAR(255),
  delivery_estimate VARCHAR(100),
  image_url TEXT,
  product_url TEXT NOT NULL,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_product_cache_scraped_at ON product_cache(scraped_at);
CREATE INDEX IF NOT EXISTS idx_product_cache_asin_scraped ON product_cache(asin, scraped_at DESC);

-- Search cache table: stores search query results
CREATE TABLE IF NOT EXISTS product_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash VARCHAR(64) NOT NULL, -- MD5 hash of query + filters for fast lookup
  query_text VARCHAR(500) NOT NULL,
  filters JSONB DEFAULT '{}',
  product_asins TEXT[] NOT NULL, -- Array of ASINs in result order
  result_count INTEGER NOT NULL,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for search cache
CREATE INDEX idx_search_cache_query_hash ON product_search_cache(query_hash);
CREATE INDEX idx_search_cache_scraped_at ON product_search_cache(scraped_at);
CREATE INDEX idx_search_cache_query_hash_scraped ON product_search_cache(query_hash, scraped_at DESC);

-- Scraping metrics table: track scraping activity for monitoring
CREATE TABLE IF NOT EXISTS scraping_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type VARCHAR(50) NOT NULL, -- 'search', 'product_detail', 'validation'
  success BOOLEAN NOT NULL,
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for metrics queries
CREATE INDEX idx_scraping_metrics_type_created ON scraping_metrics(metric_type, created_at DESC);
CREATE INDEX idx_scraping_metrics_success ON scraping_metrics(success, created_at DESC);

-- Trigger to update updated_at on product_cache
CREATE TRIGGER update_product_cache_updated_at 
BEFORE UPDATE ON product_cache
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Function to clean expired cache entries (older than specified hours)
CREATE OR REPLACE FUNCTION clean_expired_product_cache(max_age_hours INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete products older than max_age_hours
  WITH deleted AS (
    DELETE FROM product_cache
    WHERE scraped_at < NOW() - (max_age_hours || ' hours')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  -- Delete search cache entries older than max_age_hours
  DELETE FROM product_search_cache
  WHERE scraped_at < NOW() - (max_age_hours || ' hours')::INTERVAL;
  
  -- Delete old scraping metrics (keep 30 days)
  DELETE FROM scraping_metrics
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comment on tables
COMMENT ON TABLE product_cache IS 'Caches scraped Amazon product data to reduce scraping frequency';
COMMENT ON TABLE product_search_cache IS 'Caches search query results with product ASINs';
COMMENT ON TABLE scraping_metrics IS 'Tracks scraping activity for monitoring and debugging';

-- Comment on key columns
COMMENT ON COLUMN product_cache.asin IS 'Amazon Standard Identification Number';
COMMENT ON COLUMN product_cache.scraped_at IS 'When this product data was scraped from Amazon';
COMMENT ON COLUMN product_search_cache.query_hash IS 'MD5 hash of query text + filters for fast lookup';
COMMENT ON COLUMN product_search_cache.product_asins IS 'Ordered array of product ASINs from search results';
