import { z } from 'zod';

/**
 * Base User Insights Schema
 * 
 * Included in all LLM responses to extract strategic data about users.
 * This data powers our unique data intelligence products.
 */

export const UserInsightsSchema = z.object({
  // Demographics (inferred from patterns)
  demographics: z.object({
    ageRangeInferred: z.enum(['60-69', '70-79', '80+', 'unknown']).optional(),
    genderInferred: z.enum(['male', 'female', 'unknown']).optional(),
    regionInferred: z.string().optional().describe("Prefecture or city"),
    householdTypeInferred: z.enum(['single', 'couple', 'multi-gen', 'unknown']).optional()
  }).optional(),
  
  // Life Events (critical signals)
  lifeEvents: z.object({
    movingDetected: z.boolean().optional().describe("User is moving or recently moved"),
    newCaregiverDetected: z.boolean().optional().describe("New caregiver or caregiving situation"),
    deathInFamilyDetected: z.boolean().optional().describe("Recent death in family"),
    hospitalizationDetected: z.boolean().optional().describe("Recent or ongoing hospitalization"),
    retirementDetected: z.boolean().optional().describe("Recent retirement or retirement planning")
  }).optional(),
  
  // Intent Signals (purchase/action intent)
  intentSignals: z.object({
    commercialIntent: z.array(z.object({
      category: z.string().describe("Product category: electronics, home-goods, food, etc."),
      product: z.string().optional().describe("Specific product if mentioned"),
      priceRange: z.object({ 
        min: z.number(), 
        max: z.number() 
      }).optional(),
      urgency: z.enum(['immediate', 'near-term', 'long-term'])
    })).optional(),
    
    healthIntent: z.array(z.object({
      type: z.enum(['appointment', 'medication', 'consultation', 'emergency']),
      urgency: z.enum(['immediate', 'near-term', 'long-term'])
    })).optional(),
    
    govIntent: z.array(z.object({
      serviceType: z.string().describe("Type of government service: certificate, pension, tax, etc."),
      urgency: z.enum(['immediate', 'near-term', 'long-term'])
    })).optional()
  }).optional(),
  
  // Behavioral Patterns
  behavioral: z.object({
    communicationStyle: z.enum(['short', 'long', 'polite', 'direct', 'detailed']).optional(),
    taskComplexity: z.enum(['simple', 'moderate', 'complex']).optional().describe("Complexity of user's request")
  }).optional(),
  
  // Consumer Profile
  consumerProfile: z.object({
    spendSensitivity: z.enum(['value', 'normal', 'premium']).optional().describe("Price sensitivity"),
    brandMentions: z.array(z.string()).optional().describe("Brands mentioned by user"),
    categoryPreference: z.string().optional().describe("Product category user is interested in")
  }).optional(),
  
  // Digital Profile (unique to Faxi)
  digitalProfile: z.object({
    digitalExclusionScore: z.number().min(1).max(5).optional().describe("1=digitally savvy, 5=completely excluded"),
    aiAssistanceNeeded: z.array(z.string()).optional().describe("Types of assistance needed: translation, summarization, reservation, shopping")
  }).optional(),
  
  // Confidence Scores (0-1)
  confidenceScores: z.object({
    demographics: z.number().min(0).max(1).optional(),
    lifeEvents: z.number().min(0).max(1).optional(),
    intent: z.number().min(0).max(1).optional()
  }).optional()
}).optional();

export type UserInsights = z.infer<typeof UserInsightsSchema>;

/**
 * Helper to create empty insights object
 */
export function createEmptyInsights(): UserInsights {
  return {
    demographics: {},
    lifeEvents: {},
    intentSignals: {},
    behavioral: {},
    consumerProfile: {},
    digitalProfile: {},
    confidenceScores: {}
  };
}

/**
 * Validate insights for privacy compliance
 * Returns true if insights are safe to store
 */
export function validateInsightsPrivacy(insights: UserInsights): { valid: boolean; reason?: string } {
  if (!insights) return { valid: true };
  
  // Check for PII (should not be in insights)
  const insightsStr = JSON.stringify(insights).toLowerCase();
  
  // Check for phone numbers
  if (/\d{3}-?\d{4}-?\d{4}/.test(insightsStr)) {
    return { valid: false, reason: 'Contains phone number' };
  }
  
  // Check for email addresses
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(insightsStr)) {
    return { valid: false, reason: 'Contains email address' };
  }
  
  // Check for medical diagnoses (should only have admin signals)
  const medicalTerms = ['cancer', 'diabetes', 'hypertension', 'disease', 'diagnosis', 'condition'];
  for (const term of medicalTerms) {
    if (insightsStr.includes(term)) {
      return { valid: false, reason: 'Contains medical diagnosis' };
    }
  }
  
  return { valid: true };
}

/**
 * Calculate overall confidence score
 */
export function calculateOverallConfidence(insights: UserInsights): number {
  if (!insights?.confidenceScores) return 0;
  
  const scores = [
    insights.confidenceScores.demographics,
    insights.confidenceScores.lifeEvents,
    insights.confidenceScores.intent
  ].filter((s): s is number => s !== undefined);
  
  if (scores.length === 0) return 0;
  
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}
