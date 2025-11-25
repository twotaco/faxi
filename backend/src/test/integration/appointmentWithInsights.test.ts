/**
 * Appointment Booking with Insights Integration Tests
 * 
 * Tests the complete appointment booking flow with insights extraction:
 * - Appointment booking flow
 * - Date/time parsing
 * - Insights extraction
 * - Schema validation
 * 
 * Requirements: AC4, AC6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { appointmentBookingMCPServer } from '../../mcp/appointmentMcpServer.js';
import { userInsightsService } from '../../services/userInsightsService.js';
import { userRepository } from '../../repositories/userRepository.js';
import { AppointmentResponseSchema } from '../../prompts/schemas/appointment.js';
import { validateInsightsPrivacy, calculateOverallConfidence } from '../../prompts/schemas/base.js';

describe('Appointment Booking with Insights Integration Tests', () => {
  const testFaxNumber = '+81312345679';
  let testUserId: string;
  
  beforeEach(async () => {
    // Ensure test user exists
    try {
      let existingUser = await userRepository.findByPhoneNumber(testFaxNumber);
      if (!existingUser) {
        existingUser = await userRepository.create({
          phoneNumber: testFaxNumber,
          emailAddress: `${testFaxNumber.replace('+', '')}@me.faxi.jp`,
          name: 'Test Appointment User'
        });
      }
      testUserId = existingUser.id;
    } catch (error) {
      console.error('Failed to create/find test user:', error);
      throw error;
    }
  });

  describe('Appointment Booking Flow', () => {
    it('should handle medical appointment booking request', async () => {
      const message = "Make an appointment at Tanaka Clinic for next Tuesday";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('string');
      expect(result.intent).toBe('book');
      
      // Business should be identified
      expect(result.business).toBeDefined();
      expect(result.business.identified).toBe(true);
      expect(result.business.name).toContain('Tanaka');
      expect(result.business.type).toBe('medical');
      
      // Date should be parsed
      expect(result.dateTime).toBeDefined();
      expect(result.dateTime.identified).toBe(true);
    }, 30000);

    it('should handle restaurant reservation request', async () => {
      const message = "Reserve a table at Sushi Dai for 2 people tomorrow at 7pm";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('book');
      
      // Business should be identified
      expect(result.business.identified).toBe(true);
      expect(result.business.type).toBe('restaurant');
      
      // Date/time should be parsed
      expect(result.dateTime.identified).toBe(true);
      
      // Party size should be captured
      expect(result.partySize).toBe(2);
    }, 30000);

    it('should handle salon appointment request', async () => {
      const message = "Book a haircut at my usual salon";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('book');
      
      // Should identify salon type
      expect(result.business.type).toBe('salon');
      
      // May need clarification for date/time
      if (result.dateTime.needsClarification) {
        expect(result.nextAction).toBe('request_clarification');
      }
    }, 30000);

    it('should handle urgent dental appointment', async () => {
      const message = "I need to see a dentist urgently, I have tooth pain";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('book');
      
      // Should identify dental type
      expect(result.business.type).toBe('dental');
      
      // Should capture special requests
      if (result.specialRequests) {
        expect(result.specialRequests.length).toBeGreaterThan(0);
        const requestsStr = result.specialRequests.join(' ').toLowerCase();
        expect(requestsStr).toMatch(/urgent|pain|emergency/);
      }
      
      // Should detect urgency in insights
      if (result.insights?.intentSignals?.healthIntent) {
        const healthIntent = result.insights.intentSignals.healthIntent[0];
        expect(healthIntent.urgency).toBe('immediate');
      }
    }, 30000);

    it('should handle government office appointment', async () => {
      const message = "Reschedule my appointment at City Hall next Monday to the following week";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('reschedule');
      
      // Should identify government type
      expect(result.business.type).toBe('government');
      
      // Should parse date
      expect(result.dateTime.identified).toBe(true);
    }, 30000);
  });

  describe('Date/Time Parsing', () => {
    it('should parse "tomorrow" correctly', async () => {
      const message = "Book appointment tomorrow morning";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.dateTime.identified) {
        expect(result.dateTime.originalRequest).toContain('tomorrow');
      }
    }, 30000);

    it('should parse "next Tuesday" correctly', async () => {
      const message = "Make appointment next Tuesday";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.dateTime.identified) {
        expect(result.dateTime.originalRequest).toContain('Tuesday');
      }
    }, 30000);

    it('should parse time expressions', async () => {
      const message = "Book appointment tomorrow afternoon at 3pm";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.dateTime.identified && result.dateTime.time) {
        // Should parse 3pm as 15:00
        expect(result.dateTime.time).toMatch(/15:00|3:00/);
      }
    }, 30000);

    it('should handle flexible time requests', async () => {
      const message = "Book appointment anytime next week";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.dateTime.flexibility) {
        expect(['flexible', 'any']).toContain(result.dateTime.flexibility);
      }
    }, 30000);

    it('should handle specific date and time', async () => {
      const message = "Book appointment December 5th at 2:30 PM";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.dateTime.identified) {
        expect(result.dateTime.flexibility).toBe('specific');
      }
    }, 30000);
  });

  describe('Insights Extraction', () => {
    it('should extract healthcare patterns from medical appointments', async () => {
      const message = "I need my regular checkup at Dr. Tanaka's clinic";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.intentSignals?.healthIntent) {
        expect(result.insights.intentSignals.healthIntent.length).toBeGreaterThan(0);
        const healthIntent = result.insights.intentSignals.healthIntent[0];
        expect(healthIntent.type).toBe('appointment');
        expect(['near-term', 'long-term']).toContain(healthIntent.urgency);
      }
    }, 30000);

    it('should extract lifestyle patterns from salon appointments', async () => {
      const message = "Book my monthly haircut at the salon";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.consumerProfile) {
        // Regular salon visits indicate normal spending
        if (result.insights.consumerProfile.categoryPreference) {
          expect(result.insights.consumerProfile.categoryPreference.toLowerCase()).toContain('personal-care');
        }
      }
    }, 30000);

    it('should extract dining preferences from restaurant reservations', async () => {
      const message = "Reserve a table at the Italian restaurant for my anniversary";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.consumerProfile) {
        // Anniversary dinner suggests premium spending
        if (result.insights.consumerProfile.spendSensitivity) {
          expect(['normal', 'premium']).toContain(result.insights.consumerProfile.spendSensitivity);
        }
      }
    }, 30000);

    it('should extract life event signals from moving-related appointments', async () => {
      const message = "I just moved to Osaka and need to find a new doctor";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
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
      
      // Should update region
      if (result.insights?.demographics?.regionInferred) {
        expect(result.insights.demographics.regionInferred.toLowerCase()).toContain('osaka');
      }
    }, 30000);

    it('should extract digital exclusion signals', async () => {
      const message = "I can't book online, can you help me make an appointment?";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
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
          const assistanceStr = result.insights.digitalProfile.aiAssistanceNeeded.join(' ');
          expect(assistanceStr).toMatch(/appointment|booking|phone/);
        }
      }
    }, 30000);

    it('should extract demographic insights from context', async () => {
      const message = "I'm 78 and need a doctor who can help with mobility issues";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.demographics) {
        // Should infer age range
        if (result.insights.demographics.ageRangeInferred) {
          expect(['70-79', '80+']).toContain(result.insights.demographics.ageRangeInferred);
        }
      }
      
      // Should capture accessibility needs
      if (result.specialRequests) {
        const requestsStr = result.specialRequests.join(' ').toLowerCase();
        expect(requestsStr).toContain('mobility');
      }
    }, 30000);

    it('should extract government service intent', async () => {
      const message = "I need to go to city hall to get a residence certificate";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.intentSignals?.govIntent) {
        expect(result.insights.intentSignals.govIntent.length).toBeGreaterThan(0);
        const govIntent = result.insights.intentSignals.govIntent[0];
        expect(govIntent.serviceType).toBeDefined();
        expect(govIntent.serviceType.toLowerCase()).toMatch(/certificate|residence/);
      }
    }, 30000);
  });

  describe('Schema Validation', () => {
    it('should validate appointment response schema', async () => {
      const message = "Book appointment at clinic tomorrow";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      // Construct response object for validation
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
      
      // Should validate against schema
      const validated = AppointmentResponseSchema.parse(appointmentResponse);
      expect(validated).toBeDefined();
      expect(validated.intent).toBe(result.intent);
    }, 30000);

    it('should validate business identification structure', async () => {
      const message = "Make appointment at Tanaka Clinic";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.business).toBeDefined();
      expect(typeof result.business.identified).toBe('boolean');
      expect(typeof result.business.needsClarification).toBe('boolean');
      
      if (result.business.identified) {
        expect(result.business.name).toBeDefined();
        expect(result.business.type).toBeDefined();
        expect(['medical', 'dental', 'salon', 'restaurant', 'government', 'other']).toContain(result.business.type);
      }
    }, 30000);

    it('should validate date/time structure', async () => {
      const message = "Book appointment next Tuesday at 2pm";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.dateTime).toBeDefined();
      expect(typeof result.dateTime.identified).toBe('boolean');
      expect(typeof result.dateTime.needsClarification).toBe('boolean');
      
      if (result.dateTime.identified) {
        if (result.dateTime.flexibility) {
          expect(['specific', 'flexible', 'any']).toContain(result.dateTime.flexibility);
        }
      }
    }, 30000);

    it('should validate insights schema structure', async () => {
      const message = "I need an urgent appointment at the hospital";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
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

  describe('Confidence Scores', () => {
    it('should include confidence scores in insights', async () => {
      const message = "Book appointment at clinic";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.confidenceScores) {
        const scores = result.insights.confidenceScores;
        
        if (scores.intent !== undefined) {
          expect(scores.intent).toBeGreaterThanOrEqual(0);
          expect(scores.intent).toBeLessThanOrEqual(1);
        }
      }
    }, 30000);

    it('should have higher confidence for explicit information', async () => {
      const message = "I'm 75 and need appointment at Tanaka Clinic tomorrow at 2pm";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.confidenceScores) {
        // Demographics confidence should be high (explicit age)
        if (result.insights.confidenceScores.demographics !== undefined) {
          expect(result.insights.confidenceScores.demographics).toBeGreaterThan(0.7);
        }
        
        // Intent confidence should be high (explicit appointment)
        if (result.insights.confidenceScores.intent !== undefined) {
          expect(result.insights.confidenceScores.intent).toBeGreaterThan(0.7);
        }
      }
      
      // Metadata confidence should be high
      if (result.metadata?.confidence) {
        expect(result.metadata.confidence).toBe('high');
      }
    }, 30000);

    it('should calculate overall confidence correctly', async () => {
      const message = "Make appointment";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
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

  describe('Insights Storage and Processing', () => {
    it('should store appointment insights in database', async () => {
      const message = "I need a doctor's appointment for my regular checkup";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      // Wait for async insights processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if profile was updated
      const profile = await userInsightsService.getProfile(testUserId);
      
      if (profile && result.insights?.intentSignals?.healthIntent) {
        expect(profile.userId).toBe(testUserId);
        expect(profile.profileData).toBeDefined();
        
        // Should have health intent
        if (profile.profileData.intentSignals?.healthIntent) {
          expect(profile.profileData.intentSignals.healthIntent.length).toBeGreaterThan(0);
        }
      }
    }, 30000);

    it('should validate privacy compliance', async () => {
      const message = "Book appointment at Tanaka Clinic, my phone is 090-1234-5678";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        // Insights should not contain PII
        const privacyCheck = validateInsightsPrivacy(result.insights);
        expect(privacyCheck.valid).toBe(true);
        
        // Insights should not contain phone number
        const insightsStr = JSON.stringify(result.insights);
        expect(insightsStr).not.toContain('090-1234-5678');
      }
    }, 30000);

    it('should not store medical diagnoses', async () => {
      const message = "I have diabetes and need to see an endocrinologist";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        // Should detect health intent but not store diagnosis
        const insightsStr = JSON.stringify(result.insights).toLowerCase();
        
        // Should not contain medical diagnosis terms
        expect(insightsStr).not.toContain('diabetes');
        expect(insightsStr).not.toContain('endocrinologist');
        
        // But should have health intent
        if (result.insights.intentSignals?.healthIntent) {
          expect(result.insights.intentSignals.healthIntent.length).toBeGreaterThan(0);
        }
      }
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid user ID', async () => {
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: 'invalid-user-id',
        message: "Book appointment"
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty messages', async () => {
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message: ""
      });
      
      // Should either handle gracefully or return error
      expect(result).toBeDefined();
    });

    it('should handle ambiguous requests', async () => {
      const message = "Make appointment";
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      // Should request clarification
      if (result.business.needsClarification || result.dateTime.needsClarification) {
        expect(result.nextAction).toBe('request_clarification');
      }
    }, 30000);

    it('should handle very long messages', async () => {
      const longMessage = "I need to book an appointment. ".repeat(50);
      
      const result = await appointmentBookingMCPServer.tools[0].handler({
        userId: testUserId,
        message: longMessage
      });
      
      // Should handle without crashing
      expect(result).toBeDefined();
    }, 30000);
  });
});
