-- Migration: Add Demo User
-- Description: Creates a demo user for the interactive demo page
-- This user allows the demo to use real MCP shopping functionality

-- Use a well-known UUID for the demo user (easy to identify in logs)
-- UUID: 00000000-0000-0000-0000-000000000001
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

-- Add comment
COMMENT ON COLUMN users.feature_flags IS 'Feature flags including demoUser flag for demo page users';
