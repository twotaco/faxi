import { FaxTemplateEngine } from './faxTemplateEngine.js';
import { TiffGenerator } from './tiffGenerator.js';
import { ProductSelectionData, ProductOption, FaxTemplate } from '../types/fax.js';

export interface ProductSelectionOptions {
  maxMainProducts?: number;
  maxComplementaryItems?: number;
  includeBundleDeals?: boolean;
  includeDeliveryEstimate?: boolean;
}

export class ProductSelectionFaxGenerator {
  /**
   * Generate product selection fax
   */
  static async generateProductSelectionFax(
    products: ProductOption[],
    complementaryItems: ProductOption[] = [],
    hasPaymentMethod: boolean,
    deliveryAddress?: string,
    options: ProductSelectionOptions = {},
    referenceId?: string
  ): Promise<Buffer[]> {
    const opts = {
      maxMainProducts: 5,
      maxComplementaryItems: 3,
      includeBundleDeals: true,
      includeDeliveryEstimate: true,
      ...options
    };

    // Limit products to prevent overwhelming the user
    const limitedProducts = products.slice(0, opts.maxMainProducts);
    const limitedComplementary = complementaryItems.slice(0, opts.maxComplementaryItems);

    // Add bundle deals if enabled
    const bundleDeals = opts.includeBundleDeals ? this.generateBundleDeals(limitedProducts) : [];

    const selectionData: ProductSelectionData = {
      products: limitedProducts,
      complementaryItems: [...limitedComplementary, ...bundleDeals],
      hasPaymentMethod,
      deliveryAddress
    };

    const template = FaxTemplateEngine.createProductSelectionTemplate(selectionData, referenceId);
    return await TiffGenerator.generateTiff(template);
  }

  /**
   * Generate shopping search results fax
   */
  static async generateSearchResultsFax(
    searchQuery: string,
    products: ProductOption[],
    hasPaymentMethod: boolean,
    deliveryAddress?: string,
    referenceId?: string
  ): Promise<Buffer[]> {
    // Enhance the template with search context
    const enhancedProducts = products.map(product => ({
      ...product,
      description: this.truncateDescription(product.description, 60) // Limit description length for fax
    }));

    // Get complementary items based on search query
    const complementaryItems = this.getComplementaryItemsForQuery(searchQuery, products);

    return await this.generateProductSelectionFax(
      enhancedProducts,
      complementaryItems,
      hasPaymentMethod,
      deliveryAddress,
      { includeBundleDeals: true },
      referenceId
    );
  }

  /**
   * Generate product comparison fax (when user asks to compare items)
   */
  static async generateComparisonFax(
    products: ProductOption[],
    comparisonCriteria: string[] = ['price', 'features'],
    hasPaymentMethod: boolean,
    referenceId?: string
  ): Promise<Buffer[]> {
    // Create a comparison table format
    const comparisonData: ProductSelectionData = {
      products: products.map(product => ({
        ...product,
        description: this.createComparisonDescription(product, comparisonCriteria)
      })),
      complementaryItems: [],
      hasPaymentMethod
    };

    const template = FaxTemplateEngine.createProductSelectionTemplate(comparisonData, referenceId);
    
    // Modify template to include comparison header
    if (template.pages[0]) {
      template.pages[0].content.splice(1, 0, {
        type: 'text',
        text: 'PRODUCT COMPARISON',
        fontSize: 14,
        bold: true,
        alignment: 'center',
        marginBottom: 12
      });
    }

    return await TiffGenerator.generateTiff(template);
  }

  /**
   * Generate out of stock notification fax
   */
  static async generateOutOfStockFax(
    requestedProduct: string,
    alternativeProducts: ProductOption[],
    hasPaymentMethod: boolean,
    referenceId?: string
  ): Promise<Buffer[]> {
    const selectionData: ProductSelectionData = {
      products: alternativeProducts,
      complementaryItems: [],
      hasPaymentMethod
    };

    const template = FaxTemplateEngine.createProductSelectionTemplate(selectionData, referenceId);
    
    // Add out of stock message at the top
    if (template.pages[0]) {
      template.pages[0].content.splice(1, 0, 
        {
          type: 'text',
          text: `"${requestedProduct}" is currently out of stock.`,
          fontSize: 14,
          bold: true,
          marginBottom: 8
        },
        {
          type: 'text',
          text: 'Here are similar alternatives:',
          fontSize: 12,
          marginBottom: 16
        }
      );
    }

    return await TiffGenerator.generateTiff(template);
  }

  /**
   * Generate bundle deal suggestions
   */
  private static generateBundleDeals(products: ProductOption[]): ProductOption[] {
    const bundles: ProductOption[] = [];

    // Create simple 2-item bundles with 10% discount
    for (let i = 0; i < products.length - 1; i++) {
      for (let j = i + 1; j < products.length && bundles.length < 2; j++) {
        const product1 = products[i];
        const product2 = products[j];
        const originalTotal = product1.price + product2.price;
        const bundlePrice = Math.floor(originalTotal * 0.9); // 10% discount
        const savings = originalTotal - bundlePrice;

        bundles.push({
          id: `bundle_${product1.id}_${product2.id}`,
          name: `Bundle: ${product1.name} + ${product2.name}`,
          price: bundlePrice,
          currency: product1.currency,
          description: `Save ¥${savings}! Both items together.`,
          estimatedDelivery: product1.estimatedDelivery
        });
      }
    }

    return bundles;
  }

