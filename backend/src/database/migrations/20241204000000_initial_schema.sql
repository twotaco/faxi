-- Migration 001: Initial Schema
-- This is the complete initial schema for Faxi
-- All subsequent migrations will be incremental changes
--
-- IMPORTANT: This migration is idempotent (safe to run multiple times)
-- It uses IF NOT EXISTS for all CREATE statements

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Users table (one per fax machine)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  email_address VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  preferences JSONB DEFAULT '{}',
  feature_flags JSONB DEFAULT '{}',
  -- Email abuse prevention fields
  email_restricted BOOLEAN DEFAULT FALSE,
  email_restricted_at TIMESTAMP WITH TIME ZONE,
  email_restriction_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_email_address ON users(email_address);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING GIN (preferences);
CREATE INDEX IF NOT EXISTS idx_users_feature_flags ON users USING GIN (feature_flags);

-- Fax jobs table
CREATE TABLE IF NOT EXISTS fax_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fax_id VARCHAR(255) UNIQUE NOT NULL,
  reference_id VARCHAR(20) UNIQUE,
  user_id UUID REFERENCES users(id),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number VARCHAR(20) NOT NULL,
  to_number VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'sending', 'delivered')),
  page_count INTEGER,
  media_url TEXT,
  storage_key TEXT,
  webhook_payload JSONB,
  interpretation_result JSONB,
  action_results JSONB,
  error_message TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  telnyx_fax_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_fax_jobs_fax_id ON fax_jobs(fax_id);
CREATE INDEX IF NOT EXISTS idx_fax_jobs_reference_id ON fax_jobs(reference_id);
CREATE INDEX IF NOT EXISTS idx_fax_jobs_user_id ON fax_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_fax_jobs_status ON fax_jobs(status);
CREATE INDEX IF NOT EXISTS idx_fax_jobs_created_at ON fax_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_fax_jobs_delivered_at ON fax_jobs(delivered_at);
CREATE INDEX IF NOT EXISTS idx_fax_jobs_telnyx_fax_id ON fax_jobs(telnyx_fax_id);

-- Conversation contexts table
CREATE TABLE IF NOT EXISTS conversation_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  reference_id VARCHAR(20) UNIQUE NOT NULL,
  context_type VARCHAR(50) NOT NULL,
  context_data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversation_contexts_user_id ON conversation_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_contexts_reference_id ON conversation_contexts(reference_id);
CREATE INDEX IF NOT EXISTS idx_conversation_contexts_expires_at ON conversation_contexts(expires_at);

-- Payment methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  stripe_payment_method_id VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('card', 'konbini')),
  last4 VARCHAR(4),
  brand VARCHAR(50),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_id ON payment_methods(stripe_payment_method_id);

-- Address book table
CREATE TABLE IF NOT EXISTS address_book (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email_address VARCHAR(255) NOT NULL,
  relationship VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, email_address)
);

CREATE INDEX IF NOT EXISTS idx_address_book_user_id ON address_book(user_id);
CREATE INDEX IF NOT EXISTS idx_address_book_email ON address_book(email_address);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  fax_job_id UUID REFERENCES fax_jobs(id),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_fax_job_id ON audit_logs(fax_job_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Reference ID sequence table
CREATE TABLE IF NOT EXISTS reference_id_sequence (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- ADMIN TABLES
-- ============================================================

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'admin', 'support', 'analyst')),
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON admin_users(is_active);

-- Admin refresh tokens table
CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  token_id VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_refresh_tokens_token_id ON admin_refresh_tokens(token_id);
CREATE INDEX IF NOT EXISTS idx_admin_refresh_tokens_admin_user_id ON admin_refresh_tokens(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_refresh_tokens_expires_at ON admin_refresh_tokens(expires_at);

-- Admin preferences table
CREATE TABLE IF NOT EXISTS admin_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (admin_user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_preferences_admin_user_id ON admin_preferences(admin_user_id);

-- ============================================================
-- EMAIL TABLES
-- ============================================================

-- Email threads table
CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  thread_id VARCHAR(255) UNIQUE NOT NULL,
  subject VARCHAR(500) NOT NULL,
  participants JSONB NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_threads_user_id ON email_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_thread_id ON email_threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message_at ON email_threads(last_message_at);

-- Email messages table
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES email_threads(id) NOT NULL,
  message_id VARCHAR(255) UNIQUE NOT NULL,
  from_address VARCHAR(255) NOT NULL,
  to_addresses JSONB NOT NULL,
  cc_addresses JSONB,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  html_body TEXT,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'bounced', 'complained')),
  delivery_timestamp TIMESTAMP WITH TIME ZONE,
  delivery_details TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON email_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_from_address ON email_messages(from_address);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at ON email_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_messages_delivery_status ON email_messages(delivery_status);

-- Email blocklist table
CREATE TABLE IF NOT EXISTS email_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_email VARCHAR(255) NOT NULL,
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, blocked_email)
);

