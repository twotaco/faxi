# LLM Prompt Architecture - Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Fax Processing Pipeline                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              MCP Controller Agent                            │
│  - Receives interpreted fax                                  │
│  - Detects use case / intent                                 │
│  - Routes to appropriate MCP server                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬──────────────┐
        ▼             ▼             ▼              ▼
   ┌────────┐   ┌─────────┐   ┌────────┐    ┌──────────┐
   │AI Chat │   │Shopping │   │ Email  │    │Atlantis  │
   │  MCP   │   │   MCP   │   │  MCP   │    │   MCP    │
   └────┬───┘   └────┬────┘   └───┬────┘    └────┬─────┘
        │            │            │              │
        ▼            ▼            ▼              ▼
   ┌────────────────────────────────────────────────┐
   │         Gemini with JSON Schema                │
   │  - Use case specific system prompt             │
   │  - JSON schema for structured output           │
   │  - Few-shot examples                           │
   └────────────────────┬───────────────────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │         Schema Validation (Zod)                │
   │  - Validate against expected schema            │
   │  - Type-safe output                            │
   │  - Error handling & retry                      │
   └────────────────────┬───────────────────────────┘
                        │
                        ▼
   ┌────────────────────────────────────────────────┐
   │         Response Generator                     │
   │  - Convert structured output to fax template   │
   │  - Generate PDF                                │
   └────────────────────────────────────────────────┘
```

## Component Design

### 1. Prompt Manager

**Purpose**: Centralized management of prompts and schemas for each use case.

**Structure**:
```typescript
interface PromptTemplate {
  useCase: string;
  systemPrompt: string;
  jsonSchema: object;
  zodSchema: z.ZodType;
  examples: Array<{
    input: string;
    output: object;
  }>;
  faxFormatting: {
    maxWords: number;
    preferredSections: string[];
  };
}

class PromptManager {
  private templates: Map<string, PromptTemplate>;
  
  register(template: PromptTemplate): void;
  get(useCase: string): PromptTemplate;
  buildSystemPrompt(useCase: string, context?: object): string;
  validateOutput(useCase: string, output: any): ValidationResult;
}
```

### 2. Use Case Schemas

#### General Q&A Schema
```typescript
const QAResponseSchema = z.object({
  response: z.string().describe("The main response text, formatted for fax readability"),
  followUpSuggestions: z.array(z.string()).optional().describe("Suggested follow-up questions"),
  requiresContinuation: z.boolean().describe("Whether this topic needs more conversation"),
  sources: z.array(z.string()).optional().describe("Information sources if applicable"),
  metadata: z.object({
    confidence: z.enum(['high', 'medium', 'low']),
    category: z.string().optional()
  })
});

type QAResponse = z.infer<typeof QAResponseSchema>;
```

#### Shopping Schema
```typescript
const ShoppingResponseSchema = z.object({
  intent: z.enum(['search', 'select', 'order', 'status']),
  searchQuery: z.string().optional().describe("Product search query"),
  products: z.array(z.object({
    name: z.string(),
    price: z.number(),
    description: z.string(),
    productId: z.string().optional()
  })).optional(),
  selectedProduct: z.string().optional().describe("Product ID if user selected"),
  deliveryAddress: z.object({
    needsConfirmation: z.boolean(),
    suggestedAddress: z.string().optional()
  }).optional(),
  paymentMethod: z.object({
    needsSelection: z.boolean(),
    availableMethods: z.array(z.string()).optional()
  }).optional(),
  response: z.string().describe("Human-readable response for fax"),
  nextAction: z.enum(['show_products', 'confirm_order', 'request_payment', 'complete']).optional()
});

type ShoppingResponse = z.infer<typeof ShoppingResponseSchema>;
```

#### Email Schema
```typescript
const EmailResponseSchema = z.object({
  intent: z.enum(['compose', 'send', 'clarify']),
  recipient: z.object({
    identified: z.boolean(),
    name: z.string().optional(),
    email: z.string().optional(),
    needsClarification: z.boolean()
  }),
  subject: z.string().optional(),
  body: z.string().optional(),
  tone: z.enum(['formal', 'casual', 'urgent']).optional(),
  response: z.string().describe("Confirmation message for fax"),
  requiresConfirmation: z.boolean().describe("Whether user needs to confirm before sending")
});

