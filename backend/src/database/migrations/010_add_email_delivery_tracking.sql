-- Add delivery tracking fields to email_messages table

-- Add delivery tracking columns
ALTER TABLE email_messages 
ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'bounced', 'complained'));

ALTER TABLE email_messages 
ADD COLUMN IF NOT EXISTS delivery_timestamp TIMESTAMP WITH TIME ZONE;

ALTER TABLE email_messages 
ADD COLUMN IF NOT EXISTS delivery_details TEXT;

-- Create index on delivery_status for efficient queries
CREATE INDEX IF NOT EXISTS idx_email_messages_delivery_status ON email_messages(delivery_status);

-- Add comment for documentation
COMMENT ON COLUMN email_messages.delivery_status IS 'Email delivery status: pending (not yet delivered), delivered (successfully delivered), bounced (delivery failed), complained (recipient marked as spam)';
COMMENT ON COLUMN email_messages.delivery_timestamp IS 'Timestamp when delivery status was last updated';
COMMENT ON COLUMN email_messages.delivery_details IS 'Additional details about delivery status (e.g., bounce reason, complaint type)';
