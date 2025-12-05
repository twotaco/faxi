-- Migration: Add rejection_reason column to email_messages table
-- Purpose: Track why inbound emails were rejected (unregistered, unverified, blocked)
-- Also make thread_id nullable to support orphan rejected emails (no user to associate)

-- Add rejection_reason column
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(50);
-- Values: NULL (not rejected), 'unregistered_recipient', 'unverified_recipient', 'blocked_sender'

-- Make thread_id nullable for orphan rejected emails (emails to unregistered recipients)
ALTER TABLE email_messages ALTER COLUMN thread_id DROP NOT NULL;

-- Add index for querying rejected emails
CREATE INDEX IF NOT EXISTS idx_email_messages_rejection_reason
ON email_messages(rejection_reason) WHERE rejection_reason IS NOT NULL;

-- Add index for querying inbound emails
CREATE INDEX IF NOT EXISTS idx_email_messages_direction
ON email_messages(direction);

-- Add comment for documentation
COMMENT ON COLUMN email_messages.rejection_reason IS 'Why inbound email was rejected: unregistered_recipient, unverified_recipient, blocked_sender, or NULL if accepted';