type EmailResponse = z.infer<typeof EmailResponseSchema>;
```

#### User Insights Schema (Cross-Cutting)
```typescript
// Insights extracted from every interaction
const UserInsightsSchema = z.object({
  demographics: z.object({
    ageRangeInferred: z.enum(['60-69', '70-79', '80+', 'unknown']).optional(),
    genderInferred: z.enum(['male', 'female', 'unknown']).optional(),
    regionInferred: z.string().optional(),
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
      product: z.string().optional(),
      priceRange: z.object({ min: z.number(), max: z.number() }).optional(),
      urgency: z.enum(['immediate', 'near-term', 'long-term'])
    })).optional(),
    healthIntent: z.array(z.object({
      type: z.enum(['appointment', 'medication', 'consultation', 'emergency']),
      urgency: z.enum(['immediate', 'near-term', 'long-term'])
    })).optional(),
    govIntent: z.array(z.object({
      serviceType: z.string(),
      urgency: z.enum(['immediate', 'near-term', 'long-term'])
    })).optional()
  }).optional(),
  
  behavioral: z.object({
    communicationStyle: z.enum(['short', 'long', 'polite', 'direct', 'detailed']).optional(),
    taskComplexity: z.enum(['simple', 'moderate', 'complex']).optional()
  }).optional(),
  
  consumerProfile: z.object({
    spendSensitivity: z.enum(['value', 'normal', 'premium']).optional(),
    brandMentions: z.array(z.string()).optional(),
    categoryPreference: z.string().optional()
  }).optional(),
  
  digitalProfile: z.object({
    digitalExclusionScore: z.number().min(1).max(5).optional(),
    aiAssistanceNeeded: z.array(z.string()).optional()
  }).optional(),
  
  confidenceScores: z.object({
    demographics: z.number().min(0).max(1).optional(),
    lifeEvents: z.number().min(0).max(1).optional(),
    intent: z.number().min(0).max(1).optional()
  }).optional()
});

type UserInsights = z.infer<typeof UserInsightsSchema>;

// All response schemas include insights
const BaseResponseSchema = z.object({
  // ... use case specific fields ...
  insights: UserInsightsSchema.optional()
});
```

#### Multi-Action Schema
```typescript
const MultiActionResponseSchema = z.object({
  actions: z.array(z.object({
    type: z.enum(['qa', 'shopping', 'email', 'atlantis']),
    description: z.string(),
    priority: z.number(),
    dependencies: z.array(z.string()).optional()
  })),
  response: z.string().describe("Overview of actions to be taken"),
  requiresSequencing: z.boolean(),
  estimatedSteps: z.number()
});

type MultiActionResponse = z.infer<typeof MultiActionResponseSchema>;
```

### 3. System Prompts

#### Base Prompt (Common to All)
```
You are an AI assistant for Faxi, a fax-to-internet bridge service.

CRITICAL: You must respond with valid JSON matching the provided schema.

FAX FORMATTING RULES:
- Keep responses concise (500-800 words max)
- Use short paragraphs (2-3 sentences)
- Use bullet points for lists
- Simple, respectful language for all ages
- Clear, actionable information

Your response will be printed and faxed to the user.
```

#### Q&A Specific Prompt
```
You are answering general questions and providing information.

RESPONSE GUIDELINES:
- Provide accurate, helpful information
- If unsure, indicate confidence level as 'low'
- Suggest follow-up questions if topic is complex
- Keep explanations simple but not condescending
- Focus on practical, actionable advice

INSIGHTS EXTRACTION:
While answering, extract strategic insights:

DEMOGRAPHICS:
- Infer age range from language style, topics of interest
- Infer gender from context clues (not assumptions)
- Infer household type from questions (cooking for one vs. family)

LIFE EVENTS:
- Moving: questions about new area, services, neighborhoods
- Caregiving: questions about helping elderly parent, responsibilities
- Health changes: questions about accessibility, medical services
- Retirement: questions about time management, hobbies, pensions

INTENT SIGNALS:
- Commercial: product questions, price inquiries, shopping needs
- Health: medical appointment questions, medication inquiries
- Government: pension questions, certificate needs, tax inquiries

