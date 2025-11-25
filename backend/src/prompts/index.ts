import { z } from 'zod';
import { loggingService } from '../services/loggingService.js';

/**
 * Prompt Template Interface
 * 
 * Defines the structure for use-case-specific prompts with JSON schemas
 */
export interface PromptTemplate {
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

/**
 * Validation Result
 */
export interface ValidationResult {
  success: boolean;
  data?: any;
  error?: z.ZodError;
}

/**
 * PromptManager Class
 * 
 * Centralized management of prompts and schemas for each use case.
 * Provides template registration, retrieval, system prompt building, and output validation.
 */
export class PromptManager {
  private templates: Map<string, PromptTemplate>;

  constructor() {
    this.templates = new Map();
  }

  /**
   * Register a prompt template for a specific use case
   * 
   * @param template - The prompt template to register
   * @throws Error if use case is already registered
   */
  register(template: PromptTemplate): void {
    if (this.templates.has(template.useCase)) {
      loggingService.warn(`Overwriting existing template for use case: ${template.useCase}`);
    }

    // Validate template structure
    if (!template.useCase || !template.systemPrompt || !template.zodSchema) {
      throw new Error('Invalid template: useCase, systemPrompt, and zodSchema are required');
    }

    this.templates.set(template.useCase, template);
    loggingService.info(`Registered prompt template for use case: ${template.useCase}`);
  }

  /**
   * Get a registered prompt template by use case
   * 
   * @param useCase - The use case identifier
   * @returns The prompt template
   * @throws Error if use case is not registered
   */
  get(useCase: string): PromptTemplate {
    const template = this.templates.get(useCase);
    
    if (!template) {
      throw new Error(`No template registered for use case: ${useCase}`);
    }

    return template;
  }

  /**
   * Check if a use case is registered
   * 
   * @param useCase - The use case identifier
   * @returns True if registered, false otherwise
   */
  has(useCase: string): boolean {
    return this.templates.has(useCase);
  }

  /**
   * Get all registered use cases
   * 
   * @returns Array of use case identifiers
   */
  getUseCases(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Build a complete system prompt for a use case
   * 
   * @param useCase - The use case identifier
   * @param context - Optional context to inject into the prompt
   * @returns The complete system prompt with schema and examples
   */
  buildSystemPrompt(useCase: string, context?: Record<string, any>): string {
    const template = this.get(useCase);

    let prompt = template.systemPrompt;

    // Inject context if provided
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        const placeholder = `{${key}}`;
        if (prompt.includes(placeholder)) {
          prompt = prompt.replace(new RegExp(placeholder, 'g'), String(value));
        }
      }
    }

    // Add JSON schema
    prompt += '\n\nOUTPUT SCHEMA:\n';
    prompt += JSON.stringify(template.jsonSchema, null, 2);

    // Add examples if available
    if (template.examples && template.examples.length > 0) {
      prompt += '\n\nEXAMPLES:\n';
      template.examples.forEach((example, index) => {
        prompt += `\nExample ${index + 1}:\n`;
        prompt += `Input: ${example.input}\n`;
        prompt += `Output: ${JSON.stringify(example.output, null, 2)}\n`;
      });
    }

    // Add fax formatting guidelines
    prompt += '\n\nFAX FORMATTING GUIDELINES:\n';
    prompt += `- Maximum words: ${template.faxFormatting.maxWords}\n`;
    if (template.faxFormatting.preferredSections.length > 0) {
      prompt += `- Preferred sections: ${template.faxFormatting.preferredSections.join(', ')}\n`;
    }

    return prompt;
  }

  /**
   * Validate LLM output against the schema for a use case
   * 
   * @param useCase - The use case identifier
   * @param output - The output to validate (can be string or object)
   * @returns Validation result with parsed data or error
   */
  validateOutput(useCase: string, output: any): ValidationResult {
    const template = this.get(useCase);

    try {
      // If output is a string, try to parse as JSON
      let parsed = output;
      if (typeof output === 'string') {
        try {
          parsed = JSON.parse(output);
        } catch (parseError) {
          loggingService.error('Failed to parse output as JSON', parseError as Error, {
            useCase
          }, {
            output: output.substring(0, 200)
          });
          return {
            success: false,
            error: new z.ZodError([{
              code: 'custom',
              path: [],
              message: 'Output is not valid JSON'
            }])
          };
        }
      }

      // Validate against Zod schema
      const validated = template.zodSchema.parse(parsed);

      loggingService.debug('Output validation successful', { useCase });

      return {
        success: true,
        data: validated
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        loggingService.error('Schema validation failed', undefined, {
          useCase
        }, {
          errors: error.errors,
          output: typeof output === 'string' ? output.substring(0, 200) : JSON.stringify(output).substring(0, 200)
        });

        return {
          success: false,
          error
        };
      }

      // Unexpected error
      loggingService.error('Unexpected validation error', error as Error, {
        useCase
      });

      return {
        success: false,
        error: new z.ZodError([{
          code: 'custom',
          path: [],
          message: 'Unexpected validation error'
        }])
      };
    }
  }

  /**
   * Unregister a prompt template
   * 
   * @param useCase - The use case identifier
   * @returns True if template was removed, false if it didn't exist
   */
  unregister(useCase: string): boolean {
    const existed = this.templates.has(useCase);
    this.templates.delete(useCase);
    
    if (existed) {
      loggingService.info(`Unregistered prompt template for use case: ${useCase}`);
    }

    return existed;
  }

  /**
   * Clear all registered templates
   */
  clear(): void {
    this.templates.clear();
    loggingService.info('Cleared all prompt templates');
  }
}

/**
 * Global PromptManager instance
 */
export const promptManager = new PromptManager();
