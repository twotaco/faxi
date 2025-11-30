import { userInsightsRepository, UserInsightsProfile } from '../repositories/userInsightsRepository.js';
import { UserInsights, validateInsightsPrivacy, calculateOverallConfidence } from '../prompts/schemas/base.js';
import { loggingService } from './loggingService.js';

/**
 * User Insights Service
 * 
 * Business logic for collecting, merging, and managing user insights.
 * Builds comprehensive profiles from fax interactions for data intelligence products.
 */
class UserInsightsService {
  /**
   * Process insights from an LLM response
   * Validates, merges with existing profile, and stores
   */
  async processInsights(
    userId: string,
    newInsights: UserInsights | undefined,
    faxJobId: string
  ): Promise<void> {
    if (!newInsights) {
      return; // No insights to process
    }

    try {
      // 1. Validate privacy
      const privacyCheck = validateInsightsPrivacy(newInsights);
      if (!privacyCheck.valid) {
        loggingService.warn('Privacy violation in insights', {
          userId,
          faxJobId,
          reason: privacyCheck.reason
        });
        return; // Don't store insights with privacy violations
      }

      // 2. Get existing profile
      const existingProfile = await userInsightsRepository.findByUserId(userId);
      const existingData = existingProfile?.profileData || {};

      // 3. Merge insights
      const mergedProfile = this.mergeInsights(existingData, newInsights);

      // 4. Store updated profile
      await userInsightsRepository.upsert(userId, mergedProfile);

      // 5. Record in history for audit trail
      const overallConfidence = calculateOverallConfidence(newInsights);
      await this.recordInsightChanges(userId, faxJobId, existingData, newInsights, overallConfidence);

      loggingService.info('Insights processed successfully', {
        userId,
        faxJobId,
        confidence: overallConfidence
      });
    } catch (error) {
      loggingService.error('Failed to process insights', error as Error, {
        userId,
        faxJobId
      });
      // Don't throw - insights processing shouldn't break the main flow
    }
  }

