# Admin Dashboard Requirements Document

## Introduction

The Faxi Admin Dashboard is a web-based administrative interface for monitoring, managing, and operating the Faxi Core System. It provides real-time visibility into system operations, user management capabilities, and tools for troubleshooting and optimization. The dashboard will be hosted at `app.faxi.jp` and serve as the primary operational interface for administrators, support staff, and business analysts.

## Glossary

- **Admin Dashboard**: Web-based administrative interface hosted at app.faxi.jp
- **Faxi Core System**: The backend fax-to-internet bridge service (API at api.faxi.jp)
- **Fax Job**: A single inbound or outbound fax transaction with associated processing pipeline
- **MCP Server**: Model Context Protocol server providing tools to the agent (email, shopping, payment, etc.)
- **Agent**: The MCP Controller Agent that orchestrates workflows using MCP tools
- **Interpretation**: AI Vision analysis result extracting intent and parameters from fax images
- **Context**: Conversation state maintained across multiple fax exchanges
- **Reference ID**: Unique identifier for fax jobs in format FX-YYYY-NNNNNN
- **Admin User**: Authenticated user with access to the admin dashboard
- **Role**: Permission level (super_admin, admin, support, analyst)
- **Alert**: System notification triggered by threshold violations or errors
- **Metric**: Quantitative measurement of system performance or behavior
- **Audit Log**: Immutable record of system actions and changes

## Requirements

### Requirement 1: Authentication and Authorization

**User Story:** As an administrator, I want secure access to the admin dashboard with role-based permissions, so that only authorized personnel can view and modify system data.

#### Acceptance Criteria

1. WHEN an unauthenticated user accesses app.faxi.jp, THE Admin Dashboard SHALL redirect to the login page
2. WHEN a user submits valid credentials, THE Admin Dashboard SHALL authenticate the user and create a session token
3. WHEN a user submits invalid credentials, THE Admin Dashboard SHALL display an error message and log the failed attempt
4. WHILE a user is authenticated, THE Admin Dashboard SHALL display their name and role in the navigation header
5. WHEN a user's session expires, THE Admin Dashboard SHALL redirect to the login page and preserve the intended destination
6. WHERE a user has the 'support' role, THE Admin Dashboard SHALL restrict access to read-only operations
7. WHERE a user has the 'analyst' role, THE Admin Dashboard SHALL restrict access to analytics and reporting features only
8. WHERE a user has the 'admin' role, THE Admin Dashboard SHALL allow full operational access except user management
9. WHERE a user has the 'super_admin' role, THE Admin Dashboard SHALL allow unrestricted access to all features
10. WHEN a user logs out, THE Admin Dashboard SHALL invalidate the session token and clear all cached data

### Requirement 2: Real-Time Operations Dashboard

**User Story:** As an operations administrator, I want a real-time dashboard showing system health and active processing, so that I can quickly identify and respond to issues.

#### Acceptance Criteria

1. WHEN the operations dashboard loads, THE Admin Dashboard SHALL display current system health status for all services within 2 seconds
2. WHILE the dashboard is open, THE Admin Dashboard SHALL update metrics every 5 seconds without page refresh
3. WHEN any service status changes to 'down' or 'degraded', THE Admin Dashboard SHALL highlight the affected service in red or yellow
4. THE Admin Dashboard SHALL display active fax jobs currently in the processing pipeline with their current stage
5. THE Admin Dashboard SHALL display queue metrics including pending jobs, processing rate, and average wait time
6. THE Admin Dashboard SHALL display error rate for the last hour with trend indicator (increasing/decreasing/stable)
7. THE Admin Dashboard SHALL display average response time for API endpoints with percentile breakdowns (p50, p95, p99)
8. THE Admin Dashboard SHALL display current resource usage including CPU, memory, and disk space with visual gauges
9. WHEN an administrator clicks on a service status indicator, THE Admin Dashboard SHALL navigate to detailed service metrics
10. WHEN an administrator clicks on an active job, THE Admin Dashboard SHALL open the job details modal

### Requirement 3: Fax Job Management

**User Story:** As a support administrator, I want to search, view, and manage fax jobs, so that I can troubleshoot user issues and retry failed operations.

#### Acceptance Criteria

