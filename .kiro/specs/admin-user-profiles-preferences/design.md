# Design Document

## Overview

This feature enhances the Admin Dashboard and AI agent system to leverage user profile and preference data collected through fax interactions. The design has two primary components:

1. **Individual User Profiles**: Display comprehensive user profiles in the Admin Dashboard for customer support and operational oversight
2. **AI Agent Personalization**: Enable AI agents and MCP servers to access and utilize user profiles for personalized, context-aware responses

The system will surface demographics, life events, intent signals, behavioral patterns, consumer profiles, and digital exclusion metrics for individual users to support both administrative operations and intelligent agent behavior.

Note: Cluster-level analytics and aggregate reporting will be handled in a separate Analytics Dashboard spec.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Dashboard (Frontend)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ User Details │  │   Cluster    │  │  Intelligence│     │
│  │     Page     │  │   Insights   │  │     Tab      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API Layer                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Admin Intelligence API Endpoints              │  │
│  │  /admin/users/:id/insights                           │  │
│  │  /admin/users/:id/insights/history                   │  │
│  │  /admin/insights/clusters                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              User Insights Service Layer                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  userInsightsService (existing)                      │  │
│  │  + getProfile()                                      │  │
│  │  + getHistory()                                      │  │
│  │  + getAggregates()                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  intelligenceContextService (new)                    │  │
│  │  + buildAgentContext()                               │  │
│  │  + filterByConfidence()                              │  │
│  │  + filterByAge()                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  MCP Controller Agent                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Enhanced buildDecisionContext()                     │  │
│  │  + Retrieve user intelligence                        │  │
│  │  + Include in prompt context                         │  │
│  │  + Adapt behavior based on insights                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP Servers                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Shopping    │  │   AI Chat    │  │    Email     │     │
│  │     MCP      │  │     MCP      │  │     MCP      │     │
│  │ + Use prefs  │  │ + Adapt tone │  │ + Use style  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  user_insights (existing)                            │  │
│  │  insights_history (existing)                         │  │
│  │  aggregate_insights (existing)                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Admin Dashboard Flow:**
1. Admin navigates to user detail page
2. Frontend requests intelligence data via API
3. Backend retrieves from user_insights and insights_history tables
4. Data formatted and returned to frontend
5. UI renders intelligence tab with visualizations

**AI Agent Flow:**
1. User sends fax request
2. MCP Controller Agent processes request
3. Agent retrieves user intelligence via intelligenceContextService
4. Intelligence data filtered by confidence and age
5. Relevant insights included in LLM prompt context
6. MCP servers adapt behavior based on insights
7. Personalized response generated

## Components and Interfaces

### Frontend Components

#### 1. UserIntelligenceTab Component
```typescript
interface UserIntelligenceTabProps {
  userId: string;
}

interface UserIntelligenceData {
  profile: UserInsightsProfile;
  history: InsightHistoryEntry[];
  lastUpdated: Date;
}
```

Displays comprehensive intelligence data for a single user including:
- Demographics section with confidence indicators
- Life events timeline
- Intent signals with categories
- Behavioral patterns
- Consumer profile
- Digital exclusion score visualization

#### 2. InsightHistoryTimeline Component
```typescript
interface InsightHistoryTimelineProps {
  history: InsightHistoryEntry[];
  onFilterChange: (type?: string) => void;
}
```

Displays chronological timeline of insight detection with:
- Filterable by insight type
- Pagination (50 entries per page)
- Visual indicators for confidence scores
- Links to associated fax jobs

#### 4. DigitalExclusionIndicator Component
```typescript
interface DigitalExclusionIndicatorProps {
  score: number; // 1-5
  showLabel?: boolean;
}
```

Visual indicator for digital exclusion score with color coding:
- 1-2: Green (digitally savvy)
- 3: Yellow (moderate)
- 4-5: Red (excluded)

### Backend API Endpoints

#### 1. GET /admin/users/:id/insights
```typescript
interface GetUserInsightsResponse {
  success: boolean;
  insights: {
    userId: string;
    profileData: UserInsights;
    lastUpdated: Date;
    createdAt: Date;
    version: number;
    ageRange?: string;
    gender?: string;
    region?: string;
    householdType?: string;
    digitalExclusionScore?: number;
    totalInteractions: number;
    lastInteractionAt?: Date;
  };
}
```

