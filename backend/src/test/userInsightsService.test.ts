import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { userInsightsService } from '../services/userInsightsService.js';
import { userInsightsRepository } from '../repositories/userInsightsRepository.js';
import { UserInsights } from '../prompts/schemas/base.js';

// Mock the repository
vi.mock('../repositories/userInsightsRepository.js', () => ({
  userInsightsRepository: {
    findByUserId: vi.fn(),
    upsert: vi.fn(),
    recordInsight: vi.fn(),
    getHistory: vi.fn(),
    deleteByUserId: vi.fn()
  }
}));

// Mock the logging service
vi.mock('../services/loggingService.js', () => ({
  loggingService: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('UserInsightsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processInsights', () => {
    it('should process valid insights and merge with existing profile', async () => {
      const userId = 'user123';
      const faxJobId = 'fax456';
      
      const existingProfile = {
        userId,
        profileData: {
          demographics: {
            ageRangeInferred: '70-79',
            regionInferred: 'Tokyo'
          }
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        version: 1,
        totalInteractions: 5
      };

      const newInsights: UserInsights = {
        demographics: {
          genderInferred: 'male',
          householdTypeInferred: 'single'
        },
        lifeEvents: {
          movingDetected: true
        },
        confidenceScores: {
          demographics: 0.8,
          lifeEvents: 0.9
        }
      };

      vi.mocked(userInsightsRepository.findByUserId).mockResolvedValue(existingProfile);
      vi.mocked(userInsightsRepository.upsert).mockResolvedValue({
        ...existingProfile,
        version: 2
      });

      await userInsightsService.processInsights(userId, newInsights, faxJobId);

      expect(userInsightsRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(userInsightsRepository.upsert).toHaveBeenCalled();
      
      const upsertCall = vi.mocked(userInsightsRepository.upsert).mock.calls[0];
      const mergedProfile = upsertCall[1];
      
      // Check that demographics were merged
      expect(mergedProfile.demographics.ageRangeInferred).toBe('70-79'); // Kept from existing
      expect(mergedProfile.demographics.regionInferred).toBe('Tokyo'); // Kept from existing
      expect(mergedProfile.demographics.genderInferred).toBe('male'); // Added from new
      expect(mergedProfile.demographics.householdTypeInferred).toBe('single'); // Added from new
      
      // Check that life events were added
      expect(mergedProfile.lifeEvents.movingDetected).toBe(true);
      expect(mergedProfile.lifeEvents.movingDetectedAt).toBeDefined();
    });

    it('should not process insights with privacy violations', async () => {
      const userId = 'user123';
      const faxJobId = 'fax456';
      
      const insightsWithPII: UserInsights = {
        demographics: {
          regionInferred: 'Contact 090-1234-5678' // Contains phone number
        }
      };

      await userInsightsService.processInsights(userId, insightsWithPII, faxJobId);

      expect(userInsightsRepository.findByUserId).not.toHaveBeenCalled();
      expect(userInsightsRepository.upsert).not.toHaveBeenCalled();
    });

    it('should handle undefined insights gracefully', async () => {
      const userId = 'user123';
      const faxJobId = 'fax456';

      await userInsightsService.processInsights(userId, undefined, faxJobId);

      expect(userInsightsRepository.findByUserId).not.toHaveBeenCalled();
      expect(userInsightsRepository.upsert).not.toHaveBeenCalled();
    });

    it('should create new profile if user has no existing profile', async () => {
      const userId = 'newuser';
      const faxJobId = 'fax789';
      
      const newInsights: UserInsights = {
        demographics: {
          ageRangeInferred: '60-69',
          genderInferred: 'female'
        },
        confidenceScores: {
          demographics: 0.7
        }
      };

      vi.mocked(userInsightsRepository.findByUserId).mockResolvedValue(null);
      vi.mocked(userInsightsRepository.upsert).mockResolvedValue({
        userId,
        profileData: newInsights,
        lastUpdated: new Date(),
        createdAt: new Date(),
        version: 1,
        totalInteractions: 1
      });

      await userInsightsService.processInsights(userId, newInsights, faxJobId);

      expect(userInsightsRepository.upsert).toHaveBeenCalled();
      const upsertCall = vi.mocked(userInsightsRepository.upsert).mock.calls[0];
      const profile = upsertCall[1];
      
      expect(profile.demographics.ageRangeInferred).toBe('60-69');
      expect(profile.demographics.genderInferred).toBe('female');
    });
  });

  describe('Insights Merging Logic', () => {
    it('should merge demographics without overwriting existing values', async () => {
      const userId = 'user123';
      const faxJobId = 'fax456';
      
      const existingProfile = {
        userId,
        profileData: {
          demographics: {
            ageRangeInferred: '70-79',
            regionInferred: 'Tokyo'
          }
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        version: 1,
        totalInteractions: 1
      };

      const newInsights: UserInsights = {
        demographics: {
          genderInferred: 'male',
          householdTypeInferred: 'couple'
        }
      };

      vi.mocked(userInsightsRepository.findByUserId).mockResolvedValue(existingProfile);
      vi.mocked(userInsightsRepository.upsert).mockResolvedValue(existingProfile);

      await userInsightsService.processInsights(userId, newInsights, faxJobId);

      const upsertCall = vi.mocked(userInsightsRepository.upsert).mock.calls[0];
      const merged = upsertCall[1];
      
      expect(merged.demographics.ageRangeInferred).toBe('70-79');
      expect(merged.demographics.regionInferred).toBe('Tokyo');
      expect(merged.demographics.genderInferred).toBe('male');
      expect(merged.demographics.householdTypeInferred).toBe('couple');
    });

    it('should accumulate life events with timestamps', async () => {
      const userId = 'user123';
      const faxJobId = 'fax456';
      
      const existingProfile = {
        userId,
        profileData: {
          lifeEvents: {
            movingDetected: true,
            movingDetectedAt: '2024-01-01T00:00:00.000Z'
          }
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        version: 1,
        totalInteractions: 1
      };

      const newInsights: UserInsights = {
        lifeEvents: {
          retirementDetected: true,
          hospitalizationDetected: true
        }
      };

      vi.mocked(userInsightsRepository.findByUserId).mockResolvedValue(existingProfile);
      vi.mocked(userInsightsRepository.upsert).mockResolvedValue(existingProfile);

      await userInsightsService.processInsights(userId, newInsights, faxJobId);

      const upsertCall = vi.mocked(userInsightsRepository.upsert).mock.calls[0];
      const merged = upsertCall[1];
      
      expect(merged.lifeEvents.movingDetected).toBe(true);
      expect(merged.lifeEvents.movingDetectedAt).toBe('2024-01-01T00:00:00.000Z');
      expect(merged.lifeEvents.retirementDetected).toBe(true);
      expect(merged.lifeEvents.retirementDetectedAt).toBeDefined();
      expect(merged.lifeEvents.hospitalizationDetected).toBe(true);
      expect(merged.lifeEvents.hospitalizationDetectedAt).toBeDefined();
    });

    it('should accumulate intent signals with timestamps', async () => {
      const userId = 'user123';
      const faxJobId = 'fax456';
      
      const existingProfile = {
        userId,
        profileData: {
          intentSignals: {
            commercialIntent: [
              {
                category: 'electronics',
                product: 'laptop',
                urgency: 'near-term',
                detectedAt: '2024-01-01T00:00:00.000Z'
              }
            ]
          }
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        version: 1,
        totalInteractions: 1
      };

      const newInsights: UserInsights = {
        intentSignals: {
          commercialIntent: [
            {
              category: 'home-goods',
              product: 'rice cooker',
              urgency: 'immediate'
            }
          ]
        }
      };

      vi.mocked(userInsightsRepository.findByUserId).mockResolvedValue(existingProfile);
      vi.mocked(userInsightsRepository.upsert).mockResolvedValue(existingProfile);

      await userInsightsService.processInsights(userId, newInsights, faxJobId);

      const upsertCall = vi.mocked(userInsightsRepository.upsert).mock.calls[0];
      const merged = upsertCall[1];
      
      expect(merged.intentSignals.commercialIntent).toHaveLength(2);
      expect(merged.intentSignals.commercialIntent[0].category).toBe('electronics');
      expect(merged.intentSignals.commercialIntent[1].category).toBe('home-goods');
      expect(merged.intentSignals.commercialIntent[1].detectedAt).toBeDefined();
    });

    it('should limit intent signals to last 20 entries', async () => {
      const userId = 'user123';
      const faxJobId = 'fax456';
      
      // Create 20 existing intents
      const existingIntents = Array.from({ length: 20 }, (_, i) => ({
        category: `category${i}`,
        urgency: 'near-term' as const,
        detectedAt: new Date().toISOString()
      }));

      const existingProfile = {
        userId,
        profileData: {
          intentSignals: {
            commercialIntent: existingIntents
          }
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        version: 1,
        totalInteractions: 1
      };

      const newInsights: UserInsights = {
        intentSignals: {
          commercialIntent: [
            {
              category: 'new-category',
              urgency: 'immediate'
            }
          ]
        }
      };

      vi.mocked(userInsightsRepository.findByUserId).mockResolvedValue(existingProfile);
      vi.mocked(userInsightsRepository.upsert).mockResolvedValue(existingProfile);

      await userInsightsService.processInsights(userId, newInsights, faxJobId);

      const upsertCall = vi.mocked(userInsightsRepository.upsert).mock.calls[0];
      const merged = upsertCall[1];
      
      expect(merged.intentSignals.commercialIntent).toHaveLength(20);
      expect(merged.intentSignals.commercialIntent[0].category).toBe('category1'); // First one removed
      expect(merged.intentSignals.commercialIntent[19].category).toBe('new-category'); // New one added
    });

    it('should update behavioral patterns with latest values', async () => {
      const userId = 'user123';
      const faxJobId = 'fax456';
      
      const existingProfile = {
        userId,
        profileData: {
          behavioral: {
            communicationStyle: 'short',
            taskComplexity: 'simple'
          }
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        version: 1,
        totalInteractions: 1
      };

      const newInsights: UserInsights = {
        behavioral: {
          communicationStyle: 'detailed',
          taskComplexity: 'complex'
        }
      };

      vi.mocked(userInsightsRepository.findByUserId).mockResolvedValue(existingProfile);
      vi.mocked(userInsightsRepository.upsert).mockResolvedValue(existingProfile);

      await userInsightsService.processInsights(userId, newInsights, faxJobId);

      const upsertCall = vi.mocked(userInsightsRepository.upsert).mock.calls[0];
      const merged = upsertCall[1];
      
      expect(merged.behavioral.communicationStyle).toBe('detailed');
      expect(merged.behavioral.taskComplexity).toBe('complex');
    });

    it('should accumulate and deduplicate brand mentions', async () => {
      const userId = 'user123';
      const faxJobId = 'fax456';
      
      const existingProfile = {
        userId,
        profileData: {
          consumerProfile: {
            brandMentions: ['Sony', 'Panasonic']
          }
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        version: 1,
        totalInteractions: 1
      };

      const newInsights: UserInsights = {
        consumerProfile: {
          brandMentions: ['Panasonic', 'Toshiba', 'Sony'] // Duplicates
        }
      };

      vi.mocked(userInsightsRepository.findByUserId).mockResolvedValue(existingProfile);
      vi.mocked(userInsightsRepository.upsert).mockResolvedValue(existingProfile);

      await userInsightsService.processInsights(userId, newInsights, faxJobId);

      const upsertCall = vi.mocked(userInsightsRepository.upsert).mock.calls[0];
      const merged = upsertCall[1];
      
      expect(merged.consumerProfile.brandMentions).toHaveLength(3);
      expect(merged.consumerProfile.brandMentions).toContain('Sony');
      expect(merged.consumerProfile.brandMentions).toContain('Panasonic');
      expect(merged.consumerProfile.brandMentions).toContain('Toshiba');
    });

    it('should average digital exclusion scores', async () => {
      const userId = 'user123';
      const faxJobId = 'fax456';
      
      const existingProfile = {
        userId,
        profileData: {
          digitalProfile: {
            digitalExclusionScore: 4
          }
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        version: 1,
        totalInteractions: 1
      };

      const newInsights: UserInsights = {
        digitalProfile: {
          digitalExclusionScore: 5
        }
      };

      vi.mocked(userInsightsRepository.findByUserId).mockResolvedValue(existingProfile);
      vi.mocked(userInsightsRepository.upsert).mockResolvedValue(existingProfile);

      await userInsightsService.processInsights(userId, newInsights, faxJobId);

      const upsertCall = vi.mocked(userInsightsRepository.upsert).mock.calls[0];
      const merged = upsertCall[1];
      
      expect(merged.digitalProfile.digitalExclusionScore).toBe(5); // Rounded average of 4 and 5
    });

    it('should keep highest confidence scores', async () => {
      const userId = 'user123';
      const faxJobId = 'fax456';
      
      const existingProfile = {
        userId,
        profileData: {
          confidenceScores: {
            demographics: 0.9,
            lifeEvents: 0.6,
            intent: 0.7
          }
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        version: 1,
        totalInteractions: 1
      };

      const newInsights: UserInsights = {
        confidenceScores: {
          demographics: 0.8, // Lower than existing
          lifeEvents: 0.9, // Higher than existing
          intent: 0.7 // Same as existing
        }
      };

      vi.mocked(userInsightsRepository.findByUserId).mockResolvedValue(existingProfile);
      vi.mocked(userInsightsRepository.upsert).mockResolvedValue(existingProfile);

      await userInsightsService.processInsights(userId, newInsights, faxJobId);

      const upsertCall = vi.mocked(userInsightsRepository.upsert).mock.calls[0];
      const merged = upsertCall[1];
      
      expect(merged.confidenceScores.demographics).toBe(0.9); // Kept higher existing
      expect(merged.confidenceScores.lifeEvents).toBe(0.9); // Updated to higher new
      expect(merged.confidenceScores.intent).toBe(0.7); // Kept same
    });
  });

  describe('getProfile', () => {
    it('should retrieve user profile', async () => {
      const userId = 'user123';
      const mockProfile = {
        userId,
        profileData: {
          demographics: {
            ageRangeInferred: '70-79'
          }
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        version: 1,
        totalInteractions: 5
      };

      vi.mocked(userInsightsRepository.findByUserId).mockResolvedValue(mockProfile);

      const profile = await userInsightsService.getProfile(userId);

      expect(profile).toEqual(mockProfile);
      expect(userInsightsRepository.findByUserId).toHaveBeenCalledWith(userId);
    });

    it('should return null for non-existent user', async () => {
      const userId = 'nonexistent';

      vi.mocked(userInsightsRepository.findByUserId).mockResolvedValue(null);

      const profile = await userInsightsService.getProfile(userId);

      expect(profile).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should retrieve insight history with default limit', async () => {
      const userId = 'user123';
      const mockHistory = [
        {
          id: '1',
          userId,
          faxJobId: 'fax1',
          insightType: 'demographic',
          insightCategory: 'update',
          insightData: {},
          detectedAt: new Date()
        }
      ];

      vi.mocked(userInsightsRepository.getHistory).mockResolvedValue(mockHistory);

      const history = await userInsightsService.getHistory(userId);

      expect(history).toEqual(mockHistory);
      expect(userInsightsRepository.getHistory).toHaveBeenCalledWith(userId, 50, undefined);
    });

    it('should retrieve insight history with custom limit', async () => {
      const userId = 'user123';
      const mockHistory = [];

      vi.mocked(userInsightsRepository.getHistory).mockResolvedValue(mockHistory);

      await userInsightsService.getHistory(userId, 10);

      expect(userInsightsRepository.getHistory).toHaveBeenCalledWith(userId, 10, undefined);
    });

    it('should retrieve insight history filtered by type', async () => {
      const userId = 'user123';
      const mockHistory = [];

      vi.mocked(userInsightsRepository.getHistory).mockResolvedValue(mockHistory);

      await userInsightsService.getHistory(userId, 50, 'life_event');

      expect(userInsightsRepository.getHistory).toHaveBeenCalledWith(userId, 50, 'life_event');
    });
  });

  describe('deleteUserInsights', () => {
    it('should delete user insights for GDPR compliance', async () => {
      const userId = 'user123';

      vi.mocked(userInsightsRepository.deleteByUserId).mockResolvedValue();

      await userInsightsService.deleteUserInsights(userId);

      expect(userInsightsRepository.deleteByUserId).toHaveBeenCalledWith(userId);
    });
  });
});
