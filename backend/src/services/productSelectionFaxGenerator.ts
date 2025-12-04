/**
 * Product Selection Fax Generator
 * 
 * Generates faxes displaying curated product options from Amazon.co.jp
 * with selection markers, prices, and delivery information.
 * 
 * Requirements: 1.5, 8.5
 */

import { FaxGenerator } from './faxGenerator.js';
import { FaxTemplateEngine } from './faxTemplateEngine.js';
import { FaxTemplate, FaxContent, CircleOption } from '../types/fax.js';
import { CuratedProduct } from './productSearchService.js';
import { DynamicLayoutCalculator } from './dynamicLayoutCalculator.js';

export interface ProductSelectionFaxData {
  products: CuratedProduct[];
  searchQuery: string;
  userName?: string;
}

/**
 * Grouped product selection data for multi-product requests
 * E.g., when user asks for "shampoo and crackers"
 */
export interface GroupedProductSelectionFaxData {
  groupedResults: Array<{
    query: string;
    products: CuratedProduct[];
    selectionMarkers: string[];
  }>;
  userName?: string;
}

export class ProductSelectionFaxGenerator {
  // Common text constants
  private static readonly HEADER_TEXT = 'Faxi Shopping';
  private static readonly DELIVERY_TEXT = 'All products are available with free delivery';
  private static readonly DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  /**
   * Generate product selection fax with curated options
   * 
   * @param data - Product selection data including curated products
   * @param referenceId - Optional reference ID for conversation tracking
   * @returns PDF buffer ready for fax transmission
   */
  static async generateProductSelectionFax(
    data: ProductSelectionFaxData,
    referenceId?: string
  ): Promise<Buffer> {
    const template = this.createProductSelectionTemplate(data, referenceId);
    return await FaxGenerator.generatePdf(template);
  }

  /**
   * Generate grouped product selection fax for multi-product requests
   * Shows products organized by category with unique selection markers
   *
   * Example layout:
   * ━━━ 【シャンプー】Shampoo ━━━
   * A. Product 1 - ¥599
   * B. Product 2 - ¥931
   *
   * ━━━ 【野菜クラッカー】Crackers ━━━
   * C. Product 1 - ¥298
   * D. Product 2 - ¥350
   */
  static async generateGroupedProductSelectionFax(
    data: GroupedProductSelectionFaxData,
    referenceId?: string
  ): Promise<Buffer> {
    const template = this.createGroupedProductSelectionTemplate(data, referenceId);
    return await FaxGenerator.generatePdf(template);
  }

  /**
   * Create common header content
   */
  private static createHeaderContent(): FaxContent[] {
    return [
      {
        type: 'header',
        text: this.HEADER_TEXT,
        fontSize: 34,
        bold: true,
        alignment: 'center',
        marginBottom: 30
      }
    ];
  }

  /**
   * Create common delivery info content
   */
  private static createDeliveryInfoContent(fontSize: number = 32): FaxContent[] {
    return [
      {
        type: 'text',
        text: this.DIVIDER,
        fontSize: 34,
        alignment: 'center',
        marginBottom: 20
      },
      {
        type: 'text',
        text: this.DELIVERY_TEXT,
        fontSize,
        bold: true,
        alignment: 'center',
        marginBottom: 30
      }
    ];
  }

  /**
   * Create common footer content
   */
  private static createFooterContent(label: string, referenceId: string): FaxContent {
    return {
      type: 'footer',
      text: `${label} | Ref: ${referenceId} | Support: 0120-XXX-XXX`,
      fontSize: 45,
      bold: true,
      alignment: 'center',
      marginTop: 20
    };
  }

