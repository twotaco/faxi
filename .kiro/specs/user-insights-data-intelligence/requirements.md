# User Insights & Data Intelligence - Requirements

## Overview
Capture strategic user insights from every fax interaction to build comprehensive profiles of digitally excluded users, creating unique, first-party data that no other platform can provide.

## Strategic Value Proposition

### Unique Market Position
Faxi is the **only digital record** of offline seniors' and digitally excluded individuals' real-life needs. Every fax is an explicit, first-party action with full consent.

### Data Buyers & Use Cases

| Data Type | What We Capture | Buyers | Value |
|-----------|----------------|--------|-------|
| **Demographics** | Age range, gender, region, household type | Retail, insurance, government | High |
| **Elder-care Signals** | Appointments, hospital visits, medication needs | Health research, local government | Premium |
| **Local Commerce** | Shopping lists, price sensitivity, household needs | Convenience stores, FMCG brands | High |
| **Gov Service Usage** | Certificate requests, address changes, pension | Municipal planning, quality improvement | Premium |
| **Life Events** | Moving, caregiving, family death, hospitalization | Insurance, telco, advertisers | Gold-tier |
| **Digital Exclusion Index** | Digital literacy, assistance needs | Government, prefectures, NGOs | Unique |
| **Purchase Intent** | Actively looking for products/services | E-commerce, travel, retail | High |
| **Behavioral Patterns** | Frequency, recency, engagement | Digital marketers | Medium |

## Data Collection Principles

### Legal & Ethical Framework
1. **First-Party Data**: Every interaction is user-initiated
2. **Explicit Consent**: Users agree to data collection in ToS
3. **Anonymization**: Aggregate data for sale, individual data protected
4. **Transparency**: Users can view their profile
5. **Opt-Out**: Users can request data deletion
6. **GDPR/APPI Compliance**: Full compliance with Japanese privacy laws

### Data Quality Standards
- **Accuracy**: Inferred data marked as such
- **Freshness**: Real-time updates from each interaction
- **Completeness**: Progressive profiling over time
- **Validation**: Cross-reference signals for accuracy

## User Insights Schema

