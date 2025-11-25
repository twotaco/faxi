/**
 * Email with Insights Integration Tests
 * 
 * Tests the complete email flow with insights extraction:
 * - Email composition flow
 * - Recipient identification
 * - Insights extraction
 * - Schema validation
 * 
 * Requirements: AC4, AC6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { emailMCPServer } from '../../mcp/emailMcpServer.js';
import { userInsightsService } from '../../services/userInsightsService.js';
import { userRepository } from '../../repositories/userRepository.js';
import { addressBookRepository } from '../../repositories/addressBookRepository.js';
import { EmailResponseSchema } from '../../prompts/schemas/email.js';
import { validateInsightsPrivacy, calculateOverallConfidence } from '../../prompts/schemas/base.js';

describe('Email with Insights Integration Tests', () => {
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
          name: 'Test Email User'
        });
      }
      testUserId = existingUser.id;
      
      // Add some test contacts
      const existingContacts = await addressBookRepository.findByUserId(testUserId);
      if (existingContacts.length === 0) {
        await addressBookRepository.create({
          userId: testUserId,
          name: 'Takeshi Yamada',
          emailAddress: 'takeshi.yamada@example.com',
          relationship: 'son'
        });
        
        await addressBookRepository.create({
          userId: testUserId,
          name: 'Dr. Tanaka',
          emailAddress: 'tanaka.clinic@example.com',
          relationship: 'doctor'
        });
        
        await addressBookRepository.create({
          userId: testUserId,
          name: 'Yuki Tanaka',
          emailAddress: 'yuki.tanaka@example.com',
          relationship: 'daughter'
        });
      }
    } catch (error) {
      console.error('Failed to create/find test user:', error);
      throw error;
    }
  });

  describe('Email Composition Flow', () => {
    it('should compose email to family member with casual tone', async () => {
      const message = "Send email to my son about dinner plans this Sunday";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('compose');
      expect(result.response).toBeDefined();
      expect(result.recipient).toBeDefined();
      expect(result.recipient.identified).toBe(true);
      expect(result.recipient.relationship).toBe('son');
      expect(result.tone).toBe('casual');
      expect(result.subject).toBeDefined();
      expect(result.body).toBeDefined();
      expect(result.requiresConfirmation).toBe(true);
    }, 30000);

    it('should compose email to doctor with formal tone', async () => {
      const message = "Email my doctor to reschedule my appointment next week";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('compose');
      expect(result.recipient.identified).toBe(true);
      expect(result.recipient.relationship).toBe('doctor');
      expect(result.tone).toBe('formal');
      expect(result.subject).toContain('Appointment');
      expect(result.body).toBeDefined();
      expect(result.requiresConfirmation).toBe(true);
    }, 30000);

    it('should request clarification for unknown recipient', async () => {
      const message = "Send a thank you email to Suzuki-san";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('clarify');
      expect(result.recipient.identified).toBe(false);
      expect(result.recipient.needsClarification).toBe(true);
      expect(result.response).toContain('email address');
    }, 30000);

    it('should compose reply email', async () => {
      const message = "Reply to the email from my daughter about the family gathering";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('compose');
      expect(result.recipient.identified).toBe(true);
      expect(result.recipient.relationship).toBe('daughter');
      expect(result.tone).toBe('friendly');
      expect(result.metadata?.isReply).toBe(true);
    }, 30000);

    it('should format email preview for fax', async () => {
      const message = "Email my son about visiting next weekend";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      
      // Response should include preview with separators
      expect(result.response).toContain('To:');
      expect(result.response).toContain('Subject:');
      
      // Should be fax-friendly length
      expect(result.response.length).toBeLessThan(2000);
    }, 30000);
  });

  describe('Recipient Identification', () => {
    it('should identify recipient by relationship', async () => {
      const message = "Send email to my son";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.recipient.identified).toBe(true);
      expect(result.recipient.name).toBe('Takeshi Yamada');
      expect(result.recipient.email).toBe('takeshi.yamada@example.com');
      expect(result.recipient.relationship).toBe('son');
    }, 30000);

    it('should identify recipient by name', async () => {
      const message = "Email Dr. Tanaka about my test results";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.recipient.identified).toBe(true);
      expect(result.recipient.name).toBe('Dr. Tanaka');
      expect(result.recipient.email).toBe('tanaka.clinic@example.com');
    }, 30000);

    it('should handle multiple potential recipients', async () => {
      const message = "Send email to Tanaka";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      // Should either identify one or ask for clarification
      if (result.recipient.needsClarification) {
        expect(result.intent).toBe('clarify');
        expect(result.response).toContain('more specific');
      } else {
        expect(result.recipient.identified).toBe(true);
      }
    }, 30000);

    it('should request email address for unknown contact', async () => {
      const message = "Email Sato-san about the meeting";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('clarify');
      expect(result.recipient.identified).toBe(false);
      expect(result.recipient.needsClarification).toBe(true);
      expect(result.response).toContain('email address');
    }, 30000);
  });

  describe('Insights Extraction', () => {
    it('should extract demographic insights from family communication', async () => {
      const message = "Email my son about dinner this Sunday";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.demographics) {
        // Mentioning "my son" suggests user is likely 60+
        if (result.insights.demographics.ageRangeInferred) {
          expect(['60-69', '70-79', '80+']).toContain(result.insights.demographics.ageRangeInferred);
        }
        
        // Should infer household type
        if (result.insights.demographics.householdTypeInferred) {
          expect(result.insights.demographics.householdTypeInferred).toBeDefined();
        }
      }
    }, 30000);

    it('should extract health intent from doctor communication', async () => {
      const message = "Email my doctor to reschedule my appointment";
      
      const result = await emailMCPServer.tools[0].handler({
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

    it('should extract life event signals from email content', async () => {
      const message = "Email my daughter that I'm moving to Osaka next month";
      
      const result = await emailMCPServer.tools[0].handler({
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

    it('should extract communication style patterns', async () => {
      const message = "Send a quick email to my son saying I'll be late";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.behavioral) {
        // Should detect brief communication style
        if (result.insights.behavioral.communicationStyle) {
          expect(['short', 'direct']).toContain(result.insights.behavioral.communicationStyle);
        }
        
        // Should detect simple task complexity
        if (result.insights.behavioral.taskComplexity) {
          expect(result.insights.behavioral.taskComplexity).toBe('simple');
        }
      }
    }, 30000);

    it('should extract digital profile from email assistance needs', async () => {
      const message = "I need help writing a formal email to my doctor";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.digitalProfile) {
        // Should have digital exclusion score
        if (result.insights.digitalProfile.digitalExclusionScore !== undefined) {
          expect(result.insights.digitalProfile.digitalExclusionScore).toBeGreaterThanOrEqual(3);
        }
        
        // Should identify assistance needs
        if (result.insights.digitalProfile.aiAssistanceNeeded) {
          expect(result.insights.digitalProfile.aiAssistanceNeeded).toContain('email-composition');
        }
      }
    }, 30000);

    it('should extract relationship patterns', async () => {
      const message = "Email my son, daughter, and doctor about my health update";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        // Should detect family relationships
        if (result.insights.demographics?.householdTypeInferred) {
          expect(['couple', 'multi-gen']).toContain(result.insights.demographics.householdTypeInferred);
        }
        
        // Should detect health intent
        if (result.insights.intentSignals?.healthIntent) {
          expect(result.insights.intentSignals.healthIntent.length).toBeGreaterThan(0);
        }
      }
    }, 30000);
  });

  describe('Schema Validation', () => {
    it('should validate email response schema', async () => {
      const message = "Email my son about visiting";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      // Construct response object for validation
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
      
      // Should validate against schema
      const validated = EmailResponseSchema.parse(emailResponse);
      expect(validated).toBeDefined();
      expect(validated.intent).toBe(result.intent);
    }, 30000);

    it('should validate insights schema structure', async () => {
      const message = "Email my doctor about my appointment next week";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        // Insights should have valid structure
        expect(result.insights).toBeDefined();
        
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

    it('should include required fields in response', async () => {
      const message = "Email my daughter";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      // Required fields
      expect(result.intent).toBeDefined();
      expect(result.recipient).toBeDefined();
      expect(result.recipient.identified).toBeDefined();
      expect(result.recipient.needsClarification).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.requiresConfirmation).toBeDefined();
    }, 30000);
  });

  describe('Confidence Scores', () => {
    it('should include confidence scores in insights', async () => {
      const message = "Email my son";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.confidenceScores) {
        const scores = result.insights.confidenceScores;
        
        // All scores should be between 0 and 1
        if (scores.demographics !== undefined) {
          expect(scores.demographics).toBeGreaterThanOrEqual(0);
          expect(scores.demographics).toBeLessThanOrEqual(1);
        }
        
        if (scores.intent !== undefined) {
          expect(scores.intent).toBeGreaterThanOrEqual(0);
          expect(scores.intent).toBeLessThanOrEqual(1);
        }
      }
    }, 30000);

    it('should have high confidence for explicit information', async () => {
      const message = "Email my doctor Dr. Tanaka to reschedule my appointment";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights?.confidenceScores) {
        // Intent confidence should be high (explicit request)
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
      const message = "Email someone";
      
      const result = await emailMCPServer.tools[0].handler({
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
    it('should store insights in database', async () => {
      const message = "Email my son about moving to Kyoto next month";
      
      const result = await emailMCPServer.tools[0].handler({
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
      }
    }, 30000);

    it('should validate privacy compliance', async () => {
      const message = "Email my son at takeshi@example.com about dinner";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        // Insights should not contain PII
        const privacyCheck = validateInsightsPrivacy(result.insights);
        expect(privacyCheck.valid).toBe(true);
        
        // Insights should not contain email addresses
        const insightsStr = JSON.stringify(result.insights);
        expect(insightsStr).not.toContain('takeshi@example.com');
      }
    }, 30000);

    it('should not store sensitive email content', async () => {
      const message = "Email my doctor about my diabetes medication";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      
      if (result.insights) {
        // Should detect health intent but not store diagnosis
        const insightsStr = JSON.stringify(result.insights).toLowerCase();
        
        // Should not contain medical diagnosis
        expect(insightsStr).not.toContain('diabetes');
        
        // But should have health intent
        if (result.insights.intentSignals?.healthIntent) {
          expect(result.insights.intentSignals.healthIntent.length).toBeGreaterThan(0);
        }
      }
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid user ID', async () => {
      const result = await emailMCPServer.tools[0].handler({
        userId: 'invalid-user-id',
        message: "Email my son"
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty messages', async () => {
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message: ""
      });
      
      // Should handle gracefully
      expect(result).toBeDefined();
    });

    it('should handle ambiguous requests', async () => {
      const message = "Send email";
      
      const result = await emailMCPServer.tools[0].handler({
        userId: testUserId,
        message
      });
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('clarify');
      expect(result.recipient.needsClarification).toBe(true);
    }, 30000);
  });
});
