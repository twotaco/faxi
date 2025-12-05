# Design Document

## Overview

This design document outlines the implementation of five admin dashboard pages that provide operational visibility into the Faxi system. Each page is designed as a single-page view with read-only data display, focusing on quick wins that leverage existing database tables and backend services.

The pages follow a consistent design pattern:
- Server-side data fetching using Next.js Server Components
- Client-side interactivity for filtering and real-time updates where needed
- Responsive layout using Tailwind CSS and Radix UI components
- Consistent visual hierarchy with the existing admin dashboard

## Architecture

### Frontend Architecture (Next.js App Router)

```
admin-dashboard/
├── app/(dashboard)/
│   ├── mcp/
│   │   └── page.tsx              # MCP Servers page
│   ├── ai/
│   │   └── page.tsx              # AI Inspector page
│   ├── alerts/
│   │   └── page.tsx              # System Health page
│   ├── analytics/
│   │   └── page.tsx              # Analytics page
│   └── audit/
│       └── page.tsx              # Audit Logs page
├── components/
│   ├── mcp/
│   │   ├── ServerStatsCard.tsx
│   │   ├── RecentErrorsList.tsx
│   │   └── ExternalAPIStatus.tsx
│   ├── ai/
│   │   ├── ProcessingMetricsCard.tsx
│   │   ├── RecentProcessingList.tsx
│   │   └── FaxJobLink.tsx
│   ├── health/
│   │   ├── InfrastructureStatus.tsx
│   │   ├── ResourceMetrics.tsx
│   │   ├── QueueHealth.tsx
│   │   └── RecentErrorsList.tsx
│   ├── analytics/
│   │   ├── OverviewStats.tsx
│   │   ├── FaxJobsChart.tsx
│   │   ├── UserInsightsChart.tsx
│   │   └── OrderMetrics.tsx
│   └── audit/
│       ├── AuditLogTable.tsx
│       ├── EventTypeFilter.tsx
│       └── DateRangeFilter.tsx
└── lib/
    └── api/
        ├── mcp.ts
        ├── ai.ts
        ├── health.ts
        ├── analytics.ts
        └── audit.ts
```

### Backend Architecture

New API endpoints will be added to the Express backend:

```
backend/src/
├── controllers/
│   └── adminDashboardController.ts    # New controller for dashboard APIs
├── services/
│   ├── mcpMonitoringService.ts        # Existing - minor updates
│   ├── monitoringService.ts           # Existing - use as-is
│   └── analyticsService.ts            # New - aggregation queries
└── index.ts                            # Add new routes
```

## Components and Interfaces

### 1. MCP Servers Page (/mcp)

**Data Sources:**
- `audit_logs` table (event_type = 'mcp.tool_call')
- `mcpMonitoringService.getServerStats()`

**API Endpoint:**
```typescript
GET /api/admin/mcp/stats
Response: {
  servers: Array<{
    name: string;
    totalCalls: number;
    successRate: number;
    failedCount: number;
    status: 'up' | 'down';
  }>;
  recentErrors: Array<{
    toolServer: string;
    toolName: string;
    errorMessage: string;
    timestamp: Date;
    userId?: string;
  }>;
  externalAPIs: Array<{
    name: string;
    status: 'up' | 'down' | 'degraded';
  }>;
}
```

**UI Components:**
- Server stats cards (grid layout)
- Recent errors list (expandable)
- External API status indicators

### 2. AI Inspector Page (/ai)

**Data Sources:**
- `processing_metrics` table
- `fax_jobs` table (for linking)

**API Endpoint:**
```typescript
GET /api/admin/ai/metrics
Response: {
  aggregate: {
    successRate: number;
    avgAccuracy: number;
    avgConfidence: number;
    avgProcessingTime: number;
  };
  recentProcessing: Array<{
    id: string;
    faxJobId: string;
    metricType: string;
    accuracy: number;
    confidence: number;
    processingTime: number;
    success: boolean;
    errorMessage?: string;
    createdAt: Date;
  }>;
}
```

**UI Components:**
- Aggregate metrics cards
- Recent processing table with sortable columns
- Link to fax job detail (opens in modal or new page)

### 3. System Health Page (/alerts)

**Data Sources:**
- `monitoringService.getHealthStatus()`
- `application_logs` table (level = 'error')

**API Endpoint:**
```typescript
GET /api/admin/health/status
Response: {
  infrastructure: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    s3: 'up' | 'down';
  };
  resources: {
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      percentage: number;
    };
    uptime: number;
  };
  queues: {
    faxProcessing: number;
    emailToFax: number;
  };
  recentErrors: Array<{
    id: number;
    level: string;
    message: string;
    context: any;
    createdAt: Date;
  }>;
}
```

**UI Components:**
- Infrastructure status cards with visual indicators
- Resource usage gauges
- Queue size indicators
- Recent errors table with expandable JSON context

### 4. Analytics Page (/analytics)

**Data Sources:**
- `users` table
- `fax_jobs` table
- `user_insights` table
- `orders` table
- `processing_metrics` table

**API Endpoint:**
```typescript
GET /api/admin/analytics/overview
Response: {
  users: {
    total: number;
    byRegion: Record<string, number>;
    byAgeRange: Record<string, number>;
    byDigitalScore: Record<string, number>;
  };
  faxJobs: {
    total: number;
    last24Hours: number;
    byStatus: Record<string, number>;
    perDay: Array<{ date: string; count: number }>;
  };
  orders: {
    total: number;
    totalRevenue: number;
    byStatus: Record<string, number>;
  };
  processing: {
    avgAccuracy: number;
    avgConfidence: number;
    avgProcessingTime: number;
  };
}
```

