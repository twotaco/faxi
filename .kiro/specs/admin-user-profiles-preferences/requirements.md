# Requirements Document

## Introduction

This feature builds upon the existing user insights data collection infrastructure (see `.kiro/specs/user-insights-data-intelligence/`) to create two key capabilities:

1. **Individual User Profiles**: Display comprehensive user intelligence profiles in the Admin Dashboard for operational oversight and customer support
2. **AI Agent Personalization**: Enable AI agents and MCP servers to leverage user intelligence for personalized, context-aware responses

The system already collects comprehensive user insights including demographics, life events, intent signals, behavioral patterns, consumer profiles, and digital exclusion metrics through LLM responses. This feature focuses on surfacing individual user profiles and using that intelligence to personalize AI agent behavior.

Note: Cluster-level analytics and aggregate reporting will be handled in a separate Analytics spec for the Admin Dashboard.

## Glossary

- **Admin Dashboard**: The web-based administrative interface for managing the Faxi system
- **User Intelligence**: Comprehensive profile data about users inferred from their fax interactions, including demographics, behaviors, and intent signals
- **User Insights Profile**: Individual user's complete intelligence data stored in the user_insights table
- **Insight History**: Chronological audit trail of all insights detected for a user over time
- **Aggregate Insights**: Anonymized cluster-level intelligence data grouped by demographics (minimum n=100 for privacy)
- **Digital Exclusion Score**: Metric from 1-5 indicating user's digital literacy (1=digitally savvy, 5=completely excluded)
- **Life Events**: Significant life changes detected from user interactions (moving, hospitalization, retirement, etc.)
- **Intent Signals**: Commercial, health, or government service intents detected from user requests
- **Confidence Score**: Numerical value from 0.0 to 1.0 indicating certainty of an insight
- **Cluster**: Group of users sharing common demographic characteristics (region, age range, household type)

## Requirements

### Requirement 1

**User Story:** As an admin, I want to view comprehensive intelligence data for individual users, so that I can understand user profiles and provide better service.

#### Acceptance Criteria

1. WHEN an admin views a user detail page THEN the Admin Dashboard SHALL display a dedicated "Intelligence" tab alongside existing Profile, Activity, and Orders tabs
2. WHEN the Intelligence tab is selected THEN the Admin Dashboard SHALL retrieve and display the user's complete insights profile from the user_insights table
3. WHEN displaying demographic insights THEN the Admin Dashboard SHALL show age range, gender, region, household type, and digital exclusion score with their respective confidence scores
4. WHEN displaying life events THEN the Admin Dashboard SHALL show all detected life events with detection timestamps and confidence scores
5. WHEN displaying intent signals THEN the Admin Dashboard SHALL show commercial, health, and government intents with categories and detection timestamps

### Requirement 2

**User Story:** As an admin, I want to see the historical evolution of user insights, so that I can track how user profiles change over time.

#### Acceptance Criteria

1. WHEN viewing user intelligence THEN the Admin Dashboard SHALL display an insights history timeline showing all detected insights chronologically
2. WHEN displaying insight history entries THEN the Admin Dashboard SHALL show insight type, category, detection timestamp, confidence score, and associated fax job reference
3. WHEN an insight represents a change THEN the Admin Dashboard SHALL display both previous value and new value for comparison
4. WHEN filtering insight history THEN the Admin Dashboard SHALL allow filtering by insight type including demographic, life_event, intent, and behavior
5. WHEN the insight history exceeds fifty entries THEN the Admin Dashboard SHALL paginate results with fifty entries per page

### Requirement 3

**User Story:** As an admin, I want visual representations of individual user intelligence data, so that I can quickly understand user profiles and preferences.

#### Acceptance Criteria

1. WHEN viewing individual user intelligence THEN the Admin Dashboard SHALL display the digital exclusion score as a visual indicator with color coding
2. WHEN viewing intent signals THEN the Admin Dashboard SHALL display intent categories as labeled badges with appropriate visual styling
3. WHEN displaying confidence scores THEN the Admin Dashboard SHALL use visual indicators such as progress bars or color coding to represent confidence levels
4. WHEN life events are detected THEN the Admin Dashboard SHALL display event types with distinct icons and timestamps
5. WHEN viewing behavioral patterns THEN the Admin Dashboard SHALL display communication style and task complexity preferences with clear visual indicators

### Requirement 4

**User Story:** As an admin, I want to access individual user intelligence data through API endpoints, so that the frontend can retrieve and display user profiles efficiently.