#### 2. GET /admin/users/:id/insights/history
```typescript
interface GetInsightHistoryRequest {
  type?: 'demographic' | 'life_event' | 'intent' | 'behavior';
  limit?: number; // default 50
  offset?: number; // for pagination
}

interface GetInsightHistoryResponse {
  success: boolean;
  history: InsightHistoryEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

#### 3. GET /admin/users/:id/preferences
```typescript
interface GetUserPreferencesResponse {
  success: boolean;
  preferences: {
    communication: {
      style?: string;
      preferredTimeOfDay?: string;
    };
    shopping: {
      spendSensitivity?: string;
      preferredCategories?: string[];
      brandPreferences?: string[];
    };
    digital: {
      exclusionScore?: number;
      assistanceNeeds?: string[];
    };
  };
}
```

### Backend Services

#### 1. IntelligenceContextService (New)
```typescript
class IntelligenceContextService {
  /**
   * Build intelligence context for AI agent
   */
  async buildAgentContext(
    userId: string,
    options?: ContextOptions
  ): Promise<AgentIntelligenceContext>;

  /**
   * Filter insights by confidence threshold
   */
  filterByConfidence(
    insights: UserInsights,
    minConfidence: number
  ): UserInsights;

  /**
   * Filter insights by age (exclude stale data)
   */
  filterByAge(
    profile: UserInsightsProfile,
    maxAgeDays: number
  ): UserInsights;

  /**
   * Format insights for LLM prompt
   */
  formatForPrompt(
    insights: UserInsights,
    intent: string
  ): string;
}

interface ContextOptions {
  minConfidence?: number; // default 0.5
  maxAgeDays?: number; // default 90
  excludeTypes?: string[]; // sensitive insight types to exclude
}

interface AgentIntelligenceContext {
  demographics?: {
    ageRange?: string;
    region?: string;
    householdType?: string;
  };
  recentLifeEvents?: string[];
  intentSignals?: {
    commercial?: string[];
    health?: string[];
    government?: string[];
  };
  communicationStyle?: string;
  digitalExclusionScore?: number;
  spendSensitivity?: string;
  brandPreferences?: string[];
  categoryPreferences?: string[];
}
```

#### 2. Enhanced MCP Controller Agent
```typescript
// Extend existing buildDecisionContext method
private async buildDecisionContext(request: AgentRequest): Promise<DecisionContext> {
  const context: DecisionContext = {
    interpretation: request.interpretation,
    userId: request.userId
  };

  // NEW: Retrieve user intelligence
  const intelligence = await intelligenceContextService.buildAgentContext(
    request.userId,
    {
      minConfidence: 0.5,
      maxAgeDays: 90,
      excludeTypes: config.intelligence.excludedTypes
    }
  );

  context.intelligence = intelligence;

  // Existing code for user profile, payment methods, etc.
  
  return context;
}
```

#### 3. Enhanced MCP Servers

**Shopping MCP Enhancement:**
```typescript
// In search_products tool
async handler(input: SearchProductsInput): Promise<SearchProductsOutput> {
  const { query, userId, maxResults } = input;
  
  // NEW: Get user intelligence
  const intelligence = await intelligenceContextService.buildAgentContext(userId);
  
  // Apply category preferences
  let searchQuery = query;
  if (intelligence.categoryPreferences?.length) {
    // Boost preferred categories in search
  }
  
  // Apply spend sensitivity to price filtering
  const priceFilter = intelligence.spendSensitivity === 'value' 
    ? { maxPrice: 5000 }
    : intelligence.spendSensitivity === 'premium'
    ? { minPrice: 10000 }
    : undefined;
  
  // Existing search logic with enhancements
}
```

**AI Chat MCP Enhancement:**
```typescript
// In chat tool
async handler(input: ChatInput): Promise<ChatOutput> {
  const { message, userId, conversationId } = input;
  
  // NEW: Get user intelligence
  const intelligence = await intelligenceContextService.buildAgentContext(userId);
  
  // Build enhanced prompt with intelligence context
  const systemPrompt = this.buildSystemPrompt(intelligence);
  
  // Adapt response based on digital exclusion score
  const responseStyle = intelligence.digitalExclusionScore >= 4
    ? 'simple_and_detailed'
    : intelligence.digitalExclusionScore <= 2
    ? 'concise_and_technical'
    : 'balanced';
  
  // Existing chat logic with enhancements
}

