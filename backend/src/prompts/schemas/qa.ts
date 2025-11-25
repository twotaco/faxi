import { z } from 'zod';
import { UserInsightsSchema } from './base.js';

/**
 * Q&A Response Schema
 * 
 * For general information requests and questions.
 */
export const QAResponseSchema = z.object({
  // Main response
  response: z.string().describe("The main response text, formatted for fax readability"),
  
  // Follow-up suggestions
  followUpSuggestions: z.array(z.string()).optional().describe("Suggested follow-up questions"),
  
  // Conversation continuation
  requiresContinuation: z.boolean().describe("Whether this topic needs more conversation"),
  
  // Information sources
  sources: z.array(z.string()).optional().describe("Information sources if applicable"),
  
  // Metadata
  metadata: z.object({
    confidence: z.enum(['high', 'medium', 'low']).describe("Confidence in the answer"),
    category: z.string().optional().describe("Topic category: weather, health, travel, etc.")
  }),
  
  // User insights (strategic data)
  insights: UserInsightsSchema
});

export type QAResponse = z.infer<typeof QAResponseSchema>;

/**
 * Example Q&A responses for few-shot learning
 */
export const QAExamples = [
  {
    input: "What's the weather in Tokyo this week?",
    output: {
      response: "Hello, thank you for contacting Faxi.\n\nFor the most accurate and up-to-date weather information for Tokyo this week, I recommend checking a local weather website or calling the weather hotline at 177.\n\nGenerally, Tokyo in late November has:\n• Average temperatures: 10-15°C\n• Occasional rain\n• Cool and dry conditions\n\nPlease check closer to your travel dates for the latest forecast.\n\nIf you have more questions, please send another fax.",
      followUpSuggestions: [
        "What should I pack for Tokyo weather?",
        "Are there any weather warnings?"
      ],
      requiresContinuation: false,
      metadata: {
        confidence: "medium",
        category: "weather"
      },
      insights: {
        intentSignals: {
          commercialIntent: [{
            category: "travel",
            urgency: "near-term"
          }]
        },
        digitalProfile: {
          digitalExclusionScore: 4,
          aiAssistanceNeeded: ["information-lookup"]
        },
        confidenceScores: {
          intent: 0.9,
          demographics: 0.6
        }
      }
    }
  },
  {
    input: "How do I cook rice?",
    output: {
      response: "Hello, here's how to cook rice:\n\n1. Rinse rice 2-3 times until water runs clear\n2. Use 1 cup rice to 1.2 cups water\n3. Bring to boil, then reduce to low heat\n4. Cover and simmer for 15-18 minutes\n5. Turn off heat, let steam for 10 minutes\n6. Fluff with fork before serving\n\nFor best results, use a rice cooker if you have one.\n\nWould you like recommendations for rice cookers?",
      followUpSuggestions: [
        "What's a good rice cooker to buy?",
        "How do I store leftover rice?"
      ],
      requiresContinuation: false,
      metadata: {
        confidence: "high",
        category: "cooking"
      },
      insights: {
        demographics: {
          householdTypeInferred: "single"
        },
        intentSignals: {
          commercialIntent: [{
            category: "home-appliances",
            product: "rice cooker",
            urgency: "near-term"
          }]
        },
        digitalProfile: {
          digitalExclusionScore: 3,
          aiAssistanceNeeded: ["instructions"]
        },
        confidenceScores: {
          intent: 0.85,
          demographics: 0.7
        }
      }
    }
  }
];
