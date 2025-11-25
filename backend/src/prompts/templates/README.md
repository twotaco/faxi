# Prompt Templates

This directory contains use-case-specific prompt templates for the Faxi LLM system.

## Overview

Each template provides:
- System prompt with use-case-specific instructions
- Fax formatting rules
- Insights extraction guidelines
- Few-shot examples
- Response structure guidelines

## Available Templates

### Q&A Template (`qa.ts`)

**Use Case:** General information requests and questions

**Features:**
- Comprehensive insights extraction guidelines covering:
  - Demographics (age, gender, region, household type)
  - Life events (moving, caregiving, hospitalization, retirement)
  - Intent signals (commercial, health, government)
  - Behavioral patterns (communication style, task complexity)
  - Consumer profile (spend sensitivity, brand preferences)
  - Digital profile (exclusion score, assistance needs)
- Fax-optimized formatting rules
- Privacy-safe data extraction (no PII, no medical diagnoses)
- Confidence scoring guidelines
- Two detailed few-shot examples

**Usage:**
```typescript
import { buildQASystemPrompt, QAPromptTemplate } from './templates/qa.js';

// Get the complete system prompt
const systemPrompt = buildQASystemPrompt();

// Or use the template object
const template = QAPromptTemplate;
```

## Base Template Components (`base.ts`)

The `base.ts` file provides reusable components for building prompts:

### Constants
- `BASE_SYSTEM_INSTRUCTION`: Core instruction for all Faxi prompts
- `FAX_FORMATTING_RULES`: Common fax formatting guidelines
- `TONE_GUIDELINES`: Tone and style rules
- `PRIVACY_RULES`: Privacy and compliance requirements
- `INSIGHTS_EXTRACTION_GUIDELINES`: Comprehensive insights extraction rules
- `RESPONSE_STRUCTURE_GUIDELINES`: Standard response structure

### Helper Functions
- `buildSystemPrompt(useCaseGuidelines, additionalComponents)`: Build base prompt
- `formatExamples(examples)`: Format examples for prompts
- `formatSchema(jsonSchema)`: Format JSON schema
- `formatFaxGuidelines(maxWords, preferredSections)`: Format fax guidelines
- `buildCompletePrompt(config)`: Build complete prompt with all components

### Usage Example
```typescript
import { buildCompletePrompt } from './base.js';

const prompt = buildCompletePrompt({
  useCaseGuidelines: 'Your use case specific guidelines...',
  jsonSchema: { type: 'object', properties: {...} },
  examples: [{ input: '...', output: {...} }],
  maxWords: 800,
  preferredSections: ['greeting', 'body', 'closing']
});
```

## Template Structure

All templates follow this structure:

```typescript
export const TemplatePromptTemplate = {
  useCase: string;           // Unique identifier
  systemPrompt: string;      // Complete system prompt
  description: string;       // Human-readable description
  faxFormatting: {
    maxWords: number;        // Maximum response length
    preferredSections: string[];  // Recommended sections
  }
};
```

## Adding New Templates

1. Create a new file in this directory (e.g., `shopping.ts`)
2. Import base components:
   ```typescript
   import { buildCompletePrompt } from './base.js';
   import { YourSchemaExamples } from '../schemas/yourSchema.js';
   ```
3. Define use-case-specific guidelines:
   ```typescript
   export const YOUR_USE_CASE_GUIDELINES = `
   YOUR USE CASE SPECIFIC INSTRUCTIONS:
   - Guideline 1
   - Guideline 2
   `;
   ```
4. Create a `build[UseCase]SystemPrompt()` function using `buildCompletePrompt()`
5. Export the template object
6. Register in `../register.ts`

### Template Example
```typescript
import { buildCompletePrompt } from './base.js';
import { ShoppingExamples } from '../schemas/shopping.js';

export const SHOPPING_GUIDELINES = `
SHOPPING SPECIFIC GUIDELINES:
- Show prices in Japanese Yen (¥)
- Highlight Prime-eligible products
- Confirm delivery address
`;

export function buildShoppingSystemPrompt(): string {
  return buildCompletePrompt({
    useCaseGuidelines: SHOPPING_GUIDELINES,
    jsonSchema: {},
    examples: ShoppingExamples,
    maxWords: 800,
    preferredSections: ['greeting', 'products', 'confirmation']
  });
}

export const ShoppingPromptTemplate = {
  useCase: 'shopping',
  systemPrompt: buildShoppingSystemPrompt(),
  description: 'Amazon shopping with insights',
  faxFormatting: {
    maxWords: 800,
    preferredSections: ['greeting', 'products', 'confirmation']
  }
};
```

## Insights Extraction

All templates include comprehensive insights extraction guidelines to collect strategic data:

- **Demographics**: Age, gender, region, household type
- **Life Events**: Moving, caregiving, health changes, retirement
- **Intent Signals**: Commercial, health, government service intent
- **Behavioral**: Communication style, task complexity
- **Consumer Profile**: Spend sensitivity, brand preferences
- **Digital Profile**: Digital exclusion score, assistance needs

### Privacy Rules

- NO personally identifiable information (PII)
- NO medical diagnoses (only administrative signals)
- All inferences marked as "inferred" not "confirmed"
- Focus on patterns, not sensitive details
- Only include insights with confidence > 0.6

## Testing

Templates are tested in `../test/promptRegistration.test.ts`:
- Registration validation
- Structure validation
- Content validation
- Schema integration

Run tests:
```bash
npm test -- src/test/promptRegistration.test.ts
```
