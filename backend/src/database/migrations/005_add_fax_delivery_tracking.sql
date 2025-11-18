-- Add delivery tracking fields to fax_jobs table

-- Add new status values for delivery tracking
ALTER TABLE fax_jobs DROP CONSTRAINT IF EXISTS fax_jobs_status_check;
ALTER TABLE fax_jobs ADD CONSTRAINT fax_jobs_status_check 
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'sending', 'delivered'));

-- Add delivery tracking fields
ALTER TABLE fax_jobs ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE fax_jobs ADD COLUMN IF NOT EXISTS telnyx_fax_id VARCHAR(255);

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_fax_jobs_delivered_at ON fax_jobs(delivered_at);
CREATE INDEX IF NOT EXISTS idx_fax_jobs_telnyx_fax_id ON fax_jobs(telnyx_fax_id);