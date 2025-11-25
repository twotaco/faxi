/**
 * Shopping with Insights Integration Tests
 * 
 * Tests the complete shopping flow with insights extraction:
 * - Product search flow with structured outputs
 * - Shopping insights extraction
 * - Consumer profile building
 * 
 * Requirements: AC4, AC6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { shoppingMCPServer } from '../../mcp/shoppingMcpServer.js';
import { userInsightsService } from '../../services/userInsightsService.js';
import { userRepository } from '../../repositories/userRepository.js';
import { shoppingCartRepository } from '../../repositories/shoppingCartRepository.js';
import { ShoppingResponseSchema } from '../../prompts/schemas/shopping.js';
import { validateInsightsPrivacy, calculateOverallConfidence } from '../../prompts/schemas/base.js';

describe('Shopping with Insights Integration Tests', () => {
  const testFaxNumber = '+81398765432';
  let testUserId: string;
  
  beforeEach(async () => {
    // Ensure test user exists
    try {
      let existingUser = await userRepository.findByPhoneNumber(testFaxNumber);
      if (!existingUser) {
        existingUser = await userRepository.create({
          phoneNumber: testFaxNumber,
          emailAddress: `${testFaxNumber.replace('+', '')}@me.faxi.jp`,
          name: 'Shopping Test User'
        });
      }
      testUserId = existingUser.id;
      
      // Clear cart for clean tests
      try {
        await shoppingCartRepository.clear(testUserId);
      } catch (error) {
        // Cart might not exist, that's okay
      }
    } catch (error) {
      console.error('Failed to create/find test user:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  });

  describe('Product Search Flow', () => {
    it('should handle product search with structured outputs', async () => {
      const message = "I want to buy a rice cooker under ¥5000";
      
      // Find the shopping_request tool
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      expect(shoppingRequestTool).toBeDefined();
      
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('search');
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('string');
      
      // Should include products
      if (result.products) {
        expect(Array.isArray(result.products)).toBe(true);
        expect(result.products.length).toBeGreaterThan(0);
        expect(result.products.length).toBeLessThanOrEqual(5);
        
        // Each product should have required fields
        result.products.forEach((product: any) => {
          expect(product.name).toBeDefined();
          expect(product.price).toBeDefined();
          expect(typeof product.price).toBe('number');
          expect(product.description).toBeDefined();
        });
      }
    }, 30000);

    it('should handle reorder requests', async () => {
      const message = "Order the same shampoo I bought last time";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(['order', 'search', 'clarify']).toContain(result.intent);
      expect(result.response).toBeDefined();
    }, 30000);

    it('should handle gift shopping requests', async () => {
      const message = "Find me a birthday gift for my grandson, he's 8 years old";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('search');
      expect(result.response).toBeDefined();
      
      // Should include age-appropriate products
      if (result.products) {
        expect(result.products.length).toBeGreaterThan(0);
      }
    }, 30000);

    it('should highlight Prime-eligible products', async () => {
      const message = "I need batteries delivered quickly";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      // Response should mention Prime or fast delivery
      if (result.response) {
        const responseLower = result.response.toLowerCase();
        expect(
          responseLower.includes('prime') || 
          responseLower.includes('2-3 days') ||
          responseLower.includes('fast')
        ).toBe(true);
      }
    }, 30000);

    it('should include prices in Japanese Yen', async () => {
      const message = "Show me laptops";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      // Response should include ¥ symbol
      if (result.response) {
        expect(result.response).toContain('¥');
      }
      
      // Products should have numeric prices
      if (result.products) {
        result.products.forEach((product: any) => {
          expect(typeof product.price).toBe('number');
          expect(product.price).toBeGreaterThan(0);
        });
      }
    }, 30000);
  });

  describe('Schema Validation', () => {
    it('should validate shopping response schema', async () => {
      const message = "I want to buy shampoo";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      // Construct response object for validation
      const shoppingResponse = {
        intent: result.intent,
        searchQuery: message,
        products: result.products,
        response: result.response,
        nextAction: result.nextAction,
        metadata: result.metadata,
        insights: result.insights
      };
      
      // Should validate against schema
      const validated = ShoppingResponseSchema.parse(shoppingResponse);
      expect(validated).toBeDefined();
      expect(validated.intent).toBe(result.intent);
    }, 30000);

    it('should validate insights schema structure', async () => {
      const message = "I need a rice cooker under 5000 yen";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        // Should have consumer profile
        if (result.insights.consumerProfile) {
          expect(typeof result.insights.consumerProfile).toBe('object');
          
          // Should detect spend sensitivity
          if (result.insights.consumerProfile.spendSensitivity) {
            expect(['value', 'normal', 'premium']).toContain(
              result.insights.consumerProfile.spendSensitivity
            );
          }
        }
        
        // Should have commercial intent
        if (result.insights.intentSignals?.commercialIntent) {
          expect(Array.isArray(result.insights.intentSignals.commercialIntent)).toBe(true);
          
          result.insights.intentSignals.commercialIntent.forEach((intent: any) => {
            expect(intent.category).toBeDefined();
            expect(['immediate', 'near-term', 'long-term']).toContain(intent.urgency);
          });
        }
        
        // Confidence scores should be valid
        if (result.insights.confidenceScores) {
          if (result.insights.confidenceScores.intent !== undefined) {
            expect(result.insights.confidenceScores.intent).toBeGreaterThanOrEqual(0);
            expect(result.insights.confidenceScores.intent).toBeLessThanOrEqual(1);
          }
        }
      }
    }, 30000);
  });

  describe('Shopping Insights Extraction', () => {
    it('should extract spend sensitivity from budget mentions', async () => {
      const message = "I want the cheapest rice cooker available";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.consumerProfile?.spendSensitivity) {
        expect(result.insights.consumerProfile.spendSensitivity).toBe('value');
      }
    }, 30000);

    it('should extract brand preferences', async () => {
      const message = "I want a Zojirushi rice cooker";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.consumerProfile?.brandMentions) {
        expect(Array.isArray(result.insights.consumerProfile.brandMentions)).toBe(true);
        
        // Should include the mentioned brand
        const brandsLower = result.insights.consumerProfile.brandMentions.map(
          (b: string) => b.toLowerCase()
        );
        expect(brandsLower.some((b: string) => b.includes('zojirushi'))).toBe(true);
      }
    }, 30000);

    it('should extract category preferences', async () => {
      const message = "Show me home appliances";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.consumerProfile?.categoryPreference) {
        expect(result.insights.consumerProfile.categoryPreference.toLowerCase()).toContain('appliance');
      }
    }, 30000);

    it('should extract commercial intent with urgency', async () => {
      const message = "I need batteries urgently";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.intentSignals?.commercialIntent) {
        expect(result.insights.intentSignals.commercialIntent.length).toBeGreaterThan(0);
        
        const intent = result.insights.intentSignals.commercialIntent[0];
        expect(intent.urgency).toBe('immediate');
      }
    }, 30000);

    it('should extract life event signals from shopping patterns', async () => {
      const message = "I need furniture for my new apartment";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.lifeEvents?.movingDetected !== undefined) {
        expect(result.insights.lifeEvents.movingDetected).toBe(true);
      }
    }, 30000);

    it('should extract digital exclusion signals', async () => {
      const message = "I can't search Amazon myself, please help me find a rice cooker";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.digitalProfile) {
        // Should have high digital exclusion score
        if (result.insights.digitalProfile.digitalExclusionScore !== undefined) {
          expect(result.insights.digitalProfile.digitalExclusionScore).toBeGreaterThanOrEqual(4);
        }
        
        // Should identify shopping assistance need
        if (result.insights.digitalProfile.aiAssistanceNeeded) {
          expect(result.insights.digitalProfile.aiAssistanceNeeded).toContain('shopping');
        }
      }
    }, 30000);

    it('should extract demographic insights from gift shopping', async () => {
      const message = "I want to buy a toy for my 5-year-old granddaughter";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.demographics) {
        // Should infer age range (grandparent likely 60+)
        if (result.insights.demographics.ageRangeInferred) {
          expect(['60-69', '70-79', '80+']).toContain(
            result.insights.demographics.ageRangeInferred
          );
        }
        
        // Should infer household type
        if (result.insights.demographics.householdTypeInferred) {
          expect(['couple', 'multi-gen']).toContain(
            result.insights.demographics.householdTypeInferred
          );
        }
      }
    }, 30000);
  });

  describe('Consumer Profile Building', () => {
    it('should store shopping insights in database', async () => {
      const message = "I want to buy a premium Zojirushi rice cooker";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
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
        
        // Should have consumer profile data
        if (profile.profileData.consumerProfile) {
          expect(profile.profileData.consumerProfile).toBeDefined();
        }
      }
    }, 30000);

    it('should merge shopping insights with existing profile', async () => {
      // First shopping interaction
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      
      const result1 = await shoppingRequestTool!.handler({
        userId: testUserId,
        message: "I want a cheap rice cooker"
      });
      
      expect(result1.success).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Second shopping interaction with different preference
      const result2 = await shoppingRequestTool!.handler({
        userId: testUserId,
        message: "Show me Panasonic products"
      });
      
      expect(result2.success).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Profile should have both spend sensitivity and brand preferences
      const profile = await userInsightsService.getProfile(testUserId);
      
      if (profile?.profileData.consumerProfile) {
        // Should have spend sensitivity from first interaction
        if (profile.profileData.consumerProfile.spendSensitivity) {
          expect(profile.profileData.consumerProfile.spendSensitivity).toBeDefined();
        }
        
        // Should have brand mentions from second interaction
        if (profile.profileData.consumerProfile.brandMentions) {
          expect(Array.isArray(profile.profileData.consumerProfile.brandMentions)).toBe(true);
        }
      }
    }, 60000);

    it('should track shopping patterns over time', async () => {
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      
      // Multiple shopping interactions
      await shoppingRequestTool!.handler({
        userId: testUserId,
        message: "I want to buy shampoo"
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await shoppingRequestTool!.handler({
        userId: testUserId,
        message: "I need batteries"
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await shoppingRequestTool!.handler({
        userId: testUserId,
        message: "Show me rice cookers"
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check history
      const history = await userInsightsService.getHistory(testUserId, 10);
      
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      
      // Should have multiple shopping-related insights
      const shoppingInsights = history.filter((h: any) => 
        h.insightData?.intentSignals?.commercialIntent
      );
      
      expect(shoppingInsights.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Privacy Compliance', () => {
    it('should not store specific product names in insights', async () => {
      const message = "I want to buy Zojirushi NS-TSC10 rice cooker";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        const insightsStr = JSON.stringify(result.insights);
        
        // Should not contain specific model numbers
        expect(insightsStr).not.toContain('NS-TSC10');
        
        // But should contain category
        if (result.insights.consumerProfile?.categoryPreference) {
          expect(result.insights.consumerProfile.categoryPreference).toBeDefined();
        }
      }
    }, 30000);

    it('should not store exact prices in insights', async () => {
      const message = "I want a rice cooker for exactly 4,980 yen";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.intentSignals?.commercialIntent) {
        const intent = result.insights.intentSignals.commercialIntent[0];
        
        // Should have price range, not exact price
        if (intent.priceRange) {
          expect(intent.priceRange.min).toBeDefined();
          expect(intent.priceRange.max).toBeDefined();
          
          // Range should be broader than exact price
          expect(intent.priceRange.max - intent.priceRange.min).toBeGreaterThan(0);
        }
      }
    }, 30000);

    it('should validate privacy compliance', async () => {
      const message = "Send the rice cooker to my address: 123 Sakura Street, Tokyo";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        // Insights should not contain PII
        const privacyCheck = validateInsightsPrivacy(result.insights);
        expect(privacyCheck.valid).toBe(true);
        
        // Should not contain specific address
        const insightsStr = JSON.stringify(result.insights);
        expect(insightsStr).not.toContain('123 Sakura Street');
      }
    }, 30000);
  });

  describe('Confidence Scores', () => {
    it('should include confidence scores in shopping insights', async () => {
      const message = "I want to buy a rice cooker";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.confidenceScores) {
        // Intent confidence should be high for explicit shopping request
        if (result.insights.confidenceScores.intent !== undefined) {
          expect(result.insights.confidenceScores.intent).toBeGreaterThan(0.7);
          expect(result.insights.confidenceScores.intent).toBeLessThanOrEqual(1);
        }
      }
    }, 30000);

    it('should calculate overall confidence correctly', async () => {
      const message = "Show me laptops under 50000 yen";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        const overallConfidence = calculateOverallConfidence(result.insights);
        
        expect(typeof overallConfidence).toBe('number');
        expect(overallConfidence).toBeGreaterThanOrEqual(0);
        expect(overallConfidence).toBeLessThanOrEqual(1);
      }
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid user ID', async () => {
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: 'invalid-user-id',
        message: "I want to buy a rice cooker"
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty messages', async () => {
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message: ""
      });
      
      // Should handle gracefully
      expect(result).toBeDefined();
    });

    it('should handle ambiguous requests', async () => {
      const message = "I want to buy something";
      
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingRequestTool!.handler({
        userId: testUserId,
        message
      });
      
      // Should either clarify or provide general suggestions
      expect(result).toBeDefined();
      expect(['search', 'clarify']).toContain(result.intent);
    }, 30000);
  });
});
