-- Add shopping cart table for persistent cart functionality

CREATE TABLE IF NOT EXISTS shopping_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]', -- Array of cart items with product details
  total_amount DECIMAL(10, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'JPY',
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id) -- One cart per user
);

CREATE INDEX idx_shopping_carts_user_id ON shopping_carts(user_id);
CREATE INDEX idx_shopping_carts_expires_at ON shopping_carts(expires_at);

-- Add trigger for updating shopping_carts.updated_at
CREATE TRIGGER update_shopping_carts_updated_at BEFORE UPDATE ON shopping_carts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Product cache table for storing search results and product details
CREATE TABLE IF NOT EXISTS product_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_product_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'JPY',
  image_url TEXT,
  availability VARCHAR(50),
  estimated_delivery VARCHAR(100),
  specifications JSONB,
  reviews_summary JSONB,
  complementary_products JSONB, -- Array of related product IDs
  bundle_deals JSONB, -- Array of bundle offers
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour')
);

CREATE INDEX idx_product_cache_external_id ON product_cache(external_product_id);
CREATE INDEX idx_product_cache_name ON product_cache(name);
CREATE INDEX idx_product_cache_expires_at ON product_cache(expires_at);

-- Search cache table for caching product search results
CREATE TABLE IF NOT EXISTS search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash VARCHAR(64) UNIQUE NOT NULL, -- Hash of search query and parameters
  query_text VARCHAR(500) NOT NULL,
  results JSONB NOT NULL, -- Array of product IDs and basic info
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 minutes')
);

CREATE INDEX idx_search_cache_query_hash ON search_cache(query_hash);
CREATE INDEX idx_search_cache_expires_at ON search_cache(expires_at);