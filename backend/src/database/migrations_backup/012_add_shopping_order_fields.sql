-- Add shopping-specific columns to orders table for Amazon.co.jp proxy shopping service

-- Add product information columns
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS product_asin VARCHAR(20);

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS product_title VARCHAR(255);

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS product_image_url TEXT;

COMMENT ON COLUMN orders.product_asin IS 'Amazon Standard Identification Number for the product';
COMMENT ON COLUMN orders.product_title IS 'Product title from Amazon';
COMMENT ON COLUMN orders.product_image_url IS 'URL to product image from Amazon';

-- Add quantity and pricing columns
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS quoted_price DECIMAL(10, 2);

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS actual_price DECIMAL(10, 2);

COMMENT ON COLUMN orders.quantity IS 'Number of items ordered';
COMMENT ON COLUMN orders.quoted_price IS 'Price quoted to user in Product Options Fax';
COMMENT ON COLUMN orders.actual_price IS 'Actual price at checkout (may differ from quoted price)';

-- Add payment and admin tracking columns
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS admin_user_id UUID REFERENCES admin_users(id);

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN orders.stripe_payment_intent_id IS 'Stripe payment intent ID for this order';
COMMENT ON COLUMN orders.admin_user_id IS 'Admin user who completed the purchase on Amazon';
COMMENT ON COLUMN orders.purchased_at IS 'Timestamp when admin completed purchase on Amazon';

-- Update status check constraint to include shopping-specific statuses
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN (
  'pending_payment',   -- Awaiting payment
  'paid',              -- Payment confirmed
  'pending_purchase',  -- Ready for admin review
  'purchased',         -- Bought on Amazon
  'shipped',           -- Tracking number added
  'delivered',         -- Delivery confirmed
  'cancelled',         -- Order cancelled
  'pending',           -- Legacy status
  'processing'         -- Legacy status
));

COMMENT ON COLUMN orders.status IS 'Order status: pending_payment, paid, pending_purchase, purchased, shipped, delivered, cancelled';

-- Create index for pending purchase queue (orders with status = 'paid')
CREATE INDEX IF NOT EXISTS idx_orders_status_paid 
ON orders(status) WHERE status = 'paid';

COMMENT ON INDEX idx_orders_status_paid IS 'Index for admin dashboard pending purchase queue';

-- Create index for admin user orders
CREATE INDEX IF NOT EXISTS idx_orders_admin_user_id 
ON orders(admin_user_id) WHERE admin_user_id IS NOT NULL;

COMMENT ON INDEX idx_orders_admin_user_id IS 'Index for tracking orders by admin user';

-- Create index for Stripe payment intent lookups
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id 
ON orders(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

COMMENT ON INDEX idx_orders_stripe_payment_intent_id IS 'Index for looking up orders by Stripe payment intent';