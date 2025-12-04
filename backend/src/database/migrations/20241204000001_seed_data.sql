-- Migration 002: Seed Data
-- Creates essential initial data (demo user, admin user)
--
-- IMPORTANT: Uses ON CONFLICT to be idempotent

-- ============================================================
-- DEMO USER
-- ============================================================
-- UUID: 00000000-0000-0000-0000-000000000001 (well-known ID for debugging)

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

-- ============================================================
-- ADMIN USER
-- ============================================================
-- Default admin user (password: admin123)
-- Password hash is bcrypt with cost factor 12
-- IMPORTANT: Change this password in production!

INSERT INTO admin_users (
  email,
  password_hash,
  name,
  role,
  is_active
) VALUES (
  'admin@faxi.jp',
  '$2b$12$OK./5bbAPbj49xUEPBcoqOkwvfNq0U/v1jfxyyoRubb1mQ9kz4A5i',
  'System Administrator',
  'super_admin',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP;

-- Create default preferences for admin user
INSERT INTO admin_preferences (admin_user_id, preferences)
SELECT id, '{
  "theme": "light",
  "notifications": {
    "email": true,
    "browser": true,
    "sound": false
  },
  "dashboard": {
    "refreshInterval": 5000,
    "defaultView": "operations"
  }
}'::jsonb
FROM admin_users
WHERE email = 'admin@faxi.jp'
ON CONFLICT (admin_user_id) DO NOTHING;
