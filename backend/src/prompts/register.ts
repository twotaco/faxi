/**
 * Register all prompt templates with the PromptManager
 * 
 * This file should be imported at application startup to register
 * all available use case templates.
 */

import { promptManager } from './index.js';
import { QAResponseSchema, QAExamples } from './schemas/qa.js';
import { QAPromptTemplate, buildQASystemPrompt } from './templates/qa.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Register Q&A template
 * 
 * Uses the comprehensive Q&A prompt template with insights extraction
 */
export function registerQATemplate(): void {
  promptManager.register({
    useCase: 'qa',
    systemPrompt: buildQASystemPrompt(),
    jsonSchema: zodToJsonSchema(QAResponseSchema, 'QAResponseSchema'),
    zodSchema: QAResponseSchema,
    examples: QAExamples,
    faxFormatting: QAPromptTemplate.faxFormatting
  });
}

/**
 * Register all templates
 * Call this function at application startup
 */
export function registerAllTemplates(): void {
  registerQATemplate();
  // Add more template registrations here as they are implemented:
  // registerShoppingTemplate();
  // registerEmailTemplate();
  // registerAppointmentTemplate();
}
