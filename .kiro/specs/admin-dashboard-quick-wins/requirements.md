# Requirements Document

## Introduction

This specification defines the implementation of four unimplemented admin dashboard pages that currently return 404 errors. The focus is on high-value, low-complexity implementations that provide immediate operational visibility without requiring multi-page workflows. These pages will leverage existing backend services and database tables to provide actionable insights for system administrators.

## Glossary

- **Admin Dashboard**: The Next.js application providing administrative oversight of the Faxi system
- **MCP Server**: Model Context Protocol server that provides domain-specific tools (email, shopping, payment, etc.)
- **AI Inspector**: Interface for monitoring AI/LLM prompt performance and validation metrics
- **Audit Log**: Immutable record of system events and user actions stored in the audit_logs table
- **System Health**: Real-time status of infrastructure components (database, Redis, queues) and resource utilization
- **Analytics**: Aggregated metrics and insights derived from system operations and user behavior

## Requirements

### Requirement 1: MCP Servers Monitoring Page

**User Story:** As a system administrator, I want to view the status and performance of all MCP servers, so that I can quickly identify integration issues and monitor API health.

#### Acceptance Criteria

1. WHEN an administrator navigates to /mcp THEN the system SHALL display a list of all MCP servers with their current status
2. WHEN displaying MCP server information THEN the system SHALL show total calls, success rate, and failed call count for each server
3. WHEN displaying recent errors THEN the system SHALL show the 5 most recent failed MCP calls with error messages, tool names, and timestamps
4. WHEN displaying external API health THEN the system SHALL show status indicators for Telnyx, Stripe, Gemini, and Amazon services
5. WHEN an MCP server has a success rate below 95% THEN the system SHALL highlight it with a warning indicator
6. WHEN displaying metrics THEN the system SHALL use data from the last 1 hour window

### Requirement 2: AI Inspector Page

**User Story:** As a system administrator, I want to monitor AI processing performance and quality, so that I can identify issues with vision interpretation and confidence scores.

#### Acceptance Criteria

1. WHEN an administrator navigates to /ai THEN the system SHALL display AI processing metrics from the processing_metrics table
2. WHEN displaying aggregate metrics THEN the system SHALL show overall success rate, average accuracy, average confidence, and average processing time
3. WHEN displaying recent processing attempts THEN the system SHALL show the 20 most recent entries with accuracy, confidence, processing time, and success status
4. WHEN displaying a processing attempt with low confidence or accuracy THEN the system SHALL provide a link to view the associated fax job
5. WHEN viewing a linked fax job THEN the system SHALL display the original fax image, extracted text, interpretation result, and confidence scores for debugging

### Requirement 3: System Health Dashboard Page

**User Story:** As a system administrator, I want to view real-time system health and recent errors, so that I can quickly identify and respond to infrastructure issues.

#### Acceptance Criteria

1. WHEN an administrator navigates to /alerts THEN the system SHALL display current system health status from the monitoring service
2. WHEN displaying infrastructure status THEN the system SHALL show connection status for database, Redis, and S3 storage with visual indicators
3. WHEN displaying resource metrics THEN the system SHALL show current memory usage, CPU usage, and uptime
4. WHEN displaying queue health THEN the system SHALL show current queue sizes for fax processing and email-to-fax queues
5. WHEN displaying recent errors THEN the system SHALL show the 50 most recent error-level entries from the application_logs table with message, timestamp, and context
6. WHEN an infrastructure component is down THEN the system SHALL highlight it with a red indicator

### Requirement 4: Analytics Dashboard Page

**User Story:** As a system administrator, I want to view system analytics and user behavior metrics, so that I can understand usage patterns and system performance.

#### Acceptance Criteria

1. WHEN an administrator navigates to /analytics THEN the system SHALL display total users, total fax jobs, and jobs processed in the last 24 hours
2. WHEN displaying fax job metrics THEN the system SHALL show distribution by status (pending, processing, completed, failed)
3. WHEN displaying user insights THEN the system SHALL show distribution by age range, region, and digital exclusion score
4. WHEN displaying processing metrics THEN the system SHALL show average accuracy, confidence, and processing time
5. WHEN displaying time-series data THEN the system SHALL show fax jobs processed per day for the last 30 days

### Requirement 5: Audit Logs Viewer Page

**User Story:** As a system administrator, I want to search and filter audit logs, so that I can investigate user actions and system events for compliance and debugging.

#### Acceptance Criteria

1. WHEN an administrator navigates to /audit THEN the system SHALL display the 100 most recent audit log entries
2. WHEN displaying audit log entries THEN the system SHALL show event type, user ID, fax job ID, timestamp, and event data
3. WHEN filtering by event type THEN the system SHALL show only logs matching the selected event type
4. WHEN filtering by date range THEN the system SHALL show only logs within the specified time window
5. WHEN displaying event data THEN the system SHALL format JSON data in a readable, expandable format


