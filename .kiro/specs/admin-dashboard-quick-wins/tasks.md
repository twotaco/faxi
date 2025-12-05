# Implementation Plan

- [-] 1. Set up backend API infrastructure
  - Create admin dashboard controller with authentication middleware
  - Add API routes to Express app
  - _Requirements: All pages_

- [ ] 2. Implement MCP Servers monitoring page
  - [ ] 2.1 Create backend API endpoint for MCP stats
    - Query audit_logs for MCP tool calls
    - Calculate success rates and error counts per server
    - Return recent errors with details
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [ ] 2.2 Create frontend page and components
    - Build ServerStatsCard component
    - Build RecentErrorsList component
    - Build ExternalAPIStatus component
    - Create /mcp page with layout
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [ ] 2.3 Add warning indicators for low success rates
    - Highlight servers with < 95% success rate
    - _Requirements: 1.5_

- [ ] 3. Implement AI Inspector page
  - [ ] 3.1 Create backend API endpoint for AI metrics
    - Query processing_metrics table for aggregate stats
    - Fetch recent processing attempts with fax_job_id
    - Calculate success rate, avg accuracy, avg confidence
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ] 3.2 Create frontend page and components
    - Build ProcessingMetricsCard component
    - Build RecentProcessingList component with sortable columns
    - Build FaxJobLink component
    - Create /ai page with layout
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [ ] 3.3 Implement fax job detail view
    - Create modal or detail page showing fax image
    - Display extracted text and interpretation result
    - Show confidence scores
    - _Requirements: 2.5_

- [ ] 4. Implement System Health dashboard page
  - [ ] 4.1 Create backend API endpoint for system health
    - Use monitoringService.getHealthStatus() for infrastructure
    - Query application_logs for recent errors
    - Include resource metrics and queue sizes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ] 4.2 Create frontend page and components
    - Build InfrastructureStatus component with visual indicators
    - Build ResourceMetrics component with gauges
    - Build QueueHealth component
    - Build RecentErrorsList component with expandable JSON
    - Create /alerts page with layout
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ] 4.3 Add red indicators for down components
    - Highlight infrastructure components that are down
    - _Requirements: 3.6_

- [ ] 5. Implement Analytics dashboard page
  - [ ] 5.1 Create analytics service for data aggregation
    - Write queries for user metrics (total, by region, by age, by digital score)
    - Write queries for fax job metrics (total, last 24h, by status, per day)
    - Write queries for order metrics (total, revenue, by status)
    - Write queries for processing metrics (avg accuracy, confidence, time)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ] 5.2 Create backend API endpoint for analytics
    - Call analytics service methods
    - Return aggregated data in structured format
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ] 5.3 Create frontend page and components
    - Build OverviewStats component
    - Build FaxJobsChart component using Recharts
    - Build UserInsightsChart component
    - Build OrderMetrics component
    - Create /analytics page with layout
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 6. Implement Audit Logs viewer page
  - [ ] 6.1 Create backend API endpoint for audit logs
    - Query audit_logs table with filters
    - Support event type filtering
    - Support date range filtering
    - Return paginated results
    - Return available event types for filter dropdown
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ] 6.2 Create frontend page and components
    - Build EventTypeFilter dropdown component
    - Build DateRangeFilter component
    - Build AuditLogTable component with expandable JSON
    - Create /audit page with layout
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 7. Add database indexes for performance
  - Create indexes on audit_logs (event_type, created_at)
  - Create indexes on processing_metrics (created_at)
  - Create indexes on application_logs (level, created_at)
  - _Requirements: All pages - performance optimization_

- [ ] 8. Final integration and testing
  - Test all pages load without errors
  - Verify authentication protects all routes
  - Test with empty data states
  - Test error handling
  - Verify responsive layout
  - _Requirements: All pages_