  /**
   * Merge new insights with existing profile
   * Uses confidence scores to weight updates
   */
  private mergeInsights(existing: any, newInsights: UserInsights): any {
    const merged = { ...existing };

    // Guard against undefined newInsights
    if (!newInsights) {
      return merged;
    }

    // Merge demographics
    if (newInsights.demographics) {
      merged.demographics = merged.demographics || {};
      
      if (newInsights.demographics.ageRangeInferred) {
        merged.demographics.ageRangeInferred = newInsights.demographics.ageRangeInferred;
      }
      if (newInsights.demographics.genderInferred) {
        merged.demographics.genderInferred = newInsights.demographics.genderInferred;
      }
      if (newInsights.demographics.regionInferred) {
        merged.demographics.regionInferred = newInsights.demographics.regionInferred;
      }
      if (newInsights.demographics.householdTypeInferred) {
        merged.demographics.householdTypeInferred = newInsights.demographics.householdTypeInferred;
      }
    }

    // Merge life events (accumulate, don't overwrite)
    if (newInsights.lifeEvents) {
      merged.lifeEvents = merged.lifeEvents || {};
      
      if (newInsights.lifeEvents.movingDetected) {
        merged.lifeEvents.movingDetected = true;
        merged.lifeEvents.movingDetectedAt = new Date().toISOString();
      }
      if (newInsights.lifeEvents.newCaregiverDetected) {
        merged.lifeEvents.newCaregiverDetected = true;
        merged.lifeEvents.newCaregiverDetectedAt = new Date().toISOString();
      }
      if (newInsights.lifeEvents.deathInFamilyDetected) {
        merged.lifeEvents.deathInFamilyDetected = true;
        merged.lifeEvents.deathInFamilyDetectedAt = new Date().toISOString();
      }
      if (newInsights.lifeEvents.hospitalizationDetected) {
        merged.lifeEvents.hospitalizationDetected = true;
        merged.lifeEvents.hospitalizationDetectedAt = new Date().toISOString();
      }
      if (newInsights.lifeEvents.retirementDetected) {
        merged.lifeEvents.retirementDetected = true;
        merged.lifeEvents.retirementDetectedAt = new Date().toISOString();
      }
    }

    // Merge intent signals (keep recent history)
    if (newInsights.intentSignals) {
      merged.intentSignals = merged.intentSignals || {};
      
      if (newInsights.intentSignals.commercialIntent) {
        merged.intentSignals.commercialIntent = merged.intentSignals.commercialIntent || [];
        merged.intentSignals.commercialIntent.push(...newInsights.intentSignals.commercialIntent.map(intent => ({
          ...intent,
          detectedAt: new Date().toISOString()
        })));
        // Keep only last 20 intents
        merged.intentSignals.commercialIntent = merged.intentSignals.commercialIntent.slice(-20);
      }
      
      if (newInsights.intentSignals.healthIntent) {
        merged.intentSignals.healthIntent = merged.intentSignals.healthIntent || [];
        merged.intentSignals.healthIntent.push(...newInsights.intentSignals.healthIntent.map(intent => ({
          ...intent,
          detectedAt: new Date().toISOString()
        })));
        merged.intentSignals.healthIntent = merged.intentSignals.healthIntent.slice(-20);
      }
      
      if (newInsights.intentSignals.govIntent) {
        merged.intentSignals.govIntent = merged.intentSignals.govIntent || [];
        merged.intentSignals.govIntent.push(...newInsights.intentSignals.govIntent.map(intent => ({
          ...intent,
          detectedAt: new Date().toISOString()
        })));
        merged.intentSignals.govIntent = merged.intentSignals.govIntent.slice(-20);
      }
    }

    // Merge behavioral patterns (update with latest)
    if (newInsights.behavioral) {
      merged.behavioral = merged.behavioral || {};
      
      if (newInsights.behavioral.communicationStyle) {
        merged.behavioral.communicationStyle = newInsights.behavioral.communicationStyle;
      }
      if (newInsights.behavioral.taskComplexity) {
        merged.behavioral.taskComplexity = newInsights.behavioral.taskComplexity;
      }
    }

    // Merge consumer profile
    if (newInsights.consumerProfile) {
      merged.consumerProfile = merged.consumerProfile || {};
      
      if (newInsights.consumerProfile.spendSensitivity) {
        merged.consumerProfile.spendSensitivity = newInsights.consumerProfile.spendSensitivity;
      }
      if (newInsights.consumerProfile.brandMentions) {
        merged.consumerProfile.brandMentions = merged.consumerProfile.brandMentions || [];
        merged.consumerProfile.brandMentions.push(...newInsights.consumerProfile.brandMentions);
        // Deduplicate
        merged.consumerProfile.brandMentions = [...new Set(merged.consumerProfile.brandMentions)];
      }
      if (newInsights.consumerProfile.categoryPreference) {
        merged.consumerProfile.categoryPreference = newInsights.consumerProfile.categoryPreference;
      }
    }

    // Merge digital profile
    if (newInsights.digitalProfile) {
      merged.digitalProfile = merged.digitalProfile || {};
      
      if (newInsights.digitalProfile.digitalExclusionScore) {
        // Average with existing score if present
        if (merged.digitalProfile.digitalExclusionScore) {
          merged.digitalProfile.digitalExclusionScore = Math.round(
            (merged.digitalProfile.digitalExclusionScore + newInsights.digitalProfile.digitalExclusionScore) / 2
          );
        } else {
          merged.digitalProfile.digitalExclusionScore = newInsights.digitalProfile.digitalExclusionScore;
        }
      }
      if (newInsights.digitalProfile.aiAssistanceNeeded) {
        merged.digitalProfile.aiAssistanceNeeded = merged.digitalProfile.aiAssistanceNeeded || [];
        merged.digitalProfile.aiAssistanceNeeded.push(...newInsights.digitalProfile.aiAssistanceNeeded);
        merged.digitalProfile.aiAssistanceNeeded = [...new Set(merged.digitalProfile.aiAssistanceNeeded)];
      }
    }

    // Update confidence scores (keep highest)
    if (newInsights.confidenceScores) {
      merged.confidenceScores = merged.confidenceScores || {};
      
      if (newInsights.confidenceScores.demographics !== undefined) {
        merged.confidenceScores.demographics = Math.max(
          merged.confidenceScores.demographics || 0,
          newInsights.confidenceScores.demographics
        );
      }
      if (newInsights.confidenceScores.lifeEvents !== undefined) {
        merged.confidenceScores.lifeEvents = Math.max(
          merged.confidenceScores.lifeEvents || 0,
          newInsights.confidenceScores.lifeEvents
        );
      }
      if (newInsights.confidenceScores.intent !== undefined) {
        merged.confidenceScores.intent = Math.max(
          merged.confidenceScores.intent || 0,
          newInsights.confidenceScores.intent
        );
      }
    }

    return merged;
  }

