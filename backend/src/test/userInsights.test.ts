import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import {
  UserInsightsSchema,
  UserInsights,
  validateInsightsPrivacy,
  calculateOverallConfidence,
  createEmptyInsights
} from '../prompts/schemas/base.js';

describe('User Insights Infrastructure', () => {
  describe('UserInsightsSchema Validation', () => {
    it('should validate empty insights object', () => {
      const insights: UserInsights = {};
      const result = UserInsightsSchema.safeParse(insights);
      
      expect(result.success).toBe(true);
    });

    it('should validate complete insights object', () => {
      const insights: UserInsights = {
        demographics: {
          ageRangeInferred: '70-79',
          genderInferred: 'male',
          regionInferred: 'Tokyo',
          householdTypeInferred: 'single'
        },
        lifeEvents: {
          movingDetected: true,
          newCaregiverDetected: false,
          deathInFamilyDetected: false,
          hospitalizationDetected: true,
          retirementDetected: false
        },
        intentSignals: {
          commercialIntent: [
            {
              category: 'electronics',
              product: 'laptop',
              priceRange: { min: 50000, max: 100000 },
              urgency: 'near-term'
            }
          ],
          healthIntent: [
            {
              type: 'appointment',
              urgency: 'immediate'
            }
          ],
          govIntent: [
            {
              serviceType: 'pension',
              urgency: 'long-term'
            }
          ]
        },
        behavioral: {
          communicationStyle: 'polite',
          taskComplexity: 'moderate'
        },
        consumerProfile: {
          spendSensitivity: 'value',
          brandMentions: ['Sony', 'Panasonic'],
          categoryPreference: 'electronics'
        },
        digitalProfile: {
          digitalExclusionScore: 4,
          aiAssistanceNeeded: ['shopping', 'translation']
        },
        confidenceScores: {
          demographics: 0.8,
          lifeEvents: 0.9,
          intent: 0.7
        }
      };

      const result = UserInsightsSchema.safeParse(insights);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(insights);
      }
    });

    it('should validate partial demographics', () => {
      const insights: UserInsights = {
        demographics: {
          ageRangeInferred: '80+',
          regionInferred: 'Osaka'
        }
      };

      const result = UserInsightsSchema.safeParse(insights);
      expect(result.success).toBe(true);
    });

    it('should validate partial life events', () => {
      const insights: UserInsights = {
        lifeEvents: {
          movingDetected: true,
          retirementDetected: true
        }
      };

      const result = UserInsightsSchema.safeParse(insights);
      expect(result.success).toBe(true);
    });

    it('should reject invalid age range', () => {
      const insights = {
        demographics: {
          ageRangeInferred: '50-59' // Invalid, not in enum
        }
      };

      const result = UserInsightsSchema.safeParse(insights);
      expect(result.success).toBe(false);
    });

    it('should reject invalid gender', () => {
      const insights = {
        demographics: {
          genderInferred: 'other' // Invalid, not in enum
        }
      };

      const result = UserInsightsSchema.safeParse(insights);
      expect(result.success).toBe(false);
    });

    it('should reject invalid household type', () => {
      const insights = {
        demographics: {
          householdTypeInferred: 'family' // Invalid, not in enum
        }
      };

      const result = UserInsightsSchema.safeParse(insights);
      expect(result.success).toBe(false);
    });

    it('should reject invalid urgency level', () => {
      const insights = {
        intentSignals: {
          commercialIntent: [
            {
              category: 'electronics',
              urgency: 'urgent' // Invalid, not in enum
            }
          ]
        }
      };

      const result = UserInsightsSchema.safeParse(insights);
      expect(result.success).toBe(false);
    });

    it('should reject invalid health intent type', () => {
      const insights = {
        intentSignals: {
          healthIntent: [
            {
              type: 'checkup', // Invalid, not in enum
              urgency: 'immediate'
            }
          ]
        }
      };

      const result = UserInsightsSchema.safeParse(insights);
      expect(result.success).toBe(false);
    });

    it('should reject invalid communication style', () => {
      const insights = {
        behavioral: {
          communicationStyle: 'verbose' // Invalid, not in enum
        }
      };

      const result = UserInsightsSchema.safeParse(insights);
      expect(result.success).toBe(false);
    });

    it('should reject invalid spend sensitivity', () => {
      const insights = {
        consumerProfile: {
          spendSensitivity: 'cheap' // Invalid, not in enum
        }
      };

      const result = UserInsightsSchema.safeParse(insights);
      expect(result.success).toBe(false);
    });

    it('should reject digital exclusion score below 1', () => {
      const insights = {
        digitalProfile: {
          digitalExclusionScore: 0
        }
      };

      const result = UserInsightsSchema.safeParse(insights);
      expect(result.success).toBe(false);
    });

    it('should reject digital exclusion score above 5', () => {
      const insights = {
        digitalProfile: {
          digitalExclusionScore: 6
        }
      };

      const result = UserInsightsSchema.safeParse(insights);
      expect(result.success).toBe(false);
    });

    it('should reject confidence score below 0', () => {
      const insights = {
        confidenceScores: {
          demographics: -0.1
        }
      };

      const result = UserInsightsSchema.safeParse(insights);
      expect(result.success).toBe(false);
    });

    it('should reject confidence score above 1', () => {
      const insights = {
        confidenceScores: {
          demographics: 1.1
        }
      };

      const result = UserInsightsSchema.safeParse(insights);
      expect(result.success).toBe(false);
    });

    it('should accept confidence scores at boundaries', () => {
      const insights: UserInsights = {
        confidenceScores: {
          demographics: 0,
          lifeEvents: 1,
          intent: 0.5
        }
      };

      const result = UserInsightsSchema.safeParse(insights);
      expect(result.success).toBe(true);
    });

    it('should accept digital exclusion score at boundaries', () => {
      const insights1: UserInsights = {
        digitalProfile: {
          digitalExclusionScore: 1
        }
      };

      const insights2: UserInsights = {
        digitalProfile: {
          digitalExclusionScore: 5
        }
      };

      expect(UserInsightsSchema.safeParse(insights1).success).toBe(true);
      expect(UserInsightsSchema.safeParse(insights2).success).toBe(true);
    });
  });

  describe('Privacy Validation', () => {
    it('should pass validation for clean insights', () => {
      const insights: UserInsights = {
        demographics: {
          ageRangeInferred: '70-79',
          regionInferred: 'Tokyo'
        },
        lifeEvents: {
          movingDetected: true
        }
      };

      const result = validateInsightsPrivacy(insights);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should pass validation for undefined insights', () => {
      const result = validateInsightsPrivacy(undefined);
      expect(result.valid).toBe(true);
    });

    it('should detect phone numbers', () => {
      const insights: UserInsights = {
        demographics: {
          regionInferred: 'Call 090-1234-5678'
        }
      };

      const result = validateInsightsPrivacy(insights);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Contains phone number');
    });

    it('should detect phone numbers without hyphens', () => {
      const insights: UserInsights = {
        demographics: {
          regionInferred: 'Contact 09012345678'
        }
      };

      const result = validateInsightsPrivacy(insights);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Contains phone number');
    });

    it('should detect email addresses', () => {
      const insights: UserInsights = {
        demographics: {
          regionInferred: 'Email user@example.com'
        }
      };

      const result = validateInsightsPrivacy(insights);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Contains email address');
    });

    it('should detect medical diagnosis - cancer', () => {
      const insights: UserInsights = {
        intentSignals: {
          healthIntent: [
            {
              type: 'appointment',
              urgency: 'immediate'
            }
          ]
        },
        behavioral: {
          taskComplexity: 'complex'
        }
      };

      // Simulate LLM accidentally including diagnosis in data
      const insightsWithDiagnosis = {
        ...insights,
        demographics: {
          regionInferred: 'Patient has cancer'
        }
      };

      const result = validateInsightsPrivacy(insightsWithDiagnosis);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Contains medical diagnosis');
    });

    it('should detect medical diagnosis - diabetes', () => {
      const insights: UserInsights = {
        demographics: {
          regionInferred: 'Managing diabetes'
        }
      };

      const result = validateInsightsPrivacy(insights);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Contains medical diagnosis');
    });

    it('should detect medical diagnosis - hypertension', () => {
      const insights: UserInsights = {
        demographics: {
          regionInferred: 'Has hypertension'
        }
      };

      const result = validateInsightsPrivacy(insights);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Contains medical diagnosis');
    });

    it('should detect medical diagnosis - disease', () => {
      const insights: UserInsights = {
        demographics: {
          regionInferred: 'Heart disease patient'
        }
      };

      const result = validateInsightsPrivacy(insights);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Contains medical diagnosis');
    });

    it('should detect medical diagnosis - diagnosis keyword', () => {
      const insights: UserInsights = {
        demographics: {
          regionInferred: 'Recent diagnosis'
        }
      };

      const result = validateInsightsPrivacy(insights);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Contains medical diagnosis');
    });

    it('should detect medical diagnosis - condition keyword', () => {
      const insights: UserInsights = {
        demographics: {
          regionInferred: 'Medical condition'
        }
      };

      const result = validateInsightsPrivacy(insights);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Contains medical diagnosis');
    });

    it('should allow health-related administrative signals', () => {
      const insights: UserInsights = {
        intentSignals: {
          healthIntent: [
            {
              type: 'appointment',
              urgency: 'immediate'
            }
          ]
        }
      };

      const result = validateInsightsPrivacy(insights);
      expect(result.valid).toBe(true);
    });
  });

  describe('Confidence Score Calculations', () => {
    it('should calculate average confidence from all scores', () => {
      const insights: UserInsights = {
        confidenceScores: {
          demographics: 0.8,
          lifeEvents: 0.6,
          intent: 0.9
        }
      };

      const confidence = calculateOverallConfidence(insights);
      expect(confidence).toBeCloseTo(0.7667, 4);
    });

    it('should calculate confidence with partial scores', () => {
      const insights: UserInsights = {
        confidenceScores: {
          demographics: 0.8,
          intent: 0.6
        }
      };

      const confidence = calculateOverallConfidence(insights);
      expect(confidence).toBeCloseTo(0.7, 4);
    });

    it('should return 0 for insights without confidence scores', () => {
      const insights: UserInsights = {
        demographics: {
          ageRangeInferred: '70-79'
        }
      };

      const confidence = calculateOverallConfidence(insights);
      expect(confidence).toBe(0);
    });

    it('should return 0 for undefined insights', () => {
      const confidence = calculateOverallConfidence(undefined);
      expect(confidence).toBe(0);
    });

    it('should return 0 for empty confidence scores', () => {
      const insights: UserInsights = {
        confidenceScores: {}
      };

      const confidence = calculateOverallConfidence(insights);
      expect(confidence).toBe(0);
    });

    it('should handle single confidence score', () => {
      const insights: UserInsights = {
        confidenceScores: {
          demographics: 0.75
        }
      };

      const confidence = calculateOverallConfidence(insights);
      expect(confidence).toBe(0.75);
    });

    it('should handle confidence scores of 0', () => {
      const insights: UserInsights = {
        confidenceScores: {
          demographics: 0,
          lifeEvents: 0,
          intent: 0
        }
      };

      const confidence = calculateOverallConfidence(insights);
      expect(confidence).toBe(0);
    });

    it('should handle confidence scores of 1', () => {
      const insights: UserInsights = {
        confidenceScores: {
          demographics: 1,
          lifeEvents: 1,
          intent: 1
        }
      };

      const confidence = calculateOverallConfidence(insights);
      expect(confidence).toBe(1);
    });
  });

  describe('createEmptyInsights', () => {
    it('should create empty insights object with all fields', () => {
      const insights = createEmptyInsights();

      expect(insights).toHaveProperty('demographics');
      expect(insights).toHaveProperty('lifeEvents');
      expect(insights).toHaveProperty('intentSignals');
      expect(insights).toHaveProperty('behavioral');
      expect(insights).toHaveProperty('consumerProfile');
      expect(insights).toHaveProperty('digitalProfile');
      expect(insights).toHaveProperty('confidenceScores');
    });

    it('should create insights with empty nested objects', () => {
      const insights = createEmptyInsights();
      expect(insights).toBeDefined();

      expect(insights!.demographics).toEqual({});
      expect(insights!.lifeEvents).toEqual({});
      expect(insights!.intentSignals).toEqual({});
      expect(insights!.behavioral).toEqual({});
      expect(insights!.consumerProfile).toEqual({});
      expect(insights!.digitalProfile).toEqual({});
      expect(insights!.confidenceScores).toEqual({});
    });

    it('should create valid insights according to schema', () => {
      const insights = createEmptyInsights();
      const result = UserInsightsSchema.safeParse(insights);

      expect(result.success).toBe(true);
    });
  });
});