DIGITAL PROFILE:
- Digital exclusion: inability to search online, need for basic info
- Assistance needs: what tasks require help

IMPORTANT:
- Only include insights with confidence > 0.6
- Mark all inferences as "inferred" not "confirmed"
- No medical diagnoses, only administrative signals
- Respect privacy: focus on patterns, not sensitive details

OUTPUT SCHEMA:
{schema}

EXAMPLES:
{examples}
```

#### Shopping Specific Prompt (Amazon.co.jp)
```
You are helping users shop on Amazon.co.jp via fax.

SHOPPING GUIDELINES:
- Understand product needs and preferences
- Present 3-5 product options with prices in ¥
- Highlight Prime-eligible products
- Confirm delivery address before ordering
- Verify payment method availability
- Provide clear next steps

IMPORTANT:
- Always show prices in Japanese Yen (¥)
- Indicate Prime eligibility clearly
- Confirm address matches user profile
- Don't complete orders without explicit confirmation
- Warn if price has changed

INSIGHTS EXTRACTION:
Extract valuable shopping insights:

CONSUMER PROFILE:
- Spend sensitivity: budget mentions ("under ¥5000"), value seeking, premium preferences
- Brand preferences: specific brand requests, loyalty indicators
- Category preferences: types of products frequently requested
- Payment preferences: mentioned payment methods

INTENT SIGNALS:
- Commercial intent: what they're shopping for, urgency level
- Price range: budget constraints or flexibility
- Timing: immediate need vs. browsing

LIFE EVENTS:
- Moving: furniture, appliances, home goods
- New caregiver: assistive devices, health products
- Gift giving: birthday, celebration mentions

BEHAVIORAL:
- Communication style: detailed vs. brief requests
- Task complexity: simple product vs. complex comparison
- Follow-up likelihood: one-time vs. repeat customer

DIGITAL PROFILE:
- Digital exclusion: can't search Amazon themselves
- Assistance needs: product research, price comparison, ordering

OUTPUT SCHEMA:
{schema}

EXAMPLES:
{examples}
```

#### Email Specific Prompt
```
You are helping users compose and send emails via fax.

EMAIL GUIDELINES:
- Identify recipient from context or ask for clarification
- Suggest appropriate subject lines
- Match tone to relationship (formal for doctors, casual for family)
- Always confirm before sending
- Respect privacy and sensitivity

INSIGHTS EXTRACTION:
Extract relationship and communication insights:

DEMOGRAPHICS:
- Household type: mentions of family members, living situation
- Social connections: frequency of communication, relationships

LIFE EVENTS:
- Family changes: new relationships, deaths, caregiving
- Health events: medical communications, appointment scheduling
- Moving: address updates, new contacts

BEHAVIORAL:
- Communication style: formal vs. casual, brief vs. detailed
- Relationship patterns: who they contact, frequency
- Support network: family, friends, professionals

DIGITAL PROFILE:
- Email literacy: need help with composition, formatting
- Assistance needs: translation, tone adjustment, structure

OUTPUT SCHEMA:
{schema}

EXAMPLES:
{examples}
```

### 4. Implementation Plan

#### Phase 1: Core Infrastructure (Day 1-2)
1. Create `PromptManager` class
2. Define base schemas with Zod (including insights)
3. Implement schema validation layer
4. Create `UserInsightsService` and repository
5. Update `aiChatMcpServer` to use structured outputs

#### Phase 2: Use Case Implementation (Day 3-5)
1. Implement Q&A prompt and schema with insights
2. Implement Amazon Shopping prompt and schema with insights
3. Implement Email prompt and schema with insights
4. Implement Appointment Booking prompt and schema with insights
5. Add few-shot examples for each (including insights examples)

#### Phase 3: Insights Integration (Day 6-7)
1. Insights extraction from LLM responses
2. Profile building and updates
3. Confidence scoring
4. Privacy validation (no PII, no medical diagnoses)
5. Testing insights accuracy

#### Phase 4: Integration (Day 8-9)
1. Update MCP Controller to route based on use case
2. Update Response Generator to handle structured outputs
3. Add error handling and retry logic
4. Integration testing

#### Phase 5: Testing & Refinement (Day 10-12)
1. Test each use case with real examples
2. Measure schema validation success rate
3. Validate insights accuracy and confidence scores
4. Refine prompts based on failures
5. Performance optimization
6. Privacy audit

#### Appointment Booking Specific Prompt
```
You are helping users book appointments and reservations via fax.

