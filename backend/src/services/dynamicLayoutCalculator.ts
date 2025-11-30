/**
 * Dynamic Layout Calculator
 * 
 * Handles responsive layout adjustments based on content quantity.
 * Provides adaptive layout calculations for different template types.
 * 
 * @example
 * ```typescript
 * import { DynamicLayoutCalculator } from './dynamicLayoutCalculator';
 * 
 * const calculator = new DynamicLayoutCalculator();
 * 
 * // Calculate layout for 3 products (uses large images)
 * const layout = calculator.calculateProductLayout(3);
 * // Returns: { maxItemsPerPage: 3, minItemSpacing: 60, imageSize: 'large', compactMode: false }
 * 
 * // Calculate layout for 5 products (uses compact mode)
 * const compactLayout = calculator.calculateProductLayout(5);
 * // Returns: { maxItemsPerPage: 5, minItemSpacing: 30, imageSize: 'small', compactMode: true }
 * 
 * // Get image dimensions for a size
 * const dimensions = calculator.calculateImageDimensions('large');
 * // Returns: { width: 400, height: 400 }
 * 
 * // Calculate pagination for content
 * const pages = calculator.calculatePagination(5000); // 5000px of content
 * // Returns: 2 (number of pages needed)
 * ```
 * 
 * @remarks
 * The calculator uses predefined page dimensions and spacing rules to ensure
 * content fits appropriately on fax pages while maintaining readability.
 * 
 * Page dimensions:
 * - Total page height: 2800px (at 200 DPI)
 * - Header height: 200px
 * - Footer height: 150px
 * - Available content height: 2450px
 * 
 * Layout rules:
 * - 1-3 items: Large images (400x400), generous spacing (60px)
 * - 4-5 items: Small images (150x150), compact spacing (30px)
 * - Minimum spacing: 30px between items
 * 
 * @see {@link LayoutConstraints} for layout constraint structure
 * @see {@link ImageDimensions} for image dimension structure
 */

/**
 * Layout constraints for content rendering
 * 
 * @property maxItemsPerPage - Maximum number of items that fit on one page
 * @property minItemSpacing - Minimum spacing between items in pixels
 * @property imageSize - Size category for images ('small', 'medium', 'large')
 * @property compactMode - Whether to use compact layout mode
 */
export interface LayoutConstraints {
  maxItemsPerPage: number;
  minItemSpacing: number;
  imageSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
}

/**
 * Image dimensions in pixels
 * 
 * @property width - Image width in pixels
 * @property height - Image height in pixels
 */
export interface ImageDimensions {
  width: number;
  height: number;
}

export class DynamicLayoutCalculator {
  private readonly PAGE_HEIGHT = 2800;
  private readonly HEADER_HEIGHT = 200;
  private readonly FOOTER_HEIGHT = 150;

  /**
   * Calculate layout constraints for product display based on product count
   * 
   * @param productCount - Number of products to display
   * @returns Layout constraints optimized for the product count
   */
  calculateProductLayout(productCount: number): LayoutConstraints {
    if (productCount <= 0) {
      throw new Error('Product count must be greater than 0');
    }

    if (productCount <= 3) {
      // Use larger images and more spacing for 1-3 products
      return {
        maxItemsPerPage: 3,
        minItemSpacing: 60,
        imageSize: 'large',
        compactMode: false
      };
    } else {
      // Use compact layout with smaller images for 4-5 products
      return {
        maxItemsPerPage: 5,
        minItemSpacing: 30,
        imageSize: 'small',
        compactMode: true
      };
    }
  }

  /**
   * Calculate image dimensions based on size category
   * 
   * @param imageSize - Size category (small, medium, large)
   * @returns Width and height in pixels
   */
  calculateImageDimensions(imageSize: 'small' | 'medium' | 'large'): ImageDimensions {
    switch (imageSize) {
      case 'large':
        return { width: 400, height: 400 };
      case 'medium':
        return { width: 250, height: 250 };
      case 'small':
        return { width: 150, height: 150 };
    }
  }

  /**
   * Calculate number of pages needed for given content height
   * 
   * @param contentHeight - Total height of content in pixels
   * @returns Number of pages required
   */
  calculatePagination(contentHeight: number): number {
    if (contentHeight < 0) {
      throw new Error('Content height must be non-negative');
    }

    const availableHeight = this.PAGE_HEIGHT - this.HEADER_HEIGHT - this.FOOTER_HEIGHT;
    
    if (contentHeight === 0) {
      return 1; // At least one page
    }

    return Math.ceil(contentHeight / availableHeight);
  }

  /**
   * Calculate optimal spacing between items based on count and available height
   * 
   * @param itemCount - Number of items to space
   * @param availableHeight - Available vertical space in pixels
   * @returns Spacing in pixels between items
   */
  adjustSpacing(itemCount: number, availableHeight: number): number {
    if (itemCount <= 0) {
      throw new Error('Item count must be greater than 0');
    }

    if (availableHeight < 0) {
      throw new Error('Available height must be non-negative');
    }

    // Approximate item height (can be adjusted based on actual content)
    const approximateItemHeight = 200;
    const totalItemHeight = itemCount * approximateItemHeight;
    const remainingSpace = availableHeight - totalItemHeight;

    // Distribute remaining space between items, with minimum of 30px
    const calculatedSpacing = remainingSpace / (itemCount + 1);
    return Math.max(30, calculatedSpacing);
  }

  /**
   * Get available content height for a single page
   * 
   * @returns Available height in pixels
   */
  getAvailableContentHeight(): number {
    return this.PAGE_HEIGHT - this.HEADER_HEIGHT - this.FOOTER_HEIGHT;
  }

  /**
   * Calculate layout constraints for appointment slots
   * 
   * @param slotCount - Number of appointment slots
   * @returns Layout constraints optimized for the slot count
   */
  calculateAppointmentLayout(slotCount: number): LayoutConstraints {
    if (slotCount <= 0) {
      throw new Error('Slot count must be greater than 0');
    }

    if (slotCount <= 5) {
      return {
        maxItemsPerPage: 5,
        minItemSpacing: 50,
        imageSize: 'medium',
        compactMode: false
      };
    } else {
      return {
        maxItemsPerPage: 10,
        minItemSpacing: 25,
        imageSize: 'small',
        compactMode: true
      };
    }
  }
}
