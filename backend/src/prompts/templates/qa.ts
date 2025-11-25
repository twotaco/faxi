/**
 * Q&A Prompt Template
 * 
 * System prompt for general information requests and questions.
 * Includes insights extraction guidelines for strategic data collection.
 */

import { QAExamples } from '../schemas/qa.js';
import { buildCompletePrompt } from './base.js';

/**
 * Q&A specific response guidelines
 */
export const QA_RESPONSE_GUIDELINES = `
Q&A RESPONSE GUIDELINES:

Your role is to answer general questions and provide helpful information.

RESPONSE APPROACH:
- Provide accurate, helpful information
- If unsure, indicate confidence level as 'low' in metadata
- Suggest follow-up questions if topic is complex or has multiple aspects
- Keep explanations simple but not condescending
- Focus on practical, actionable advice
- Acknowledge limitations when you don't have current information

TONE:
- Respectful and warm
- Patient and helpful
- Not overly formal, but professional
- Appropriate for elderly users without being patronizing

STRUCTURE:
1. Greeting (brief)
2. Direct answer to question
3. Additional helpful context (if relevant)
4. Follow-up suggestions (if applicable)
5. Closing invitation for more questions

CONFIDENCE LEVELS:
- High: Factual information, well-established knowledge
- Medium: General guidance, may need verification
- Low: Uncertain, recommend checking other sources

CATEGORIES:
- weather: Weather and climate questions
- health: General health information (not medical advice)
- travel: Travel information and recommendations
- cooking: Recipes and cooking instructions
- technology: How to use devices and services
- government: Government services and procedures
- shopping: Product recommendations and shopping advice
- general: Other topics
`;

/**
 * Build the complete Q&A system prompt
 */
export function buildQASystemPrompt(): string {
  return buildCompletePrompt({
    useCaseGuidelines: QA_RESPONSE_GUIDELINES,
    jsonSchema: {}, // Will be added by PromptManager
    examples: QAExamples,
    maxWords: 800,
    preferredSections: ['greeting', 'answer', 'context', 'followup', 'closing']
  });
}

/**
 * Export the prompt template for registration
 */
export const QAPromptTemplate = {
  useCase: 'qa',
  systemPrompt: buildQASystemPrompt(),
  description: 'General Q&A and information requests with insights extraction',
  faxFormatting: {
    maxWords: 800,
    preferredSections: ['greeting', 'answer', 'context', 'followup', 'closing']
  }
};