1. THE Admin Dashboard SHALL provide a search interface for fax jobs with filters for status, user, date range, and intent
2. WHEN an administrator searches for fax jobs, THE Admin Dashboard SHALL return results within 3 seconds with pagination
3. WHEN an administrator clicks on a fax job, THE Admin Dashboard SHALL display complete job details including processing history
4. THE Admin Dashboard SHALL display the original fax image with zoom and pan capabilities
5. THE Admin Dashboard SHALL display AI interpretation results including extracted intent, parameters, and confidence scores
6. THE Admin Dashboard SHALL display all agent actions taken including MCP tool calls and their results
7. THE Admin Dashboard SHALL display the generated response fax with preview capability
8. WHERE a fax job has status 'failed', THE Admin Dashboard SHALL provide a retry button to reprocess the job
9. WHEN an administrator clicks retry, THE Admin Dashboard SHALL enqueue the job for reprocessing and display confirmation
10. WHERE a fax job is in status 'processing', THE Admin Dashboard SHALL provide a cancel button to stop processing
11. THE Admin Dashboard SHALL display conversation context associated with the fax job including reference ID and related faxes
12. WHEN an administrator views a fax job, THE Admin Dashboard SHALL log the access in the audit log

### Requirement 4: User Management

**User Story:** As a customer support administrator, I want to search and manage user accounts, so that I can assist users with account issues and monitor usage.

#### Acceptance Criteria

1. THE Admin Dashboard SHALL provide a search interface for users by phone number, email, or registration date
2. WHEN an administrator searches for users, THE Admin Dashboard SHALL return results within 2 seconds
3. WHEN an administrator clicks on a user, THE Admin Dashboard SHALL display complete user profile including preferences and feature flags
4. THE Admin Dashboard SHALL display user activity history including all fax jobs, orders, and payments
5. THE Admin Dashboard SHALL display user statistics including total faxes sent/received, orders placed, and total spend
6. WHERE a user has the 'admin' or 'super_admin' role, THE Admin Dashboard SHALL provide controls to modify user feature flags
7. WHEN an administrator modifies feature flags, THE Admin Dashboard SHALL apply changes immediately and log the action
8. THE Admin Dashboard SHALL provide a button to view user's address book contacts
9. THE Admin Dashboard SHALL provide a button to view user's payment methods (masked for security)
10. THE Admin Dashboard SHALL provide a button to view user's order history with order details
11. WHERE a user has active conversation contexts, THE Admin Dashboard SHALL display them with expiration times
12. THE Admin Dashboard SHALL provide a button to manually expire or clear conversation contexts

### Requirement 5: MCP Server Monitoring

**User Story:** As a technical administrator, I want to monitor MCP server health and tool usage, so that I can identify integration issues and optimize performance.

#### Acceptance Criteria

1. THE Admin Dashboard SHALL display status of all registered MCP servers (email, shopping, payment, ai_chat, user_profile)
2. WHEN an MCP server is unavailable, THE Admin Dashboard SHALL display the server status as 'down' with last error message
3. THE Admin Dashboard SHALL display tool usage statistics for each MCP server including call count and success rate
4. THE Admin Dashboard SHALL display average response time for each MCP tool over the last hour
5. THE Admin Dashboard SHALL display external API health status for Telnyx, Stripe, Google Gemini, and shopping APIs
6. WHEN an external API is experiencing issues, THE Admin Dashboard SHALL display error rate and recent error messages
7. THE Admin Dashboard SHALL display API rate limit usage as percentage of quota for each external service
8. THE Admin Dashboard SHALL display estimated costs for the current billing period broken down by service
9. WHERE a user has the 'admin' or 'super_admin' role, THE Admin Dashboard SHALL provide controls to enable/disable MCP servers
10. WHEN an administrator disables an MCP server, THE Admin Dashboard SHALL prevent new tool calls and display confirmation

### Requirement 6: AI Interpretation Inspector

**User Story:** As a technical administrator, I want to review AI interpretation results and accuracy, so that I can identify issues and improve the system.

#### Acceptance Criteria

