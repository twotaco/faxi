# Performance Indexes Documentation

## Overview

This document describes the database indexes added to optimize admin dashboard query performance. These indexes were added in migration `20241205000000_add_performance_indexes.sql`.

## Indexes Added

### 1. Audit Logs Table

#### `idx_audit_logs_event_type_created_at`
- **Columns**: `event_type, created_at DESC`
- **Type**: Composite B-tree index
- **Purpose**: Optimizes queries filtering by event type and sorting by timestamp
- **Used By**: MCP Servers monitoring page, Audit Logs viewer
- **Example Query**:
  ```sql
  SELECT * FROM audit_logs 
  WHERE event_type = 'mcp.tool_call' 
  ORDER BY created_at DESC 
  LIMIT 100;
  ```

#### `idx_audit_logs_user_id_created_at`
- **Columns**: `user_id, created_at DESC`
- **Type**: Composite B-tree index with partial condition (WHERE user_id IS NOT NULL)
- **Purpose**: Optimizes queries filtering by user and sorting by timestamp
- **Used By**: User-specific audit log queries
- **Example Query**:
  ```sql
  SELECT * FROM audit_logs 
  WHERE user_id = '...' 
  ORDER BY created_at DESC;
  ```

### 2. Processing Metrics Table

#### `idx_processing_metrics_type_created_at`
- **Columns**: `metric_type, created_at DESC`
- **Type**: Composite B-tree index
- **Purpose**: Optimizes queries filtering by metric type and sorting by timestamp
- **Used By**: AI Inspector page
- **Example Query**:
  ```sql
  SELECT * FROM processing_metrics 
  WHERE metric_type = 'vision_interpretation' 
  ORDER BY created_at DESC;
  ```

#### `idx_processing_metrics_success_created_at`
- **Columns**: `success, created_at DESC`
- **Type**: Composite B-tree index
- **Purpose**: Optimizes queries filtering by success status
- **Used By**: AI Inspector page (failed processing attempts)
- **Example Query**:
  ```sql
  SELECT * FROM processing_metrics 
  WHERE success = false 
  ORDER BY created_at DESC 
  LIMIT 20;
  ```

#### `idx_processing_metrics_fax_job_created_at`
- **Columns**: `fax_job_id, created_at DESC`
- **Type**: Composite B-tree index with partial condition (WHERE fax_job_id IS NOT NULL)
- **Purpose**: Optimizes joins between fax_jobs and processing_metrics
- **Used By**: Fax job detail views with processing metrics
- **Example Query**:
  ```sql
  SELECT * FROM processing_metrics 
  WHERE fax_job_id = '...' 
  ORDER BY created_at DESC;
  ```

### 3. Application Logs Table

#### `idx_application_logs_level_created_at_range`
- **Columns**: `level, created_at`
- **Type**: Composite B-tree index with partial condition (WHERE level = 'error')
- **Purpose**: Optimizes queries for error logs within date ranges
- **Used By**: System Health dashboard page
- **Example Query**:
  ```sql
  SELECT * FROM application_logs 
  WHERE level = 'error' 
  ORDER BY created_at DESC 
  LIMIT 50;
  ```

**Note**: The index `idx_application_logs_level_created_at` already existed from the initial schema and handles general level-based queries.

## Performance Impact

### Query Performance Improvements

| Query Type | Before | After | Improvement |
|------------|--------|-------|-------------|
| MCP stats by event type | Table scan | Index scan | ~10-100x faster |
| Recent processing metrics | Index scan | Index scan | Maintained |
| Error logs retrieval | Index scan | Partial index scan | ~2-5x faster |
| Audit logs by user | Table scan | Index scan | ~10-100x faster |

### Index Size Overhead

The new indexes add minimal storage overhead:
- Composite indexes: ~2-5% of table size each
- Partial indexes: ~1-2% of table size (only indexes subset of rows)

For typical admin dashboard usage patterns, the query performance gains far outweigh the storage cost.

## Maintenance

### Automatic Maintenance

PostgreSQL automatically maintains these indexes through:
- **Auto-vacuum**: Removes dead tuples and updates statistics
- **Auto-analyze**: Updates query planner statistics

### Manual Maintenance (Optional)

For large tables with heavy write activity, consider periodic manual maintenance:

```sql
-- Rebuild indexes to remove bloat (during low-traffic periods)
REINDEX TABLE audit_logs;
REINDEX TABLE processing_metrics;
REINDEX TABLE application_logs;

-- Update statistics for query planner
ANALYZE audit_logs;
ANALYZE processing_metrics;
ANALYZE application_logs;
```

### Monitoring Index Usage

To verify indexes are being used:

```sql
-- Check index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('audit_logs', 'processing_metrics', 'application_logs')
ORDER BY tablename, indexname;

-- Check for unused indexes (idx_scan = 0)
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE tablename IN ('audit_logs', 'processing_metrics', 'application_logs')
  AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

## Query Optimization Tips

### Using EXPLAIN ANALYZE

To verify a query is using the expected index:

```sql
EXPLAIN ANALYZE
SELECT * FROM audit_logs 
WHERE event_type = 'mcp.tool_call' 
ORDER BY created_at DESC 
LIMIT 100;
```

Look for:
- `Index Scan using idx_audit_logs_event_type_created_at`
- Low execution time (< 10ms for typical queries)

### When Indexes Won't Be Used

PostgreSQL may choose not to use an index if:
1. **Table is very small**: Sequential scan is faster for small tables
2. **Query returns large percentage of rows**: Sequential scan is more efficient
3. **Statistics are outdated**: Run `ANALYZE` to update statistics
4. **Index bloat**: Consider `REINDEX` if index is heavily fragmented

## Testing

Verification tests are available in:
- `backend/src/database/migrations/verify_indexes.test.ts`

Run tests with:
```bash
npm run test -- src/database/migrations/verify_indexes.test.ts
```

## Related Documentation

- [Admin Dashboard Design](../../.kiro/specs/admin-dashboard-quick-wins/design.md)
- [Database Schema](../src/database/migrations/20241204000000_initial_schema.sql)
- [PostgreSQL Index Documentation](https://www.postgresql.org/docs/current/indexes.html)
