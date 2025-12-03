-- Add email abuse prevention tables and fields

-- Create email_blocklist table for user-managed blocked senders
CREATE TABLE IF NOT EXISTS email_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_email VARCHAR(255) NOT NULL,
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, blocked_email)
);

CREATE INDEX IF NOT EXISTS idx_email_blocklist_user_id ON email_blocklist(user_id);
CREATE INDEX IF NOT EXISTS idx_email_blocklist_email ON email_blocklist(LOWER(blocked_email));

COMMENT ON TABLE email_blocklist IS 'User-managed blocklist of email addresses to reject';
COMMENT ON COLUMN email_blocklist.blocked_email IS 'Email address to block (stored as-is, matched case-insensitively)';

-- Create user_complaints table for tracking complaint events
CREATE TABLE IF NOT EXISTS user_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id VARCHAR(255) NOT NULL,
  complained_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  complaint_type VARCHAR(50),
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_complaints_user_id ON user_complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_user_complaints_date ON user_complaints(complained_at);

COMMENT ON TABLE user_complaints IS 'Tracks complaint notifications received from email providers';
COMMENT ON COLUMN user_complaints.complaint_type IS 'Type of complaint (e.g., abuse, fraud, virus, other)';
COMMENT ON COLUMN user_complaints.details IS 'Additional complaint details from provider';

-- Create email_metrics table for quality monitoring
CREATE TABLE IF NOT EXISTS email_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('sent', 'delivered', 'bounced', 'complained')),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message_id VARCHAR(255),
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_email_metrics_event_type ON email_metrics(event_type);
CREATE INDEX IF NOT EXISTS idx_email_metrics_occurred_at ON email_metrics(occurred_at);
CREATE INDEX IF NOT EXISTS idx_email_metrics_user_id ON email_metrics(user_id);

COMMENT ON TABLE email_metrics IS 'Email quality metrics for monitoring bounce/complaint rates';
COMMENT ON COLUMN email_metrics.event_type IS 'Type of email event: sent, delivered, bounced, complained';
COMMENT ON COLUMN email_metrics.details IS 'Additional event details in JSON format';

-- Add email restriction fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_restricted BOOLEAN DEFAULT FALSE;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_restricted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_restriction_reason TEXT;

COMMENT ON COLUMN users.email_restricted IS 'Whether user is restricted from sending outbound emails due to complaints';
COMMENT ON COLUMN users.email_restricted_at IS 'Timestamp when email restriction was applied';
COMMENT ON COLUMN users.email_restriction_reason IS 'Reason for email restriction (e.g., excessive complaints)';
