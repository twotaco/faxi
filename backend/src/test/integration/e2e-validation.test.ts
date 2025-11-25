/**
 * End-to-End Validation Tests
 * 
 * Comprehensive validation of the LLM Prompt Architecture:
 * - All use cases with real examples
 * - Schema validation success rate (target 95%+)
 * - Insights extraction accuracy
 * - Privacy compliance
 * - Performance testing
 * 
 * Requirements: All ACs, NFR1, NFR2
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { aiChatMCPServer } from '../../mcp/aiChatMcpServer.js';
import { shoppingMCPServer } from '../../mcp/shoppingMcpServer.js';
import { emailMCPServer } from '../../mcp/emailMcpServer.js';
import { appointmentBookingMCPServer } from '../../mcp/appointmentMcpServer.js';
import { userRepository } from '../../repositories/userRepository.js';
import { userInsightsService } from '../../services/userInsightsService.js';
import { QAResponseSchema } from '../../prompts/schemas/qa.js';
import { ShoppingResponseSchema } from '../../prompts/schemas/shopping.js';
import { EmailResponseSchema } from '../../prompts/schemas/email.js';
import { AppointmentResponseSchema } from '../../prompts/schemas/appointment.js';
import { validateInsightsPrivacy } from '../../prompts/schemas/base.js';

describe('End-to-End Validation Tests', () => {
  const testFaxNumber = '+81399999999';
  let testUserId: string;
  
  beforeAll(async () => {
    // Create test user
    try {
      let existingUser = await userRepository.findByPhoneNumber(testFaxNumber);
      if (!existingUser) {
        existingUser = await userRepository.create({
          phoneNumber: testFaxNumber,
          emailAddress: `${testFaxNumber.replace('+', '')}@me.faxi.jp`,
          name: 'E2E Test User'
        });
      }
      testUserId = existingUser.id;
    } catch (error) {
      console.error('Failed to create test user:', error);
      throw error;
    }
  });

  describe('Schema Validation Success Rate (Target 95%+)', () => {
    it('should validate Q&A responses at 95%+ success rate', async () => {
      const testCases = [
        "What's the weather in Tokyo?",
        "How do I cook rice?",
        "Tell me about Japanese history",
        "I want to buy a laptop",
        "What time is it?",
        "How do I get to Shibuya?",
        "What's the capital of Japan?",
        "Tell me a joke",
        "How do I make sushi?",
        "What's the population of Tokyo?"
      ];
      
      let successCount = 0;
      const results = [];
      
      for (const message of testCases) {
        try {
          const result = await aiChatMCPServer.tools[0].handler({
            userId: testUserId,
            message
          });
          
          if (result.success && result.response) {
            const qaResponse = {
              response: result.response,
              requiresContinuation: false,
              metadata: { confidence: 'high' as const },
              insights: result.insights
            };
            
            QAResponseSchema.parse(qaResponse);
            successCount++;
            results.push({ message, success: true });
          } else {
            results.push({ message, success: false, error: 'No response' });
          }
        } catch (error) {
          results.push({ message, success: false, error: error.message });
        }
      }
      
      const successRate = (successCount / testCases.length) * 100;
      console.log(`Q&A Schema Validation Success Rate: ${successRate}%`);
      console.log('Results:', results);
      
      expect(successRate).toBeGreaterThanOrEqual(95);
    }, 120000);

    it('should validate Shopping responses at 95%+ success rate', async () => {
      const testCases = [
        "I want to buy a rice cooker",
        "Show me laptops under 50000 yen",
        "I need batteries",
        "Find me a birthday gift",
        "Order shampoo",
        "I want to buy furniture",
        "Show me kitchen appliances",
        "I need a new phone",
        "Buy the same thing I ordered last time",
        "I want premium headphones"
      ];
      
      let successCount = 0;
      const results = [];
      const shoppingRequestTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      
      for (const message of testCases) {
        try {
          const result = await shoppingRequestTool!.handler({
            userId: testUserId,
            message
          });
          
          if (result.success) {
            const shoppingResponse = {
              intent: result.intent,
              searchQuery: message,
              products: result.products,
              response: result.response,
              nextAction: result.nextAction,
              metadata: result.metadata,
              insights: result.insights
            };
            
            ShoppingResponseSchema.parse(shoppingResponse);
            successCount++;
            results.push({ message, success: true });
          } else {
            results.push({ message, success: false, error: 'No response' });
          }
        } catch (error) {
          results.push({ message, success: false, error: error.message });
        }
      }
      
      const successRate = (successCount / testCases.length) * 100;
      console.log(`Shopping Schema Validation Success Rate: ${successRate}%`);
      console.log('Results:', results);
      
      expect(successRate).toBeGreaterThanOrEqual(95);
    }, 120000);

    it('should validate Email responses at 95%+ success rate', async () => {
      const testCases = [
        "Email my son about dinner",
        "Send email to my doctor",
        "Email my daughter about visiting",
        "Reply to the email from my friend",
        "Send a thank you email",
        "Email about the meeting",
        "Send urgent email to my family",
        "Email my boss about vacation",
        "Send birthday wishes email",
        "Email about appointment"
      ];
      
      let successCount = 0;
      const results = [];
      
      for (const message of testCases) {
        try {
          const result = await emailMCPServer.tools[0].handler({
            userId: testUserId,
            message
          });
          
          if (result.success) {
            const emailResponse = {
              intent: result.intent,
              recipient: result.recipient,
              subject: result.subject,
              body: result.body,
              tone: result.tone,
              response: result.response,
              requiresConfirmation: result.requiresConfirmation,
              nextAction: result.nextAction,
              metadata: result.metadata,
              insights: result.insights
            };
            
            EmailResponseSchema.parse(emailResponse);
            successCount++;
            results.push({ message, success: true });
          } else {
            results.push({ message, success: false, error: 'No response' });
          }
        } catch (error) {
          results.push({ message, success: false, error: error.message });
        }
      }
      
      const successRate = (successCount / testCases.length) * 100;
      console.log(`Email Schema Validation Success Rate: ${successRate}%`);
      console.log('Results:', results);
      
      expect(successRate).toBeGreaterThanOrEqual(95);
    }, 120000);

    it('should validate Appointment responses at 95%+ success rate', async () => {
      const testCases = [
        "Book appointment at clinic tomorrow",
        "Reserve table for 2 people",
        "Make haircut appointment",
        "Schedule doctor visit next week",
        "Book dental appointment",
        "Reserve restaurant for dinner",
        "Make appointment at city hall",
        "Book salon appointment",
        "Schedule checkup",
        "Reserve table at sushi restaurant"
      ];
      
      let successCount = 0;
      const results = [];
      
      for (const message of testCases) {
        try {
          const result = await appointmentBookingMCPServer.tools[0].handler({
            userId: testUserId,
            message
          });
          
          if (result.success) {
            const appointmentResponse = {
              intent: result.intent,
              business: result.business,
              dateTime: result.dateTime,
              response: result.response,
              requiresConfirmation: result.requiresConfirmation,
              nextAction: result.nextAction,
              metadata: result.metadata,
              insights: result.insights
            };
            
            AppointmentResponseSchema.parse(appointmentResponse);
            successCount++;
            results.push({ message, success: true });
          } else {
            results.push({ message, success: false, error: 'No response' });
          }
        } catch (error) {
          results.push({ message, success: false, error: error.message });
        }
      }
      
      const successRate = (successCount / testCases.length) * 100;
      console.log(`Appointment Schema Validation Success Rate: ${successRate}%`);
      console.log('Results:', results);
      
      expect(successRate).toBeGreaterThanOrEqual(95);
    }, 120000);
  });

  describe('Insights Extraction Accuracy', () => {
    it('should extract demographic insights with 90%+ accuracy', async () => {
      const testCases = [
        { message: "I'm 75 years old and live in Tokyo", expected: { age: '70-79', region: 'tokyo' } },
        { message: "I'm 82 and live alone", expected: { age: '80+', household: 'single' } },
        { message: "I'm 68 and my wife and I live in Osaka", expected: { age: '60-69', household: 'couple', region: 'osaka' } },
        { message: "I live with my son and his family", expected: { household: 'multi-gen' } },
        { message: "I'm a 70-year-old woman in Kyoto", expected: { age: '70-79', gender: 'female', region: 'kyoto' } }
      ];
      
      let accurateCount = 0;
      const results = [];
      
      for (const testCase of testCases) {
        const result = await aiChatMCPServer.tools[0].handler({
          userId: testUserId,
          message: testCase.message
        });
        
        if (result.success && result.insights?.demographics) {
          const demographics = result.insights.demographics;
          let isAccurate = true;
          
          if (testCase.expected.age && demographics.ageRangeInferred !== testCase.expected.age) {
            isAccurate = false;
          }
          if (testCase.expected.household && demographics.householdTypeInferred !== testCase.expected.household) {
            isAccurate = false;
          }
          if (testCase.expected.region && !demographics.regionInferred?.toLowerCase().includes(testCase.expected.region)) {
            isAccurate = false;
          }
          if (testCase.expected.gender && demographics.genderInferred !== testCase.expected.gender) {
            isAccurate = false;
          }
          
          if (isAccurate) accurateCount++;
          results.push({ message: testCase.message, accurate: isAccurate, extracted: demographics });
        } else {
          results.push({ message: testCase.message, accurate: false, error: 'No insights' });
        }
      }
      
      const accuracy = (accurateCount / testCases.length) * 100;
      console.log(`Demographic Insights Accuracy: ${accuracy}%`);
      console.log('Results:', results);
      
      expect(accuracy).toBeGreaterThanOrEqual(90);
    }, 120000);

    it('should extract life event signals with 95%+ accuracy', async () => {
      const testCases = [
        { message: "I just moved to Osaka", expected: 'moving' },
        { message: "I'm taking care of my elderly mother now", expected: 'caregiving' },
        { message: "I was recently hospitalized", expected: 'hospitalization' },
        { message: "I retired last month", expected: 'retirement' },
        { message: "My husband passed away last year", expected: 'death' }
      ];
      
      let accurateCount = 0;
      const results = [];
      
      for (const testCase of testCases) {
        const result = await aiChatMCPServer.tools[0].handler({
          userId: testUserId,
          message: testCase.message
        });
        
        if (result.success && result.insights?.lifeEvents) {
          const lifeEvents = result.insights.lifeEvents;
          let detected = false;
          
          switch (testCase.expected) {
            case 'moving':
              detected = lifeEvents.movingDetected === true;
              break;
            case 'caregiving':
              detected = lifeEvents.newCaregiverDetected === true;
              break;
            case 'hospitalization':
              detected = lifeEvents.hospitalizationDetected === true;
              break;
            case 'retirement':
              detected = lifeEvents.retirementDetected === true;
              break;
            case 'death':
              detected = lifeEvents.deathInFamilyDetected === true;
              break;
          }
          
          if (detected) accurateCount++;
          results.push({ message: testCase.message, detected, expected: testCase.expected });
        } else {
          results.push({ message: testCase.message, detected: false, error: 'No insights' });
        }
      }
      
      const accuracy = (accurateCount / testCases.length) * 100;
      console.log(`Life Event Detection Accuracy: ${accuracy}%`);
      console.log('Results:', results);
      
      expect(accuracy).toBeGreaterThanOrEqual(95);
    }, 120000);

    it('should extract intent signals with 90%+ accuracy', async () => {
      const testCases = [
        { message: "I want to buy a laptop under 50000 yen", expected: 'commercial' },
        { message: "I need to see a doctor urgently", expected: 'health' },
        { message: "I need to get a residence certificate from city hall", expected: 'government' },
        { message: "Show me rice cookers", expected: 'commercial' },
        { message: "Book appointment at clinic", expected: 'health' }
      ];
      
      let accurateCount = 0;
      const results = [];
      
      for (const testCase of testCases) {
        let result;
        
        if (testCase.expected === 'commercial') {
          const shoppingTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
          result = await shoppingTool!.handler({ userId: testUserId, message: testCase.message });
        } else if (testCase.expected === 'health') {
          result = await appointmentBookingMCPServer.tools[0].handler({ userId: testUserId, message: testCase.message });
        } else {
          result = await aiChatMCPServer.tools[0].handler({ userId: testUserId, message: testCase.message });
        }
        
        if (result.success && result.insights?.intentSignals) {
          const signals = result.insights.intentSignals;
          let detected = false;
          
          switch (testCase.expected) {
            case 'commercial':
              detected = signals.commercialIntent && signals.commercialIntent.length > 0;
              break;
            case 'health':
              detected = signals.healthIntent && signals.healthIntent.length > 0;
              break;
            case 'government':
              detected = signals.govIntent && signals.govIntent.length > 0;
              break;
          }
          
          if (detected) accurateCount++;
          results.push({ message: testCase.message, detected, expected: testCase.expected });
        } else {
          results.push({ message: testCase.message, detected: false, error: 'No insights' });
        }
      }
      
      const accuracy = (accurateCount / testCases.length) * 100;
      console.log(`Intent Signal Accuracy: ${accuracy}%`);
      console.log('Results:', results);
      
      expect(accuracy).toBeGreaterThanOrEqual(90);
    }, 120000);
  });

  describe('Privacy Compliance (Zero PII Leaks)', () => {
    it('should not store email addresses in insights', async () => {
      const message = "My email is test@example.com and I want to buy a laptop";
      
      const shoppingTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingTool!.handler({ userId: testUserId, message });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        const privacyCheck = validateInsightsPrivacy(result.insights);
        expect(privacyCheck.valid).toBe(true);
        
        const insightsStr = JSON.stringify(result.insights);
        expect(insightsStr).not.toContain('test@example.com');
      }
    }, 30000);

    it('should not store phone numbers in insights', async () => {
      const message = "Call me at 090-1234-5678 about the appointment";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({ userId: testUserId, message });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        const privacyCheck = validateInsightsPrivacy(result.insights);
        expect(privacyCheck.valid).toBe(true);
        
        const insightsStr = JSON.stringify(result.insights);
        expect(insightsStr).not.toContain('090-1234-5678');
      }
    }, 30000);

    it('should not store addresses in insights', async () => {
      const message = "Send to 123 Sakura Street, Tokyo 100-0001";
      
      const shoppingTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingTool!.handler({ userId: testUserId, message });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        const privacyCheck = validateInsightsPrivacy(result.insights);
        expect(privacyCheck.valid).toBe(true);
        
        const insightsStr = JSON.stringify(result.insights);
        expect(insightsStr).not.toContain('123 Sakura Street');
      }
    }, 30000);

    it('should not store medical diagnoses in insights', async () => {
      const testCases = [
        "I have diabetes and need medication",
        "I was diagnosed with hypertension",
        "I have arthritis in my knees",
        "My doctor said I have high cholesterol"
      ];
      
      for (const message of testCases) {
        const result = await aiChatMCPServer.tools[0].handler({ userId: testUserId, message });
        
        expect(result.success).toBe(true);
        
        if (result.insights) {
          const privacyCheck = validateInsightsPrivacy(result.insights);
          expect(privacyCheck.valid).toBe(true);
          
          const insightsStr = JSON.stringify(result.insights).toLowerCase();
          
          // Should not contain diagnosis terms
          expect(insightsStr).not.toContain('diabetes');
          expect(insightsStr).not.toContain('hypertension');
          expect(insightsStr).not.toContain('arthritis');
          expect(insightsStr).not.toContain('cholesterol');
        }
      }
    }, 120000);

    it('should not store credit card numbers in insights', async () => {
      const message = "Use my card 4111-1111-1111-1111 to buy the laptop";
      
      const shoppingTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const result = await shoppingTool!.handler({ userId: testUserId, message });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        const privacyCheck = validateInsightsPrivacy(result.insights);
        expect(privacyCheck.valid).toBe(true);
        
        const insightsStr = JSON.stringify(result.insights);
        expect(insightsStr).not.toContain('4111');
      }
    }, 30000);
  });

  describe('Performance Testing (Target < 5 seconds)', () => {
    it('should respond to Q&A requests in under 5 seconds', async () => {
      const message = "What's the weather in Tokyo?";
      
      const startTime = Date.now();
      const result = await aiChatMCPServer.tools[0].handler({ userId: testUserId, message });
      const endTime = Date.now();
      
      const responseTime = (endTime - startTime) / 1000;
      console.log(`Q&A Response Time: ${responseTime}s`);
      
      expect(result.success).toBe(true);
      expect(responseTime).toBeLessThan(5);
    }, 10000);

    it('should respond to Shopping requests in under 5 seconds', async () => {
      const message = "I want to buy a rice cooker";
      
      const shoppingTool = shoppingMCPServer.tools.find(t => t.name === 'shopping_request');
      const startTime = Date.now();
      const result = await shoppingTool!.handler({ userId: testUserId, message });
      const endTime = Date.now();
      
      const responseTime = (endTime - startTime) / 1000;
      console.log(`Shopping Response Time: ${responseTime}s`);
      
      expect(result.success).toBe(true);
      expect(responseTime).toBeLessThan(5);
    }, 10000);

    it('should respond to Email requests in under 5 seconds', async () => {
      const message = "Email my son about dinner";
      
      const startTime = Date.now();
      const result = await emailMCPServer.tools[0].handler({ userId: testUserId, message });
      const endTime = Date.now();
      
      const responseTime = (endTime - startTime) / 1000;
      console.log(`Email Response Time: ${responseTime}s`);
      
      expect(result.success).toBe(true);
      expect(responseTime).toBeLessThan(5);
    }, 10000);

    it('should respond to Appointment requests in under 5 seconds', async () => {
      const message = "Book appointment at clinic tomorrow";
      
      const startTime = Date.now();
      const result = await appointmentBookingMCPServer.tools[0].handler({ userId: testUserId, message });
      const endTime = Date.now();
      
      const responseTime = (endTime - startTime) / 1000;
      console.log(`Appointment Response Time: ${responseTime}s`);
      
      expect(result.success).toBe(true);
      expect(responseTime).toBeLessThan(5);
    }, 10000);

    it('should have schema validation overhead < 100ms', async () => {
      const message = "What's the weather?";
      
      // Measure total time
      const startTotal = Date.now();
      const result = await aiChatMCPServer.tools[0].handler({ userId: testUserId, message });
      const endTotal = Date.now();
      
      expect(result.success).toBe(true);
      
      // Measure validation time
      const startValidation = Date.now();
      const qaResponse = {
        response: result.response,
        requiresContinuation: false,
        metadata: { confidence: 'high' as const },
        insights: result.insights
      };
      QAResponseSchema.parse(qaResponse);
      const endValidation = Date.now();
      
      const validationTime = endValidation - startValidation;
      console.log(`Schema Validation Overhead: ${validationTime}ms`);
      
      expect(validationTime).toBeLessThan(100);
    }, 10000);
  });

  describe('Profile Building Over Time (Target 80%+ completeness after 10 interactions)', () => {
    it('should build comprehensive profile after multiple interactions', async () => {
      // Simulate 10 interactions
      const interactions = [
        { handler: aiChatMCPServer.tools[0], message: "I'm 75 years old and live in Tokyo" },
        { handler: aiChatMCPServer.tools[0], message: "I want to buy a rice cooker under 5000 yen" },
        { handler: emailMCPServer.tools[0], message: "Email my son about dinner" },
        { handler: appointmentBookingMCPServer.tools[0], message: "Book appointment at clinic" },
        { handler: aiChatMCPServer.tools[0], message: "I just moved to Osaka" },
        { handler: aiChatMCPServer.tools[0], message: "I'm taking care of my elderly mother" },
        { handler: aiChatMCPServer.tools[0], message: "I can't use the internet well" },
        { handler: aiChatMCPServer.tools[0], message: "I need help with my pension" },
        { handler: aiChatMCPServer.tools[0], message: "I want to buy a gift for my grandson" },
        { handler: aiChatMCPServer.tools[0], message: "I need a doctor who speaks slowly" }
      ];
      
      for (const interaction of interactions) {
        await interaction.handler.handler({ userId: testUserId, message: interaction.message });
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Wait for insights processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check profile completeness
      const profile = await userInsightsService.getProfile(testUserId);
      
      expect(profile).toBeDefined();
      expect(profile!.profileData).toBeDefined();
      
      // Count populated fields
      let populatedFields = 0;
      let totalFields = 0;
      
      const data = profile!.profileData;
      
      // Demographics (5 fields)
      totalFields += 5;
      if (data.demographics?.ageRangeInferred) populatedFields++;
      if (data.demographics?.genderInferred) populatedFields++;
      if (data.demographics?.regionInferred) populatedFields++;
      if (data.demographics?.householdTypeInferred) populatedFields++;
      
      // Life Events (5 fields)
      totalFields += 5;
      if (data.lifeEvents?.movingDetected) populatedFields++;
      if (data.lifeEvents?.newCaregiverDetected) populatedFields++;
      if (data.lifeEvents?.deathInFamilyDetected) populatedFields++;
      if (data.lifeEvents?.hospitalizationDetected) populatedFields++;
      if (data.lifeEvents?.retirementDetected) populatedFields++;
      
      // Intent Signals (3 categories)
      totalFields += 3;
      if (data.intentSignals?.commercialIntent && data.intentSignals.commercialIntent.length > 0) populatedFields++;
      if (data.intentSignals?.healthIntent && data.intentSignals.healthIntent.length > 0) populatedFields++;
      if (data.intentSignals?.govIntent && data.intentSignals.govIntent.length > 0) populatedFields++;
      
      // Behavioral (2 fields)
      totalFields += 2;
      if (data.behavioral?.communicationStyle) populatedFields++;
      if (data.behavioral?.taskComplexity) populatedFields++;
      
      // Consumer Profile (3 fields)
      totalFields += 3;
      if (data.consumerProfile?.spendSensitivity) populatedFields++;
      if (data.consumerProfile?.brandMentions && data.consumerProfile.brandMentions.length > 0) populatedFields++;
      if (data.consumerProfile?.categoryPreference) populatedFields++;
      
      // Digital Profile (2 fields)
      totalFields += 2;
      if (data.digitalProfile?.digitalExclusionScore) populatedFields++;
      if (data.digitalProfile?.aiAssistanceNeeded && data.digitalProfile.aiAssistanceNeeded.length > 0) populatedFields++;
      
      const completeness = (populatedFields / totalFields) * 100;
      console.log(`Profile Completeness: ${completeness}% (${populatedFields}/${totalFields} fields)`);
      console.log('Profile Data:', JSON.stringify(data, null, 2));
      
      expect(completeness).toBeGreaterThanOrEqual(80);
    }, 180000);
  });

  describe('Error Rate (Target < 5% requiring manual intervention)', () => {
    it('should handle edge cases without manual intervention', async () => {
      const edgeCases = [
        { handler: aiChatMCPServer.tools[0], message: "" },
        { handler: aiChatMCPServer.tools[0], message: "a" },
        { handler: aiChatMCPServer.tools[0], message: "What? ".repeat(50) },
        { handler: aiChatMCPServer.tools[0], message: "🎉🎊🎈" },
        { handler: aiChatMCPServer.tools[0], message: "Hello" },
        { handler: aiChatMCPServer.tools[0], message: "I want" },
        { handler: aiChatMCPServer.tools[0], message: "Help me" },
        { handler: aiChatMCPServer.tools[0], message: "???" },
        { handler: aiChatMCPServer.tools[0], message: "Tell me everything about everything" },
        { handler: aiChatMCPServer.tools[0], message: "What's the meaning of life?" }
      ];
      
      let successCount = 0;
      const results = [];
      
      for (const testCase of edgeCases) {
        try {
          const result = await testCase.handler.handler({ userId: testUserId, message: testCase.message });
          
          // Success if we get any response without crashing
          if (result) {
            successCount++;
            results.push({ message: testCase.message, success: true });
          } else {
            results.push({ message: testCase.message, success: false, error: 'No result' });
          }
        } catch (error) {
          results.push({ message: testCase.message, success: false, error: error.message });
        }
      }
      
      const successRate = (successCount / edgeCases.length) * 100;
      const errorRate = 100 - successRate;
      console.log(`Error Rate: ${errorRate}%`);
      console.log('Results:', results);
      
      expect(errorRate).toBeLessThan(5);
    }, 120000);
  });

  describe('Fax-Friendly Formatting', () => {
    it('should keep responses under 2000 characters for fax', async () => {
      const testCases = [
        { handler: aiChatMCPServer.tools[0], message: "Tell me everything about Tokyo" },
        { handler: aiChatMCPServer.tools[0], message: "Explain Japanese history in detail" },
        { handler: aiChatMCPServer.tools[0], message: "How do I cook a full course meal?" }
      ];
      
      for (const testCase of testCases) {
        const result = await testCase.handler.handler({ userId: testUserId, message: testCase.message });
        
        expect(result.success).toBe(true);
        expect(result.response).toBeDefined();
        expect(result.response.length).toBeLessThan(2000);
      }
    }, 90000);

    it('should use simple, clear language', async () => {
      const message = "What's quantum physics?";
      
      const result = await aiChatMCPServer.tools[0].handler({ userId: testUserId, message });
      
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      
      // Should not contain overly technical jargon
      const response = result.response.toLowerCase();
      const technicalTerms = ['eigenvalue', 'hamiltonian', 'schrodinger', 'wavefunction'];
      const hasTechnicalTerms = technicalTerms.some(term => response.includes(term));
      
      // Prefer simple explanations
      expect(hasTechnicalTerms).toBe(false);
    }, 30000);
  });
});

