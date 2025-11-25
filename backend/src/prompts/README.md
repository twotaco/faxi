# Prompt Management System

This directory contains the centralized prompt management system for Faxi's LLM interactions.

## Overview

The PromptManager provides a structured way to manage use-case-specific prompts with JSON schemas for reliable, programmatic outputs.

## Architecture

```
prompts/
├── index.ts              # PromptManager class
├── validation.ts         # Schema validation layer with retry logic
├── register.ts           # Template registration
├── schemas/              # Zod schemas for each use case
│   ├── base.ts          # Base insights schema
│   ├── qa.ts            # Q&A response schema
│   ├── shopping.ts      # Shopping response schema (TODO)
│   ├── email.ts         # Email response schema (TODO)
│   └── appointment.ts   # Appointment response schema (TODO)
└── templates/           # Prompt templates (TODO)
    ├── qa.ts
    ├── shopping.ts
    ├── email.ts
    └── appointment.ts
```

## Usage

### 1. Register Templates at Startup

```typescript
import { registerAllTemplates } from './prompts/register.js';

// In your application startup (e.g., index.ts)
registerAllTemplates();
```

### 2. Use PromptManager in MCP Servers

```typescript
import { promptManager } from './prompts/index.js';

// Get the template
const template = promptManager.get('qa');

// Build system prompt with context
const systemPrompt = promptManager.buildSystemPrompt('qa', {
  userName: 'Tanaka-san',
  previousContext: 'User asked about weather'
});

// Use with Gemini
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

// Validate the response
const result = await chat.sendMessage(userMessage);
const response = result.response.text();
const validation = promptManager.validateOutput('qa', response);

if (validation.success) {
  const typedData = validation.data; // Fully typed!
  // Process the response...
} else {
  // Handle validation error
  console.error('Validation failed:', validation.error);
}
```

## PromptManager API

### `register(template: PromptTemplate): void`

Register a new prompt template for a use case.

```typescript
promptManager.register({
  useCase: 'qa',
  systemPrompt: 'Your system prompt here...',
  jsonSchema: zodToJsonSchema(QAResponseSchema),
  zodSchema: QAResponseSchema,
  examples: [
    { input: 'Hello', output: { response: 'Hi!' } }
  ],
  faxFormatting: {
    maxWords: 800,
    preferredSections: ['greeting', 'answer']
  }
});
```

### `get(useCase: string): PromptTemplate`

Retrieve a registered template.

```typescript
const template = promptManager.get('qa');
```

### `buildSystemPrompt(useCase: string, context?: object): string`

Build a complete system prompt with schema and examples.

```typescript
const prompt = promptManager.buildSystemPrompt('qa', {
  userName: 'Tanaka-san'
});
```

### `validateOutput(useCase: string, output: any): ValidationResult`

Validate LLM output against the schema.

```typescript
const result = promptManager.validateOutput('qa', jsonString);
if (result.success) {
  console.log(result.data); // Typed data
} else {
  console.error(result.error); // Zod error
}
```

### `has(useCase: string): boolean`

Check if a use case is registered.

```typescript
if (promptManager.has('qa')) {
  // Use the template
}
```

### `getUseCases(): string[]`

Get all registered use cases.

```typescript
const useCases = promptManager.getUseCases();
// ['qa', 'shopping', 'email', ...]
```

## Creating New Use Cases

### 1. Define the Schema

Create a new schema file in `schemas/`:

```typescript
// schemas/myUseCase.ts
import { z } from 'zod';
import { UserInsightsSchema } from './base.js';

export const MyUseCaseSchema = z.object({
  response: z.string(),
  // ... other fields
  insights: UserInsightsSchema
});

export type MyUseCaseResponse = z.infer<typeof MyUseCaseSchema>;

export const MyUseCaseExamples = [
  {
    input: 'Example input',
    output: { response: 'Example output' }
  }
];
```

### 2. Create the Prompt Template

Add to `register.ts`:

```typescript
export function registerMyUseCaseTemplate(): void {
  promptManager.register({
    useCase: 'myUseCase',
    systemPrompt: `${BASE_PROMPT}\n\nYour specific instructions...`,
    jsonSchema: zodToJsonSchema(MyUseCaseSchema),
    zodSchema: MyUseCaseSchema,
    examples: MyUseCaseExamples,
    faxFormatting: {
      maxWords: 800,
      preferredSections: ['intro', 'body', 'conclusion']
    }
  });
}

// Add to registerAllTemplates()
export function registerAllTemplates(): void {
  registerQATemplate();
  registerMyUseCaseTemplate(); // Add here
}
```