  /**
   * Record insight changes in history
   */
  private async recordInsightChanges(
    userId: string,
    faxJobId: string,
    existing: any,
    newInsights: UserInsights,
    confidence: number
  ): Promise<void> {
    // Guard against undefined newInsights
    if (!newInsights) {
      return;
    }

    // Record demographic changes
    if (newInsights.demographics) {
      await userInsightsRepository.recordInsight(
        userId,
        faxJobId,
        'demographic',
        'update',
        newInsights.demographics,
        newInsights.confidenceScores?.demographics,
        existing.demographics,
        newInsights.demographics
      );
    }

    // Record life events
    if (newInsights.lifeEvents) {
      const detectedEvents = Object.entries(newInsights.lifeEvents)
        .filter(([_, value]) => value === true)
        .map(([key]) => key);
      
      for (const event of detectedEvents) {
        await userInsightsRepository.recordInsight(
          userId,
          faxJobId,
          'life_event',
          event,
          { event, detectedAt: new Date().toISOString() },
          newInsights.confidenceScores?.lifeEvents
        );
      }
    }

    // Record intent signals
    if (newInsights.intentSignals) {
      if (newInsights.intentSignals.commercialIntent && newInsights.intentSignals.commercialIntent.length > 0) {
        await userInsightsRepository.recordInsight(
          userId,
          faxJobId,
          'intent',
          'commercial',
          newInsights.intentSignals.commercialIntent,
          newInsights.confidenceScores?.intent
        );
      }
      if (newInsights.intentSignals.healthIntent && newInsights.intentSignals.healthIntent.length > 0) {
        await userInsightsRepository.recordInsight(
          userId,
          faxJobId,
          'intent',
          'health',
          newInsights.intentSignals.healthIntent,
          newInsights.confidenceScores?.intent
        );
      }
      if (newInsights.intentSignals.govIntent && newInsights.intentSignals.govIntent.length > 0) {
        await userInsightsRepository.recordInsight(
          userId,
          faxJobId,
          'intent',
          'government',
          newInsights.intentSignals.govIntent,
          newInsights.confidenceScores?.intent
        );
      }
    }
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<UserInsightsProfile | null> {
    return await userInsightsRepository.findByUserId(userId);
  }

  /**
   * Get insight history
   */
  async getHistory(userId: string, limit: number = 50, insightType?: string) {
    return await userInsightsRepository.getHistory(userId, limit, insightType);
  }

  /**
   * Delete user insights (GDPR compliance)
   */
  async deleteUserInsights(userId: string): Promise<void> {
    await userInsightsRepository.deleteByUserId(userId);
    loggingService.info('User insights deleted', { userId });
  }

  /**
   * Generate aggregate insights for data products
   * (To be implemented in Phase 3)
   */
  async generateAggregates(filters: {
    region?: string;
    ageRange?: string;
    dateRange: { start: Date; end: Date };
  }): Promise<any> {
    // TODO: Implement aggregation logic
    throw new Error('Not implemented yet');
  }
}

export const userInsightsService = new UserInsightsService();
