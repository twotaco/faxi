-- Faxi Core System Database Schema

-- Users table (one per fax machine)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  email_address VARCHAR(255) UNIQUE NOT NULL, -- {phone_number}@me.faxi.jp
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_phone_number ON users(phone_number);
CREATE INDEX idx_users_email_address ON users(email_address);

-- Fax jobs table
CREATE TABLE IF NOT EXISTS fax_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fax_id VARCHAR(255) UNIQUE NOT NULL, -- Telnyx fax ID for idempotency
  reference_id VARCHAR(20) UNIQUE, -- FX-YYYY-NNNNNN format
  user_id UUID REFERENCES users(id),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number VARCHAR(20) NOT NULL,
  to_number VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  page_count INTEGER,
  media_url TEXT,
  storage_key TEXT, -- S3 key for stored fax image
  webhook_payload JSONB,
  interpretation_result JSONB,
  action_results JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_fax_jobs_fax_id ON fax_jobs(fax_id);
CREATE INDEX idx_fax_jobs_reference_id ON fax_jobs(reference_id);
CREATE INDEX idx_fax_jobs_user_id ON fax_jobs(user_id);
CREATE INDEX idx_fax_jobs_status ON fax_jobs(status);
CREATE INDEX idx_fax_jobs_created_at ON fax_jobs(created_at);

-- Conversation contexts table
CREATE TABLE IF NOT EXISTS conversation_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  reference_id VARCHAR(20) UNIQUE NOT NULL,
  context_type VARCHAR(50) NOT NULL, -- 'email', 'shopping', 'ai_chat', etc.
  context_data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversation_contexts_user_id ON conversation_contexts(user_id);
CREATE INDEX idx_conversation_contexts_reference_id ON conversation_contexts(reference_id);
CREATE INDEX idx_conversation_contexts_expires_at ON conversation_contexts(expires_at);

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

CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_stripe_id ON payment_methods(stripe_payment_method_id);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  reference_id VARCHAR(20) NOT NULL,
  external_order_id VARCHAR(255), -- From e-commerce platform (Amazon Order ID)
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending_payment', 'paid', 'pending_purchase', 'purchased', 'shipped', 'delivered', 'cancelled', 'pending', 'processing')),
  total_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'JPY',
  items JSONB NOT NULL,
  shipping_address JSONB,
  tracking_number VARCHAR(255),
  -- Shopping-specific columns
  product_asin VARCHAR(20), -- Amazon Standard Identification Number
  product_title VARCHAR(255), -- Product title from Amazon
  product_image_url TEXT, -- URL to product image
  quantity INTEGER DEFAULT 1, -- Number of items ordered
  quoted_price DECIMAL(10, 2), -- Price quoted to user in Product Options Fax
  actual_price DECIMAL(10, 2), -- Actual price at checkout
  stripe_payment_intent_id VARCHAR(255), -- Stripe payment intent ID
  admin_user_id UUID, -- Admin who completed purchase (FK added in migration 008)
  purchased_at TIMESTAMP WITH TIME ZONE, -- When admin completed purchase
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_reference_id ON orders(reference_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_status_paid ON orders(status) WHERE status = 'paid';
CREATE INDEX idx_orders_admin_user_id ON orders(admin_user_id) WHERE admin_user_id IS NOT NULL;
CREATE INDEX idx_orders_stripe_payment_intent_id ON orders(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

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

CREATE INDEX idx_address_book_user_id ON address_book(user_id);
CREATE INDEX idx_address_book_email ON address_book(email_address);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  fax_job_id UUID REFERENCES fax_jobs(id),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_fax_job_id ON audit_logs(fax_job_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Reference ID sequence table
CREATE TABLE IF NOT EXISTS reference_id_sequence (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- Function to generate reference IDs
CREATE OR REPLACE FUNCTION generate_reference_id()
RETURNS VARCHAR(20) AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
  reference_id VARCHAR(20);
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_TIMESTAMP);
  
  -- Get or create sequence for current year
  INSERT INTO reference_id_sequence (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = reference_id_sequence.last_number + 1
  RETURNING last_number INTO next_number;
  
  -- Format: FX-YYYY-NNNNNN
  reference_id := 'FX-' || current_year || '-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN reference_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate reference IDs for outbound faxes
CREATE OR REPLACE FUNCTION set_reference_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.direction = 'outbound' AND NEW.reference_id IS NULL THEN
    NEW.reference_id := generate_reference_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_reference_id
BEFORE INSERT ON fax_jobs
FOR EACH ROW
EXECUTE FUNCTION set_reference_id();

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