  /**
   * Create grouped product selection template
   */
  private static createGroupedProductSelectionTemplate(
    data: GroupedProductSelectionFaxData,
    referenceId?: string
  ): FaxTemplate {
    const refId = referenceId || FaxTemplateEngine.generateReferenceId();

    const content: FaxContent[] = [
      ...this.createHeaderContent(),
      
      // Instructions
      {
        type: 'text',
        text: 'We found products for your requests. Circle your choices and fax this form back:',
        fontSize: 34,
        marginBottom: 30
      }
    ];

    // Add each product group with section header
    for (const group of data.groupedResults) {
      // Section divider with category name
      content.push({
        type: 'text',
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        fontSize: 28,
        alignment: 'center',
        marginBottom: 10
      });

      content.push({
        type: 'text',
        text: `【${group.query}】`,
        fontSize: 40,
        bold: true,
        alignment: 'center',
        marginBottom: 20
      });

      // Add product options for this group
      const productOptions: CircleOption[] = group.products.map((product, index) => ({
        id: product.asin,
        label: group.selectionMarkers[index] || product.selectionMarker,
        text: this.formatProductText(product),
        price: product.price,
        currency: 'JPY'
      }));

      content.push({
        type: 'circle_option',
        options: productOptions,
        fontSize: 32, // Slightly smaller to fit more content
        marginBottom: 25
      });
    }

    // Delivery info
    content.push(...this.createDeliveryInfoContent(32));

    // Instructions for selection
    content.push({
      type: 'text',
      text: 'TO ORDER: Circle one or more letters, then fax this page back',
      fontSize: 34,
      bold: true,
      marginBottom: 20
    });

    content.push({
      type: 'text',
      text: '複数の商品を選択できます / You can select multiple products',
      fontSize: 32,
      marginBottom: 30
    });

    // Footer with reference ID
    content.push(this.createFooterContent('Multi-Product Options', refId));

    // Collect all products for context data
    const allProducts = data.groupedResults.flatMap(g => g.products.map((p, i) => ({
      asin: p.asin,
      selectionMarker: g.selectionMarkers[i] || p.selectionMarker,
      title: p.title,
      price: p.price,
      category: g.query
    })));

    return {
      type: 'product_selection',
      referenceId: refId,
      pages: [{
        content,
        pageNumber: 1,
        totalPages: 1
      }],
      contextData: {
        isMultiProductSearch: true,
        searchQueries: data.groupedResults.map(g => g.query),
        products: allProducts
      }
    };
  }

  /**
   * Create product selection fax template
   */
  private static createProductSelectionTemplate(
    data: ProductSelectionFaxData,
    referenceId?: string
  ): FaxTemplate {
    const refId = referenceId || FaxTemplateEngine.generateReferenceId();
    
    // Use DynamicLayoutCalculator to determine layout constraints
    const layoutCalculator = new DynamicLayoutCalculator();
    const layoutConstraints = layoutCalculator.calculateProductLayout(data.products.length);
    const imageDimensions = layoutCalculator.calculateImageDimensions(layoutConstraints.imageSize);
    
    const content: FaxContent[] = [
      ...this.createHeaderContent(),
      
      // Search query
      {
        type: 'text',
        text: `Search: "${data.searchQuery}"`,
        fontSize: 40, // ~14pt
        bold: true,
        marginBottom: 30
      },
      
      // Instructions
      {
        type: 'text',
        text: 'We found these products for you. Circle your choices and fax this form back:',
        fontSize: 34, // 12pt
        marginBottom: layoutConstraints.compactMode ? 20 : 40
      }
    ];

    // Add products with images and selection markers
    for (const product of data.products) {
      // Add product image if available
      if (product.imageUrl) {
        content.push({
          type: 'image',
          imageData: {
            url: product.imageUrl,
            width: imageDimensions.width,
            height: imageDimensions.height,
            alignment: 'left',
            fallbackText: `[Image unavailable for ${product.title}]`
          },
          marginBottom: 10
        });
      }
      
      // Add product details with selection marker
      const productOption: CircleOption = {
        id: product.asin,
        label: product.selectionMarker,
        text: this.formatProductText(product),
        price: product.price,
        currency: 'JPY'
      };
      
      content.push({
        type: 'circle_option',
        options: [productOption],
        fontSize: layoutConstraints.compactMode ? 30 : 34,
        marginBottom: layoutConstraints.minItemSpacing
      });
    }

    // Add delivery information
    const deliveryFontSize = layoutConstraints.compactMode ? 30 : 34;
    content.push(...this.createDeliveryInfoContent(deliveryFontSize));

    // Instructions for selection
    content.push({
      type: 'text',
      text: 'TO ORDER:',
      fontSize: layoutConstraints.compactMode ? 36 : 40,
      bold: true,
      marginBottom: layoutConstraints.compactMode ? 15 : 20
    });

    content.push({
      type: 'text',
      text: '1. Circle your choices',
      fontSize: layoutConstraints.compactMode ? 30 : 34,
      marginBottom: 10
    });

    content.push({
      type: 'text',
      text: '2. Fax this page back to us',
      fontSize: layoutConstraints.compactMode ? 30 : 34,
      marginBottom: 10
    });

    content.push({
      type: 'text',
      text: '3. We\'ll confirm your order and payment',
      fontSize: layoutConstraints.compactMode ? 30 : 34,
      marginBottom: layoutConstraints.compactMode ? 25 : 40
    });

    // Footer with reference ID
    content.push(this.createFooterContent('Product Options', refId));

    return {
      type: 'product_selection',
      referenceId: refId,
      pages: [{
        content,
        pageNumber: 1,
        totalPages: 1
      }],
      contextData: {
        searchQuery: data.searchQuery,
        products: data.products.map(p => ({
          asin: p.asin,
          selectionMarker: p.selectionMarker,
          title: p.title,
          price: p.price
        })),
        layoutConstraints: {
          compactMode: layoutConstraints.compactMode,
          imageSize: layoutConstraints.imageSize,
          productCount: data.products.length
        }
      }
    };
  }