private buildSystemPrompt(intelligence: AgentIntelligenceContext): string {
  let prompt = "You are a helpful assistant for Faxi users.";
  
  if (intelligence.digitalExclusionScore >= 4) {
    prompt += " The user has limited digital literacy. Use simple language, avoid jargon, and provide step-by-step instructions.";
  }
  
  if (intelligence.communicationStyle === 'polite') {
    prompt += " The user prefers formal, polite communication.";
  }
  
  if (intelligence.recentLifeEvents?.includes('moving')) {
    prompt += " The user is currently moving or recently moved. Be sensitive to this context.";
  }
  
  return prompt;
}
```

## Data Models

### Existing Models (No Changes)

The following models already exist and will be used as-is:
- `UserInsightsProfile` (from userInsightsRepository)
- `InsightHistoryEntry` (from userInsightsRepository)
- `AggregateInsight` (from userInsightsRepository)
- `UserInsights` (from prompts/schemas/base.ts)

### New Models

#### AgentIntelligenceContext
```typescript
interface AgentIntelligenceContext {
  demographics?: {
    ageRange?: string;
    region?: string;
    householdType?: string;
  };
  recentLifeEvents?: string[]; // e.g., ['moving', 'hospitalization']
  intentSignals?: {
    commercial?: string[]; // e.g., ['electronics', 'home-goods']
    health?: string[]; // e.g., ['appointment', 'medication']
    government?: string[]; // e.g., ['pension', 'certificate']
  };
  communicationStyle?: 'short' | 'long' | 'polite' | 'direct' | 'detailed';
  digitalExclusionScore?: number; // 1-5
  spendSensitivity?: 'value' | 'normal' | 'premium';
  brandPreferences?: string[];
  categoryPreferences?: string[];
}
```

#### DecisionContext Enhancement
```typescript
// Extend existing DecisionContext interface
interface DecisionContext {
  interpretation: InterpretationResult;
  userId: string;
  userProfile?: UserProfile;
  paymentMethods?: PaymentMethod[];
  addressBook?: Contact[];
  orderHistory?: Order[];
  intelligence?: AgentIntelligenceContext; // NEW
}
```

#### IntelligenceConfig
```typescript
interface IntelligenceConfig {
  minConfidence: number; // default 0.5
  maxAgeDays: number; // default 90
  excludedTypes: string[]; // e.g., ['health_diagnosis']
  enabledForAgents: boolean; // feature flag
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several redundancies were identified and consolidated:

- Properties 1.3, 1.4, and 1.5 (displaying specific fields) can be combined into a single comprehensive property about complete data display
- Properties 3.1, 3.2, 3.3, and 3.4 (visual indicators) can be combined into a property about consistent visual representation
- Properties 6.3, 7.3, and 7.4 (shopping prioritization) can be combined into a single property about preference-based ranking
- Properties 6.4, 6.5, 7.1, and 7.2 (response adaptation) can be combined into a property about context-aware responses
- Properties 8.1, 8.2, 8.3, and 8.4 (filtering) can be combined into a single comprehensive filtering property

### Admin Dashboard Display Properties

Property 1: Intelligence data completeness
*For any* user with insights data, when displaying the intelligence tab, all available insight fields (demographics, life events, intent signals, behavioral patterns, consumer profile, digital profile) should be rendered with their associated confidence scores
**Validates: Requirements 1.3, 1.4, 1.5**

Property 2: Insight history chronological ordering
*For any* user with insight history, the timeline should display all insights in reverse chronological order (newest first)
**Validates: Requirements 2.1**

Property 3: Insight history field completeness
*For any* insight history entry, the display should include insight type, category, detection timestamp, confidence score, and fax job reference when available
**Validates: Requirements 2.2**

Property 4: Change tracking display
*For any* insight history entry with both previous_value and new_value fields, both values should be displayed for comparison
**Validates: Requirements 2.3**

Property 5: Insight history filtering
*For any* selected insight type filter, only history entries matching that type should be displayed
**Validates: Requirements 2.4**

Property 6: Insight history pagination
*For any* user with more than 50 insight history entries, the display should paginate results with exactly 50 entries per page
**Validates: Requirements 2.5**

Property 7: Visual indicator consistency
*For any* displayed insight with a confidence score or digital exclusion score, an appropriate visual indicator (color coding, progress bar, or badge) should be rendered
**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### API Endpoint Properties

Property 8: User insights API response
*For any* valid user ID, GET /admin/users/:id/insights should return HTTP 200 with a complete UserInsightsProfile object
**Validates: Requirements 4.1**

Property 9: Insight history API response
*For any* valid user ID, GET /admin/users/:id/insights/history should return HTTP 200 with an array of InsightHistoryEntry objects and pagination metadata
**Validates: Requirements 4.2**

Property 10: User preferences API response
*For any* valid user ID, GET /admin/users/:id/preferences should return HTTP 200 with a formatted preferences summary
**Validates: Requirements 4.5**

Property 11: API error handling for invalid IDs
*For any* invalid or non-existent user ID, API endpoints should return HTTP 404 with an error message
**Validates: Requirements 4.3**

Property 12: API authentication enforcement
*For any* unauthenticated request to user profile API endpoints, the backend should return HTTP 401 and reject the request
**Validates: Requirements 4.4**

### Privacy and Security Properties

Property 13: Privacy validation filtering
*For any* displayed user insight, it should have passed validateInsightsPrivacy() checks (no PII, no medical diagnoses)
**Validates: Requirements 5.1, 5.2**

Property 14: Low confidence warning display
*For any* displayed insight with confidence score below 0.5, a visual warning indicator should be shown
**Validates: Requirements 5.3**

Property 15: Comprehensive intelligence filtering
*For any* intelligence data retrieved for AI context, insights should be excluded if they: (1) have confidence < configured threshold, OR (2) are older than configured max age, OR (3) match configured sensitive types, OR (4) don't pass privacy validation
**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

Property 16: Intelligence audit logging
*For any* AI context assembly operation, a log entry should be created documenting which insights were included
**Validates: Requirements 8.5**

### AI Agent Integration Properties

Property 17: Intelligence retrieval for agent requests
*For any* user request processed by the MCP Controller Agent, the agent should retrieve the user's profile from the user_insights table
**Validates: Requirements 6.1**

Property 18: Intelligence context inclusion
*For any* user with profile data, the AI agent should include relevant insights (demographics, preferences, recent intent signals) in the LLM prompt context
**Validates: Requirements 6.2**

Property 19: Preference-based search ranking
*For any* shopping search request from a user with category preferences OR brand preferences OR value spend sensitivity, the Shopping MCP should rank results prioritizing matching categories, brands, or budget-friendly options respectively
**Validates: Requirements 6.3, 7.3, 7.4**

Property 20: Context-aware response adaptation
*For any* user with profile data indicating high digital exclusion score OR detected life events OR specific communication style OR simple task preference, the AI agent should adapt responses accordingly (simplified language, empathetic tone, matched formality, or step-by-step breakdown)
**Validates: Requirements 6.4, 6.5, 7.1, 7.2**

Property 21: Proactive assistance offering
*For any* user with identified AI assistance needs, the agent should proactively offer help with the detected challenging task types
**Validates: Requirements 7.5**

### UI State Management Properties

Property 22: Tab navigation state preservation
*For any* tab navigation within the user details page, the current user ID and context should be preserved
**Validates: Requirements 9.2**

Property 23: Loading state indication
*For any* profile data loading operation, a loading indicator should be displayed until data is received or an error occurs
**Validates: Requirements 9.3**

Property 24: Error state handling
*For any* error during profile data retrieval, an error message should be displayed while maintaining access to other user information tabs
**Validates: Requirements 9.4, 9.5**

## Error Handling

### Frontend Error Handling

1. **API Request Failures**
   - Display user-friendly error messages
   - Maintain access to other tabs (graceful degradation)
   - Provide retry mechanisms for transient failures
   - Log errors to monitoring service

2. **Missing Data**
   - Display "No intelligence data available" message
   - Don't block access to other user information
   - Suggest actions (e.g., "Data will appear after user interactions")

3. **Invalid Data**
   - Validate API responses against TypeScript interfaces
   - Display generic error if data structure is invalid
   - Log validation errors for debugging

### Backend Error Handling

1. **Database Errors**
   - Catch and log database connection errors
   - Return HTTP 500 with generic error message
   - Don't expose internal error details to frontend
   - Implement retry logic for transient failures

2. **Authentication Errors**
   - Return HTTP 401 for unauthenticated requests
   - Return HTTP 403 for insufficient permissions
   - Log authentication failures for security monitoring

3. **Invalid Input**
   - Validate user IDs and filter parameters
   - Return HTTP 400 for malformed requests
   - Return HTTP 404 for non-existent resources
   - Provide clear error messages

4. **Privacy Validation Failures**
   - Silently exclude insights that fail privacy checks
   - Log privacy violations for audit
   - Don't expose privacy check failures to frontend

### AI Agent Error Handling

1. **Intelligence Retrieval Failures**
   - Continue processing request without intelligence context
   - Log retrieval failures
   - Don't block main workflow

2. **Context Building Errors**
   - Use default behavior if intelligence context fails
   - Log context building errors
   - Ensure agent can still process requests

3. **Filtering Errors**
   - Fall back to no filtering if filter logic fails
   - Log filtering errors
   - Prefer including data over excluding incorrectly

## Testing Strategy

### Unit Testing

**Frontend Components:**
- Test UserIntelligenceTab renders all sections correctly
- Test InsightHistoryTimeline filtering and pagination
- Test ClusterInsightsView filter application
- Test DigitalExclusionIndicator color coding
- Test error state rendering
- Test loading state rendering

**Backend Services:**
- Test IntelligenceContextService filtering logic
- Test IntelligenceContextService prompt formatting
- Test API endpoint request validation
- Test API endpoint response formatting
- Test authentication middleware
- Test privacy validation logic

**AI Agent Integration:**
- Test MCP Controller Agent intelligence retrieval
- Test context building with various intelligence profiles
- Test Shopping MCP preference-based ranking
- Test AI Chat MCP response adaptation
- Test error handling when intelligence unavailable

### Property-Based Testing

Property-based tests will be implemented using fast-check (TypeScript/JavaScript PBT library). Each test will run a minimum of 100 iterations with randomly generated inputs.

**Data Display Properties:**
- Generate random UserInsightsProfile objects and verify all fields are rendered
- Generate random insight history arrays and verify chronological ordering
- Generate random cluster data and verify filtering logic
- Generate random confidence scores and verify visual indicators

**API Properties:**
- Generate random valid/invalid user IDs and verify response codes
- Generate random filter combinations and verify result matching
- Generate random authentication states and verify access control

**Privacy Properties:**
- Generate random insights with/without PII and verify filtering
- Generate random confidence scores and verify threshold filtering
- Generate random timestamps and verify age-based filtering

**AI Agent Properties:**
- Generate random intelligence profiles and verify context inclusion
- Generate random user preferences and verify search ranking
- Generate random digital exclusion scores and verify response adaptation

### Integration Testing

**End-to-End Flows:**
1. Admin views user intelligence tab → API call → Data display
2. Admin filters insight history → API call with filters → Filtered results
3. Admin views cluster insights → API call → Filtered clusters (sample size >= 100)
4. User sends fax → Agent retrieves intelligence → Personalized response
5. Shopping request with preferences → Preference-based ranking → Results

**Database Integration:**
- Test reading from user_insights table
- Test reading from insights_history table
- Test reading from aggregate_insights table
- Test filtering and pagination queries

**Authentication Integration:**
- Test authenticated admin access
- Test unauthenticated access rejection
- Test insufficient permissions handling

### Manual Testing

**UI/UX Testing:**
- Verify visual design consistency
- Test responsive layout on different screen sizes
- Verify accessibility (keyboard navigation, screen readers)
- Test loading states and transitions
- Verify error message clarity

**Data Accuracy:**
- Verify intelligence data matches database
- Verify confidence scores display correctly
- Verify time periods and timestamps are accurate
- Verify filtering produces expected results

**AI Agent Behavior:**
- Verify personalized responses for different user profiles
- Verify simplified language for high digital exclusion scores
- Verify preference-based product ranking
- Verify empathetic tone for life events
