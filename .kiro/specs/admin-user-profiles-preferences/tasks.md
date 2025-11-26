# Implementation Plan

- [ ] 1. Set up Intelligence Context Service for AI agents
  - Create IntelligenceContextService class with filtering and formatting methods
  - Implement buildAgentContext() to retrieve and filter user intelligence
  - Implement filterByConfidence() to exclude low-confidence insights
  - Implement filterByAge() to exclude stale insights
  - Implement formatForPrompt() to create LLM-friendly context strings
  - _Requirements: 6.1, 6.2, 8.1, 8.2, 8.3, 8.4_

- [ ]* 1.1 Write property test for intelligence filtering
  - **Property 15: Comprehensive intelligence filtering**
  - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

- [ ]* 1.2 Write property test for audit logging
  - **Property 16: Intelligence audit logging**
  - **Validates: Requirements 8.5**

- [ ] 2. Integrate intelligence context into MCP Controller Agent
  - Enhance buildDecisionContext() to retrieve user intelligence
  - Add intelligence field to DecisionContext interface
  - Ensure intelligence retrieval doesn't block main workflow on errors
  - _Requirements: 6.1, 6.2_

- [ ]* 2.1 Write property test for intelligence retrieval
  - **Property 17: Intelligence retrieval for agent requests**
  - **Validates: Requirements 6.1**

- [ ]* 2.2 Write property test for context inclusion
  - **Property 18: Intelligence context inclusion**
  - **Validates: Requirements 6.2**

- [ ] 3. Enhance Shopping MCP with preference-based ranking
  - Modify search_products tool to accept intelligence context
  - Implement category preference boosting in search results
  - Implement brand preference prioritization
  - Implement spend sensitivity price filtering
  - _Requirements: 6.3, 7.3, 7.4_

- [ ]* 3.1 Write property test for preference-based ranking
  - **Property 19: Preference-based search ranking**
  - **Validates: Requirements 6.3, 7.3, 7.4**

- [ ] 4. Enhance AI Chat MCP with adaptive responses
  - Modify chat tool to accept intelligence context
  - Implement buildSystemPrompt() with intelligence-based adaptations
  - Add digital exclusion score-based language simplification
  - Add communication style matching
  - Add life event context acknowledgment
  - Add task complexity-based response structuring
  - _Requirements: 6.4, 6.5, 7.1, 7.2_

- [ ]* 4.1 Write property test for response adaptation
  - **Property 20: Context-aware response adaptation**
  - **Validates: Requirements 6.4, 6.5, 7.1, 7.2**

- [ ] 5. Implement proactive assistance in AI agents
  - Add logic to detect AI assistance needs from intelligence
  - Implement proactive help offering in responses
  - _Requirements: 7.5_

- [ ]* 5.1 Write property test for proactive assistance
  - **Property 21: Proactive assistance offering**
  - **Validates: Requirements 7.5**

- [ ] 6. Create backend API endpoints for user intelligence
  - Implement GET /admin/users/:id/insights endpoint
  - Implement GET /admin/users/:id/insights/history endpoint with filtering and pagination
  - Implement GET /admin/users/:id/preferences endpoint
  - Add authentication middleware to all endpoints
  - Add input validation for user IDs and query parameters
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 6.1 Write property test for insights API
  - **Property 8: User insights API response**
  - **Validates: Requirements 4.1**

- [ ]* 6.2 Write property test for history API
  - **Property 9: Insight history API response**
  - **Validates: Requirements 4.2**

- [ ]* 6.3 Write property test for preferences API
  - **Property 10: User preferences API response**
  - **Validates: Requirements 4.5**

- [ ]* 6.4 Write property test for API error handling
  - **Property 11: API error handling for invalid IDs**
  - **Validates: Requirements 4.3**

- [ ]* 6.5 Write property test for API authentication
  - **Property 12: API authentication enforcement**
  - **Validates: Requirements 4.4**

- [ ] 7. Create UserIntelligenceTab frontend component
  - Create UserIntelligenceTab component with sections for all insight types
  - Implement data fetching using React Query
  - Add loading and error states
  - Integrate with existing user details page tabs
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ]* 7.1 Write property test for data completeness
  - **Property 1: Intelligence data completeness**
  - **Validates: Requirements 1.3, 1.4, 1.5**

- [ ] 8. Create InsightHistoryTimeline frontend component
  - Create timeline component with chronological display
  - Implement filtering by insight type
  - Implement pagination (50 entries per page)
  - Display all required fields for each entry
  - Show previous/new values for changes
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ]* 8.1 Write property test for chronological ordering
  - **Property 2: Insight history chronological ordering**
  - **Validates: Requirements 2.1**

- [ ]* 8.2 Write property test for field completeness
  - **Property 3: Insight history field completeness**
  - **Validates: Requirements 2.2**

- [ ]* 8.3 Write property test for change tracking
  - **Property 4: Change tracking display**
  - **Validates: Requirements 2.3**

- [ ]* 8.4 Write property test for filtering
  - **Property 5: Insight history filtering**
  - **Validates: Requirements 2.4**

- [ ]* 8.5 Write property test for pagination
  - **Property 6: Insight history pagination**
  - **Validates: Requirements 2.5**

- [ ] 9. Create visual indicator components
  - Create DigitalExclusionIndicator component with color coding
  - Create IntentBadge component for intent signals
  - Create ConfidenceIndicator component for confidence scores
  - Create LifeEventIcon component for life events
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 9.1 Write property test for visual indicators
  - **Property 7: Visual indicator consistency**
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [ ]* 9.2 Write property test for low confidence warnings
  - **Property 14: Low confidence warning display**
  - **Validates: Requirements 5.3**

- [ ] 10. Implement privacy filtering in frontend
  - Add privacy validation before displaying insights
  - Filter out insights with PII
  - Show warnings for low confidence insights
  - Display appropriate messages when no data available
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 10.1 Write property test for privacy filtering
  - **Property 13: Privacy validation filtering**
  - **Validates: Requirements 5.1, 5.2**

- [ ] 11. Create React Query hooks for intelligence data
  - Create useUserIntelligence hook
  - Create useInsightHistory hook with filtering and pagination
  - Create useUserPreferences hook
  - Add error handling and retry logic
  - _Requirements: 1.2, 2.1, 4.1, 4.2, 4.5_

- [ ] 12. Integrate Intelligence tab into user details page
  - Add Intelligence tab to existing tab navigation
  - Ensure tab state preservation during navigation
  - Maintain consistent loading and error patterns
  - Ensure graceful degradation when intelligence unavailable
  - _Requirements: 1.1, 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ]* 12.1 Write property test for tab navigation
  - **Property 22: Tab navigation state preservation**
  - **Validates: Requirements 9.2**

- [ ]* 12.2 Write property test for loading states
  - **Property 23: Loading state indication**
  - **Validates: Requirements 9.3**

- [ ]* 12.3 Write property test for error handling
  - **Property 24: Error state handling**
  - **Validates: Requirements 9.4, 9.5**

- [ ] 13. Add configuration for intelligence filtering
  - Create IntelligenceConfig interface
  - Add configuration to backend config
  - Implement feature flag for enabling/disabling intelligence in agents
  - Add configuration for confidence threshold, max age, and excluded types
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
