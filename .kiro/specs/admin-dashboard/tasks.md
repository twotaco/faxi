# Admin Dashboard Implementation Plan

## Phase 0: Monorepo Setup

### 0. Setup Monorepo Structure

- [x] 0.1 Complete monorepo migration
  - Move all backend code from root src/ to backend/src/
  - Move tsconfig.json to backend/tsconfig.json
  - Move vitest.config.ts to backend/vitest.config.ts
  - Update all import paths if needed
  - Update Docker and deployment configs to point to backend/
  - Test that backend still runs with `npm run dev`
  - _Requirements: All (infrastructure)_

- [x] 0.2 Initialize Next.js admin dashboard
  - Run `npx create-next-app@latest admin-dashboard` with TypeScript, Tailwind, App Router
  - Configure admin-dashboard/tsconfig.json
  - Set up Tailwind with Faxi brand colors (orange #f97316)
  - Install shadcn/ui: `npx shadcn-ui@latest init`
  - Create admin-dashboard/.env.local with NEXT_PUBLIC_API_URL
  - Test that admin dashboard runs with `npm run dev:admin`
  - _Requirements: All (infrastructure)_

- [x] 0.3 Verify monorepo setup
  - Run `npm install` at root to install all workspace dependencies
  - Test `npm run dev:all` to run both backend and frontend
  - Test `npm run build` to build both workspaces
  - Test `npm run test` to run tests in both workspaces
  - Update .gitignore for both workspaces
  - _Requirements: All (infrastructure)_

## Phase 1: MVP - Core Dashboard and Job Management

### 1. Backend API Foundation

- [x] 1.1 Create admin user database schema and migrations
  - Create admin_users table with role-based access (super_admin, admin, support, analyst)
  - Create admin_refresh_tokens table for session management
  - Create admin_preferences table for user settings
  - Add indexes for performance (email, role, token_id, expires_at)
  - Create migration file in backend/src/database/migrations/
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

- [x] 1.2 Implement authentication service
  - Create backend/src/services/adminAuthService.ts
  - Implement password hashing utilities with bcrypt (add bcrypt dependency)
  - Implement JWT token generation and validation (add jsonwebtoken dependency)
  - Create refresh token rotation logic
  - Add session management functions
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.10_

- [x] 1.3 Create admin user repository
  - Create backend/src/repositories/adminUserRepository.ts
  - Implement CRUD operations for admin users
  - Implement token management (create, validate, revoke)
  - Implement preference management
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 1.4 Create authentication API endpoints
  - Add POST /admin/auth/login endpoint to backend/src/index.ts
  - Add POST /admin/auth/logout endpoint
  - Add POST /admin/auth/refresh endpoint
  - Add rate limiting for login attempts (5 per 15 min)
  - Add audit logging for authentication events
  - _Requirements: 1.1, 1.2, 1.3, 1.10, 11.1, 11.2, 11.3_

- [x] 1.5 Implement authorization middleware
  - Create backend/src/middleware/adminAuth.ts
  - Create permission checking middleware
  - Implement role-based access control (RBAC)
  - Add route protection based on permissions
  - Create permission helper functions
  - _Requirements: 1.6, 1.7, 1.8, 1.9_

- [x] 1.6 Create dashboard metrics API endpoints
  - Add GET /admin/dashboard/metrics endpoint to backend/src/index.ts
  - Leverage existing monitoringService.getHealthStatus()
  - Add active jobs query from fax_jobs table
  - Add queue metrics from existing queue health checks
  - Add error rate calculation from audit_logs
  - Add performance metrics aggregation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 1.7 Implement Server-Sent Events for real-time updates
  - Add GET /admin/dashboard/stream SSE endpoint to backend/src/index.ts
  - Implement metrics broadcasting every 5 seconds
  - Add alert event broadcasting from alertingService
  - Add connection management and cleanup
  - _Requirements: 2.2, 2.3, 8.2_

- [x] 1.8 Create fax job management API endpoints
  - Add GET /admin/jobs endpoint with filtering and pagination to backend/src/index.ts
  - Add GET /admin/jobs/:id endpoint for job details
  - Add POST /admin/jobs/:id/retry endpoint
  - Add POST /admin/jobs/:id/cancel endpoint
  - Add audit logging for job operations
  - Leverage existing faxJobRepository
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

### 2. Frontend Foundation

- [x] 2.1 Set up project structure and routing
  - Create admin-dashboard/app/(auth)/login route for login page
  - Create admin-dashboard/app/(dashboard) route group for authenticated pages
  - Create admin-dashboard/app/(dashboard)/page.tsx for operations dashboard
  - Set up admin-dashboard/app/(auth)/layout.tsx (no sidebar)
  - Set up admin-dashboard/app/(dashboard)/layout.tsx (with sidebar)
  - Configure admin-dashboard/middleware.ts for route protection
  - _Requirements: 1.1, 1.5_

- [x] 2.2 Implement authentication UI and logic
  - Create admin-dashboard/app/(auth)/login/page.tsx with form validation (Zod)
  - Create admin-dashboard/app/api/auth/[...auth]/route.ts (proxy to backend)
  - Create admin-dashboard/lib/auth/AuthContext.tsx and useAuth hook
  - Implement token refresh logic with interceptors
  - Add logout functionality
  - Create admin-dashboard/lib/api/client.ts for API calls
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.10_

- [x] 2.3 Create dashboard layout components
  - Create admin-dashboard/components/layout/Sidebar.tsx with navigation
  - Create admin-dashboard/components/layout/TopBar.tsx with user menu
  - Create admin-dashboard/components/layout/Breadcrumb.tsx
  - Implement responsive layout (mobile, tablet, desktop)
  - Add Faxi logo and branding
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 2.4 Set up data fetching infrastructure
  - Install @tanstack/react-query in admin-dashboard
  - Create admin-dashboard/lib/api/client.ts with axios and auth interceptors
  - Create admin-dashboard/lib/hooks/useQuery.ts wrapper hooks
  - Implement error handling and retry logic
  - Add loading states and error boundaries
  - _Requirements: All data fetching requirements_

### 3. Operations Dashboard

- [x] 3.1 Create operations dashboard page
  - Create app/(dashboard)/page.tsx
  - Implement grid layout with metric cards
  - Add loading skeletons and error boundaries
  - Create lib/hooks/useDashboardMetrics.ts
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

- [x] 3.2 Implement system health status component
  - Create components/dashboard/SystemHealth.tsx
  - Display service status cards (DB, Redis, S3, fax queue, email queue)
  - Add visual indicators (green/yellow/red) for health status
  - Implement click-through to service details modal
  - _Requirements: 2.1, 2.3_

- [x] 3.3 Implement active jobs component
  - Create components/dashboard/ActiveJobs.tsx
  - Display active jobs list with real-time updates
  - Add job progress indicators (stage, elapsed time)
  - Implement click-through to job details
  - _Requirements: 2.4, 2.10_

- [x] 3.4 Implement queue metrics component
  - Create components/dashboard/QueueMetrics.tsx
  - Display queue status (pending, processing, rate, wait time)
  - Add visual indicators for queue health
  - Show processing rate and average wait time
  - _Requirements: 2.5_

- [x] 3.5 Implement error rate component
  - Create components/dashboard/ErrorRate.tsx
  - Display error rate card with trend indicator (↑↓→)
  - Show top errors list
  - Add click-through to error details
  - _Requirements: 2.6_

- [x] 3.6 Implement performance metrics component
  - Create components/dashboard/PerformanceMetrics.tsx
  - Display performance chart with response times (Recharts)
  - Show percentile breakdowns (p50, p95, p99)
  - Add time range selector (1h, 6h, 24h)
  - _Requirements: 2.7_

- [x] 3.7 Implement resource usage component
  - Create components/dashboard/ResourceUsage.tsx
  - Display resource usage gauges (CPU, memory, disk)
  - Add visual indicators for resource levels
  - Implement alerts for high usage (>90%)
  - _Requirements: 2.8_

- [x] 3.8 Implement real-time updates with SSE
  - Create lib/hooks/useDashboardStream.ts
  - Create EventSource connection to /admin/dashboard/stream
  - Implement automatic reconnection with exponential backoff
  - Update dashboard metrics every 5 seconds
  - Add connection status indicator
  - _Requirements: 2.2_

### 4. Fax Job Management

- [x] 4.1 Create fax jobs list page
  - Create app/(dashboard)/jobs/page.tsx
  - Implement job list table with TanStack Table
  - Add sorting and pagination
  - Create lib/hooks/useFaxJobs.ts
  - _Requirements: 3.1, 3.2_

- [x] 4.2 Implement job search and filtering
  - Create components/jobs/JobFilters.tsx
  - Add search input with debouncing (useDebounce hook)
  - Add filter dropdowns (status, intent, date range)
  - Implement URL state management with useSearchParams
  - _Requirements: 3.1, 3.2_

- [x] 4.3 Create job details modal
  - Create components/jobs/JobDetailsModal.tsx
  - Implement tabbed interface (Overview, Interpretation, Actions, Response, History)
  - Create components/jobs/FaxImageViewer.tsx with zoom and pan
  - Display interpretation results, action results, context
  - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 3.11_

- [x] 4.4 Implement job actions
  - Add retry button with confirmation dialog
  - Add cancel button with confirmation dialog
  - Add download fax button (presigned S3 URL)
  - Implement action feedback with toast notifications
  - Create lib/hooks/useJobActions.ts
  - _Requirements: 3.8, 3.9, 3.10_

- [x] 4.5 Add audit logging for job operations
  - Log job view actions to backend
  - Log retry and cancel actions
  - Display audit trail in job details History tab
  - _Requirements: 3.12_

## Phase 2: User Management and MCP Monitoring

### 5. User Management

- [x] 5.1 Create user management API endpoints
  - Add GET /admin/users endpoint with search and pagination to src/index.ts
  - Add GET /admin/users/:id endpoint for user details
  - Add PATCH /admin/users/:id/feature-flags endpoint
  - Add GET /admin/users/:id/activity endpoint (from audit_logs)
  - Add GET /admin/users/:id/orders endpoint
  - Add GET /admin/users/:id/payments endpoint
  - Add DELETE /admin/users/:id/contexts/:contextId endpoint
  - Leverage existing userRepository, orderRepository, conversationContextRepository
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

- [x] 5.2 Create users list page
  - Create app/(dashboard)/users/page.tsx
  - Implement user list table with TanStack Table
  - Add search by phone, email, name
  - Display user statistics (faxes, orders, total spend)
  - Create lib/hooks/useUsers.ts
  - _Requirements: 4.1, 4.2_

- [x] 5.3 Create user details page
  - Create app/(dashboard)/users/[id]/page.tsx
  - Implement tabbed interface (Profile, Activity, Orders, Payments, Contacts)
  - Display user profile and statistics
  - Create components/users/UserProfile.tsx
  - _Requirements: 4.3, 4.4, 4.5_

- [x] 5.4 Implement feature flag management
  - Create components/users/FeatureFlagToggles.tsx
  - Add toggle controls for each feature flag
  - Add confirmation dialog for flag changes
  - Implement immediate application of changes
  - _Requirements: 4.6, 4.7_

- [x] 5.5 Implement context management
  - Create components/users/ActiveContexts.tsx
  - Display active conversation contexts with expiration times
  - Add clear context button with confirmation
  - Show context type and reference ID
  - _Requirements: 4.11, 4.12_

- [x] 5.6 Display user activity and orders
  - Create components/users/ActivityTimeline.tsx
  - Create components/users/OrderHistory.tsx
  - Display order history with details
  - Show payment methods (masked card numbers)
  - _Requirements: 4.4, 4.5, 4.8, 4.9, 4.10_

### 6. MCP Server Monitoring

- [ ] 6.1 Create MCP monitoring service and API endpoints
  - Create src/services/mcpMonitoringService.ts
  - Add GET /admin/mcp/servers endpoint to src/index.ts
  - Add GET /admin/mcp/servers/:name/tools endpoint
  - Add GET /admin/mcp/servers/:name/metrics endpoint
  - Add POST /admin/mcp/servers/:name/enable endpoint
  - Add POST /admin/mcp/servers/:name/disable endpoint
  - Add GET /admin/mcp/external-apis endpoint
  - Track tool call counts, success rates, response times from audit_logs
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

- [ ] 6.2 Create MCP monitoring page
  - Create app/(dashboard)/mcp/page.tsx
  - Display server status table (email, shopping, payment, ai_chat, user_profile)
  - Show external API health (Telnyx, Stripe, Gemini, Amazon)
  - Create lib/hooks/useMCPServers.ts
  - _Requirements: 5.1, 5.2, 5.5, 5.6_

- [ ] 6.3 Implement tool usage visualization
  - Create components/mcp/ToolUsageStats.tsx
  - Display tool usage statistics (calls/hour, success rate)
  - Add response time metrics chart
  - Display success rate indicators
  - _Requirements: 5.3, 5.4_

- [ ] 6.4 Implement API health monitoring
  - Create components/mcp/ExternalAPIHealth.tsx
  - Display external API status (up/down/slow)
  - Show rate limit usage as percentage
  - Display cost estimates for current billing period
  - _Requirements: 5.5, 5.6, 5.7, 5.8_

- [ ] 6.5 Implement MCP server controls
  - Add enable/disable server buttons
  - Implement confirmation dialogs
  - Add audit logging for server changes
  - Update MCP server configuration dynamically
  - _Requirements: 5.9, 5.10_

## Phase 3: AI Inspector and Financial Dashboard

### 7. AI Interpretation Inspector

- [ ] 7.1 Create AI interpretation API endpoints
  - Add GET /admin/ai/interpretations endpoint with filtering to src/index.ts
  - Add GET /admin/ai/interpretations/:id endpoint
  - Add POST /admin/ai/interpretations/:id/feedback endpoint
  - Add GET /admin/ai/metrics endpoint
  - Query fax_jobs table for interpretation_result data
  - Store feedback in new ai_interpretation_feedback table
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

- [ ] 7.2 Create AI interpretations list page
  - Create app/(dashboard)/ai/page.tsx
  - Implement interpretation list with filters (confidence, intent)
  - Add confidence score indicators (color-coded)
  - Create lib/hooks/useAIInterpretations.ts
  - _Requirements: 6.1, 6.3, 6.6_

- [ ] 7.3 Create interpretation details view
  - Create components/ai/InterpretationDetails.tsx
  - Display fax image with annotations overlay
  - Show extracted intent and parameters
  - Display AI prompt and response (from interpretation_result)
  - Show detected visual annotations (circles, checkmarks, arrows)
  - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [ ] 7.4 Implement feedback mechanism
  - Create components/ai/FeedbackForm.tsx
  - Add correct/incorrect marking buttons
  - Create feedback form for corrections
  - Store feedback for future model training
  - _Requirements: 6.7, 6.8, 6.9_

- [ ] 7.5 Implement accuracy metrics
  - Create components/ai/AccuracyMetrics.tsx
  - Display overall accuracy percentage
  - Create accuracy trend chart (Recharts)
  - Show accuracy by intent type
  - _Requirements: 6.10_

### 8. Financial Dashboard

- [ ] 8.1 Create financial API endpoints
  - Add GET /admin/financial/overview endpoint to src/index.ts
  - Add GET /admin/financial/payments endpoint
  - Add GET /admin/financial/payments/:id endpoint
  - Add POST /admin/financial/payments/:id/retry endpoint
  - Add POST /admin/financial/payments/:id/refund endpoint
  - Add GET /admin/financial/export endpoint (CSV format)
  - Query orders table for revenue data
  - Integrate with Stripe API for payment details
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12_

- [ ] 8.2 Create financial overview page
  - Create app/(dashboard)/financial/page.tsx
  - Display revenue metrics cards (total, orders, avg order value)
  - Show revenue trend chart (Recharts line chart)
  - Create lib/hooks/useFinancialMetrics.ts
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 8.3 Implement payment method breakdown
  - Create components/financial/PaymentMethodBreakdown.tsx
  - Create payment method pie chart (credit card vs konbini)
  - Display distribution percentages
  - Add time period selector (today, week, month, year, custom)
  - _Requirements: 7.2_

- [ ] 8.4 Create transactions list
  - Create components/financial/TransactionsList.tsx
  - Display recent transactions table
  - Add status indicators (paid, pending, failed)
  - Implement pagination
  - _Requirements: 7.4, 7.5, 7.6_

- [ ] 8.5 Implement payment details and actions
  - Create components/financial/PaymentDetailsModal.tsx
  - Display complete payment details
  - Add Stripe dashboard link (external)
  - Implement retry button for failed payments
  - Implement refund button with confirmation
  - _Requirements: 7.6, 7.7, 7.8, 7.10_

- [ ] 8.6 Implement financial reporting
  - Add export to CSV functionality
  - Display fees and net revenue
  - Calculate Stripe fees (2.9% + ¥30)
  - _Requirements: 7.11, 7.12_

## Phase 4: Analytics and Advanced Features

### 9. Alert Management

- [ ] 9.1 Create alert management API endpoints
  - Add GET /admin/alerts endpoint to src/index.ts
  - Add GET /admin/alerts/history endpoint
  - Add GET /admin/alerts/rules endpoint
  - Add POST /admin/alerts/rules endpoint
  - Add PUT /admin/alerts/rules/:id endpoint
  - Add DELETE /admin/alerts/rules/:id endpoint
  - Add POST /admin/alerts/:id/acknowledge endpoint
  - Add GET /admin/alerts/stream (SSE) endpoint
  - Leverage existing alertingService
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11_

- [ ] 9.2 Create alerts page
  - Create app/(dashboard)/alerts/page.tsx
  - Display active alerts with severity (critical, warning, info)
  - Show alert history
  - Create lib/hooks/useAlerts.ts
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 9.3 Implement alert rule management
  - Create components/alerts/AlertRulesList.tsx
  - Create components/alerts/AlertRuleForm.tsx
  - Add create/edit/delete rule forms
  - Implement rule validation (condition syntax)
  - _Requirements: 8.4, 8.5, 8.6_

- [ ] 9.4 Implement notification channel configuration
  - Create components/alerts/NotificationChannels.tsx
  - Add email, Slack, PagerDuty configuration
  - Test notification delivery button
  - _Requirements: 8.7, 8.8_

- [ ] 9.5 Implement alert actions
  - Add acknowledge button
  - Add dismiss button
  - Implement cooldown logic display
  - Show last triggered time
  - _Requirements: 8.9, 8.10, 8.11_

- [ ] 9.6 Implement real-time alert notifications
  - Create lib/hooks/useAlertStream.ts
  - Connect to /admin/alerts/stream SSE endpoint
  - Display notification banner (toast)
  - Play notification sound (optional, user preference)
  - _Requirements: 8.2_

### 10. Configuration Management

- [ ] 10.1 Create configuration API endpoints and service
  - Create src/services/configManagementService.ts
  - Add GET /admin/config endpoint to src/index.ts
  - Add PUT /admin/config/:category/:key endpoint
  - Add GET /admin/config/feature-flags endpoint
  - Add PUT /admin/config/feature-flags/:flag endpoint
  - Store configuration in new system_config table
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12_

- [ ] 10.2 Create configuration page
  - Create app/(dashboard)/config/page.tsx
  - Display configuration by category (features, MCP, rate limits, queue, test mode)
  - Show current values with descriptions
  - Create lib/hooks/useConfig.ts
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 10.3 Implement configuration editing
  - Create components/config/ConfigEditor.tsx
  - Create edit forms with validation (Zod)
  - Add save confirmation dialog
  - Implement immediate application (no restart required)
  - _Requirements: 9.4, 9.5, 9.6_

- [ ] 10.4 Implement feature flag management
  - Create components/config/FeatureFlagManager.tsx
  - Create feature flag toggles
  - Add global enable/disable controls
  - Show affected users count
  - _Requirements: 9.7_

- [ ] 10.5 Implement MCP server configuration
  - Create components/config/MCPServerConfig.tsx
  - Add MCP server enable/disable controls
  - Show server status (up/down)
  - _Requirements: 9.8_

- [ ] 10.6 Implement system configuration
  - Create components/config/SystemConfig.tsx
  - Add rate limit configuration (requests per minute)
  - Add queue configuration (worker counts, timeouts)
  - Add test mode toggle with prominent warning banner
  - _Requirements: 9.9, 9.10, 9.11, 9.12_

### 11. Analytics and Reporting

- [ ] 11.1 Create analytics API endpoints and service
  - Create src/services/analyticsService.ts
  - Add GET /admin/analytics/usage endpoint to src/index.ts
  - Add GET /admin/analytics/intents endpoint
  - Add GET /admin/analytics/conversion endpoint
  - Add GET /admin/analytics/retention endpoint
  - Add GET /admin/analytics/errors endpoint
  - Add GET /admin/analytics/performance endpoint
  - Add POST /admin/analytics/export endpoint (CSV)
  - Query fax_jobs, orders, audit_logs tables for analytics data
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12_

- [ ] 11.2 Create analytics page
  - Create app/(dashboard)/analytics/page.tsx
  - Add date range selector (last 7 days, 30 days, 90 days, custom)
  - Implement responsive chart layout
  - Create lib/hooks/useAnalytics.ts
  - _Requirements: 10.9_

- [ ] 11.3 Implement usage analytics
  - Create components/analytics/UsageTrends.tsx
  - Create usage trend charts (faxes, users, orders over time)
  - Display user count metrics (new, active, total)
  - Show peak usage heatmap (day of week, hour of day)
  - _Requirements: 10.1, 10.5_

- [ ] 11.4 Implement intent distribution
  - Create components/analytics/IntentDistribution.tsx
  - Create intent distribution chart (pie or bar chart)
  - Show most common requests
  - Add drill-down capability to see details
  - _Requirements: 10.2_

- [ ] 11.5 Implement conversion funnel
  - Create components/analytics/ConversionFunnel.tsx
  - Create funnel visualization (shopping: search → select → purchase)
  - Display conversion rates at each stage
  - Show drop-off points
  - _Requirements: 10.3_

- [ ] 11.6 Implement retention metrics
  - Create components/analytics/RetentionMetrics.tsx
  - Display retention cohort analysis
  - Show churn rate
  - Calculate user lifetime value (LTV)
  - _Requirements: 10.4_

- [ ] 11.7 Implement error analysis
  - Create components/analytics/ErrorAnalysis.tsx
  - Create error frequency chart
  - Display top errors with counts
  - Show error trends over time
  - _Requirements: 10.6_

- [ ] 11.8 Implement performance analytics
  - Create components/analytics/PerformanceAnalytics.tsx
  - Display processing time metrics by intent
  - Show SLA compliance (% under target time)
  - Create performance trend charts
  - _Requirements: 10.7, 10.8_

- [ ] 11.9 Implement cost analysis
  - Create components/analytics/CostAnalysis.tsx
  - Display per-user costs (API calls, storage)
  - Show service cost breakdown (Telnyx, Stripe, Gemini, S3)
  - Calculate ROI metrics
  - _Requirements: 10.12_

- [ ] 11.10 Implement report export
  - Add CSV export functionality
  - Generate downloadable reports
  - _Requirements: 10.10, 10.11_

### 12. Audit Log Viewer

- [ ] 12.1 Create audit log API endpoints
  - Add GET /admin/audit endpoint with filtering to src/index.ts
  - Add GET /admin/audit/:id endpoint
  - Add GET /admin/audit/export endpoint (CSV)
  - Leverage existing auditLogRepository
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11_

- [ ] 12.2 Create audit log page
  - Create app/(dashboard)/audit/page.tsx
  - Implement audit log table with TanStack Table
  - Add search functionality
  - Create lib/hooks/useAuditLogs.ts
  - _Requirements: 11.1, 11.2_

- [ ] 12.3 Implement audit log filtering
  - Create components/audit/AuditLogFilters.tsx
  - Add entity type filter (user, fax_job, order, payment, etc.)
  - Add action filter (created, updated, deleted, etc.)
  - Add user filter
  - Add date range filter
  - _Requirements: 11.1, 11.2_

- [ ] 12.4 Create audit log details view
  - Create components/audit/AuditLogDetails.tsx
  - Display complete audit entry
  - Show before/after values (if applicable)
  - Display related entities (user, fax job, etc.)
  - _Requirements: 11.3, 11.4_

- [ ] 12.5 Implement audit log export
  - Add CSV export functionality
  - Implement retention policy display (e.g., 90 days)
  - _Requirements: 11.8, 11.9_

- [ ] 12.6 Implement specialized audit views
  - Create components/audit/UserActionHistory.tsx
  - Create components/audit/AdminActionHistory.tsx
  - Create components/audit/DataChangeHistory.tsx
  - _Requirements: 11.5, 11.6, 11.7_

### 13. Responsive Design and Accessibility

- [ ] 13.1 Implement responsive layouts
  - Test and optimize for desktop (1920x1080+)
  - Test and optimize for laptop (1366x768+)
  - Test and optimize for tablet (768x1024+)
  - Create mobile-optimized layout with collapsible sidebar
  - Use Tailwind responsive breakpoints (sm, md, lg, xl, 2xl)
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 13.2 Implement accessibility features
  - Add keyboard navigation support (Tab, Enter, Escape)
  - Implement ARIA labels for screen readers
  - Ensure color contrast ratios (4.5:1 minimum)
  - Test with screen readers (VoiceOver, NVDA)
  - Add focus indicators for interactive elements
  - _Requirements: 12.5, 12.6, 12.7_

- [ ] 13.3 Optimize performance
  - Implement progressive loading with React.lazy
  - Add loading skeletons for all data components
  - Optimize bundle size with code splitting
  - Test page load times (target < 3s)
  - Implement image optimization with Next.js Image
  - _Requirements: 12.8, 12.9, 12.10_

### 14. Testing and Documentation

- [ ] 14.1 Write unit tests
  - Test authentication logic (adminAuthService)
  - Test API client functions
  - Test utility functions
  - Test React hooks (useAuth, useDashboardMetrics, etc.)
  - Use Vitest for backend, Jest/React Testing Library for frontend
  - _Requirements: All_

- [ ] 14.2 Write integration tests
  - Test authentication flows (login, logout, refresh)
  - Test data fetching and mutations
  - Test real-time updates (SSE)
  - Test user workflows (view job, retry job, etc.)
  - _Requirements: All_

- [ ] 14.3 Write end-to-end tests
  - Test complete user journeys with Playwright
  - Test error scenarios
  - Test responsive layouts
  - Test accessibility compliance
  - _Requirements: All_

- [ ] 14.4 Create documentation
  - Write user guide for administrators (docs/ADMIN_GUIDE.md)
  - Document API endpoints (docs/ADMIN_API.md)
  - Create deployment guide (docs/ADMIN_DEPLOYMENT.md)
  - Write troubleshooting guide (docs/ADMIN_TROUBLESHOOTING.md)
  - _Requirements: All_

### 15. Deployment and Production Setup

- [ ] 15.1 Configure production environment
  - Set up Vercel project (or self-hosted Next.js)
  - Configure environment variables (NEXT_PUBLIC_API_URL, etc.)
  - Set up custom domain (app.faxi.jp)
  - Configure SSL certificates (automatic with Vercel)
  - Set up Cloudflare CDN for static assets
  - _Requirements: All_

- [ ] 15.2 Set up monitoring and logging
  - Configure Vercel Analytics for performance monitoring
  - Set up Sentry for error tracking
  - Configure custom metrics to backend monitoring
  - Set up uptime monitoring (UptimeRobot)
  - _Requirements: All_

- [ ] 15.3 Implement security measures
  - Configure CORS policies (allow app.faxi.jp)
  - Set up rate limiting on backend endpoints
  - Implement CSRF protection
  - Configure security headers (Helmet.js)
  - Set up httpOnly, secure, sameSite cookies
  - _Requirements: All security requirements_

- [ ] 15.4 Deploy to production
  - Deploy backend admin endpoints to api.faxi.jp
  - Deploy frontend to Vercel production (app.faxi.jp)
  - Verify all endpoints working
  - Test authentication flow end-to-end
  - Verify real-time updates (SSE)
  - Create initial admin user account
  - _Requirements: All_

## Implementation Summary

**Total Tasks: 16 major tasks with 101 sub-tasks**

**Phase 0 (Monorepo Setup):** 1 major task, 3 sub-tasks
- Setup monorepo structure (3 sub-tasks)

**Phase 1 (MVP):** 4 major tasks, 28 sub-tasks
- Backend API foundation (8 sub-tasks)
- Frontend foundation (4 sub-tasks)
- Operations dashboard (8 sub-tasks)
- Fax job management (5 sub-tasks)
- Optional testing (3 sub-tasks)

**Phase 2:** 2 major tasks, 17 sub-tasks
- User management (6 sub-tasks)
- MCP monitoring (5 sub-tasks)
- Optional testing (6 sub-tasks)

**Phase 3:** 2 major tasks, 17 sub-tasks
- AI interpretation inspector (5 sub-tasks)
- Financial dashboard (6 sub-tasks)
- Optional testing (6 sub-tasks)

**Phase 4:** 7 major tasks, 35 sub-tasks
- Alert management (6 sub-tasks)
- Configuration management (6 sub-tasks)
- Analytics and reporting (10 sub-tasks)
- Audit log viewer (6 sub-tasks)
- Responsive design and accessibility (3 sub-tasks)
- Testing and documentation (4 sub-tasks)
- Deployment and production setup (4 sub-tasks)

**Key Implementation Notes:**
- **Monorepo Structure**: Using npm workspaces with backend/ and admin-dashboard/ directories
- The Faxi Core System already has monitoring, alerting, and audit logging services that can be leveraged
- The existing database schema (users, fax_jobs, orders, audit_logs) provides the foundation for admin queries
- New tables needed: admin_users, admin_refresh_tokens, admin_preferences, system_config, ai_interpretation_feedback
- Frontend is a Next.js 14 project in admin-dashboard/ directory
- Backend admin endpoints will be added to backend/src/index.ts Express app
- Real-time updates will use Server-Sent Events (SSE) for dashboard and alerts
- Both backend and frontend can be developed and run concurrently with `npm run dev:all`

**Estimated Timeline:**
- Phase 0: 1-2 days (monorepo setup)
- Phase 1: 2-3 weeks
- Phase 2: 1-2 weeks
- Phase 3: 1-2 weeks
- Phase 4: 2-3 weeks
- **Total: 6-10 weeks**
