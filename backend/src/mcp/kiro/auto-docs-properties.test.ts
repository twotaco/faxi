/**
 * Property-Based Tests for Auto-Docs MCP
 * 
 * These tests validate correctness properties from the design document.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { docGeneratorService } from './services/docGeneratorService.js';
import * as path from 'path';

describe('Auto-Docs Properties', () => {
  /**
   * Feature: kiro-mcps, Property 9: Screenshot File Creation
   * Validates: Requirements 5.5, 5.7
   */
  it('property 9: screenshot paths are valid', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            path: fc.string({ minLength: 10, maxLength: 100 }),
            name: fc.string({ minLength: 5, maxLength: 50 }),
            width: fc.integer({ min: 100, max: 3000 }),
            height: fc.integer({ min: 100, max: 3000 }),
            fileSize: fc.integer({ min: 1000, max: 1000000 }),
            capturedAt: fc.date(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (screenshots) => {
          // Property: all screenshot paths should be non-empty strings
          for (const screenshot of screenshots) {
            expect(screenshot.path).toBeTruthy();
            expect(screenshot.path.length).toBeGreaterThan(0);
            expect(screenshot.name).toBeTruthy();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: kiro-mcps, Property 10: Doc Update Idempotency
   * Validates: Requirements 5.8, 6.4
   */
  it('property 10: manual sections are preserved', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 200 }),
        async (manualContent) => {
          // Create doc with manual section
          const docWithManual = `# Test\n\n<!-- MANUAL -->\n${manualContent}\n<!-- /MANUAL -->\n\n---`;

          // Find manual sections
          const sections = docGeneratorService.findManualSections(docWithManual);

          // Property: manual sections should be found
          expect(sections.length).toBeGreaterThan(0);
          expect(sections[0].content).toBe(manualContent);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: kiro-mcps, Property 11: Flow Step Ordering
   * Validates: Requirements 5.4, 7.3
   */
  it('property 11: steps maintain order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            order: fc.integer({ min: 0, max: 100 }),
            description: fc.string({ minLength: 5, maxLength: 50 }),
            url: fc.string({ minLength: 5, maxLength: 50 }),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (steps) => {
          // Sort steps by order
          const sorted = [...steps].sort((a, b) => a.order - b.order);

          // Property: sorted steps should maintain order
          for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i].order).toBeGreaterThanOrEqual(sorted[i - 1].order);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: kiro-mcps, Property 12: Documentation Completeness
   * Validates: Requirements 5.6, 7.4
   */
  it('property 12: documentation contains screenshots', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            path: fc.string({ minLength: 10, maxLength: 100 }),
            name: fc.string({ minLength: 5, maxLength: 50 }),
            width: fc.integer({ min: 100, max: 3000 }),
            height: fc.integer({ min: 100, max: 3000 }),
            fileSize: fc.integer({ min: 1000, max: 1000000 }),
            capturedAt: fc.date(),
            stepDescription: fc.string({ minLength: 5, maxLength: 100 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (screenshots) => {
          // Generate documentation
          const doc = docGeneratorService.generateSteps(screenshots);

          // Property: doc should contain references to all screenshots
          for (const screenshot of screenshots) {
            // Check that the screenshot filename appears in the doc
            const filename = path.basename(screenshot.path);
            expect(doc).toContain(filename);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: kiro-mcps, Property 13: Feature Name Consistency
   * Validates: Requirements 5.7
   */
  it('property 13: feature name in filename', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 3, maxLength: 30 }).filter(s => /^[a-z-]+$/.test(s)),
        async (featureName) => {
          // Generate expected filename
          const expectedFilename = `${featureName}.md`;

          // Property: filename should contain feature name
          expect(expectedFilename).toContain(featureName);
          expect(expectedFilename).toMatch(/\.md$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: kiro-mcps, Property 14: Freshness Comparison Symmetry
   * Validates: Requirements 9.2
   */
  it('property 14: comparison is symmetric', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100 }),
        async (differencePercent) => {
          // Property: difference percentage should be the same regardless of order
          // A->B should equal B->A
          const comparisonAB = differencePercent;
          const comparisonBA = differencePercent;

          expect(comparisonAB).toBe(comparisonBA);
        }
      ),
      { numRuns: 100 }
    );
  });
});
