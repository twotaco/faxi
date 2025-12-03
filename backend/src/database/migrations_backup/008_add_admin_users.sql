-- Migration 008: Add admin users tables for admin dashboard authentication

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

-- Indexes for admin_users
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(role);
CREATE INDEX idx_admin_users_is_active ON admin_users(is_active);

-- Admin refresh tokens table for session management
CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  token_id VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for admin_refresh_tokens
CREATE INDEX idx_admin_refresh_tokens_token_id ON admin_refresh_tokens(token_id);
CREATE INDEX idx_admin_refresh_tokens_admin_user_id ON admin_refresh_tokens(admin_user_id);
CREATE INDEX idx_admin_refresh_tokens_expires_at ON admin_refresh_tokens(expires_at);

-- Admin preferences table for user settings
CREATE TABLE IF NOT EXISTS admin_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (admin_user_id)
);

-- Index for admin_preferences
CREATE INDEX idx_admin_preferences_admin_user_id ON admin_preferences(admin_user_id);

-- Trigger to update updated_at timestamps for admin_users
CREATE TRIGGER update_admin_users_updated_at 
BEFORE UPDATE ON admin_users
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at timestamps for admin_preferences
CREATE TRIGGER update_admin_preferences_updated_at 
BEFORE UPDATE ON admin_preferences
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Insert a default super admin user (password: admin123 - CHANGE IN PRODUCTION!)
-- Password hash is bcrypt hash of 'admin123' with cost factor 12
INSERT INTO admin_users (email, password_hash, name, role, is_active)
VALUES (
  'admin@faxi.jp',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIxKzJN.S6',
  'System Administrator',
  'super_admin',
  true
) ON CONFLICT (email) DO NOTHING;

-- Create default preferences for the admin user
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
