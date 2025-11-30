import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { db } from '../../database/connection';
import { emailMetricsService, EmailEvent } from '../../services/emailMetricsService';

/**
 * Property 40: Email quality metrics calculation
 * 
 * For any time period, bounce rate, complaint rate, and delivery rate should be 
 * accurately calculated from email events.
 * 
 * Validates: Requirements 17.2, 17.3, 17.4
 */

describe('Property 40: Email quality metrics calculation', () => {
  beforeEach(async () => {
    // Clean up email_metrics table before each test
    await db.query('DELETE FROM email_metrics');
  });

  afterEach(async () => {
    // Clean up after each test
    await db.query('DELETE FROM email_metrics');
  });

  it('should accurately calculate bounce rate, complaint rate, and delivery rate from email events', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary email event counts
        fc.record({
          sentCount: fc.integer({ min: 1, max: 100 }),
          deliveredCount: fc.integer({ min: 0, max: 100 }),
          bouncedCount: fc.integer({ min: 0, max: 100 }),
          complainedCount: fc.integer({ min: 0, max: 100 }),
        }),
        async (eventCounts) => {
          // Create a time window for the test
          const startDate = new Date('2024-01-01T00:00:00Z');
          const endDate = new Date('2024-01-02T00:00:00Z');
          const testTime = new Date('2024-01-01T12:00:00Z');

          // Record sent events (user_id is optional, so we can omit it for testing)
          for (let i = 0; i < eventCounts.sentCount; i++) {
            const event: EmailEvent = {
              eventType: 'sent',
              messageId: `msg-sent-${i}`,
              occurredAt: testTime,
            };
            await emailMetricsService.recordEmailEvent(event);
          }

          // Record delivered events (can't exceed sent count in reality, but we'll test the calculation)
          const actualDelivered = Math.min(eventCounts.deliveredCount, eventCounts.sentCount);
          for (let i = 0; i < actualDelivered; i++) {
            const event: EmailEvent = {
              eventType: 'delivered',
              messageId: `msg-delivered-${i}`,
              occurredAt: testTime,
            };
            await emailMetricsService.recordEmailEvent(event);
          }

          // Record bounced events
          const actualBounced = Math.min(eventCounts.bouncedCount, eventCounts.sentCount);
          for (let i = 0; i < actualBounced; i++) {
            const event: EmailEvent = {
              eventType: 'bounced',
              messageId: `msg-bounced-${i}`,
              occurredAt: testTime,
            };
            await emailMetricsService.recordEmailEvent(event);
          }

          // Record complained events
          const actualComplained = Math.min(eventCounts.complainedCount, eventCounts.sentCount);
          for (let i = 0; i < actualComplained; i++) {
            const event: EmailEvent = {
              eventType: 'complained',
              messageId: `msg-complained-${i}`,
              occurredAt: testTime,
            };
            await emailMetricsService.recordEmailEvent(event);
          }

          // Calculate metrics
          const metrics = await emailMetricsService.calculateMetrics(startDate, endDate);

          // Verify counts
          expect(metrics.totalSent).toBe(eventCounts.sentCount);
          expect(metrics.totalDelivered).toBe(actualDelivered);
          expect(metrics.totalBounced).toBe(actualBounced);
          expect(metrics.totalComplaints).toBe(actualComplained);

          // Verify rate calculations
          const expectedBounceRate = actualBounced / eventCounts.sentCount;
          const expectedComplaintRate = actualComplained / eventCounts.sentCount;
          const expectedDeliveryRate = actualDelivered / eventCounts.sentCount;

          expect(metrics.bounceRate).toBeCloseTo(expectedBounceRate, 10);
          expect(metrics.complaintRate).toBeCloseTo(expectedComplaintRate, 10);
          expect(metrics.deliveryRate).toBeCloseTo(expectedDeliveryRate, 10);

          // Verify rates are between 0 and 1
          expect(metrics.bounceRate).toBeGreaterThanOrEqual(0);
          expect(metrics.bounceRate).toBeLessThanOrEqual(1);
          expect(metrics.complaintRate).toBeGreaterThanOrEqual(0);
          expect(metrics.complaintRate).toBeLessThanOrEqual(1);
          expect(metrics.deliveryRate).toBeGreaterThanOrEqual(0);
          expect(metrics.deliveryRate).toBeLessThanOrEqual(1);

          // Clean up for next iteration
          await db.query('DELETE FROM email_metrics');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle zero sent emails without division by zero', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null), // No input needed
        async () => {
          const startDate = new Date('2024-01-01T00:00:00Z');
          const endDate = new Date('2024-01-02T00:00:00Z');

          // Don't record any events
          const metrics = await emailMetricsService.calculateMetrics(startDate, endDate);

          // All counts should be zero
          expect(metrics.totalSent).toBe(0);
          expect(metrics.totalDelivered).toBe(0);
          expect(metrics.totalBounced).toBe(0);
          expect(metrics.totalComplaints).toBe(0);

          // All rates should be zero (not NaN or Infinity)
          expect(metrics.bounceRate).toBe(0);
          expect(metrics.complaintRate).toBe(0);
          expect(metrics.deliveryRate).toBe(0);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should only include events within the specified time range', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          insideCount: fc.integer({ min: 1, max: 50 }),
          outsideCount: fc.integer({ min: 1, max: 50 }),
        }),
        async (counts) => {
          const startDate = new Date('2024-01-01T00:00:00Z');
          const endDate = new Date('2024-01-02T00:00:00Z');
          const insideTime = new Date('2024-01-01T12:00:00Z');
          const outsideTime = new Date('2024-01-03T12:00:00Z'); // Outside range

          // Record events inside the time range
          for (let i = 0; i < counts.insideCount; i++) {
            await emailMetricsService.recordEmailEvent({
              eventType: 'sent',
              messageId: `msg-inside-${i}`,
              occurredAt: insideTime,
            });
          }

          // Record events outside the time range
          for (let i = 0; i < counts.outsideCount; i++) {
            await emailMetricsService.recordEmailEvent({
              eventType: 'sent',
              messageId: `msg-outside-${i}`,
              occurredAt: outsideTime,
            });
          }

          // Calculate metrics for the specified range
          const metrics = await emailMetricsService.calculateMetrics(startDate, endDate);

          // Should only count events inside the range
          expect(metrics.totalSent).toBe(counts.insideCount);

          // Clean up
          await db.query('DELETE FROM email_metrics');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should correctly aggregate multiple event types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sent: fc.integer({ min: 10, max: 100 }),
          deliveredRatio: fc.double({ min: 0, max: 1, noNaN: true }),
          bouncedRatio: fc.double({ min: 0, max: 0.2, noNaN: true }),
          complainedRatio: fc.double({ min: 0, max: 0.05, noNaN: true }),
        }),
        async (params) => {
          // Clean up BEFORE recording events to ensure clean state
          await db.query('DELETE FROM email_metrics');

          const startDate = new Date('2024-01-01T00:00:00Z');
          const endDate = new Date('2024-01-02T00:00:00Z');
          const testTime = new Date('2024-01-01T12:00:00Z');

          const delivered = Math.floor(params.sent * params.deliveredRatio);
          const bounced = Math.floor(params.sent * params.bouncedRatio);
          const complained = Math.floor(params.sent * params.complainedRatio);

          // Record all event types
          for (let i = 0; i < params.sent; i++) {
            await emailMetricsService.recordEmailEvent({
              eventType: 'sent',
              messageId: `msg-${i}`,
              occurredAt: testTime,
            });
          }

          for (let i = 0; i < delivered; i++) {
            await emailMetricsService.recordEmailEvent({
              eventType: 'delivered',
              messageId: `msg-${i}`,
              occurredAt: testTime,
            });
          }

          for (let i = 0; i < bounced; i++) {
            await emailMetricsService.recordEmailEvent({
              eventType: 'bounced',
              messageId: `msg-${i}`,
              occurredAt: testTime,
            });
          }

          for (let i = 0; i < complained; i++) {
            await emailMetricsService.recordEmailEvent({
              eventType: 'complained',
              messageId: `msg-${i}`,
              occurredAt: testTime,
            });
          }

          const metrics = await emailMetricsService.calculateMetrics(startDate, endDate);

          // Verify all counts
          expect(metrics.totalSent).toBe(params.sent);
          expect(metrics.totalDelivered).toBe(delivered);
          expect(metrics.totalBounced).toBe(bounced);
          expect(metrics.totalComplaints).toBe(complained);

          // Verify rates are calculated correctly
          expect(metrics.deliveryRate).toBeCloseTo(delivered / params.sent, 5);
          expect(metrics.bounceRate).toBeCloseTo(bounced / params.sent, 5);
          expect(metrics.complaintRate).toBeCloseTo(complained / params.sent, 5);
        }
      ),
      { numRuns: 100 }
    );
  });
});
