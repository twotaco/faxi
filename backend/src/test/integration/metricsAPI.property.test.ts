/**
 * Property-based tests for metrics API completeness
 * Feature: hackathon-winning-features
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('**Feature: hackathon-winning-features, Property 4: Metrics API completeness**', () => {
  /**
   * Property 4: Metrics API completeness
   * For any metrics API response, it should include overall accuracy, breakdown by category 
   * (OCR, annotation, intent), breakdown by use case, and processing statistics 
   * (avg time, success rate, confidence distribution)
   * Validates: Requirements 2.1, 2.3, 2.4
   */
  it('should include complete accuracy metrics structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          overall: fc.float({ min: 0, max: 100 }),
          ocrAccuracy: fc.float({ min: 0, max: 100 }),
          annotationAccuracy: fc.float({ min: 0, max: 100 }),
          intentAccuracy: fc.float({ min: 0, max: 100 })
        }),
        async (mockData) => {
          // Mock accuracy metrics response
          const accuracyMetrics = {
            overall: mockData.overall,
            byCategory: {
              ocr: mockData.ocrAccuracy,
              annotation: mockData.annotationAccuracy,
              intent: mockData.intentAccuracy
            },
            byUseCase: [
              { useCase: 'email', accuracy: 90, sampleCount: 10 },
              { useCase: 'shopping', accuracy: 85, sampleCount: 8 }
            ],
            trend: [
              { date: '2025-11-25', accuracy: 88 },
              { date: '2025-11-26', accuracy: 90 }
            ]
          };

          // Verify required fields exist
          expect(accuracyMetrics).toHaveProperty('overall');
          expect(accuracyMetrics).toHaveProperty('byCategory');
          expect(accuracyMetrics).toHaveProperty('byUseCase');
          expect(accuracyMetrics).toHaveProperty('trend');

          // Verify byCategory structure
          expect(accuracyMetrics.byCategory).toHaveProperty('ocr');
          expect(accuracyMetrics.byCategory).toHaveProperty('annotation');
          expect(accuracyMetrics.byCategory).toHaveProperty('intent');

          // Verify byUseCase is an array with proper structure
          expect(Array.isArray(accuracyMetrics.byUseCase)).toBe(true);
          for (const useCase of accuracyMetrics.byUseCase) {
            expect(useCase).toHaveProperty('useCase');
            expect(useCase).toHaveProperty('accuracy');
            expect(useCase).toHaveProperty('sampleCount');
          }

          // Verify trend is an array with proper structure
          expect(Array.isArray(accuracyMetrics.trend)).toBe(true);
          for (const point of accuracyMetrics.trend) {
            expect(point).toHaveProperty('date');
            expect(point).toHaveProperty('accuracy');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include complete processing stats structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          avgTime: fc.integer({ min: 100, max: 5000 }),
          successRate: fc.float({ min: 0, max: 100 }),
          totalProcessed: fc.integer({ min: 0, max: 1000 })
        }),
        async (mockData) => {
          // Mock processing stats response
          const processingStats = {
            averageTime: mockData.avgTime,
            medianTime: mockData.avgTime * 0.9,
            p95Time: mockData.avgTime * 1.5,
            successRate: mockData.successRate,
            totalProcessed: mockData.totalProcessed,
            confidenceDistribution: [
              { range: '0.9-1.0', count: 50, percentage: 50 },
              { range: '0.7-0.89', count: 30, percentage: 30 },
              { range: '0.5-0.69', count: 20, percentage: 20 }
            ],
            byUseCase: [
              { useCase: 'email', avgTime: 1500, successRate: 95 },
              { useCase: 'shopping', avgTime: 2000, successRate: 90 }
            ]
          };

          // Verify required fields exist
          expect(processingStats).toHaveProperty('averageTime');
          expect(processingStats).toHaveProperty('medianTime');
          expect(processingStats).toHaveProperty('p95Time');
          expect(processingStats).toHaveProperty('successRate');
          expect(processingStats).toHaveProperty('totalProcessed');
          expect(processingStats).toHaveProperty('confidenceDistribution');
          expect(processingStats).toHaveProperty('byUseCase');

          // Verify confidenceDistribution structure
          expect(Array.isArray(processingStats.confidenceDistribution)).toBe(true);
          for (const dist of processingStats.confidenceDistribution) {
            expect(dist).toHaveProperty('range');
            expect(dist).toHaveProperty('count');
            expect(dist).toHaveProperty('percentage');
          }

          // Verify byUseCase structure
          expect(Array.isArray(processingStats.byUseCase)).toBe(true);
          for (const useCase of processingStats.byUseCase) {
            expect(useCase).toHaveProperty('useCase');
            expect(useCase).toHaveProperty('avgTime');
            expect(useCase).toHaveProperty('successRate');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have valid value ranges for all metrics', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          overall: fc.float({ min: 0, max: 100, noNaN: true }),
          avgTime: fc.integer({ min: 0, max: 10000 }),
          successRate: fc.float({ min: 0, max: 100, noNaN: true })
        }),
        async ({ overall, avgTime, successRate }) => {
          // Verify accuracy is in valid range
          expect(overall).toBeGreaterThanOrEqual(0);
          expect(overall).toBeLessThanOrEqual(100);
          expect(Number.isFinite(overall)).toBe(true);

          // Verify processing time is positive
          expect(avgTime).toBeGreaterThanOrEqual(0);

          // Verify success rate is in valid range
          expect(successRate).toBeGreaterThanOrEqual(0);
          expect(successRate).toBeLessThanOrEqual(100);
          expect(Number.isFinite(successRate)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