#### Acceptance Criteria

1. WHEN the frontend requests user insights THEN the backend SHALL provide a GET endpoint at /admin/users/:id/insights returning the complete user insights profile
2. WHEN the frontend requests insight history THEN the backend SHALL provide a GET endpoint at /admin/users/:id/insights/history with optional type filtering and pagination
3. WHEN API requests include invalid user IDs THEN the backend SHALL return HTTP 404 status with appropriate error messages
4. WHEN API requests are made by unauthenticated users THEN the backend SHALL return HTTP 401 status and reject the request
5. WHEN the frontend requests user preferences summary THEN the backend SHALL provide a GET endpoint at /admin/users/:id/preferences returning formatted preferences for quick reference

### Requirement 5

**User Story:** As an admin, I want the user profile display to respect user privacy, so that sensitive information is protected.

#### Acceptance Criteria

1. WHEN displaying individual user insights THEN the Admin Dashboard SHALL only show insights that passed privacy validation checks
2. WHEN insight data contains personally identifiable information THEN the Admin Dashboard SHALL not display the raw insight data
3. WHEN displaying confidence scores THEN the Admin Dashboard SHALL indicate low confidence insights with visual warnings
4. WHEN users have no insights data THEN the Admin Dashboard SHALL display a message indicating no intelligence data is available
5. WHEN displaying sensitive life events THEN the Admin Dashboard SHALL show only high-level indicators without detailed personal information

### Requirement 6

**User Story:** As an AI agent processing user requests, I want to access user profile and preference data, so that I can provide personalized and contextually relevant responses.

#### Acceptance Criteria

1. WHEN an AI agent processes a user request THEN the MCP Controller Agent SHALL retrieve the user's intelligence profile from the user_insights table
2. WHEN user intelligence data exists THEN the AI agent SHALL include relevant insights in the prompt context including demographics, preferences, and recent intent signals
3. WHEN commercial intent signals are detected THEN the Shopping MCP SHALL prioritize product categories matching the user's category preferences
4. WHEN digital exclusion score is high THEN the AI agent SHALL simplify language and provide more detailed step-by-step instructions
5. WHEN life events are detected THEN the AI agent SHALL acknowledge relevant context and adjust tone appropriately

### Requirement 7

**User Story:** As an AI agent, I want to use behavioral patterns and preferences from user profiles, so that I can adapt my communication style to match user preferences.

#### Acceptance Criteria

1. WHEN user intelligence contains communication style data THEN the AI agent SHALL adapt response verbosity and formality to match the detected style
2. WHEN task complexity patterns indicate preference for simple tasks THEN the AI agent SHALL break complex requests into smaller steps
3. WHEN spend sensitivity indicates price consciousness THEN the Shopping MCP SHALL prioritize budget-friendly options and highlight discounts
4. WHEN brand mentions are present THEN the Shopping MCP SHALL prioritize products from mentioned brands in search results
5. WHEN AI assistance needs are identified THEN the AI agent SHALL proactively offer help with detected challenging task types

### Requirement 8

**User Story:** As a system administrator, I want to configure which user profile data is shared with AI agents, so that I can control privacy and relevance of context.

#### Acceptance Criteria

1. WHEN retrieving intelligence for AI context THEN the system SHALL filter insights based on configured privacy settings
2. WHEN confidence scores are below a configured threshold THEN the system SHALL exclude low-confidence insights from AI context
3. WHEN insights are older than a configured time period THEN the system SHALL exclude stale insights from AI context
4. WHEN certain insight types are marked as sensitive THEN the system SHALL exclude those types from AI context regardless of other settings
5. WHEN AI context is assembled THEN the system SHALL log which insights were included for audit purposes

### Requirement 9

**User Story:** As an admin, I want the user profile features to integrate seamlessly with existing admin functionality, so that the user experience remains consistent.

#### Acceptance Criteria

1. WHEN adding intelligence features THEN the Admin Dashboard SHALL maintain the existing design system and visual styling
2. WHEN navigating between tabs THEN the Admin Dashboard SHALL preserve the current user context and maintain navigation state
3. WHEN loading intelligence data THEN the Admin Dashboard SHALL display loading indicators consistent with existing patterns
4. WHEN errors occur THEN the Admin Dashboard SHALL display error messages using the existing error handling patterns
5. WHEN intelligence data is unavailable THEN the Admin Dashboard SHALL gracefully degrade and allow access to other user information