BOOKING GUIDELINES:
- Identify business name and type accurately
- Parse date/time preferences (handle "next Tuesday", "tomorrow afternoon")
- Suggest alternatives if preferred time unavailable
- Confirm all details before booking
- Provide clear confirmation information

IMPORTANT:
- Always confirm business name and location
- Verify date and time before booking
- Ask for party size for restaurants
- Mention cancellation policy if available
- Never book without explicit user confirmation
- Handle credentials securely (never show in response)

INSIGHTS EXTRACTION:
Extract appointment and lifestyle insights:

HEALTHCARE PROFILE:
- Visit frequency: regular appointments vs. one-time
- Appointment types: general, specialist, dental, therapy
- Support needs: transportation, translation, form-filling
- Mobility indicators: accessibility requests, assistance needs

LIFE EVENTS:
- New healthcare needs: first-time appointments, new conditions
- Caregiving: booking for others, family support
- Moving: new area, finding new providers

BEHAVIORAL:
- Planning style: advance booking vs. urgent requests
- Communication style: detailed vs. brief requests
- Follow-up patterns: regular appointments vs. sporadic

CONSUMER PROFILE:
- Service preferences: restaurant types, salon preferences
- Spending patterns: budget vs. premium services
- Loyalty: repeat businesses vs. trying new places

DIGITAL PROFILE:
- Booking literacy: need help navigating websites
- Assistance needs: account creation, form filling, confirmation tracking

OUTPUT SCHEMA:
{schema}

EXAMPLES:
{examples}
```

### 5. File Structure

```
backend/src/
├── prompts/
│   ├── index.ts                    # PromptManager
│   ├── schemas/
│   │   ├── base.ts                # Base insights schema
│   │   ├── qa.ts                  # Q&A schema with insights
│   │   ├── amazonShopping.ts      # Amazon shopping schema with insights
│   │   ├── email.ts               # Email schema with insights
│   │   ├── appointment.ts         # Appointment schema with insights
│   │   └── multiAction.ts         # Multi-action schema
│   ├── templates/
│   │   ├── base.ts                # Base prompt with insights instructions
│   │   ├── qa.ts                  # Q&A prompt
│   │   ├── amazonShopping.ts      # Amazon shopping prompt
│   │   ├── email.ts               # Email prompt
│   │   └── appointment.ts         # Appointment prompt
│   └── examples/
│       ├── qa.json                # Q&A examples with insights
│       ├── amazonShopping.json    # Shopping examples with insights
│       ├── email.json             # Email examples with insights
│       └── appointment.json       # Appointment examples with insights
├── mcp/
│   ├── aiChatMcpServer.ts         # Q&A - Updated with PromptManager
│   ├── amazonShoppingMcpServer.ts # Amazon.co.jp shopping
│   ├── emailMcpServer.ts          # Email sending
│   └── appointmentMcpServer.ts    # Appointment booking
├── services/
│   ├── mcpControllerAgent.ts      # Updated routing logic
│   └── userInsightsService.ts     # NEW: Insights collection & aggregation
└── repositories/
    └── userInsightsRepository.ts  # NEW: Insights data access
```

### 6. Error Handling

```typescript
class SchemaValidationError extends Error {
  constructor(
    public useCase: string,
    public validationErrors: z.ZodError,
    public rawOutput: any
  ) {
    super(`Schema validation failed for ${useCase}`);
  }
}