**UI Components:**
- Overview stats cards
- Fax jobs time-series chart (Recharts)
- User insights distribution charts
- Order metrics summary

### 5. Audit Logs Page (/audit)

**Data Sources:**
- `audit_logs` table

**API Endpoint:**
```typescript
GET /api/admin/audit/logs?eventType=&startDate=&endDate=&limit=100
Response: {
  logs: Array<{
    id: string;
    userId: string | null;
    faxJobId: string | null;
    eventType: string;
    eventData: any;
    createdAt: Date;
  }>;
  total: number;
  eventTypes: string[];  // Available event types for filter
}
```

**UI Components:**
- Event type dropdown filter
- Date range picker
- Audit log table with expandable JSON
- Pagination controls

## Data Models

### MCP Server Stats
```typescript
interface MCPServerStats {
  name: string;
  totalCalls: number;
  successRate: number;
  failedCount: number;
  status: 'up' | 'down';
}

interface MCPError {
  toolServer: string;
  toolName: string;
  errorMessage: string;
  timestamp: Date;
  userId?: string;
}
```

### AI Processing Metrics
```typescript
interface AIMetrics {
  aggregate: {
    successRate: number;
    avgAccuracy: number;
    avgConfidence: number;
    avgProcessingTime: number;
  };
  recentProcessing: ProcessingMetric[];
}

interface ProcessingMetric {
  id: string;
  faxJobId: string;
  metricType: string;
  accuracy: number;
  confidence: number;
  processingTime: number;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}
```

### System Health
```typescript
interface SystemHealth {
  infrastructure: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    s3: 'up' | 'down';
  };
  resources: {
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      percentage: number;
    };
    uptime: number;
  };
  queues: {
    faxProcessing: number;
    emailToFax: number;
  };
  recentErrors: ApplicationLog[];
}

interface ApplicationLog {
  id: number;
  level: string;
  message: string;
  context: any;
  createdAt: Date;
}
```

### Analytics Overview
```typescript
interface AnalyticsOverview {
  users: {
    total: number;
    byRegion: Record<string, number>;
    byAgeRange: Record<string, number>;
    byDigitalScore: Record<string, number>;
  };
  faxJobs: {
    total: number;
    last24Hours: number;
    byStatus: Record<string, number>;
    perDay: Array<{ date: string; count: number }>;
  };
  orders: {
    total: number;
    totalRevenue: number;
    byStatus: Record<string, number>;
  };
  processing: {
    avgAccuracy: number;
    avgConfidence: number;
    avgProcessingTime: number;
  };
}
```

### Audit Log
```typescript
interface AuditLog {
  id: string;
  userId: string | null;
  faxJobId: string | null;
  eventType: string;
  eventData: any;
  createdAt: Date;
}

interface AuditLogFilter {
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  limit: number;
}
```

## Error Handling

### Frontend Error Handling
- Display error boundaries for component-level errors
- Show user-friendly error messages for API failures
- Provide retry mechanisms for failed data fetches
- Log errors to console for debugging

### Backend Error Handling
- Return consistent error response format:
```typescript
{
  success: false,
  error: string,
  code?: string
}
```
- Log all errors with context
- Handle database connection failures gracefully
- Return 500 for server errors, 400 for bad requests, 401 for auth failures

## Testing Strategy

### Unit Tests
- Test API client functions for correct request formatting
- Test data transformation functions
- Test filter logic for audit logs
- Test chart data formatting

### Integration Tests
- Test API endpoints return correct data structure
- Test database queries return expected results
- Test authentication middleware protects routes
- Test error handling for missing data

### Manual Testing
- Verify all pages load without errors
- Test filtering and sorting functionality
- Verify responsive layout on different screen sizes
- Test with empty data states
- Verify error states display correctly

## Performance Considerations

### Database Query Optimization
- Add indexes on frequently queried columns:
  - `audit_logs.event_type`
  - `audit_logs.created_at`
  - `processing_metrics.created_at`
  - `application_logs.level`
  - `application_logs.created_at`
- Use LIMIT clauses to prevent large result sets
- Consider caching for analytics aggregations (5-minute TTL)

### Frontend Performance
- Use Server Components for initial data fetch (faster initial load)
- Implement pagination for large lists
- Lazy load charts only when visible
- Use React.memo for expensive components
- Debounce filter inputs

### API Response Times
- Target < 500ms for all dashboard API endpoints
- Use database connection pooling
- Consider Redis caching for expensive aggregations
- Monitor slow queries and optimize as needed

## Security Considerations

### Authentication & Authorization
- All dashboard pages require admin authentication
- Use existing `requireAdminAuth` middleware
- Verify JWT tokens on every request
- Check user permissions for dashboard access

### Data Protection
- Mask sensitive data in audit logs (API keys, passwords)
- Sanitize user input in filters
- Prevent SQL injection with parameterized queries
- Rate limit API endpoints to prevent abuse

### Audit Trail
- Log all admin dashboard access
- Track which admin viewed which pages
- Record filter parameters used in audit log queries

## Deployment Considerations

### Environment Variables
No new environment variables required - uses existing configuration.

### Database Migrations
No schema changes required - uses existing tables.

### Rollout Strategy
1. Deploy backend API endpoints first
2. Test endpoints in staging environment
3. Deploy frontend pages
4. Monitor error rates and performance
5. Gather admin feedback for improvements

## Future Enhancements

Potential improvements for future iterations:
- Real-time updates using Server-Sent Events or WebSockets
- Export functionality for audit logs and analytics
- Custom date range selection for analytics
- Drill-down views for specific metrics
- Alert configuration UI (if alerting system is enhanced)
- Dashboard customization (drag-and-drop widgets)
