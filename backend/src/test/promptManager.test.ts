import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { PromptManager, PromptTemplate } from '../prompts/index.js';

describe('PromptManager', () => {
  let promptManager: PromptManager;

  beforeEach(() => {
    promptManager = new PromptManager();
  });

  describe('register', () => {
    it('should register a valid template', () => {
      const template: PromptTemplate = {
        useCase: 'test',
        systemPrompt: 'Test prompt',
        jsonSchema: { type: 'object' },
        zodSchema: z.object({ message: z.string() }),
        examples: [],
        faxFormatting: {
          maxWords: 500,
          preferredSections: ['intro', 'body']
        }
      };

      expect(() => promptManager.register(template)).not.toThrow();
      expect(promptManager.has('test')).toBe(true);
    });

    it('should throw error for invalid template', () => {
      const invalidTemplate = {
        useCase: 'test',
        systemPrompt: 'Test prompt'
        // Missing zodSchema
      } as any;

      expect(() => promptManager.register(invalidTemplate)).toThrow('Invalid template');
    });
  });

  describe('get', () => {
    it('should retrieve a registered template', () => {
      const template: PromptTemplate = {
        useCase: 'test',
        systemPrompt: 'Test prompt',
        jsonSchema: { type: 'object' },
        zodSchema: z.object({ message: z.string() }),
        examples: [],
        faxFormatting: {
          maxWords: 500,
          preferredSections: []
        }
      };

      promptManager.register(template);
      const retrieved = promptManager.get('test');

      expect(retrieved).toEqual(template);
    });

    it('should throw error for unregistered use case', () => {
      expect(() => promptManager.get('nonexistent')).toThrow('No template registered');
    });
  });

  describe('buildSystemPrompt', () => {
    it('should build a complete system prompt', () => {
      const template: PromptTemplate = {
        useCase: 'test',
        systemPrompt: 'Test prompt for {context}',
        jsonSchema: { type: 'object', properties: { message: { type: 'string' } } },
        zodSchema: z.object({ message: z.string() }),
        examples: [
          {
            input: 'Hello',
            output: { message: 'Hi there' }
          }
        ],
        faxFormatting: {
          maxWords: 500,
          preferredSections: ['intro', 'body']
        }
      };

      promptManager.register(template);
      const systemPrompt = promptManager.buildSystemPrompt('test', { context: 'testing' });

      expect(systemPrompt).toContain('Test prompt for testing');
      expect(systemPrompt).toContain('OUTPUT SCHEMA:');
      expect(systemPrompt).toContain('EXAMPLES:');
      expect(systemPrompt).toContain('FAX FORMATTING GUIDELINES:');
      expect(systemPrompt).toContain('Maximum words: 500');
    });
  });

  describe('validateOutput', () => {
    beforeEach(() => {
      const template: PromptTemplate = {
        useCase: 'test',
        systemPrompt: 'Test prompt',
        jsonSchema: { type: 'object' },
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

    it('should validate valid JSON string output', () => {
      const output = '{"message": "Hello", "count": 5}';
      const result = promptManager.validateOutput('test', output);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ message: 'Hello', count: 5 });
    });

    it('should validate valid object output', () => {
      const output = { message: 'Hello', count: 5 };
      const result = promptManager.validateOutput('test', output);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ message: 'Hello', count: 5 });
    });

    it('should fail validation for invalid schema', () => {
      const output = { count: 5 }; // Missing required 'message' field
      const result = promptManager.validateOutput('test', output);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail validation for invalid JSON string', () => {
      const output = 'not valid json';
      const result = promptManager.validateOutput('test', output);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('utility methods', () => {
    it('should check if use case exists', () => {
      const template: PromptTemplate = {
        useCase: 'test',
        systemPrompt: 'Test prompt',
        jsonSchema: { type: 'object' },
        zodSchema: z.object({ message: z.string() }),
        examples: [],
        faxFormatting: {
          maxWords: 500,
          preferredSections: []
        }
      };

      expect(promptManager.has('test')).toBe(false);
      promptManager.register(template);
      expect(promptManager.has('test')).toBe(true);
    });

    it('should return all registered use cases', () => {
      const template1: PromptTemplate = {
        useCase: 'test1',
        systemPrompt: 'Test prompt 1',
        jsonSchema: { type: 'object' },
        zodSchema: z.object({ message: z.string() }),
        examples: [],
        faxFormatting: { maxWords: 500, preferredSections: [] }
      };

      const template2: PromptTemplate = {
        useCase: 'test2',
        systemPrompt: 'Test prompt 2',
        jsonSchema: { type: 'object' },
        zodSchema: z.object({ message: z.string() }),
        examples: [],
        faxFormatting: { maxWords: 500, preferredSections: [] }
      };

      promptManager.register(template1);
      promptManager.register(template2);

      const useCases = promptManager.getUseCases();
      expect(useCases).toContain('test1');
      expect(useCases).toContain('test2');
      expect(useCases.length).toBe(2);
    });

    it('should unregister a template', () => {
      const template: PromptTemplate = {
        useCase: 'test',
        systemPrompt: 'Test prompt',
        jsonSchema: { type: 'object' },
        zodSchema: z.object({ message: z.string() }),
        examples: [],
        faxFormatting: { maxWords: 500, preferredSections: [] }
      };

      promptManager.register(template);
      expect(promptManager.has('test')).toBe(true);

      const result = promptManager.unregister('test');
      expect(result).toBe(true);
      expect(promptManager.has('test')).toBe(false);
    });

    it('should clear all templates', () => {
      const template1: PromptTemplate = {
        useCase: 'test1',
        systemPrompt: 'Test prompt 1',
        jsonSchema: { type: 'object' },
        zodSchema: z.object({ message: z.string() }),
        examples: [],
        faxFormatting: { maxWords: 500, preferredSections: [] }
      };

      const template2: PromptTemplate = {
        useCase: 'test2',
        systemPrompt: 'Test prompt 2',
        jsonSchema: { type: 'object' },
        zodSchema: z.object({ message: z.string() }),
        examples: [],
        faxFormatting: { maxWords: 500, preferredSections: [] }
      };

      promptManager.register(template1);
      promptManager.register(template2);
      expect(promptManager.getUseCases().length).toBe(2);

      promptManager.clear();
      expect(promptManager.getUseCases().length).toBe(0);
    });
  });
});