async function handleLLMResponse(
  useCase: string,
  rawOutput: string
): Promise<ValidatedResponse> {
  try {
    // Parse JSON
    const parsed = JSON.parse(rawOutput);
    
    // Validate against schema
    const template = promptManager.get(useCase);
    const validated = template.zodSchema.parse(parsed);
    
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Log validation errors
      logger.error('Schema validation failed', {
        useCase,
        errors: error.errors,
        rawOutput
      });
      
      // Retry with clarification
      return await retryWithClarification(useCase, error);
    }
    
    // JSON parse error
    logger.error('Invalid JSON from LLM', { rawOutput });
    return await retryWithFormatCorrection(useCase, rawOutput);
  }
}
```

### 7. Gemini Integration

```typescript
async function callGeminiWithSchema(
  useCase: string,
  userMessage: string,
  conversationHistory: any[]
): Promise<any> {
  const template = promptManager.get(useCase);
  const systemPrompt = promptManager.buildSystemPrompt(useCase);
  
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    systemInstruction: {
      role: 'system',
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: template.jsonSchema
    }
  });
  
  const chat = model.startChat({
    history: conversationHistory
  });
  
  const result = await chat.sendMessage(userMessage);
  const response = result.response.text();
  
  return JSON.parse(response);
}
```

## Insights Processing Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    LLM Response                              │
│  {                                                           │
│    response: "...",                                          │
│    insights: { demographics: {...}, lifeEvents: {...} }     │
│  }                                                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Insights Validator                              │
│  - Validate against schema                                   │
│  - Check confidence scores                                   │
│  - Privacy check (no PII, no medical diagnoses)             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           UserInsightsService                                │
│  - Merge with existing profile                               │
│  - Update confidence scores                                  │
│  - Detect contradictions                                     │
│  - Record insight history                                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Database Storage                                │
│  - user_insights (current profile)                           │
│  - insights_history (audit trail)                            │
│  - aggregate_insights (data products)                        │
└─────────────────────────────────────────────────────────────┘
```

### Insights Processing Logic

```typescript
async function processInsights(
  userId: string,
  insights: UserInsights,
  faxJobId: string
): Promise<void> {
  // 1. Validate insights
  const validated = UserInsightsSchema.parse(insights);
  
  // 2. Privacy check
  if (containsPII(validated) || containsMedicalDiagnosis(validated)) {
    logger.warn('Privacy violation detected in insights', { userId, faxJobId });
    return; // Don't store
  }
  
  // 3. Get existing profile
  const existingProfile = await userInsightsService.getProfile(userId);
  
  // 4. Merge insights with confidence weighting
  const updatedProfile = mergeInsights(existingProfile, validated);
  
  // 5. Store updated profile
  await userInsightsService.updateProfile(userId, updatedProfile, faxJobId);
  
  // 6. Record in history for audit
  await userInsightsService.recordInsight(
    userId,
    'interaction',
    validated,
    calculateConfidence(validated),
    faxJobId
  );
  
  // 7. Update aggregates (async)
  await userInsightsService.updateAggregates(userId, validated);
}
```

## Migration Strategy

### Backward Compatibility
- Keep existing generic prompt as fallback
- Gradually migrate use cases to structured outputs
- Monitor success rates and adjust
- Insights collection is additive (doesn't break existing flows)

### Rollout Plan
1. **Week 1**: Deploy Q&A schema with insights (lowest risk)
2. **Week 2**: Monitor insights quality, adjust prompts
3. **Week 3**: Deploy Amazon Shopping schema with insights
4. **Week 4**: Deploy Email schema with insights
5. **Week 5**: Deploy Appointment Booking schema with insights
6. **Week 6**: Validate data quality, prepare data products
7. **Week 7**: Launch data products to first buyers

## Success Metrics

### Response Quality
- **Schema Validation Rate**: Target 95%+ first-attempt success
- **Response Quality**: User satisfaction surveys
- **Processing Time**: < 5 seconds end-to-end
- **Error Rate**: < 5% requiring manual intervention
- **Extensibility**: New use case added in < 1 hour

### Insights Quality
- **Demographic Accuracy**: 90%+ confidence in age/gender inferences
- **Life Event Detection**: 95%+ accuracy, < 5% false positives
- **Intent Signal Accuracy**: 90%+ correct intent classification
- **Confidence Calibration**: Confidence scores match actual accuracy
- **Privacy Compliance**: Zero PII leaks, zero medical diagnoses
- **Profile Completeness**: 80%+ of users have 5+ data points after 10 interactions

## Open Questions

1. Should we support hybrid responses (partial JSON + text)?
2. How to handle schema evolution without breaking existing conversations?
3. Should examples be stored in database for dynamic updates?
4. How to A/B test different prompts?

## Next Steps

1. Review and approve design
2. Create implementation tasks
3. Set up monitoring and metrics
4. Begin Phase 1 implementation
