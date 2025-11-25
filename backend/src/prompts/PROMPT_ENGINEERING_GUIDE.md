# Prompt Engineering Guide

## Overview

This guide provides comprehensive instructions for creating, maintaining, and optimizing prompts in the Faxi LLM Prompt Architecture system. The system uses structured JSON outputs with Gemini 2.0 Flash and integrates user insights collection across all use cases.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Adding a New Use Case](#adding-a-new-use-case)
3. [Schema Design Patterns](#schema-design-patterns)
4. [Insights Extraction Best Practices](#insights-extraction-best-practices)
5. [Prompt Template Guidelines](#prompt-template-guidelines)
6. [Testing and Validation](#testing-and-validation)
7. [Common Pitfalls](#common-pitfalls)

---

## Architecture Overview

### System Components

```
User Fax → Intent Detection → MCP Server → Gemini (JSON Mode) → Schema Validation → Response
                                                    ↓
                                            Insights Extraction
                                                    ↓
                                            UserInsightsService
```

### Key Principles

1. **Structured Outputs**: All LLM responses must conform to predefined JSON schemas
2. **Use-Case Specific**: Each use case has tailored prompts and schemas
3. **Insights Collection**: Every interaction extracts strategic user insights
4. **Privacy First**: No PII, no medical diagnoses, confidence-scored inferences only
5. **Fax Optimization**: Responses must be concise and fax-friendly

---

## Adding a New Use Case

### Time Estimate: < 1 hour

### Step-by-Step Process

#### 1. Define the Schema (15 minutes)

Create a new schema file in `backend/src/prompts/schemas/`:

```typescript
// backend/src/prompts/schemas/yourUseCase.ts
import { z } from 'zod';
import { UserInsightsSchema } from './base';

export const YourUseCaseResponseSchema = z.object({
  // Core response fields
  intent: z.enum(['action1', 'action2', 'clarify']),
  response: z.string().describe("Human-readable response for fax"),
  
  // Use-case specific fields
  specificField: z.string().optional(),
  
  // Metadata
  metadata: z.object({
    confidence: z.enum(['high', 'medium', 'low']),
    requiresFollowUp: z.boolean()
  }),
  
  // REQUIRED: Insights field
  insights: UserInsightsSchema.optional()
});

export type YourUseCaseResponse = z.infer<typeof YourUseCaseResponseSchema>;

// Export JSON schema for Gemini
export const yourUseCaseJsonSchema = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["action1", "action2", "clarify"] },
    response: { type: "string", description: "Human-readable response for fax" },
    specificField: { type: "string" },
    metadata: {
      type: "object",
      properties: {
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        requiresFollowUp: { type: "boolean" }
      },
      required: ["confidence", "requiresFollowUp"]
    },
    insights: {
      // Include full insights schema structure
      type: "object",
      properties: {
        // ... see base.ts for complete structure
      }
    }
  },
  required: ["intent", "response", "metadata"]
};
```

#### 2. Create the Prompt Template (20 minutes)

Create a new template file in `backend/src/prompts/templates/`:

```typescript
// backend/src/prompts/templates/yourUseCase.ts
import { PromptTemplate } from '../index';
import { 
  YourUseCaseResponseSchema, 
  yourUseCaseJsonSchema 
} from '../schemas/yourUseCase';

export const yourUseCasePrompt: PromptTemplate = {
  useCase: 'your-use-case',
  systemPrompt: `You are helping users with [specific task] via fax.

CRITICAL: You must respond with valid JSON matching the provided schema.

FAX FORMATTING RULES:
- Keep responses concise (500-800 words max)
- Use short paragraphs (2-3 sentences)
- Use bullet points for lists
- Simple, respectful language for all ages
- Clear, actionable information

[USE CASE SPECIFIC GUIDELINES]:
- Guideline 1
- Guideline 2
- Guideline 3

INSIGHTS EXTRACTION:
Extract strategic insights while processing the request:

DEMOGRAPHICS:
- Age range: infer from language style, topics, technology comfort
- Gender: only from explicit context, never assume
- Household type: infer from mentions of family, living situation

LIFE EVENTS:
- [Relevant life events for this use case]
- Look for: moving, caregiving, health changes, retirement

INTENT SIGNALS:
- [Use case specific intents]
- Urgency level: immediate, near-term, long-term

BEHAVIORAL:
- Communication style: brief, detailed, formal, casual
- Task complexity: simple, moderate, complex

DIGITAL PROFILE:
- Digital exclusion indicators
- Assistance needs specific to this use case

IMPORTANT:
- Only include insights with confidence > 0.6
- Mark all inferences as "inferred" not "confirmed"
- No medical diagnoses, only administrative signals
- Respect privacy: focus on patterns, not sensitive details

OUTPUT SCHEMA:
{schema}

EXAMPLES:
{examples}`,
  
  jsonSchema: yourUseCaseJsonSchema,
  zodSchema: YourUseCaseResponseSchema,
  
  examples: [
    {
      input: "Example user request",
      output: {
        intent: "action1",
        response: "Clear, fax-friendly response",
        metadata: {
          confidence: "high",
          requiresFollowUp: false
        },
        insights: {
          demographics: {
            ageRangeInferred: "70-79"
          },
          intentSignals: {
            // ... relevant insights
          },
          confidenceScores: {
            demographics: 0.7,
            intent: 0.9
          }
        }
      }
    }
  ],
  
  faxFormatting: {
    maxWords: 800,
    preferredSections: ['summary', 'details', 'next-steps']
  }
};
```

#### 3. Register the Template (5 minutes)

Add registration in `backend/src/prompts/register.ts`:

```typescript
import { yourUseCasePrompt } from './templates/yourUseCase';

export function registerAllPrompts(manager: PromptManager): void {
  // ... existing registrations
  manager.register(yourUseCasePrompt);
}
```

#### 4. Create MCP Server Integration (15 minutes)

Update or create MCP server in `backend/src/mcp/`:

```typescript
// backend/src/mcp/yourUseCaseMcpServer.ts
import { promptManager } from '../prompts';
import { YourUseCaseResponse } from '../prompts/schemas/yourUseCase';
import { userInsightsService } from '../services/userInsightsService';

export class YourUseCaseMcpServer {
  async handleRequest(
    userMessage: string,
    userId: string,
    faxJobId: string
  ): Promise<YourUseCaseResponse> {
    // 1. Build system prompt
    const systemPrompt = promptManager.buildSystemPrompt('your-use-case');
    
    // 2. Call Gemini with JSON mode
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: promptManager.get('your-use-case').jsonSchema
      }
    });
    
    const result = await model.generateContent(userMessage);
    const responseText = result.response.text();
    
    // 3. Validate response
    const validated = await promptManager.validateOutput('your-use-case', responseText);
    
    // 4. Extract and process insights
    if (validated.insights) {
      await userInsightsService.processInsights(
        userId,
        validated.insights,
        faxJobId
      );
    }
    
    return validated;
  }
}
```

#### 5. Write Integration Tests (5 minutes)

Create test file in `backend/src/test/integration/`:

```typescript
// backend/src/test/integration/yourUseCaseWithInsights.test.ts
import { describe, it, expect } from 'vitest';
import { YourUseCaseMcpServer } from '../../mcp/yourUseCaseMcpServer';

describe('Your Use Case with Insights', () => {
  it('should handle request and extract insights', async () => {
    const server = new YourUseCaseMcpServer();
    const response = await server.handleRequest(
      'Example request',
      'test-user-id',
      'test-fax-job-id'
    );
    
    expect(response.intent).toBeDefined();
    expect(response.response).toBeDefined();
    expect(response.insights).toBeDefined();
  });
});
```

---

## Schema Design Patterns

### Pattern 1: Base Response Structure

All schemas should include:

```typescript
{
  // Intent classification
  intent: z.enum([...]),
  
  // Human-readable response
  response: z.string(),
  
  // Metadata
  metadata: z.object({
    confidence: z.enum(['high', 'medium', 'low']),
    // ... other metadata
  }),
  
  // REQUIRED: Insights
  insights: UserInsightsSchema.optional()
}
```

### Pattern 2: Progressive Disclosure

For multi-step workflows:

```typescript
{
  intent: z.enum(['search', 'select', 'confirm', 'complete']),
  currentStep: z.string(),
  nextAction: z.string().optional(),
  requiresConfirmation: z.boolean()
}
```

### Pattern 3: Conditional Fields

Use `.optional()` for fields that depend on intent:

```typescript
{
  intent: z.enum(['search', 'order']),
  searchQuery: z.string().optional(), // Only for 'search'
  orderId: z.string().optional()      // Only for 'order'
}
```

### Pattern 4: Nested Objects for Complex Data

```typescript
{
  recipient: z.object({
    identified: z.boolean(),
    name: z.string().optional(),
    email: z.string().optional(),
    needsClarification: z.boolean()
  })
}
```

### Anti-Patterns to Avoid

❌ **Don't**: Use overly complex nested structures
```typescript
// Too complex
data: z.object({
  level1: z.object({
    level2: z.object({
      level3: z.string()
    })
  })
})
```

✅ **Do**: Flatten when possible
```typescript
// Better
level1_level2_level3: z.string()
```

❌ **Don't**: Make everything required
```typescript
// Too rigid
{
  field1: z.string(),
  field2: z.string(),
  field3: z.string()
}
```

✅ **Do**: Use optional fields appropriately
```typescript
// More flexible
{
  field1: z.string(),
  field2: z.string().optional(),
  field3: z.string().optional()
}
```

---

## Insights Extraction Best Practices

### Confidence Scoring Guidelines

| Confidence | Criteria | Example |
|------------|----------|---------|
| 0.9-1.0 | Explicit statement | "I'm 75 years old" |
| 0.7-0.9 | Strong contextual clues | "My grandson is visiting" (implies 60+) |
| 0.5-0.7 | Moderate inference | "I need help with the computer" (digital exclusion) |
| 0.3-0.5 | Weak inference | Language style suggests age range |
| < 0.3 | Don't include | Too speculative |

### Demographics Extraction

**Age Range Inference:**
- Language formality and style
- Technology comfort level
- Life stage indicators (retirement, grandchildren)
- Health-related mentions

**Household Type Inference:**
- Mentions of family members
- Cooking portions ("for one" vs "for family")
- Living situation references

**Gender Inference:**
- Only from explicit context
- Never assume from names or preferences
- Mark confidence as low unless explicit

### Life Events Detection

**High-Value Events:**
- Moving: address changes, new area questions
- Caregiving: helping elderly parent, responsibilities
- Health changes: hospitalization, mobility issues
- Retirement: time management, pension questions
- Family changes: births, deaths, marriages

**Detection Signals:**
- Direct mentions
- Contextual clues (asking about new services in area)
- Behavioral changes (sudden increase in health appointments)

### Intent Signals

**Commercial Intent:**
```typescript
{
  commercialIntent: [{
    category: "electronics",
    product: "laptop",
    priceRange: { min: 30000, max: 50000 },
    urgency: "near-term"
  }]
}
```

**Health Intent:**
```typescript
{
  healthIntent: [{
    type: "appointment",
    urgency: "immediate"
  }]
}
```

### Privacy Compliance

**✅ ALLOWED:**
- Age range (not exact age)
- Household type
- General health patterns (appointment frequency)
- Consumer preferences
- Digital literacy level

**❌ FORBIDDEN:**
- Exact age or birthdate
- Medical diagnoses
- Specific health conditions
- Financial account details
- Personal identification numbers

### Insights Prompt Template

Include this in every use case prompt:

```
INSIGHTS EXTRACTION:
Extract strategic insights while processing the request:

DEMOGRAPHICS:
- Age range: infer from [use-case-specific signals]
- Gender: only from explicit context
- Household type: infer from [use-case-specific signals]

LIFE EVENTS:
- [Relevant events]: look for [specific signals]

INTENT SIGNALS:
- [Use-case intents]: classify and score urgency

BEHAVIORAL:
- Communication style: observe formality, length, detail
- Task complexity: assess request sophistication

DIGITAL PROFILE:
- Digital exclusion: inability to [use-case-specific tasks]
- Assistance needs: [use-case-specific help needed]

IMPORTANT:
- Only include insights with confidence > 0.6
- Mark all inferences as "inferred" not "confirmed"
- No medical diagnoses, only administrative signals
- Respect privacy: focus on patterns, not sensitive details
```

---

## Prompt Template Guidelines

### Structure

Every prompt should have:

1. **Role Definition**: Who the AI is
2. **Critical Instructions**: JSON output requirement
3. **Fax Formatting Rules**: Concise, clear, respectful
4. **Use Case Guidelines**: Specific to the task
5. **Insights Extraction**: Strategic data collection
6. **Output Schema**: JSON structure
7. **Examples**: Few-shot learning

### Writing Effective Instructions

**✅ DO:**
- Use imperative language ("Extract", "Identify", "Classify")
- Be specific about edge cases
- Provide concrete examples
- Include confidence thresholds
- Specify output format clearly

**❌ DON'T:**
- Use vague terms ("try to", "maybe", "if possible")
- Assume LLM knowledge
- Over-complicate instructions
- Mix multiple concerns in one instruction

### Few-Shot Examples

Include 2-3 examples per use case:

```typescript
examples: [
  {
    input: "Simple, common case",
    output: { /* expected structure */ }
  },
  {
    input: "Edge case or ambiguous request",
    output: { /* how to handle */ }
  },
  {
    input: "Complex multi-part request",
    output: { /* structured breakdown */ }
  }
]
```

### Fax Formatting Guidelines

Always include:

```
FAX FORMATTING RULES:
- Keep responses concise (500-800 words max)
- Use short paragraphs (2-3 sentences)
- Use bullet points for lists
- Simple, respectful language for all ages
- Clear, actionable information
- Avoid jargon and technical terms
- Use large, readable sections
```

### Tone and Language

- **Respectful**: Assume elderly users, use polite language
- **Clear**: Avoid ambiguity, be direct
- **Helpful**: Provide actionable next steps
- **Patient**: Don't rush or pressure
- **Accessible**: Simple vocabulary, no jargon

---

## Testing and Validation

### Schema Validation Testing

Test that schemas correctly validate:

```typescript
describe('Schema Validation', () => {
  it('should accept valid response', () => {
    const valid = {
      intent: 'action1',
      response: 'Test response',
      metadata: { confidence: 'high' }
    };
    expect(() => YourSchema.parse(valid)).not.toThrow();
  });
  
  it('should reject invalid response', () => {
    const invalid = {
      intent: 'invalid-intent',
      response: 'Test'
    };
    expect(() => YourSchema.parse(invalid)).toThrow();
  });
});
```

### Insights Extraction Testing

Test insights quality:

```typescript
describe('Insights Extraction', () => {
  it('should extract demographics with confidence', async () => {
    const response = await server.handleRequest(
      'My grandson is visiting next week',
      'user-id',
      'fax-id'
    );
    
    expect(response.insights?.demographics?.ageRangeInferred).toBe('60-69');
    expect(response.insights?.confidenceScores?.demographics).toBeGreaterThan(0.6);
  });
});
```

### End-to-End Testing

Test complete flow:

```typescript
describe('E2E Use Case', () => {
  it('should handle request, extract insights, and store profile', async () => {
    // 1. Send request
    const response = await server.handleRequest(input, userId, faxId);
    
    // 2. Verify response structure
    expect(response.intent).toBeDefined();
    expect(response.response).toBeDefined();
    
    // 3. Verify insights stored
    const profile = await userInsightsService.getProfile(userId);
    expect(profile).toBeDefined();
  });
});
```

### Performance Testing

Monitor key metrics:

```typescript
describe('Performance', () => {
  it('should respond within 5 seconds', async () => {
    const start = Date.now();
    await server.handleRequest(input, userId, faxId);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(5000);
  });
  
  it('should validate schema in < 100ms', () => {
    const start = Date.now();
    promptManager.validateOutput('use-case', jsonString);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100);
  });
});
```

---

## Common Pitfalls

### 1. Schema Too Strict

**Problem**: LLM can't consistently match schema
**Solution**: Use optional fields, provide clear examples

### 2. Missing Insights

**Problem**: Forgetting to include insights field
**Solution**: Always extend from base schema with UserInsightsSchema

### 3. Over-Extraction

**Problem**: Extracting too many low-confidence insights
**Solution**: Set confidence threshold > 0.6, be selective

### 4. Privacy Violations

**Problem**: Extracting PII or medical diagnoses
**Solution**: Review privacy guidelines, test with validation

### 5. Poor Fax Formatting

**Problem**: Responses too long or complex for fax
**Solution**: Test with actual fax generation, enforce word limits

### 6. Inconsistent Validation

**Problem**: Different validation logic across use cases
**Solution**: Use PromptManager.validateOutput() consistently

### 7. No Error Handling

**Problem**: Crashes on invalid JSON or schema mismatch
**Solution**: Use try-catch, implement retry logic

### 8. Hardcoded Prompts

**Problem**: Prompts embedded in code, hard to update
**Solution**: Use PromptManager, store in template files

---

## Quick Reference

### Checklist for New Use Case

- [ ] Schema defined with Zod
- [ ] JSON schema exported for Gemini
- [ ] Insights field included
- [ ] Prompt template created
- [ ] Few-shot examples added
- [ ] Template registered
- [ ] MCP server integration
- [ ] Schema validation implemented
- [ ] Insights processing integrated
- [ ] Integration tests written
- [ ] Privacy compliance verified
- [ ] Fax formatting tested

### Key Files

- Schemas: `backend/src/prompts/schemas/`
- Templates: `backend/src/prompts/templates/`
- Registration: `backend/src/prompts/register.ts`
- MCP Servers: `backend/src/mcp/`
- Tests: `backend/src/test/integration/`

### Support

For questions or issues:
1. Check existing use cases (Q&A, Shopping, Email, Appointment)
2. Review design document: `.kiro/specs/llm-prompt-architecture/design.md`
3. Consult runbooks: `backend/src/prompts/RUNBOOKS.md`

---

## Version History

- v1.0 (2025-01-25): Initial documentation
