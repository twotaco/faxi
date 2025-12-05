-- Migration: Add performance indexes for admin dashboard queries
-- This migration adds composite indexes to optimize common query patterns
-- used by the admin dashboard pages (MCP monitoring, AI inspector, System Health, Analytics, Audit Logs)

-- ============================================================
-- AUDIT LOGS INDEXES
-- ============================================================

-- Composite index for filtering by event_type and sorting by created_at
-- Optimizes queries like: SELECT * FROM audit_logs WHERE event_type = 'mcp.tool_call' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type_created_at 
ON audit_logs(event_type, created_at DESC);

-- Note: Individual indexes on event_type and created_at already exist from initial schema
-- The composite index will be used when both columns are in the query

-- ============================================================
-- PROCESSING METRICS INDEXES
-- ============================================================

-- Composite index for filtering by metric_type and sorting by created_at
-- Optimizes queries like: SELECT * FROM processing_metrics WHERE metric_type = 'vision_interpretation' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_processing_metrics_type_created_at 
ON processing_metrics(metric_type, created_at DESC);

-- Index for filtering by success status and sorting by created_at
-- Optimizes queries for failed processing attempts
CREATE INDEX IF NOT EXISTS idx_processing_metrics_success_created_at 
ON processing_metrics(success, created_at DESC);

-- Note: Individual indexes on metric_type, created_at, and success already exist from initial schema
-- The composite indexes will be used when both columns are in the query

-- ============================================================
-- APPLICATION LOGS INDEXES
-- ============================================================

-- Note: The composite index idx_application_logs_level_created_at already exists from initial schema
-- This optimizes queries like: SELECT * FROM application_logs WHERE level = 'error' ORDER BY created_at DESC

-- Additional index for filtering errors within a date range
-- Optimizes queries with date range filters on error logs
CREATE INDEX IF NOT EXISTS idx_application_logs_level_created_at_range 
ON application_logs(level, created_at) 
WHERE level = 'error';

-- ============================================================
-- ADDITIONAL PERFORMANCE OPTIMIZATIONS
-- ============================================================

-- Index for user_id lookups in audit_logs with time-based queries
-- Optimizes queries like: SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_created_at 
ON audit_logs(user_id, created_at DESC) 
WHERE user_id IS NOT NULL;

-- Index for fax_job_id lookups in processing_metrics
-- Optimizes queries joining fax_jobs with processing_metrics
CREATE INDEX IF NOT EXISTS idx_processing_metrics_fax_job_created_at 
ON processing_metrics(fax_job_id, created_at DESC) 
WHERE fax_job_id IS NOT NULL;

-- ============================================================
-- QUERY OPTIMIZATION NOTES
-- ============================================================

-- These indexes are designed to support the following query patterns:
--
-- 1. MCP Monitoring Page:
--    - SELECT * FROM audit_logs WHERE event_type = 'mcp.tool_call' ORDER BY created_at DESC LIMIT 100
--    - Uses: idx_audit_logs_event_type_created_at
--
-- 2. AI Inspector Page:
--    - SELECT * FROM processing_metrics ORDER BY created_at DESC LIMIT 20
--    - Uses: idx_processing_metrics_created (existing)
--    - SELECT * FROM processing_metrics WHERE success = false ORDER BY created_at DESC
--    - Uses: idx_processing_metrics_success_created_at
--
-- 3. System Health Page:
--    - SELECT * FROM application_logs WHERE level = 'error' ORDER BY created_at DESC LIMIT 50
--    - Uses: idx_application_logs_level_created_at (existing)
--
-- 4. Analytics Page:
--    - Various aggregation queries on fax_jobs, users, orders
--    - Existing indexes are sufficient for these queries
--
-- 5. Audit Logs Page:
--    - SELECT * FROM audit_logs WHERE event_type = ? AND created_at BETWEEN ? AND ? ORDER BY created_at DESC
--    - Uses: idx_audit_logs_event_type_created_at
--    - SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC
--    - Uses: idx_audit_logs_user_id_created_at

-- ============================================================
-- INDEX MAINTENANCE
-- ============================================================

-- PostgreSQL automatically maintains indexes, but for large tables,
-- periodic VACUUM and ANALYZE operations are recommended:
--
-- VACUUM ANALYZE audit_logs;
-- VACUUM ANALYZE processing_metrics;
-- VACUUM ANALYZE application_logs;
--
-- These operations should be scheduled during low-traffic periods.