1. THE Admin Dashboard SHALL provide an interface to browse recent AI interpretations with filters for confidence level and intent
2. WHEN an administrator views an interpretation, THE Admin Dashboard SHALL display the original fax image alongside extracted data
3. THE Admin Dashboard SHALL display confidence scores for intent classification and parameter extraction
4. THE Admin Dashboard SHALL display detected visual annotations (circles, checkmarks, arrows) overlaid on the fax image
5. THE Admin Dashboard SHALL display the full AI prompt and response for debugging purposes
6. WHERE an interpretation has confidence below 0.7, THE Admin Dashboard SHALL flag it for review
7. THE Admin Dashboard SHALL provide a feedback mechanism to mark interpretations as correct or incorrect
8. WHEN an administrator marks an interpretation as incorrect, THE Admin Dashboard SHALL prompt for the correct interpretation
9. THE Admin Dashboard SHALL store interpretation feedback for future model training and improvement
10. THE Admin Dashboard SHALL display interpretation accuracy metrics over time with trend analysis

### Requirement 7: Financial Dashboard

**User Story:** As a business administrator, I want to view financial metrics and transaction details, so that I can monitor revenue and identify payment issues.

#### Acceptance Criteria

1. THE Admin Dashboard SHALL display total revenue for selectable time periods (today, week, month, year, custom)
2. THE Admin Dashboard SHALL display revenue breakdown by payment method (credit card, convenience store)
3. THE Admin Dashboard SHALL display order count and average order value with trend indicators
4. THE Admin Dashboard SHALL display pending convenience store payments with expiration times
5. THE Admin Dashboard SHALL display failed payment attempts with error reasons and retry status
6. WHEN an administrator clicks on a payment, THE Admin Dashboard SHALL display complete payment details
7. THE Admin Dashboard SHALL provide a direct link to the Stripe dashboard for each payment
8. WHERE a payment has failed, THE Admin Dashboard SHALL provide a retry button to attempt reprocessing
9. THE Admin Dashboard SHALL display refund history with reasons and amounts
10. WHERE a user has the 'admin' or 'super_admin' role, THE Admin Dashboard SHALL provide controls to issue refunds
11. THE Admin Dashboard SHALL display payment processing fees and net revenue
12. THE Admin Dashboard SHALL provide export functionality for financial data in CSV format

### Requirement 8: Alert Management

**User Story:** As an operations administrator, I want to configure and manage system alerts, so that I can be notified of critical issues proactively.

#### Acceptance Criteria

1. THE Admin Dashboard SHALL display all active alerts with severity level (critical, warning, info)
2. WHEN a new alert is triggered, THE Admin Dashboard SHALL display a notification banner and play a sound (if enabled)
3. THE Admin Dashboard SHALL display alert history with resolution times and actions taken
4. WHERE a user has the 'admin' or 'super_admin' role, THE Admin Dashboard SHALL provide controls to configure alert rules
5. WHEN an administrator creates an alert rule, THE Admin Dashboard SHALL validate the condition and save the configuration
6. THE Admin Dashboard SHALL support alert conditions based on metrics, error rates, queue sizes, and service health
7. THE Admin Dashboard SHALL provide controls to configure notification channels (email, Slack, PagerDuty)
8. WHEN an alert is triggered, THE Admin Dashboard SHALL send notifications to configured channels
9. THE Admin Dashboard SHALL implement alert cooldown periods to prevent notification spam
10. WHERE a user has the 'admin' or 'super_admin' role, THE Admin Dashboard SHALL provide controls to acknowledge or dismiss alerts
11. WHEN an administrator acknowledges an alert, THE Admin Dashboard SHALL log the action and stop sending notifications

### Requirement 9: Configuration Management

**User Story:** As a technical administrator, I want to manage system configuration settings, so that I can adjust behavior without code deployments.

#### Acceptance Criteria

