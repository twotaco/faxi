-- Migration: Add fax_number_verified field to users table
-- Purpose: Track whether a user's fax number has been verified by receiving a real fax from Telnyx
-- This prevents email-to-fax conversion for unverified/test phone numbers

ALTER TABLE users ADD COLUMN IF NOT EXISTS fax_number_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fax_number_verified_at TIMESTAMP WITH TIME ZONE;

-- Add index for quick lookups when checking verification status
CREATE INDEX IF NOT EXISTS idx_users_fax_number_verified ON users(fax_number_verified) WHERE fax_number_verified = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN users.fax_number_verified IS 'TRUE when user has sent a real fax TO Faxi via Telnyx, proving their fax number is valid';
COMMENT ON COLUMN users.fax_number_verified_at IS 'Timestamp when fax_number_verified was set to TRUE';