### Complete Profile Structure
```typescript
interface UserInsightsProfile {
  userId: string;
  lastUpdated: Date;
  
  // Demographics (inferred from patterns)
  demographics: {
    ageRangeInferred: '60-69' | '70-79' | '80+' | 'unknown';
    genderInferred: 'male' | 'female' | 'unknown';
    regionInferred: string; // Prefecture/city
    householdType: 'single' | 'couple' | 'multi-gen' | 'unknown';
    livingArrangement: 'independent' | 'assisted' | 'family-care' | 'unknown';
  };
  
  // Life Events (critical signals)
  lifeEvents: {
    moving: {
      detected: boolean;
      date?: Date;
      fromRegion?: string;
      toRegion?: string;
    };
    newCaregiver: {
      detected: boolean;
      date?: Date;
      relationship?: string; // son, daughter, professional
    };
    deathInFamily: {
      detected: boolean;
      date?: Date;
      relationship?: string;
    };
    hospitalization: {
      detected: boolean;
      date?: Date;
      duration?: string;
      ongoing?: boolean;
    };
    jobChange: {
      detected: boolean;
      date?: Date;
      type?: 'retirement' | 'new-job' | 'career-change';
    };
    retirementStatus: 'working' | 'retired' | 'semi-retired' | 'unknown';
  };
  
  // Intent Signals (purchase/action intent)
  intentSignals: {
    commercialIntent: Array<{
      category: string; // 'electronics', 'home-goods', 'food'
      product: string;
      priceRange?: { min: number; max: number };
      detectedAt: Date;
      urgency: 'immediate' | 'near-term' | 'long-term';
    }>;
    healthIntent: Array<{
      type: 'appointment' | 'medication' | 'consultation' | 'emergency';
      provider?: string;
      detectedAt: Date;
      urgency: 'immediate' | 'near-term' | 'long-term';
    }>;
    govIntent: Array<{
      serviceType: string; // 'certificate', 'pension', 'tax'
      detectedAt: Date;
      urgency: 'immediate' | 'near-term' | 'long-term';
    }>;
    timing: 'immediate' | 'near-term' | 'long-term';
    urgency: 'low' | 'medium' | 'high' | 'critical';
  };
  
  // Behavioral Patterns
  behavioral: {
    serviceFrequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
    serviceRecencyDays: number;
    taskComplexity: 'simple' | 'moderate' | 'complex';
    followUpLikelihood: number; // 0-1 probability
    communicationStyle: 'short' | 'long' | 'polite' | 'direct' | 'detailed';
    preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'unknown';
    responseTime: number; // Average hours to respond to fax
  };
  
  // Consumer Profile
  consumerProfile: {
    spendSensitivity: 'value' | 'normal' | 'premium';
    preferredCategories: string[]; // ['food', 'health', 'home']
    brandMentions: Array<{ brand: string; count: number; sentiment: 'positive' | 'neutral' | 'negative' }>;
    paymentPreference: 'cash' | 'credit' | 'convenience-store' | 'bank-transfer' | 'unknown';
    averageOrderValue?: number;
    purchaseFrequency?: 'high' | 'medium' | 'low';
  };
  
  // Healthcare Profile (non-medical, admin signals only)
  healthcareProfile: {
    visitFrequency: 'weekly' | 'monthly' | 'quarterly' | 'rare';
    appointmentTypes: string[]; // ['general', 'specialist', 'dental']
    nonMedicalNeeds: string[]; // ['transportation', 'translation', 'form-filling']
    supportLevel: 'low' | 'medium' | 'high'; // How much assistance needed
    mobilityIndicators: 'independent' | 'assisted' | 'limited' | 'unknown';
  };
  
  // Government Services Usage
  govServicesUsage: {
    certificateTypesRequested: string[]; // ['residence', 'tax', 'pension']
    frequency: 'frequent' | 'occasional' | 'rare';
    repeatPatterns: Array<{ service: string; frequency: string }>;
    lastInteraction?: Date;
  };
  
  // Digital Profile (unique to Faxi)
  digitalProfile: {
    digitalExclusionScore: 1 | 2 | 3 | 4 | 5; // 1=digitally savvy, 5=completely excluded
    faxUsagePattern: 'primary' | 'supplementary' | 'emergency-only';
    aiAssistanceNeeded: string[]; // ['translation', 'summarization', 'reservation', 'shopping']
    deviceOwnership: {
      smartphone: boolean;
      computer: boolean;
      tablet: boolean;
      none: boolean;
    };
    internetAccess: 'none' | 'limited' | 'full' | 'unknown';
    digitalLiteracy: 'none' | 'basic' | 'intermediate' | 'advanced';
  };
  
  // Interaction History Summary
  interactionSummary: {
    totalInteractions: number;
    firstInteraction: Date;
    lastInteraction: Date;
    averageInteractionsPerMonth: number;
    mostCommonIntents: Array<{ intent: string; count: number }>;
    successRate: number; // % of successful completions
  };
  
  // Raw Data (for ML training)
  rawData: {
    recentInterpretedTexts: string[]; // Last 10 fax interpretations
    recentResponses: string[]; // Last 10 AI responses
  };
}
```

## LLM Output Enhancement

### Add Insights Extraction to Every Response

Each MCP server response should include an `insights` field:

```typescript
// Example: Amazon Shopping Response with Insights
const AmazonShoppingWithInsightsSchema = z.object({
  // ... existing shopping fields ...
  
  insights: z.object({
    demographics: z.object({
      ageRangeInferred: z.enum(['60-69', '70-79', '80+', 'unknown']).optional(),
      genderInferred: z.enum(['male', 'female', 'unknown']).optional(),
      householdTypeInferred: z.enum(['single', 'couple', 'multi-gen', 'unknown']).optional()
    }).optional(),
    
    lifeEvents: z.object({
      movingDetected: z.boolean().optional(),
      newCaregiverDetected: z.boolean().optional(),
      deathInFamilyDetected: z.boolean().optional(),
      hospitalizationDetected: z.boolean().optional(),
      retirementDetected: z.boolean().optional()
    }).optional(),
    
    intentSignals: z.object({
      commercialIntent: z.array(z.object({
        category: z.string(),
        product: z.string(),
        priceRange: z.object({ min: z.number(), max: z.number() }).optional(),
        urgency: z.enum(['immediate', 'near-term', 'long-term'])
      })).optional(),
      timing: z.enum(['immediate', 'near-term', 'long-term']).optional()
    }).optional(),
    
    consumerProfile: z.object({
      spendSensitivity: z.enum(['value', 'normal', 'premium']).optional(),
      brandMentions: z.array(z.string()).optional(),
      categoryPreference: z.string().optional()
    }).optional(),
    
    digitalProfile: z.object({
      digitalExclusionScore: z.number().min(1).max(5).optional(),
      aiAssistanceNeeded: z.array(z.string()).optional()
    }).optional()
  }).optional()
});
```