1. WHERE a user has the 'super_admin' role, THE Admin Dashboard SHALL display all system configuration settings
2. THE Admin Dashboard SHALL organize configuration settings by category (features, MCP servers, rate limits, queue, test mode)
3. THE Admin Dashboard SHALL display current values for all configuration settings with data types and descriptions
4. WHEN an administrator modifies a configuration setting, THE Admin Dashboard SHALL validate the new value
5. WHEN an administrator saves configuration changes, THE Admin Dashboard SHALL apply changes immediately without restart
6. THE Admin Dashboard SHALL log all configuration changes in the audit log with old and new values
7. THE Admin Dashboard SHALL provide controls to enable/disable feature flags globally
8. THE Admin Dashboard SHALL provide controls to enable/disable individual MCP servers
9. THE Admin Dashboard SHALL provide controls to adjust rate limiting thresholds for API endpoints
10. THE Admin Dashboard SHALL provide controls to configure queue worker counts and timeouts
11. THE Admin Dashboard SHALL provide a toggle to enable/disable test mode
12. WHEN test mode is enabled, THE Admin Dashboard SHALL display a prominent banner indicating test mode is active

### Requirement 10: Analytics and Reporting

**User Story:** As a business analyst, I want to view usage analytics and generate reports, so that I can understand user behavior and system performance.

#### Acceptance Criteria

1. THE Admin Dashboard SHALL display usage trends over time including fax count, user count, and order count
2. THE Admin Dashboard SHALL display intent distribution showing most common user requests
3. THE Admin Dashboard SHALL display conversion funnel metrics for shopping workflows (search → select → purchase)
4. THE Admin Dashboard SHALL display user retention metrics including new users, returning users, and churn rate
5. THE Admin Dashboard SHALL display peak usage hours and days of week with heatmap visualization
6. THE Admin Dashboard SHALL display error analysis showing most common errors and their frequencies
7. THE Admin Dashboard SHALL display performance metrics including average processing time by intent
8. THE Admin Dashboard SHALL display SLA compliance metrics for processing time requirements
9. THE Admin Dashboard SHALL provide date range selectors for all analytics views
10. THE Admin Dashboard SHALL provide export functionality for analytics data in CSV and PDF formats
11. THE Admin Dashboard SHALL provide scheduled report generation with email delivery
12. THE Admin Dashboard SHALL display cost analysis including per-user costs and service costs

### Requirement 11: Audit Log Viewer

**User Story:** As a compliance administrator, I want to view and search audit logs, so that I can track system actions for compliance and security purposes.

#### Acceptance Criteria

1. THE Admin Dashboard SHALL display audit logs with filters for entity type, action, user, and date range
2. WHEN an administrator searches audit logs, THE Admin Dashboard SHALL return results within 3 seconds with pagination
3. THE Admin Dashboard SHALL display audit log entries with timestamp, entity type, entity ID, action, user, and details
4. THE Admin Dashboard SHALL provide drill-down capability to view complete audit log details including before/after values
5. THE Admin Dashboard SHALL display user action history showing all actions taken by a specific user
6. THE Admin Dashboard SHALL display admin action history showing all administrative interventions
7. THE Admin Dashboard SHALL display data change history showing who modified what and when
8. THE Admin Dashboard SHALL provide export functionality for audit logs in CSV format
9. THE Admin Dashboard SHALL implement audit log retention policies with automatic archival
10. WHERE a user has the 'super_admin' role, THE Admin Dashboard SHALL provide controls to configure retention policies
11. THE Admin Dashboard SHALL ensure audit logs are immutable and cannot be modified or deleted

### Requirement 12: Responsive Design and Accessibility

**User Story:** As an administrator, I want the dashboard to work on different devices and be accessible, so that I can monitor the system from anywhere.

#### Acceptance Criteria

1. THE Admin Dashboard SHALL render correctly on desktop screens (1920x1080 and above)
2. THE Admin Dashboard SHALL render correctly on laptop screens (1366x768 and above)
3. THE Admin Dashboard SHALL render correctly on tablet screens (768x1024 and above)
4. WHEN viewed on mobile devices, THE Admin Dashboard SHALL display a simplified mobile-optimized layout
5. THE Admin Dashboard SHALL support keyboard navigation for all interactive elements
6. THE Admin Dashboard SHALL provide appropriate ARIA labels for screen readers
7. THE Admin Dashboard SHALL maintain color contrast ratios of at least 4.5:1 for text
8. THE Admin Dashboard SHALL support browser zoom up to 200% without breaking layout
9. THE Admin Dashboard SHALL load initial page content within 3 seconds on standard broadband connections
10. THE Admin Dashboard SHALL implement progressive loading for large data sets to maintain responsiveness
