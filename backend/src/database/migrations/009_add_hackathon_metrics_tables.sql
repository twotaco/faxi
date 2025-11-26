-- Migration 009: Add tables for hackathon demo and metrics tracking
-- Requirements: 1.5, 2.1

-- Table for tracking AI processing metrics
CREATE TABLE IF NOT EXISTS processing_metrics (
  id SERIAL PRIMARY KEY,
  fax_job_id UUID REFERENCES fax_jobs(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL, -- 'ocr', 'annotation', 'intent'
  accuracy DECIMAL(5,2),
  confidence DECIMAL(5,2),
  processing_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB, -- Additional metric details
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_processing_metrics_type ON processing_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_processing_metrics_created ON processing_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_processing_metrics_fax_job ON processing_metrics(fax_job_id);
CREATE INDEX IF NOT EXISTS idx_processing_metrics_success ON processing_metrics(success);

-- Table for tracking demo sessions
CREATE TABLE IF NOT EXISTS demo_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  fixture_id VARCHAR(255),
  uploaded_image_url TEXT,
  processing_result JSONB,
  visitor_ip VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Indexes for demo sessions
CREATE INDEX IF NOT EXISTS idx_demo_sessions_created ON demo_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_session_id ON demo_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_fixture ON demo_sessions(fixture_id);

-- Table for historical accuracy snapshots
CREATE TABLE IF NOT EXISTS accuracy_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  overall_accuracy DECIMAL(5,2),
  ocr_accuracy DECIMAL(5,2),
  annotation_accuracy DECIMAL(5,2),
  intent_accuracy DECIMAL(5,2),
  sample_count INTEGER,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique index to prevent duplicate snapshots for same date
CREATE UNIQUE INDEX IF NOT EXISTS idx_accuracy_snapshots_date ON accuracy_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_accuracy_snapshots_created ON accuracy_snapshots(created_at);

-- Add comments for documentation
COMMENT ON TABLE processing_metrics IS 'Tracks AI processing metrics for accuracy analysis';
COMMENT ON TABLE demo_sessions IS 'Tracks demo usage from marketing website';
COMMENT ON TABLE accuracy_snapshots IS 'Historical accuracy data for trend analysis';

COMMENT ON COLUMN processing_metrics.metric_type IS 'Type of metric: ocr, annotation, or intent';
COMMENT ON COLUMN processing_metrics.accuracy IS 'Accuracy score from 0-100';
COMMENT ON COLUMN processing_metrics.confidence IS 'Confidence score from 0-1';
COMMENT ON COLUMN processing_metrics.metadata IS 'Additional details like detected regions, annotations, etc.';

COMMENT ON COLUMN demo_sessions.session_id IS 'Unique session identifier for tracking demo usage';
COMMENT ON COLUMN demo_sessions.fixture_id IS 'ID of test fixture used, if applicable';
COMMENT ON COLUMN demo_sessions.processing_result IS 'Complete processing result including visualization data';

COMMENT ON COLUMN accuracy_snapshots.snapshot_date IS 'Date of the accuracy snapshot';
COMMENT ON COLUMN accuracy_snapshots.metadata IS 'Additional snapshot details like breakdown by use case';
