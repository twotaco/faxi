-- Migration 020: Fix missing schema elements
-- This migration ensures all required schema elements exist that may have been
-- skipped due to earlier migration failures

-- =====================================================
-- 1. Add missing feature_flags column to users table
-- =====================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_users_feature_flags ON users USING GIN (feature_flags);

-- =====================================================
-- 2. Ensure product_cache table exists with all columns
-- =====================================================
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  -- Additional columns from 014_product_cache_categories
  category VARCHAR(100),
  product_name VARCHAR(255),
  brand VARCHAR(100),
  quantity VARCHAR(50),
  description TEXT
);

-- Add columns if table already exists but missing columns
ALTER TABLE product_cache ADD COLUMN IF NOT EXISTS rating DECIMAL(2, 1);
ALTER TABLE product_cache ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE product_cache ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE product_cache ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);
ALTER TABLE product_cache ADD COLUMN IF NOT EXISTS brand VARCHAR(100);
ALTER TABLE product_cache ADD COLUMN IF NOT EXISTS quantity VARCHAR(50);
ALTER TABLE product_cache ADD COLUMN IF NOT EXISTS description TEXT;

-- Indexes for product_cache
CREATE INDEX IF NOT EXISTS idx_product_cache_scraped_at ON product_cache(scraped_at);
CREATE INDEX IF NOT EXISTS idx_product_cache_asin_scraped ON product_cache(asin, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_cache_category ON product_cache(category);
CREATE INDEX IF NOT EXISTS idx_product_cache_category_rating ON product_cache(category, rating DESC);

-- =====================================================
-- 3. Ensure product_search_cache table exists
-- =====================================================
CREATE TABLE IF NOT EXISTS product_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash VARCHAR(64) NOT NULL,
  query_text VARCHAR(500) NOT NULL,
  filters JSONB DEFAULT '{}',
  product_asins TEXT[] NOT NULL,
  result_count INTEGER NOT NULL,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_cache_query_hash ON product_search_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_search_cache_scraped_at ON product_search_cache(scraped_at);
CREATE INDEX IF NOT EXISTS idx_search_cache_query_hash_scraped ON product_search_cache(query_hash, scraped_at DESC);

-- =====================================================
-- 4. Ensure scraping_metrics table exists
-- =====================================================
CREATE TABLE IF NOT EXISTS scraping_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type VARCHAR(50) NOT NULL,
  success BOOLEAN NOT NULL,
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scraping_metrics_type_created ON scraping_metrics(metric_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraping_metrics_success ON scraping_metrics(success, created_at DESC);

-- =====================================================
-- 5. Ensure demo_sessions table exists (for demo page)
-- =====================================================
CREATE TABLE IF NOT EXISTS demo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) UNIQUE NOT NULL,
  fixture_id VARCHAR(255),
  visitor_ip VARCHAR(45),
  user_agent TEXT,
  processing_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_demo_sessions_session_id ON demo_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_created_at ON demo_sessions(created_at);

-- =====================================================
-- 6. Insert demo user (for demo page functionality)
-- =====================================================
INSERT INTO users (
  id,
  phone_number,
  email_address,
  name,
  preferences,
  feature_flags
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '+81-0000-000-0001',
  'demo@faxi.jp',
  'Demo User',
  '{"language": "ja", "welcomeFaxSent": true}'::jsonb,
  '{"demoUser": true, "skipRateLimit": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  preferences = EXCLUDED.preferences,
  feature_flags = EXCLUDED.feature_flags,
  updated_at = CURRENT_TIMESTAMP;

-- =====================================================
-- 7. Insert default admin user (for admin dashboard)
-- =====================================================
-- Password: admin123 (bcrypt hash with cost factor 12)
INSERT INTO admin_users (email, password_hash, name, role, is_active)
VALUES (
  'admin@faxi.jp',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIxKzJN.S6',
  'System Administrator',
  'super_admin',
  true
) ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- 8. Ensure application_logs table exists (with correct indexes)
-- =====================================================
CREATE TABLE IF NOT EXISTS application_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(10) NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    error_data JSONB,
    performance_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Use btree indexes (not GIN) for jsonb text extraction
CREATE INDEX IF NOT EXISTS idx_application_logs_level ON application_logs(level);
CREATE INDEX IF NOT EXISTS idx_application_logs_created_at ON application_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_application_logs_context_user_id ON application_logs(((context->>'userId')));
CREATE INDEX IF NOT EXISTS idx_application_logs_context_fax_job_id ON application_logs(((context->>'faxJobId')));
CREATE INDEX IF NOT EXISTS idx_application_logs_level_created_at ON application_logs(level, created_at);

-- Partial index for errors only
CREATE INDEX IF NOT EXISTS idx_application_logs_errors ON application_logs(created_at) WHERE level = 'error';

-- =====================================================
-- 9. Create cleanup function for application logs
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_old_application_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM application_logs
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Done
-- =====================================================
