-- Add email threads table for tracking email conversations

CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  thread_id VARCHAR(255) UNIQUE NOT NULL, -- External thread ID from email provider
  subject VARCHAR(500) NOT NULL,
  participants JSONB NOT NULL, -- Array of email addresses
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_threads_user_id ON email_threads(user_id);
CREATE INDEX idx_email_threads_thread_id ON email_threads(thread_id);
CREATE INDEX idx_email_threads_last_message_at ON email_threads(last_message_at);

-- Email messages table for storing individual emails
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES email_threads(id) NOT NULL,
  message_id VARCHAR(255) UNIQUE NOT NULL, -- External message ID from email provider
  from_address VARCHAR(255) NOT NULL,
  to_addresses JSONB NOT NULL, -- Array of recipient email addresses
  cc_addresses JSONB, -- Array of CC email addresses
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  html_body TEXT, -- HTML version if available
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_messages_thread_id ON email_messages(thread_id);
CREATE INDEX idx_email_messages_message_id ON email_messages(message_id);
CREATE INDEX idx_email_messages_from_address ON email_messages(from_address);
CREATE INDEX idx_email_messages_sent_at ON email_messages(sent_at);

-- Add trigger for updating email_threads.updated_at
CREATE TRIGGER update_email_threads_updated_at BEFORE UPDATE ON email_threads
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();