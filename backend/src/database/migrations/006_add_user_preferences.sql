-- Add preferences column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Create index for preferences queries
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING GIN (preferences);

-- Update existing users to have default preferences
UPDATE users 
SET preferences = '{
  "spamSensitivity": "medium",
  "welcomeFaxSent": false
}'::jsonb
WHERE preferences IS NULL OR preferences = '{}'::jsonb;