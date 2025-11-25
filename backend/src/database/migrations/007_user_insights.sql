-- User Insights Tables
-- Strategic data collection for data intelligence products

-- Main user insights profile
CREATE TABLE IF NOT EXISTS user_insights (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile_data JSONB NOT NULL DEFAULT '{}',
  last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Extracted fields for fast querying
  age_range VARCHAR(20),
  gender VARCHAR(20),
  region VARCHAR(100),
  household_type VARCHAR(50),
  digital_exclusion_score INTEGER CHECK (digital_exclusion_score BETWEEN 1 AND 5),
  
  -- Aggregate metrics
  total_interactions INTEGER DEFAULT 0,
  last_interaction_at TIMESTAMP
);

-- Insights history (audit trail of all insights detected)
CREATE TABLE IF NOT EXISTS insights_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fax_job_id UUID REFERENCES fax_jobs(id) ON DELETE SET NULL,
  
  insight_type VARCHAR(50) NOT NULL, -- 'life_event', 'intent', 'behavior', 'demographic'
  insight_category VARCHAR(50), -- Specific category within type
  insight_data JSONB NOT NULL,
  
  confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
  detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- For tracking changes over time
  previous_value JSONB,
  new_value JSONB
);

-- Aggregate insights for data products (anonymized)
CREATE TABLE IF NOT EXISTS aggregate_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Segmentation
  region VARCHAR(100),
  age_range VARCHAR(20),
  household_type VARCHAR(50),
  
  -- Insight category
  insight_category VARCHAR(50) NOT NULL,
  
  -- Aggregated data
  aggregate_data JSONB NOT NULL,
  
  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Sample size
  sample_size INTEGER NOT NULL CHECK (sample_size >= 100), -- Minimum for anonymization
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_insights_user ON user_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_user_insights_region ON user_insights(region);
CREATE INDEX IF NOT EXISTS idx_user_insights_age_range ON user_insights(age_range);
CREATE INDEX IF NOT EXISTS idx_user_insights_digital_score ON user_insights(digital_exclusion_score);
CREATE INDEX IF NOT EXISTS idx_user_insights_last_interaction ON user_insights(last_interaction_at);

CREATE INDEX IF NOT EXISTS idx_insights_history_user ON insights_history(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_history_type ON insights_history(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_history_category ON insights_history(insight_category);
CREATE INDEX IF NOT EXISTS idx_insights_history_detected ON insights_history(detected_at);
CREATE INDEX IF NOT EXISTS idx_insights_history_fax_job ON insights_history(fax_job_id);

CREATE INDEX IF NOT EXISTS idx_aggregate_insights_region ON aggregate_insights(region);
CREATE INDEX IF NOT EXISTS idx_aggregate_insights_category ON aggregate_insights(insight_category);
CREATE INDEX IF NOT EXISTS idx_aggregate_insights_period ON aggregate_insights(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_aggregate_insights_age ON aggregate_insights(age_range);

-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_user_insights_profile_data ON user_insights USING GIN (profile_data);
CREATE INDEX IF NOT EXISTS idx_insights_history_data ON insights_history USING GIN (insight_data);
CREATE INDEX IF NOT EXISTS idx_aggregate_insights_data ON aggregate_insights USING GIN (aggregate_data);

-- Comments
COMMENT ON TABLE user_insights IS 'Strategic user profiles built from fax interactions';
COMMENT ON TABLE insights_history IS 'Audit trail of all insights detected over time';
COMMENT ON TABLE aggregate_insights IS 'Anonymized aggregate data for data products (min n=100)';

COMMENT ON COLUMN user_insights.profile_data IS 'Complete user insights profile (JSONB)';
COMMENT ON COLUMN user_insights.digital_exclusion_score IS '1=digitally savvy, 5=completely excluded';
COMMENT ON COLUMN insights_history.confidence_score IS 'Confidence in the insight (0.0 to 1.0)';
COMMENT ON COLUMN aggregate_insights.sample_size IS 'Must be >= 100 for anonymization';