  /**
   * Format product text with title, delivery estimate, and Prime badge
   * Ensures title is truncated to 60 characters as per requirement 8.5
   */
  private static formatProductText(product: CuratedProduct): string {
    // Title is already truncated to 60 chars by productSearchService
    const title = product.title;
    
    // Format price with comma separators (Japanese Yen format)
    const formattedPrice = this.formatPrice(product.price);
    
    // Add Prime badge
    const primeBadge = product.primeEligible ? ' [Prime]' : '';
    
    // Add delivery estimate
    const delivery = product.deliveryEstimate ? ` - ${product.deliveryEstimate}` : '';
    
    // Add rating
    const rating = product.rating ? ` (★${product.rating.toFixed(1)})` : '';
    
    return `${title}${rating}${primeBadge}${delivery}`;
  }

  /**
   * Format price in Japanese Yen with comma separators
   * Example: 1234 -> "¥1,234"
   */
  private static formatPrice(price: number): string {
    return `¥${price.toLocaleString('ja-JP')}`;
  }

  /**
   * Generate product unavailable fax when selected product is out of stock
   */
  static async generateProductUnavailableFax(
    productTitle: string,
    asin: string,
    referenceId?: string
  ): Promise<Buffer> {
    const refId = referenceId || FaxTemplateEngine.generateReferenceId();
    
    const content: FaxContent[] = [
      {
        type: 'header',
        text: 'Faxi - Product Unavailable',
        fontSize: 34,
        bold: true,
        alignment: 'center',
        marginBottom: 40
      },
      {
        type: 'text',
        text: 'PRODUCT OUT OF STOCK',
        fontSize: 45,
        bold: true,
        alignment: 'center',
        marginBottom: 40
      },
      {
        type: 'text',
        text: 'We\'re sorry, but the product you selected is currently unavailable:',
        fontSize: 34,
        marginBottom: 30
      },
      {
        type: 'text',
        text: productTitle,
        fontSize: 40,
        bold: true,
        marginBottom: 10
      },
      {
        type: 'text',
        text: `ASIN: ${asin}`,
        fontSize: 34,
        marginBottom: 40
      },
      {
        type: 'text',
        text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        fontSize: 34,
        alignment: 'center',
        marginBottom: 30
      },
      {
        type: 'text',
        text: 'WHAT WOULD YOU LIKE TO DO?',
        fontSize: 40,
        bold: true,
        marginBottom: 20
      },
      {
        type: 'text',
        text: 'Circle your choice and fax back:',
        fontSize: 34,
        marginBottom: 30
      }
    ];

    const options: CircleOption[] = [
      {
        id: 'search_similar',
        label: 'A',
        text: 'Search for similar products'
      },
      {
        id: 'wait_restock',
        label: 'B',
        text: 'Wait for restock notification'
      },
      {
        id: 'cancel',
        label: 'C',
        text: 'Cancel this order'
      }
    ];

    content.push({
      type: 'circle_option',
      options,
      fontSize: 34,
      marginBottom: 40
    });

    content.push(this.createFooterContent('Product Unavailable', refId));

    const template: FaxTemplate = {
      type: 'product_selection',
      referenceId: refId,
      pages: [{
        content,
        pageNumber: 1,
        totalPages: 1
      }],
      contextData: {
        productTitle,
        asin,
        isUnavailable: true
      }
    };

    return await FaxGenerator.generatePdf(template);
  }