### 3. Use in MCP Server

```typescript
import { promptManager } from '../prompts/index.js';

const template = promptManager.get('myUseCase');
const systemPrompt = promptManager.buildSystemPrompt('myUseCase');

// Use with Gemini...
```

## Best Practices

1. **Always validate outputs**: Use `validateOutput()` to ensure type safety
2. **Include insights**: Every schema should include the `UserInsightsSchema`
3. **Provide examples**: Few-shot examples improve LLM performance
4. **Keep prompts modular**: Use `BASE_PROMPT` for common instructions
5. **Test schemas**: Write unit tests for schema validation
6. **Document confidence**: Include confidence scores in responses

## Testing

Run the PromptManager tests:

```bash
npm test -- promptManager.test.ts
```

## Schema Validation Layer

The validation layer provides robust error handling and retry logic for LLM responses.

### Using handleLLMResponse

The `handleLLMResponse` function provides automatic validation with retry support:

```typescript
import { handleLLMResponse, createClarificationPrompt } from './prompts/validation.js';

// Basic validation (no retry)
const result = await handleLLMResponse('qa', llmOutput);

if (result.success) {
  console.log('Validated data:', result.data);
} else {
  console.error('Validation failed:', result.error?.getErrorSummary());
}

// With retry callback
const resultWithRetry = await handleLLMResponse(
  'qa',
  llmOutput,
  async (error) => {
    // Generate clarification prompt
    const clarification = createClarificationPrompt(error);
    
    // Retry with LLM
    const retryResult = await chat.sendMessage(clarification);
    return retryResult.response.text();
  },
  {
    maxAttempts: 3,
    logErrors: true
  }
);
```

### SchemaValidationError

Custom error class with detailed validation information:

```typescript
try {
  const result = await handleLLMResponse('qa', output);
  if (!result.success) {
    const error = result.error!;
    
    // Get human-readable summary
    console.log(error.getErrorSummary());
    
    // Get structured errors for programmatic handling
    const errors = error.getStructuredErrors();
    // [{ path: 'message', message: 'Required', code: 'invalid_type' }]
  }
} catch (error) {
  // Handle unexpected errors
}
```

### Format Correction

Automatically fix common JSON formatting issues:

```typescript
import { retryWithFormatCorrection } from './prompts/validation.js';

// Handles:
// - JSON in markdown code blocks
// - Single quotes instead of double quotes
// - Trailing commas
// - JSON embedded in text

const corrected = retryWithFormatCorrection('qa', malformedOutput);
```

### Configuration Options

```typescript
interface RetryConfig {
  maxAttempts: number;           // Default: 3
  retryOnParseError: boolean;    // Default: true
  retryOnValidationError: boolean; // Default: true
  logErrors: boolean;            // Default: true
}
```

### Example: Complete Validation Flow

```typescript
import { handleLLMResponse, createClarificationPrompt } from './prompts/validation.js';
import { promptManager } from './prompts/index.js';

async function processLLMResponse(useCase: string, userMessage: string) {
  const template = promptManager.get(useCase);
  const systemPrompt = promptManager.buildSystemPrompt(useCase);
  
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: template.jsonSchema
    }
  });
  
  const chat = model.startChat();
  const initialResult = await chat.sendMessage(userMessage);
  
  // Validate with automatic retry
  const validated = await handleLLMResponse(
    useCase,
    initialResult.response.text(),
    async (error) => {
      // Retry with clarification
      const clarification = createClarificationPrompt(error);
      const retryResult = await chat.sendMessage(clarification);
      return retryResult.response.text();
    },
    { maxAttempts: 3 }
  );
  
  if (validated.success) {
    console.log(`Validated after ${validated.attemptNumber} attempt(s)`);
    return validated.data;
  } else {
    throw validated.error;
  }
}
```

## Testing

Run all prompt-related tests:

```bash
npm test -- promptManager.test.ts
npm test -- validation.test.ts
```

## Future Enhancements

- [ ] Dynamic prompt loading from database
- [ ] A/B testing support for prompts
- [ ] Prompt versioning
- [x] Automatic retry with clarification on validation failure ✅
- [ ] Prompt performance metrics
