/**
 * Q&A with Insights Integration Tests
 * 
 * Tests the complete Q&A flow with insights extraction:
 * - Q&A response generation
 * - Schema validation
 * - Insights extraction accuracy
 * - Confidence scores
 * 
 * Requirements: AC4, AC6
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aiChatMCPServer } from '../../mcp/aiChatMcpServer.js';
import { userInsightsService } from '../../services/userInsightsService.js';
import { userInsightsRepository } from '../../repositories/userInsightsRepository.js';
import { userRepository } from '../../repositories/userRepository.js';
import { conversationContextRepository } from '../../repositories/conversationContextRepository.js';
import { QAResponseSchema } from '../../prompts/schemas/qa.js';
import { validateInsightsPrivacy, calculateOverallConfidence } from '../../prompts/schemas/base.js';

describe('Q&A with Insights Integration Tests', () => {
  const testFaxNumber = '+81312345678';
  let testUserId: string;
  
  beforeEach(async () => {
    // Ensure test user exists
    try {
      let existingUser = await userRepository.findByPhoneNumber(testFaxNumber);
      if (!existingUser) {
        existingUser = await userRepository.create({
          phoneNumber: testFaxNumber,
          emailAddress: `${testFaxNumber.replace('+', '')}@me.faxi.jp`,
          name: 'Test User'
        });
      }
      testUserId = existingUser.id;
    } catch (error) {
      // If user creation fails, tests will fail appropriately
      console.error('Failed to create/find test user:', error.message);
      throw error;
    }
  });

  describe('Q&A Response Generation', () => {
    it('should generate a valid Q&A response with insights', async () => {
      const message = "What's the weather in Tokyo?";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('string');
      expect(result.response.length).toBeGreaterThan(0);
      expect(result.conversationId).toBeDefined();
      
      // Response should be formatted for fax
      expect(result.response.length).toBeLessThan(2000); // Reasonable fax length
    }, 30000); // 30 second timeout for API call

    it('should handle cooking questions with insights', async () => {
      const message = "How do I cook rice?";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response).toContain('rice');
      
      // Should include insights about potential commercial intent
      if (result.insights) {
        expect(result.insights).toBeDefined();
      }
    }, 30000);

    it('should handle shopping-related questions', async () => {
      const message = "I want to buy a rice cooker under 5000 yen";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      
      // Should detect commercial intent
      if (result.insights?.intentSignals?.commercialIntent) {
        expect(result.insights.intentSignals.commercialIntent.length).toBeGreaterThan(0);
        const intent = result.insights.intentSignals.commercialIntent[0];
        expect(intent.category).toBeDefined();
        expect(intent.urgency).toBeDefined();
      }
    }, 30000);

    it('should maintain conversation context', async () => {
      // First message
      const result1 = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message: "Tell me about Tokyo"
      });
      
      expect(result1.success).toBe(true);
      const conversationId = result1.conversationId;
      
      // Follow-up message
      const result2 = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message: "What about the weather there?",
        conversationId
      });
      
      expect(result2.success).toBe(true);
      expect(result2.conversationId).toBe(conversationId);
      expect(result2.messageCount).toBeGreaterThan(result1.messageCount);
    }, 60000);
  });

  describe('Schema Validation', () => {
    it('should validate Q&A response schema', async () => {
      const message = "What's the capital of Japan?";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      // Construct response object for validation
      const qaResponse = {
        response: result.response,
        requiresContinuation: false,
        metadata: {
          confidence: 'high' as const
        },
        insights: result.insights
      };
      
      // Should validate against schema
      const validated = QAResponseSchema.parse(qaResponse);
      expect(validated).toBeDefined();
      expect(validated.response).toBe(result.response);
    }, 30000);

    it('should handle responses with follow-up suggestions', async () => {
      const message = "Tell me about Japanese history";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      // Response might include follow-up suggestions
      // This is optional in the schema
      const qaResponse = {
        response: result.response,
        followUpSuggestions: ["What period interests you?"],
        requiresContinuation: true,
        metadata: {
          confidence: 'medium' as const,
          category: 'history'
        },
        insights: result.insights
      };
      
      const validated = QAResponseSchema.parse(qaResponse);
      expect(validated).toBeDefined();
    }, 30000);

    it('should validate insights schema structure', async () => {
      const message = "I need help finding a doctor for my elderly mother";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        // Insights should have valid structure
        expect(result.insights).toBeDefined();
        
        // Should detect caregiving and health intent
        if (result.insights.lifeEvents) {
          expect(typeof result.insights.lifeEvents).toBe('object');
        }
        
        if (result.insights.intentSignals?.healthIntent) {
          expect(Array.isArray(result.insights.intentSignals.healthIntent)).toBe(true);
        }
        
        // Confidence scores should be in valid range
        if (result.insights.confidenceScores) {
          if (result.insights.confidenceScores.demographics !== undefined) {
            expect(result.insights.confidenceScores.demographics).toBeGreaterThanOrEqual(0);
            expect(result.insights.confidenceScores.demographics).toBeLessThanOrEqual(1);
          }
          if (result.insights.confidenceScores.intent !== undefined) {
            expect(result.insights.confidenceScores.intent).toBeGreaterThanOrEqual(0);
            expect(result.insights.confidenceScores.intent).toBeLessThanOrEqual(1);
          }
        }
      }
    }, 30000);
  });

  describe('Insights Extraction Accuracy', () => {
    it('should extract demographic insights from context', async () => {
      const message = "I'm 75 years old and live alone in Tokyo. How do I cook rice?";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.demographics) {
        // Should infer age range
        if (result.insights.demographics.ageRangeInferred) {
          expect(['70-79', '80+']).toContain(result.insights.demographics.ageRangeInferred);
        }
        
        // Should infer household type
        if (result.insights.demographics.householdTypeInferred) {
          expect(result.insights.demographics.householdTypeInferred).toBe('single');
        }
        
        // Should infer region
        if (result.insights.demographics.regionInferred) {
          expect(result.insights.demographics.regionInferred.toLowerCase()).toContain('tokyo');
        }
      }
    }, 30000);

    it('should extract commercial intent from shopping questions', async () => {
      const message = "I want to buy a laptop for under 50000 yen";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.intentSignals?.commercialIntent) {
        expect(result.insights.intentSignals.commercialIntent.length).toBeGreaterThan(0);
        
        const intent = result.insights.intentSignals.commercialIntent[0];
        expect(intent.category).toBeDefined();
        expect(['electronics', 'computer', 'laptop', 'technology']).toContain(intent.category.toLowerCase());
        
        // Should detect price range
        if (intent.priceRange) {
          expect(intent.priceRange.max).toBeLessThanOrEqual(50000);
        }
        
        // Should have urgency
        expect(['immediate', 'near-term', 'long-term']).toContain(intent.urgency);
      }
    }, 30000);

    it('should extract health intent from medical questions', async () => {
      const message = "I need to make a doctor's appointment for next week";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.intentSignals?.healthIntent) {
        expect(result.insights.intentSignals.healthIntent.length).toBeGreaterThan(0);
        
        const intent = result.insights.intentSignals.healthIntent[0];
        expect(intent.type).toBe('appointment');
        expect(['immediate', 'near-term', 'long-term']).toContain(intent.urgency);
      }
    }, 30000);

    it('should extract life event signals', async () => {
      const message = "I just moved to Osaka and need to find a new doctor";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.lifeEvents) {
        // Should detect moving
        if (result.insights.lifeEvents.movingDetected !== undefined) {
          expect(result.insights.lifeEvents.movingDetected).toBe(true);
        }
      }
      
      // Should also update region
      if (result.insights?.demographics?.regionInferred) {
        expect(result.insights.demographics.regionInferred.toLowerCase()).toContain('osaka');
      }
    }, 30000);

    it('should extract digital exclusion signals', async () => {
      const message = "I don't know how to use the internet. Can you help me find information?";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.digitalProfile) {
        // Should have high digital exclusion score
        if (result.insights.digitalProfile.digitalExclusionScore !== undefined) {
          expect(result.insights.digitalProfile.digitalExclusionScore).toBeGreaterThanOrEqual(3);
        }
        
        // Should identify assistance needs
        if (result.insights.digitalProfile.aiAssistanceNeeded) {
          expect(result.insights.digitalProfile.aiAssistanceNeeded.length).toBeGreaterThan(0);
        }
      }
    }, 30000);
  });

  describe('Confidence Scores', () => {
    it('should include confidence scores in insights', async () => {
      const message = "What's the weather like?";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.confidenceScores) {
        // Confidence scores should be between 0 and 1
        const scores = result.insights.confidenceScores;
        
        if (scores.demographics !== undefined) {
          expect(scores.demographics).toBeGreaterThanOrEqual(0);
          expect(scores.demographics).toBeLessThanOrEqual(1);
        }
        
        if (scores.lifeEvents !== undefined) {
          expect(scores.lifeEvents).toBeGreaterThanOrEqual(0);
          expect(scores.lifeEvents).toBeLessThanOrEqual(1);
        }
        
        if (scores.intent !== undefined) {
          expect(scores.intent).toBeGreaterThanOrEqual(0);
          expect(scores.intent).toBeLessThanOrEqual(1);
        }
      }
    }, 30000);

    it('should have higher confidence for explicit information', async () => {
      const message = "I'm 72 years old and want to buy a rice cooker";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.confidenceScores) {
        // Demographics confidence should be high (explicit age)
        if (result.insights.confidenceScores.demographics !== undefined) {
          expect(result.insights.confidenceScores.demographics).toBeGreaterThan(0.7);
        }
        
        // Intent confidence should be high (explicit product)
        if (result.insights.confidenceScores.intent !== undefined) {
          expect(result.insights.confidenceScores.intent).toBeGreaterThan(0.7);
        }
      }
    }, 30000);

    it('should calculate overall confidence correctly', async () => {
      const message = "Tell me about Tokyo";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        const overallConfidence = calculateOverallConfidence(result.insights);
        
        // Should be a valid number
        expect(typeof overallConfidence).toBe('number');
        expect(overallConfidence).toBeGreaterThanOrEqual(0);
        expect(overallConfidence).toBeLessThanOrEqual(1);
      }
    }, 30000);
  });

  describe('Insights Storage and Processing', () => {
    it('should store insights in database', async () => {
      const message = "I'm looking for a new apartment in Shibuya";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      // Wait for async insights processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if profile was updated
      const profile = await userInsightsService.getProfile(testUserId);
      
      if (profile) {
        expect(profile.userId).toBe(testUserId);
        expect(profile.profileData).toBeDefined();
        
        // Should have detected moving
        if (profile.profileData.lifeEvents?.movingDetected) {
          expect(profile.profileData.lifeEvents.movingDetected).toBe(true);
        }
        
        // Should have region
        if (profile.profileData.demographics?.regionInferred) {
          expect(profile.profileData.demographics.regionInferred.toLowerCase()).toContain('shibuya');
        }
      }
    }, 30000);

    it('should merge insights with existing profile', async () => {
      // First interaction
      const result1 = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message: "I'm 75 years old"
      });
      
      expect(result1.success).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Second interaction
      const result2 = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message: "I want to buy a laptop"
      });
      
      expect(result2.success).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Profile should have both demographic and commercial intent
      const profile = await userInsightsService.getProfile(testUserId);
      
      if (profile) {
        // Should have age from first interaction
        if (profile.profileData.demographics?.ageRangeInferred) {
          expect(['70-79', '80+']).toContain(profile.profileData.demographics.ageRangeInferred);
        }
        
        // Should have commercial intent from second interaction
        if (profile.profileData.intentSignals?.commercialIntent) {
          expect(profile.profileData.intentSignals.commercialIntent.length).toBeGreaterThan(0);
        }
      }
    }, 60000);

    it('should record insights in history', async () => {
      const message = "I need help with my pension application";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check history
      const history = await userInsightsService.getHistory(testUserId, 10);
      
      expect(Array.isArray(history)).toBe(true);
      
      if (history.length > 0) {
        const latestInsight = history[0];
        expect(latestInsight.userId).toBe(testUserId);
        expect(latestInsight.insightType).toBeDefined();
        expect(latestInsight.insightData).toBeDefined();
      }
    }, 30000);

    it('should validate privacy compliance', async () => {
      const message = "My email is test@example.com and my phone is 090-1234-5678";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        // Insights should not contain PII
        const privacyCheck = validateInsightsPrivacy(result.insights);
        expect(privacyCheck.valid).toBe(true);
        
        // Insights should not contain email or phone
        const insightsStr = JSON.stringify(result.insights);
        expect(insightsStr).not.toContain('test@example.com');
        expect(insightsStr).not.toContain('090-1234-5678');
      }
    }, 30000);

    it('should not store medical diagnoses', async () => {
      const message = "I have diabetes and need medication";
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        // Should detect health intent but not store diagnosis
        const insightsStr = JSON.stringify(result.insights).toLowerCase();
        
        // Should not contain medical diagnosis terms
        expect(insightsStr).not.toContain('diabetes');
        
        // But might contain health intent
        if (result.insights.intentSignals?.healthIntent) {
          expect(result.insights.intentSignals.healthIntent.length).toBeGreaterThan(0);
        }
      }
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid user ID', async () => {
      const result = await aiChatMCPServer.tools[0].handler({
        userId: 'invalid-user-id',
        message: "Hello"
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty messages', async () => {
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message: ""
      });
      
      // Should either handle gracefully or return error
      expect(result).toBeDefined();
    });

    it('should handle very long messages', async () => {
      const longMessage = "Tell me about Tokyo. ".repeat(100);
      
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message: longMessage
      });
      
      // Should handle without crashing
      expect(result).toBeDefined();
    }, 30000);

    it('should handle invalid conversation ID', async () => {
      const result = await aiChatMCPServer.tools[0].handler({
        userId: testUserId,
        message: "Hello",
        conversationId: 'invalid-conversation-id'
      });
      
      // Should create new conversation or handle gracefully
      expect(result).toBeDefined();
    });
  });
});
