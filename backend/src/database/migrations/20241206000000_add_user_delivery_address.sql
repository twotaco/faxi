-- Migration: Add delivery address columns to users table
-- This stores the user's default delivery address for shopping orders

ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_postal_code VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_prefecture VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_city VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_address1 VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_address2 VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_phone VARCHAR(20);

-- Add a comment to document the purpose
COMMENT ON COLUMN users.delivery_name IS 'Full name for delivery (may differ from account name)';
COMMENT ON COLUMN users.delivery_postal_code IS 'Japanese postal code (e.g., 150-0001)';
COMMENT ON COLUMN users.delivery_prefecture IS 'Prefecture (e.g., 東京都)';
COMMENT ON COLUMN users.delivery_city IS 'City/Ward (e.g., 渋谷区)';
COMMENT ON COLUMN users.delivery_address1 IS 'Street address line 1';
COMMENT ON COLUMN users.delivery_address2 IS 'Building/apartment details (optional)';
COMMENT ON COLUMN users.delivery_phone IS 'Phone number for delivery contact';