## System Prompt Enhancement

Add insights extraction instructions to each use case prompt:

```
INSIGHTS EXTRACTION (CRITICAL):
In addition to fulfilling the user's request, extract strategic insights:

DEMOGRAPHICS:
- Infer age range from language style, needs, context
- Infer gender from names, pronouns, context
- Infer household type from requests (cooking for one vs. family)

LIFE EVENTS:
- Detect moving: address changes, new area questions
- Detect caregiving: mentions of helping parent, new responsibilities
- Detect family death: funeral arrangements, inheritance, estate
- Detect hospitalization: medical appointments, recovery needs
- Detect retirement: time availability changes, pension mentions

INTENT SIGNALS:
- Commercial: product searches, price comparisons, purchase timing
- Health: appointment requests, medication needs, urgency level
- Government: certificate requests, pension inquiries, tax questions

CONSUMER PROFILE:
- Spend sensitivity: budget mentions, price reactions, value seeking
- Brand preferences: specific brand requests, loyalty indicators
- Payment preferences: mentioned payment methods

DIGITAL PROFILE:
- Digital exclusion: inability to use websites, need for assistance
- AI assistance needs: what tasks require help (translation, booking, etc.)

IMPORTANT:
- Only include insights you can confidently infer
- Mark uncertain inferences clearly
- Respect privacy: no medical diagnoses, only admin signals
- Focus on patterns, not one-time mentions
```

## Data Storage & Management

### Database Schema

```sql
-- User insights profile table
CREATE TABLE user_insights (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  profile_data JSONB NOT NULL,
  last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

-- Insights history (for tracking changes over time)
CREATE TABLE insights_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  insight_type VARCHAR(50) NOT NULL, -- 'life_event', 'intent', 'behavior'
  insight_data JSONB NOT NULL,
  detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  source_fax_id UUID REFERENCES fax_jobs(id)
);

-- Aggregate insights for data products
CREATE TABLE aggregate_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region VARCHAR(100),
  age_range VARCHAR(20),
  insight_category VARCHAR(50),
  aggregate_data JSONB NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sample_size INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX idx_insights_user ON user_insights(user_id);
CREATE INDEX idx_insights_history_user ON insights_history(user_id);
CREATE INDEX idx_insights_history_type ON insights_history(insight_type);
CREATE INDEX idx_aggregate_region ON aggregate_insights(region);
CREATE INDEX idx_aggregate_category ON aggregate_insights(insight_category);
```

### Insights Service

```typescript
class UserInsightsService {
  /**
   * Update user profile with new insights from fax interaction
   */
  async updateProfile(
    userId: string,
    newInsights: Partial<UserInsightsProfile>,
    faxJobId: string
  ): Promise<void>;
  
  /**
   * Get complete user profile
   */
  async getProfile(userId: string): Promise<UserInsightsProfile>;
  
  /**
   * Record specific insight event
   */
  async recordInsight(
    userId: string,
    insightType: string,
    data: any,
    confidence: number,
    faxJobId: string
  ): Promise<void>;
  
  /**
   * Generate aggregate insights for data products
   */
  async generateAggregates(
    filters: {
      region?: string;
      ageRange?: string;
      dateRange: { start: Date; end: Date };
    }
  ): Promise<AggregateInsights>;
  
  /**
   * Export anonymized data for buyers
   */
  async exportDataProduct(
    productType: 'demographics' | 'life-events' | 'commerce' | 'digital-exclusion',
    filters: any
  ): Promise<DataProduct>;
}
```