  /**
   * Generate price discrepancy notification fax
   */
  static async generatePriceDiscrepancyFax(
    productTitle: string,
    quotedPrice: number,
    currentPrice: number,
    referenceId?: string
  ): Promise<Buffer> {
    const refId = referenceId || FaxTemplateEngine.generateReferenceId();
    const difference = currentPrice - quotedPrice;
    const percentChange = ((difference / quotedPrice) * 100).toFixed(1);
    
    const content: FaxContent[] = [
      {
        type: 'header',
        text: 'Faxi - Price Change Notice',
        fontSize: 34,
        bold: true,
        alignment: 'center',
        marginBottom: 40
      },
      {
        type: 'text',
        text: 'PRICE HAS CHANGED',
        fontSize: 45,
        bold: true,
        alignment: 'center',
        marginBottom: 40
      },
      {
        type: 'text',
        text: 'The price for your selected product has changed:',
        fontSize: 34,
        marginBottom: 30
      },
      {
        type: 'text',
        text: productTitle,
        fontSize: 40,
        bold: true,
        marginBottom: 30
      },
      {
        type: 'text',
        text: `Original Price: ${this.formatPrice(quotedPrice)}`,
        fontSize: 40,
        marginBottom: 10
      },
      {
        type: 'text',
        text: `Current Price: ${this.formatPrice(currentPrice)}`,
        fontSize: 40,
        bold: true,
        marginBottom: 10
      },
      {
        type: 'text',
        text: `Difference: ${difference > 0 ? '+' : ''}${this.formatPrice(difference)} (${percentChange}%)`,
        fontSize: 40,
        bold: true,
        marginBottom: 40
      },
      {
        type: 'text',
        text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        fontSize: 34,
        alignment: 'center',
        marginBottom: 30
      },
      {
        type: 'text',
        text: 'DO YOU WANT TO PROCEED?',
        fontSize: 40,
        bold: true,
        marginBottom: 20
      },
      {
        type: 'text',
        text: 'Circle your choice and fax back:',
        fontSize: 34,
        marginBottom: 30
      }
    ];

    const options: CircleOption[] = [
      {
        id: 'proceed',
        label: 'A',
        text: `Yes, proceed with purchase at ${this.formatPrice(currentPrice)}`
      },
      {
        id: 'cancel',
        label: 'B',
        text: 'No, cancel this order'
      }
    ];

    content.push({
      type: 'circle_option',
      options,
      fontSize: 34,
      marginBottom: 40
    });

    content.push(this.createFooterContent('Price Change', refId));

    const template: FaxTemplate = {
      type: 'product_selection',
      referenceId: refId,
      pages: [{
        content,
        pageNumber: 1,
        totalPages: 1
      }],
      contextData: {
        productTitle,
        quotedPrice,
        currentPrice,
        isPriceDiscrepancy: true
      }
    };

    return await FaxGenerator.generatePdf(template);
  }
}