CREATE INDEX IF NOT EXISTS idx_email_blocklist_user_id ON email_blocklist(user_id);
CREATE INDEX IF NOT EXISTS idx_email_blocklist_email ON email_blocklist(LOWER(blocked_email));

-- User complaints table
CREATE TABLE IF NOT EXISTS user_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id VARCHAR(255) NOT NULL,
  complained_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  complaint_type VARCHAR(50),
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_complaints_user_id ON user_complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_user_complaints_date ON user_complaints(complained_at);

-- Email metrics table
CREATE TABLE IF NOT EXISTS email_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('sent', 'delivered', 'bounced', 'complained')),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message_id VARCHAR(255),
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_email_metrics_event_type ON email_metrics(event_type);
CREATE INDEX IF NOT EXISTS idx_email_metrics_occurred_at ON email_metrics(occurred_at);
CREATE INDEX IF NOT EXISTS idx_email_metrics_user_id ON email_metrics(user_id);

-- ============================================================
-- SHOPPING TABLES
-- ============================================================

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  reference_id VARCHAR(20) NOT NULL,
  external_order_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending_payment', 'paid', 'pending_purchase', 'purchased', 'shipped', 'delivered', 'cancelled', 'pending', 'processing')),
  total_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'JPY',
  items JSONB NOT NULL,
  shipping_address JSONB,
  tracking_number VARCHAR(255),
  product_asin VARCHAR(20),
  product_title VARCHAR(255),
  product_image_url TEXT,
  quantity INTEGER DEFAULT 1,
  quoted_price DECIMAL(10, 2),
  actual_price DECIMAL(10, 2),
  stripe_payment_intent_id VARCHAR(255),
  admin_user_id UUID REFERENCES admin_users(id),
  purchased_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_reference_id ON orders(reference_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_status_paid ON orders(status) WHERE status = 'paid';
CREATE INDEX IF NOT EXISTS idx_orders_admin_user_id ON orders(admin_user_id) WHERE admin_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id ON orders(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- Shopping carts table
CREATE TABLE IF NOT EXISTS shopping_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total_amount DECIMAL(10, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'JPY',
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_shopping_carts_user_id ON shopping_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_carts_expires_at ON shopping_carts(expires_at);

-- Product cache table (for Playwright scraping)
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
  category VARCHAR(100),
  product_name VARCHAR(255),
  brand VARCHAR(100),
  quantity VARCHAR(50),
  description TEXT,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_cache_scraped_at ON product_cache(scraped_at);
CREATE INDEX IF NOT EXISTS idx_product_cache_asin_scraped ON product_cache(asin, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_cache_category ON product_cache(category);
CREATE INDEX IF NOT EXISTS idx_product_cache_category_rating ON product_cache(category, rating DESC);

-- Product search cache table
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

-- Scraping metrics table
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

-- ============================================================
-- ANALYTICS & METRICS TABLES
-- ============================================================

-- User insights table
CREATE TABLE IF NOT EXISTS user_insights (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile_data JSONB NOT NULL DEFAULT '{}',
  last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,
  age_range VARCHAR(20),
  gender VARCHAR(20),
  region VARCHAR(100),
  household_type VARCHAR(50),
  digital_exclusion_score INTEGER CHECK (digital_exclusion_score BETWEEN 1 AND 5),
  total_interactions INTEGER DEFAULT 0,
  last_interaction_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_insights_user ON user_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_user_insights_region ON user_insights(region);
CREATE INDEX IF NOT EXISTS idx_user_insights_age_range ON user_insights(age_range);
CREATE INDEX IF NOT EXISTS idx_user_insights_digital_score ON user_insights(digital_exclusion_score);
CREATE INDEX IF NOT EXISTS idx_user_insights_last_interaction ON user_insights(last_interaction_at);
CREATE INDEX IF NOT EXISTS idx_user_insights_profile_data ON user_insights USING GIN (profile_data);

-- Insights history table
CREATE TABLE IF NOT EXISTS insights_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fax_job_id UUID REFERENCES fax_jobs(id) ON DELETE SET NULL,
  insight_type VARCHAR(50) NOT NULL,
  insight_category VARCHAR(50),
  insight_data JSONB NOT NULL,
  confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
  detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  previous_value JSONB,
  new_value JSONB
);

CREATE INDEX IF NOT EXISTS idx_insights_history_user ON insights_history(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_history_type ON insights_history(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_history_category ON insights_history(insight_category);
CREATE INDEX IF NOT EXISTS idx_insights_history_detected ON insights_history(detected_at);
CREATE INDEX IF NOT EXISTS idx_insights_history_fax_job ON insights_history(fax_job_id);
CREATE INDEX IF NOT EXISTS idx_insights_history_data ON insights_history USING GIN (insight_data);

-- Aggregate insights table
CREATE TABLE IF NOT EXISTS aggregate_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region VARCHAR(100),
  age_range VARCHAR(20),
  household_type VARCHAR(50),
  insight_category VARCHAR(50) NOT NULL,
  aggregate_data JSONB NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sample_size INTEGER NOT NULL CHECK (sample_size >= 100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aggregate_insights_region ON aggregate_insights(region);
CREATE INDEX IF NOT EXISTS idx_aggregate_insights_category ON aggregate_insights(insight_category);
CREATE INDEX IF NOT EXISTS idx_aggregate_insights_period ON aggregate_insights(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_aggregate_insights_age ON aggregate_insights(age_range);
CREATE INDEX IF NOT EXISTS idx_aggregate_insights_data ON aggregate_insights USING GIN (aggregate_data);

-- Processing metrics table
CREATE TABLE IF NOT EXISTS processing_metrics (
  id SERIAL PRIMARY KEY,
  fax_job_id UUID REFERENCES fax_jobs(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL,
  accuracy DECIMAL(5,2),
  confidence DECIMAL(5,2),
  processing_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_processing_metrics_type ON processing_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_processing_metrics_created ON processing_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_processing_metrics_fax_job ON processing_metrics(fax_job_id);
CREATE INDEX IF NOT EXISTS idx_processing_metrics_success ON processing_metrics(success);

-- Demo sessions table
CREATE TABLE IF NOT EXISTS demo_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  fixture_id VARCHAR(255),
  uploaded_image_url TEXT,
  processing_result JSONB,
  visitor_ip VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_demo_sessions_created ON demo_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_session_id ON demo_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_fixture ON demo_sessions(fixture_id);

-- Accuracy snapshots table
CREATE TABLE IF NOT EXISTS accuracy_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  overall_accuracy DECIMAL(5,2),
  ocr_accuracy DECIMAL(5,2),
  annotation_accuracy DECIMAL(5,2),
  intent_accuracy DECIMAL(5,2),
  sample_count INTEGER,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accuracy_snapshots_date ON accuracy_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_accuracy_snapshots_created ON accuracy_snapshots(created_at);

-- Application logs table
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

CREATE INDEX IF NOT EXISTS idx_application_logs_level ON application_logs(level);
CREATE INDEX IF NOT EXISTS idx_application_logs_created_at ON application_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_application_logs_context_user_id ON application_logs(((context->>'userId')));
CREATE INDEX IF NOT EXISTS idx_application_logs_context_fax_job_id ON application_logs(((context->>'faxJobId')));
CREATE INDEX IF NOT EXISTS idx_application_logs_level_created_at ON application_logs(level, created_at);
CREATE INDEX IF NOT EXISTS idx_application_logs_errors ON application_logs(created_at) WHERE level = 'error';

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to generate reference IDs
CREATE OR REPLACE FUNCTION generate_reference_id()
RETURNS VARCHAR(20) AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
  ref_id VARCHAR(20);
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_TIMESTAMP);

  INSERT INTO reference_id_sequence (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = reference_id_sequence.last_number + 1
  RETURNING last_number INTO next_number;

  ref_id := 'FX-' || current_year || '-' || LPAD(next_number::TEXT, 6, '0');

  RETURN ref_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-generate reference IDs
CREATE OR REPLACE FUNCTION set_reference_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.direction = 'outbound' AND NEW.reference_id IS NULL THEN
    NEW.reference_id := generate_reference_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired product cache
CREATE OR REPLACE FUNCTION clean_expired_product_cache(max_age_hours INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM product_cache
    WHERE scraped_at < NOW() - (max_age_hours || ' hours')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  DELETE FROM product_search_cache
  WHERE scraped_at < NOW() - (max_age_hours || ' hours')::INTERVAL;

  DELETE FROM scraping_metrics
  WHERE created_at < NOW() - INTERVAL '30 days';

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old application logs
CREATE OR REPLACE FUNCTION cleanup_old_application_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM application_logs
  WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Drop triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS trigger_set_reference_id ON fax_jobs;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_fax_jobs_updated_at ON fax_jobs;
DROP TRIGGER IF EXISTS update_conversation_contexts_updated_at ON conversation_contexts;
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON payment_methods;
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
DROP TRIGGER IF EXISTS update_address_book_updated_at ON address_book;
DROP TRIGGER IF EXISTS update_email_threads_updated_at ON email_threads;
DROP TRIGGER IF EXISTS update_shopping_carts_updated_at ON shopping_carts;
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
DROP TRIGGER IF EXISTS update_admin_preferences_updated_at ON admin_preferences;
DROP TRIGGER IF EXISTS update_product_cache_updated_at ON product_cache;

-- Create triggers
CREATE TRIGGER trigger_set_reference_id
BEFORE INSERT ON fax_jobs
FOR EACH ROW EXECUTE FUNCTION set_reference_id();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fax_jobs_updated_at BEFORE UPDATE ON fax_jobs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_contexts_updated_at BEFORE UPDATE ON conversation_contexts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_address_book_updated_at BEFORE UPDATE ON address_book
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_threads_updated_at BEFORE UPDATE ON email_threads
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopping_carts_updated_at BEFORE UPDATE ON shopping_carts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_preferences_updated_at BEFORE UPDATE ON admin_preferences
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_cache_updated_at BEFORE UPDATE ON product_cache
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