  /**
   * Get complementary items based on search query
   */
  private static getComplementaryItemsForQuery(query: string, products: ProductOption[]): ProductOption[] {
    const complementaryMap: { [key: string]: ProductOption[] } = {
      'flashlight': [
        { id: 'batteries_aa', name: 'AA Batteries (4-pack)', price: 380, currency: 'JPY', description: 'Long-lasting alkaline' },
        { id: 'case_small', name: 'Carrying Case', price: 450, currency: 'JPY', description: 'Protective case' }
      ],
      'coffee': [
        { id: 'filters', name: 'Coffee Filters (100ct)', price: 320, currency: 'JPY', description: 'Paper filters' },
        { id: 'beans', name: 'Coffee Beans', price: 980, currency: 'JPY', description: 'Medium roast' }
      ],
      'shampoo': [
        { id: 'conditioner', name: 'Conditioner', price: 750, currency: 'JPY', description: 'Matching conditioner' },
        { id: 'soap', name: 'Hand Soap', price: 320, currency: 'JPY', description: 'Moisturizing formula' }
      ],
      'phone': [
        { id: 'case', name: 'Phone Case', price: 1200, currency: 'JPY', description: 'Protective case' },
        { id: 'charger', name: 'Charger Cable', price: 800, currency: 'JPY', description: 'Fast charging' }
      ]
    };

    const queryLower = query.toLowerCase();
    for (const [keyword, items] of Object.entries(complementaryMap)) {
      if (queryLower.includes(keyword)) {
        return items;
      }
    }

    return [];
  }

  /**
   * Truncate description to fit fax format
   */
  private static truncateDescription(description: string, maxLength: number): string {
    if (description.length <= maxLength) {
      return description;
    }
    return description.substring(0, maxLength - 3) + '...';
  }

  /**
   * Create comparison description highlighting key differences
   */
  private static createComparisonDescription(product: ProductOption, criteria: string[]): string {
    const parts: string[] = [];
    
    if (criteria.includes('price')) {
      parts.push(`¥${product.price}`);
    }
    
    if (criteria.includes('features') && product.description) {
      const shortDesc = this.truncateDescription(product.description, 40);
      parts.push(shortDesc);
    }
    
    if (criteria.includes('delivery') && product.estimatedDelivery) {
      parts.push(`Ships: ${product.estimatedDelivery}`);
    }

    return parts.join(' | ');
  }

  /**
   * Generate category browse fax (when user asks to browse a category)
   */
  static async generateCategoryBrowseFax(
    categoryName: string,
    products: ProductOption[],
    subcategories: string[] = [],
    hasPaymentMethod: boolean,
    referenceId?: string
  ): Promise<Buffer[]> {
    const selectionData: ProductSelectionData = {
      products: products.slice(0, 4), // Limit to 4 for category browsing
      complementaryItems: [],
      hasPaymentMethod
    };

    const template = FaxTemplateEngine.createProductSelectionTemplate(selectionData, referenceId);
    
    // Add category header
    if (template.pages[0]) {
      template.pages[0].content.splice(1, 0, {
        type: 'text',
        text: `BROWSING: ${categoryName.toUpperCase()}`,
        fontSize: 14,
        bold: true,
        alignment: 'center',
        marginBottom: 16
      });

      // Add subcategories if available
      if (subcategories.length > 0) {
        template.pages[0].content.splice(2, 0, 
          {
            type: 'text',
            text: 'Or browse subcategories:',
            fontSize: 12,
            bold: true,
            marginBottom: 8
          },
          {
            type: 'text',
            text: subcategories.map(sub => `• ${sub}`).join('\n'),
            fontSize: 12,
            marginBottom: 16
          }
        );
      }
    }

    return await TiffGenerator.generateTiff(template);
  }

  /**
   * Generate wishlist/favorites fax
   */
  static async generateWishlistFax(
    wishlistItems: ProductOption[],
    hasPaymentMethod: boolean,
    referenceId?: string
  ): Promise<Buffer[]> {
    const selectionData: ProductSelectionData = {
      products: wishlistItems,
      complementaryItems: [],
      hasPaymentMethod
    };

    const template = FaxTemplateEngine.createProductSelectionTemplate(selectionData, referenceId);
    
    // Modify header for wishlist
    if (template.pages[0]) {
      template.pages[0].content[1] = {
        type: 'text',
        text: 'YOUR WISHLIST',
        fontSize: 16,
        bold: true,
        alignment: 'center',
        marginBottom: 16
      };
    }

    return await TiffGenerator.generateTiff(template);
  }
}