/**
 * Property-Based Tests for DynamicLayoutCalculator
 * 
 * Tests universal properties that should hold across all inputs
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DynamicLayoutCalculator } from './dynamicLayoutCalculator';

describe('DynamicLayoutCalculator Property Tests', () => {
  const calculator = new DynamicLayoutCalculator();

  // Feature: fax-template-system, Property 4: Dynamic content accommodation
  // Validates: Requirements 1.4, 9.1, 9.4
  describe('Property 4: Dynamic content accommodation', () => {
    it('should properly paginate for any content height without overflow', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50000 }), // contentHeight
          (contentHeight) => {
            const pageCount = calculator.calculatePagination(contentHeight);
            const availableHeight = calculator.getAvailableContentHeight();

            // Property: Page count should be sufficient to hold all content
            expect(pageCount).toBeGreaterThanOrEqual(1);
            expect(pageCount * availableHeight).toBeGreaterThanOrEqual(contentHeight);

            // Property: Should not allocate more pages than necessary
            if (contentHeight > 0) {
              expect((pageCount - 1) * availableHeight).toBeLessThan(contentHeight);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should adjust spacing appropriately for varying item counts', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }), // itemCount
          fc.integer({ min: 500, max: 5000 }), // availableHeight
          (itemCount, availableHeight) => {
            const spacing = calculator.adjustSpacing(itemCount, availableHeight);

            // Property: Spacing should always be at least the minimum (30px)
            expect(spacing).toBeGreaterThanOrEqual(30);

            // Property: Spacing should be a positive number
            expect(spacing).toBeGreaterThan(0);

            // Property: Spacing should be finite
            expect(Number.isFinite(spacing)).toBe(true);
            
            // Property: When available height is sufficient, spacing should distribute space
            const approximateItemHeight = 200;
            const totalItemHeight = itemCount * approximateItemHeight;
            
            if (availableHeight > totalItemHeight) {
              // When there's extra space, spacing should be more than minimum
              const remainingSpace = availableHeight - totalItemHeight;
              const idealSpacing = remainingSpace / (itemCount + 1);
              
              if (idealSpacing > 30) {
                expect(spacing).toBeGreaterThan(30);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle product layouts for any valid product count', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // productCount
          (productCount) => {
            const layout = calculator.calculateProductLayout(productCount);

            // Property: Layout should always have valid constraints
            expect(layout.maxItemsPerPage).toBeGreaterThan(0);
            expect(layout.minItemSpacing).toBeGreaterThan(0);
            expect(['small', 'medium', 'large']).toContain(layout.imageSize);
            expect(typeof layout.compactMode).toBe('boolean');

            // Property: Max items per page should be sufficient for the product count
            // (may require multiple pages, but should be reasonable)
            expect(layout.maxItemsPerPage).toBeGreaterThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle appointment layouts for any valid slot count', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }), // slotCount
          (slotCount) => {
            const layout = calculator.calculateAppointmentLayout(slotCount);

            // Property: Layout should always have valid constraints
            expect(layout.maxItemsPerPage).toBeGreaterThan(0);
            expect(layout.minItemSpacing).toBeGreaterThan(0);
            expect(['small', 'medium', 'large']).toContain(layout.imageSize);
            expect(typeof layout.compactMode).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate consistent image dimensions for all size categories', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('small', 'medium', 'large'),
          (size) => {
            const dimensions = calculator.calculateImageDimensions(size);

            // Property: Dimensions should be positive
            expect(dimensions.width).toBeGreaterThan(0);
            expect(dimensions.height).toBeGreaterThan(0);

            // Property: Dimensions should be square (for product images)
            expect(dimensions.width).toBe(dimensions.height);

            // Property: Dimensions should be reasonable for fax resolution
            expect(dimensions.width).toBeLessThanOrEqual(500);
            expect(dimensions.height).toBeLessThanOrEqual(500);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain pagination consistency - same input always gives same output', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          (contentHeight) => {
            const pageCount1 = calculator.calculatePagination(contentHeight);
            const pageCount2 = calculator.calculatePagination(contentHeight);

            // Property: Idempotence - same input should always produce same output
            expect(pageCount1).toBe(pageCount2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: fax-template-system, Property 11: Layout density adaptation
  // Validates: Requirements 9.2, 9.3
  describe('Property 11: Layout density adaptation', () => {
    it('should use larger images and spacing for 1-3 products', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3 }), // productCount
          (productCount) => {
            const layout = calculator.calculateProductLayout(productCount);

            // Property: Low product counts should use large images
            expect(layout.imageSize).toBe('large');
            expect(layout.compactMode).toBe(false);
            expect(layout.minItemSpacing).toBeGreaterThanOrEqual(60);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use compact layout with smaller images for 4+ products', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 10 }), // productCount
          (productCount) => {
            const layout = calculator.calculateProductLayout(productCount);

            // Property: High product counts should use small images and compact mode
            expect(layout.imageSize).toBe('small');
            expect(layout.compactMode).toBe(true);
            expect(layout.minItemSpacing).toBeLessThanOrEqual(60);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should adapt image size based on layout density', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (productCount) => {
            const layout = calculator.calculateProductLayout(productCount);
            const dimensions = calculator.calculateImageDimensions(layout.imageSize);

            // Property: Larger image sizes should have larger dimensions
            if (layout.imageSize === 'large') {
              expect(dimensions.width).toBeGreaterThanOrEqual(300);
            } else if (layout.imageSize === 'small') {
              expect(dimensions.width).toBeLessThanOrEqual(200);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain inverse relationship between item count and spacing', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3 }),
          fc.integer({ min: 4, max: 10 }),
          (lowCount, highCount) => {
            const lowLayout = calculator.calculateProductLayout(lowCount);
            const highLayout = calculator.calculateProductLayout(highCount);

            // Property: Lower item counts should have more spacing
            expect(lowLayout.minItemSpacing).toBeGreaterThan(highLayout.minItemSpacing);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should scale appointment layout density with slot count', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 6, max: 20 }),
          (lowCount, highCount) => {
            const lowLayout = calculator.calculateAppointmentLayout(lowCount);
            const highLayout = calculator.calculateAppointmentLayout(highCount);

            // Property: Lower slot counts should have more spacing
            expect(lowLayout.minItemSpacing).toBeGreaterThan(highLayout.minItemSpacing);

            // Property: Higher slot counts should allow more items per page
            expect(highLayout.maxItemsPerPage).toBeGreaterThanOrEqual(lowLayout.maxItemsPerPage);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Additional edge case tests
  describe('Edge Cases', () => {
    it('should handle zero content height', () => {
      const pageCount = calculator.calculatePagination(0);
      expect(pageCount).toBe(1); // At least one page
    });

    it('should handle very large content heights', () => {
      const pageCount = calculator.calculatePagination(100000);
      expect(pageCount).toBeGreaterThan(1);
      expect(pageCount).toBeLessThan(1000); // Reasonable upper bound
    });

    it('should throw error for negative content height', () => {
      expect(() => calculator.calculatePagination(-1)).toThrow();
    });

    it('should throw error for zero or negative product count', () => {
      expect(() => calculator.calculateProductLayout(0)).toThrow();
      expect(() => calculator.calculateProductLayout(-1)).toThrow();
    });

    it('should throw error for zero or negative item count in spacing', () => {
      expect(() => calculator.adjustSpacing(0, 1000)).toThrow();
      expect(() => calculator.adjustSpacing(-1, 1000)).toThrow();
    });

    it('should throw error for negative available height', () => {
      expect(() => calculator.adjustSpacing(5, -100)).toThrow();
    });
  });
});
