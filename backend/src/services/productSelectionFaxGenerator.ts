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

export interface ProductSelectionFaxData {
  products: CuratedProduct[];
  searchQuery: string;
  userName?: string;
}

export class ProductSelectionFaxGenerator {
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
   * Create product selection fax template
   */
  private static createProductSelectionTemplate(
    data: ProductSelectionFaxData,
    referenceId?: string
  ): FaxTemplate {
    const refId = referenceId || FaxTemplateEngine.generateReferenceId();
    
    const content: FaxContent[] = [
      // Header
      {
        type: 'header',
        text: 'Faxi - Amazon.co.jp Shopping',
        fontSize: 34, // 12pt at 204 DPI (12 * 204/72 ≈ 34)
        bold: true,
        alignment: 'center',
        marginBottom: 40
      },
      
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
        text: 'We found these products for you. Circle your choice (A, B, C, D, or E) and fax back:',
        fontSize: 34, // 12pt
        marginBottom: 40
      }
    ];

    // Add product options with selection markers
    const productOptions: CircleOption[] = data.products.map(product => ({
      id: product.asin,
      label: product.selectionMarker,
      text: this.formatProductText(product),
      price: product.price,
      currency: 'JPY'
    }));

    content.push({
      type: 'circle_option',
      options: productOptions,
      fontSize: 34, // 12pt minimum for readability
      marginBottom: 40
    });

    // Add delivery and Prime information
    content.push({
      type: 'text',
      text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      fontSize: 34,
      alignment: 'center',
      marginBottom: 20
    });

    content.push({
      type: 'text',
      text: 'All products are Prime-eligible with free delivery',
      fontSize: 34,
      bold: true,
      alignment: 'center',
      marginBottom: 40
    });

    // Instructions for selection
    content.push({
      type: 'text',
      text: 'TO ORDER:',
      fontSize: 40,
      bold: true,
      marginBottom: 20
    });

    content.push({
      type: 'text',
      text: '1. Circle your choice (A, B, C, D, or E)',
      fontSize: 34,
      marginBottom: 10
    });

    content.push({
      type: 'text',
      text: '2. Fax this page back to us',
      fontSize: 34,
      marginBottom: 10
    });

    content.push({
      type: 'text',
      text: '3. We\'ll confirm your order and payment',
      fontSize: 34,
      marginBottom: 40
    });

    // Footer with reference ID
    content.push({
      type: 'footer',
      text: `Product Options | Ref: ${refId} | Support: 0120-XXX-XXX`,
      fontSize: 28, // ~10pt
      alignment: 'center',
      marginTop: 30
    });

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
        }))
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

    content.push({
      type: 'footer',
      text: `Product Unavailable | Ref: ${refId} | Support: 0120-XXX-XXX`,
      fontSize: 28,
      alignment: 'center',
      marginTop: 30
    });

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

    content.push({
      type: 'footer',
      text: `Price Change | Ref: ${refId} | Support: 0120-XXX-XXX`,
      fontSize: 28,
      alignment: 'center',
      marginTop: 30
    });

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