## Data Products for Sale

### Product 1: Digital Exclusion Index
**Target Buyers**: Government, municipalities, NGOs, telecom

**Data Included**:
- Regional digital exclusion scores
- Demographics of excluded population
- Service needs and gaps
- Assistance requirements

**Pricing**: ¥500,000 - ¥2,000,000 per prefecture/year

### Product 2: Elder-Care Demand Signals
**Target Buyers**: Healthcare providers, insurance, local government

**Data Included**:
- Appointment patterns
- Healthcare service utilization
- Support level indicators
- Mobility patterns

**Pricing**: ¥300,000 - ¥1,000,000 per region/year

### Product 3: Local Commerce Insights
**Target Buyers**: Convenience stores, supermarkets, FMCG brands

**Data Included**:
- Shopping patterns
- Price sensitivity
- Category preferences
- Brand mentions

**Pricing**: ¥200,000 - ¥800,000 per region/year

### Product 4: Life Event Triggers
**Target Buyers**: Insurance, financial services, advertisers

**Data Included**:
- Moving events
- Caregiving transitions
- Retirement timing
- Family changes

**Pricing**: ¥1,000,000 - ¥5,000,000 per year (premium)

## Privacy & Compliance

### Anonymization Process
1. Remove all PII (names, addresses, phone numbers)
2. Aggregate to minimum group size (n ≥ 100)
3. Add noise to prevent re-identification
4. Regional aggregation only (no individual data)

### User Controls
- View their own profile
- Opt-out of data sales (still use service)
- Request data deletion
- Export their data (GDPR right)

### Compliance Checklist
- [ ] APPI (Act on Protection of Personal Information) compliance
- [ ] GDPR compliance for EU users
- [ ] Clear ToS explaining data usage
- [ ] Opt-out mechanism
- [ ] Data retention policies
- [ ] Security measures (encryption, access control)
- [ ] Regular privacy audits

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Database schema
- [ ] UserInsightsService
- [ ] Basic profile structure
- [ ] Integration with existing MCP responses

### Phase 2: LLM Integration (Week 2)
- [ ] Update all MCP schemas with insights fields
- [ ] Enhance system prompts
- [ ] Validation and confidence scoring
- [ ] Testing with real faxes

### Phase 3: Aggregation & Analytics (Week 3)
- [ ] Aggregate insights generation
- [ ] Dashboard for internal analytics
- [ ] Data quality monitoring
- [ ] Anomaly detection

### Phase 4: Data Products (Week 4)
- [ ] Anonymization pipeline
- [ ] Export formats
- [ ] API for data buyers
- [ ] Pricing and licensing

### Phase 5: Compliance & Launch (Week 5)
- [ ] Legal review
- [ ] Privacy audit
- [ ] User controls implementation
- [ ] Documentation for buyers

## Success Metrics

### Data Quality
- 90%+ confidence in demographic inferences
- 95%+ accuracy in life event detection
- < 5% false positives in intent signals

### Business Value
- 5+ data product buyers in first year
- ¥10M+ annual revenue from data products
- 80%+ buyer satisfaction

### User Trust
- < 1% opt-out rate
- Zero privacy incidents
- Positive user feedback on transparency

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Privacy breach | Critical | Strong encryption, access controls, audits |
| Re-identification | High | Strict anonymization, minimum group sizes |
| User backlash | Medium | Transparency, opt-out, clear value exchange |
| Regulatory changes | Medium | Legal monitoring, flexible architecture |
| Data quality issues | Medium | Validation, confidence scoring, human review |

## Revenue Model

### Subscription Tiers for Data Buyers

**Basic**: ¥100,000/month
- Regional aggregates
- Monthly updates
- Standard categories

**Professional**: ¥300,000/month
- All basic features
- Weekly updates
- Custom segments
- API access

**Enterprise**: ¥1,000,000/month
- All professional features
- Daily updates
- Custom data products
- Dedicated support
- Early access to new signals

## Next Steps

1. Legal review of data collection and sales
2. Design user consent flow
3. Implement Phase 1 infrastructure
4. Pilot with 100 users
5. Validate data quality
6. Approach first data buyers
