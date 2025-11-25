import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import {
  SchemaValidationError,
  handleLLMResponse,
  createClarificationPrompt,
  retryWithFormatCorrection,
  logValidationMetrics
} from '../prompts/validation.js';
import { PromptManager, PromptTemplate } from '../prompts/index.js';

describe('Schema Validation Layer', () => {
  let promptManager: PromptManager;

  beforeEach(() => {
    promptManager = new PromptManager();

    // Register a test template
    const template: PromptTemplate = {
      useCase: 'test',
      systemPrompt: 'Test prompt',
      jsonSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          count: { type: 'number' }
        },
        required: ['message']
      },
      zodSchema: z.object({
        message: z.string(),
        count: z.number().optional()
      }),
      examples: [],
      faxFormatting: {
        maxWords: 500,
        preferredSections: []
      }
    };

    promptManager.register(template);
  });

  describe('SchemaValidationError', () => {
    it('should create error with all required fields', () => {
      const zodError = new z.ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['message'],
          message: 'Expected string, received number'
        }
      ]);

      const error = new SchemaValidationError(
        'test',
        zodError,
        { message: 123 },
        1
      );

      expect(error.name).toBe('SchemaValidationError');
      expect(error.useCase).toBe('test');
      expect(error.validationErrors).toBe(zodError);
      expect(error.rawOutput).toEqual({ message: 123 });
      expect(error.attemptNumber).toBe(1);
      expect(error.message).toContain('Schema validation failed for test');
    });

    it('should generate error summary', () => {
      const zodError = new z.ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['message'],
          message: 'Expected string, received number'
        },
        {
          code: 'invalid_type',
          expected: 'number',
          received: 'string',
          path: ['count'],
          message: 'Expected number, received string'
        }
      ]);

      const error = new SchemaValidationError('test', zodError, {}, 1);
      const summary = error.getErrorSummary();

      expect(summary).toContain('Validation failed for test');
      expect(summary).toContain('message: Expected string, received number');
      expect(summary).toContain('count: Expected number, received string');
    });

    it('should get structured errors', () => {
      const zodError = new z.ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['message'],
          message: 'Expected string, received number'
        }
      ]);

      const error = new SchemaValidationError('test', zodError, {}, 1);
      const structured = error.getStructuredErrors();

      expect(structured).toHaveLength(1);
      expect(structured[0]).toEqual({
        path: 'message',
        message: 'Expected string, received number',
        code: 'invalid_type'
      });
    });
  });

  describe('handleLLMResponse', () => {
    it('should validate valid JSON string output', async () => {
      const output = '{"message": "Hello", "count": 5}';
      const result = await handleLLMResponse('test', output, undefined, {}, promptManager);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ message: 'Hello', count: 5 });
      expect(result.attemptNumber).toBe(1);
      expect(result.retried).toBe(false);
    });

    it('should validate valid object output', async () => {
      const output = { message: 'Hello', count: 5 };
      const result = await handleLLMResponse('test', output, undefined, {}, promptManager);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ message: 'Hello', count: 5 });
      expect(result.attemptNumber).toBe(1);
      expect(result.retried).toBe(false);
    });

    it('should fail validation for invalid schema', async () => {
      const output = { count: 5 }; // Missing required 'message' field
      const result = await handleLLMResponse('test', output, undefined, {}, promptManager);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SchemaValidationError);
      expect(result.error?.useCase).toBe('test');
      expect(result.attemptNumber).toBe(1);
      expect(result.retried).toBe(false);
    });

    it('should fail validation for invalid JSON string', async () => {
      const output = 'not valid json';
      const result = await handleLLMResponse('test', output, undefined, {}, promptManager);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SchemaValidationError);
      expect(result.error?.validationErrors.errors[0].message).toContain('Invalid JSON');
    });

    it('should retry with callback on validation failure', async () => {
      let retryCount = 0;
      const retryCallback = vi.fn(async (error: SchemaValidationError) => {
        retryCount++;
        // Return valid output on retry
        return { message: 'Corrected', count: 10 };
      });

      const invalidOutput = { count: 5 }; // Missing required 'message'
      const result = await handleLLMResponse('test', invalidOutput, retryCallback, {}, promptManager);

      expect(retryCallback).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ message: 'Corrected', count: 10 });
      expect(result.attemptNumber).toBe(2);
      expect(result.retried).toBe(true);
    });

    it('should respect maxAttempts configuration', async () => {
      let retryCount = 0;
      const retryCallback = vi.fn(async () => {
        retryCount++;
        // Always return invalid output
        return { count: 5 };
      });

      const invalidOutput = { count: 5 };
      const result = await handleLLMResponse(
        'test',
        invalidOutput,
        retryCallback,
        { maxAttempts: 2 },
        promptManager
      );

      expect(retryCallback).toHaveBeenCalledTimes(1); // maxAttempts - 1
      expect(result.success).toBe(false);
      expect(result.attemptNumber).toBe(2);
      expect(result.retried).toBe(true);
    });

    it('should not retry without callback', async () => {
      const invalidOutput = { count: 5 };
      const result = await handleLLMResponse('test', invalidOutput, undefined, {}, promptManager);

      expect(result.success).toBe(false);
      expect(result.attemptNumber).toBe(1);
      expect(result.retried).toBe(false);
    });

    it('should handle retry callback errors gracefully', async () => {
      const retryCallback = vi.fn(async () => {
        throw new Error('Retry failed');
      });

      const invalidOutput = { count: 5 };
      const result = await handleLLMResponse('test', invalidOutput, retryCallback, {}, promptManager);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SchemaValidationError);
    });
  });

  describe('createClarificationPrompt', () => {
    it('should create clarification prompt from validation error', () => {
      const zodError = new z.ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['message'],
          message: 'Expected string, received number'
        },
        {
          code: 'invalid_type',
          expected: 'number',
          received: 'string',
          path: ['count'],
          message: 'Expected number, received string'
        }
      ]);

      const error = new SchemaValidationError('test', zodError, {}, 1);
      const clarification = createClarificationPrompt(error);

      expect(clarification).toContain('Your previous response did not match the expected schema');
      expect(clarification).toContain('Field "message": Expected string, received number');
      expect(clarification).toContain('Field "count": Expected number, received string');
      expect(clarification).toContain('Please provide a corrected response');
    });

    it('should handle errors without path', () => {
      const zodError = new z.ZodError([
        {
          code: 'custom',
          path: [],
          message: 'Invalid JSON format'
        }
      ]);

      const error = new SchemaValidationError('test', zodError, {}, 1);
      const clarification = createClarificationPrompt(error);

      expect(clarification).toContain('Invalid JSON format');
      expect(clarification).not.toContain('Field ""');
    });
  });

  describe('retryWithFormatCorrection', () => {
    it('should extract JSON from markdown code block', () => {
      const output = '```json\n{"message": "Hello", "count": 5}\n```';
      const corrected = retryWithFormatCorrection('test', output);

      expect(corrected).toEqual({ message: 'Hello', count: 5 });
    });

    it('should extract JSON from code block without language', () => {
      const output = '```\n{"message": "Hello", "count": 5}\n```';
      const corrected = retryWithFormatCorrection('test', output);

      expect(corrected).toEqual({ message: 'Hello', count: 5 });
    });

    it('should extract JSON object from text', () => {
      const output = 'Here is the response: {"message": "Hello", "count": 5} as requested';
      const corrected = retryWithFormatCorrection('test', output);

      expect(corrected).toEqual({ message: 'Hello', count: 5 });
    });

    it('should fix single quotes to double quotes', () => {
      const output = "{'message': 'Hello', 'count': 5}";
      const corrected = retryWithFormatCorrection('test', output);

      expect(corrected).toEqual({ message: 'Hello', count: 5 });
    });

    it('should remove trailing commas', () => {
      const output = '{"message": "Hello", "count": 5,}';
      const corrected = retryWithFormatCorrection('test', output);

      expect(corrected).toEqual({ message: 'Hello', count: 5 });
    });

    it('should return original if correction fails', () => {
      const output = 'completely invalid json with no structure';
      const corrected = retryWithFormatCorrection('test', output);

      expect(corrected).toBe(output);
    });
  });

  describe('logValidationMetrics', () => {
    it('should log validation metrics without errors', () => {
      // This is primarily for code coverage
      // In a real scenario, you'd mock the logging service
      expect(() => {
        logValidationMetrics('test', true, 1, 100);
      }).not.toThrow();

      expect(() => {
        logValidationMetrics('test', false, 3, 500);
      }).not.toThrow();
    });
  });
});
