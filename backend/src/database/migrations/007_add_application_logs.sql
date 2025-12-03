-- Migration: Add application logs table for centralized logging
-- This table stores structured application logs for monitoring and debugging

CREATE TABLE IF NOT EXISTS application_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(10) NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    error_data JSONB,
    performance_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_application_logs_level ON application_logs(level);
CREATE INDEX IF NOT EXISTS idx_application_logs_created_at ON application_logs(created_at);
-- Use btree indexes for text extraction (GIN requires jsonb, not text)
CREATE INDEX IF NOT EXISTS idx_application_logs_context_user_id ON application_logs(((context->>'userId')));
CREATE INDEX IF NOT EXISTS idx_application_logs_context_fax_job_id ON application_logs(((context->>'faxJobId')));
CREATE INDEX IF NOT EXISTS idx_application_logs_level_created_at ON application_logs(level, created_at);

-- Partial index for errors only (most commonly queried)
CREATE INDEX IF NOT EXISTS idx_application_logs_errors ON application_logs(created_at) WHERE level = 'error';

-- Add retention policy - automatically delete logs older than 90 days
-- This can be implemented as a scheduled job or using pg_partman for partitioning
CREATE OR REPLACE FUNCTION cleanup_old_application_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM application_logs 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-logs', '0 2 * * *', 'SELECT cleanup_old_application_logs();');

-- For systems without pg_cron, this can be run as a daily cron job:
-- 0 2 * * * psql -d faxi -c "SELECT cleanup_old_application_logs();"

COMMENT ON TABLE application_logs IS 'Centralized application logs for monitoring and debugging';
COMMENT ON COLUMN application_logs.level IS 'Log level: error, warn, info, debug';
COMMENT ON COLUMN application_logs.message IS 'Human-readable log message';
COMMENT ON COLUMN application_logs.context IS 'Structured context data (user_id, fax_job_id, etc.)';
COMMENT ON COLUMN application_logs.metadata IS 'Additional metadata and structured data';
COMMENT ON COLUMN application_logs.error_data IS 'Error details including stack traces';
COMMENT ON COLUMN application_logs.performance_data IS 'Performance metrics (duration, operation, etc.)';