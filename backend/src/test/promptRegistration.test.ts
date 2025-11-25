import { describe, it, expect, beforeEach } from 'vitest';
import { promptManager } from '../prompts/index.js';
import { registerQATemplate } from '../prompts/register.js';

describe('Prompt Registration', () => {
  beforeEach(() => {
    // Clear any existing templates before each test
    promptManager.clear();
  });

  describe('registerQATemplate', () => {
    it('should register Q&A template successfully', () => {
      // Register using the global promptManager
      registerQATemplate();

      // Verify it's registered
      expect(promptManager.has('qa')).toBe(true);
    });

    it('should have valid Q&A template structure', () => {
      registerQATemplate();

      const template = promptManager.get('qa');

      expect(template.useCase).toBe('qa');
      expect(template.systemPrompt).toBeDefined();
      expect(template.systemPrompt.length).toBeGreaterThan(0);
      expect(template.jsonSchema).toBeDefined();
      expect(template.zodSchema).toBeDefined();
      expect(template.examples).toBeDefined();
      expect(Array.isArray(template.examples)).toBe(true);
      expect(template.faxFormatting).toBeDefined();
      expect(template.faxFormatting.maxWords).toBe(800);
    });

    it('should build valid system prompt for Q&A', () => {
      registerQATemplate();

      const systemPrompt = promptManager.buildSystemPrompt('qa');

      expect(systemPrompt).toContain('Faxi');
      expect(systemPrompt).toContain('JSON');
      expect(systemPrompt).toContain('OUTPUT SCHEMA:');
      expect(systemPrompt).toContain('EXAMPLES:');
      expect(systemPrompt).toContain('FAX FORMATTING GUIDELINES:');
      expect(systemPrompt).toContain('INSIGHTS EXTRACTION GUIDELINES:');
    });

    it('should validate Q&A response correctly', () => {
      registerQATemplate();

      const validResponse = {
        response: 'This is a test response',
        followUpSuggestions: ['Question 1', 'Question 2'],
        requiresContinuation: false,
        metadata: {
          confidence: 'high',
          category: 'test'
        },
        insights: {
          demographics: {
            ageRangeInferred: '70-79'
          },
          confidenceScores: {
            demographics: 0.8
          }
        }
      };

      const result = promptManager.validateOutput('qa', validResponse);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.response).toBe('This is a test response');
    });

    it('should fail validation for invalid Q&A response', () => {
      registerQATemplate();

      const invalidResponse = {
        // Missing required 'response' field
        metadata: {
          confidence: 'high'
        }
      };

      const result = promptManager.validateOutput('qa', invalidResponse);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
