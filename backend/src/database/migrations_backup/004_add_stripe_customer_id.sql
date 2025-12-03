-- Migration: Add Stripe customer ID to users table
-- This migration adds support for storing Stripe customer IDs for payment processing

-- Add stripe_customer_id column to users table
ALTER TABLE users 
ADD COLUMN stripe_customer_id VARCHAR(255) NULL;

-- Add index for faster lookups by Stripe customer ID
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);

-- Add comment to document the column
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe customer ID for payment processing';