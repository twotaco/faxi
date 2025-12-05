import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { ShoppingOrder } from './orderManagementService';
import { loggingService } from './loggingService';
import { productSearchService } from './productSearchService';

/**
 * Checkout session details
 */
export interface CheckoutSession {
  sessionId: string;
  checkoutUrl: string;
  checkoutDetails: CheckoutDetails;
  expiresAt: Date;
}

/**
 * Checkout details extracted from Amazon
 */
export interface CheckoutDetails {
  totalPrice: number;
  shippingCost: number;
  tax: number;
  estimatedDelivery: string;
  inStock: boolean;
  productTitle: string;
  currentPrice: number;
}

/**
 * Browser Automation Service
 * Semi-automated checkout preparation using Playwright
 * Stops before "Place Order" button for human review
 */
export class BrowserAutomationService {
  private browser: Browser | null = null;

  /**
   * Prepare Amazon checkout for admin review
   * Navigates to product, adds to cart, fills address, stops at review page
   */
  async prepareCheckout(order: ShoppingOrder): Promise<CheckoutSession> {
    loggingService.info('Preparing checkout for order', {
      orderId: order.id,
      productAsin: order.productAsin
    });

    if (!order.productAsin) {
      throw new Error('Order missing product ASIN');
    }

    try {
      // Get fresh product data for validation
      const productDetails = await productSearchService.getProductDetails(
        order.productAsin,
        true // force fresh scrape
      );

      if (!productDetails) {
        throw new Error(`Product not found: ${order.productAsin}`);
      }

      // For MVP, we'll return mock checkout details
      // In production, this would use Playwright to actually navigate Amazon
      const checkoutDetails: CheckoutDetails = {
        totalPrice: productDetails.price,
        shippingCost: 0, // Prime shipping
        tax: Math.round(productDetails.price * 0.1), // 10% consumption tax
        estimatedDelivery: productDetails.deliveryEstimate || '2-3 days',
        inStock: productDetails.availability === 'in_stock',
        productTitle: productDetails.title,
        currentPrice: productDetails.price
      };

      const sessionId = `checkout_${order.id}_${Date.now()}`;
      const checkoutUrl = `https://www.amazon.co.jp/gp/cart/view.html?asin=${order.productAsin}`;

      const session: CheckoutSession = {
        sessionId,
        checkoutUrl,
        checkoutDetails,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      };

      loggingService.info('Checkout prepared successfully', {
        orderId: order.id,
        sessionId,
        currentPrice: checkoutDetails.currentPrice,
        quotedPrice: order.quotedPrice
      });

      return session;
    } catch (error) {
      loggingService.error('Error preparing checkout', {
        orderId: order.id,
        error
      });
      throw error;
    }
  }

  /**
   * Full Playwright implementation (for future use)
   * This is the actual browser automation that would be used in production
   */
  private async prepareCheckoutWithPlaywright(order: ShoppingOrder): Promise<CheckoutSession> {
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      // Launch browser
      if (!this.browser) {
        this.browser = await chromium.launch({
          headless: false, // Show browser for admin to see
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage'
          ]
        });
      }

      // Create context with realistic fingerprint
      context = await this.browser.newContext({
        locale: 'ja-JP',
        timezoneId: 'Asia/Tokyo',
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      page = await context.newPage();

      // Navigate to product page
      const productUrl = `https://www.amazon.co.jp/dp/${order.productAsin}`;
      await page.goto(productUrl, { waitUntil: 'networkidle' });

      // Add to cart
      await this.addToCart(page, order.quantity);

      // Navigate to cart
      await page.goto('https://www.amazon.co.jp/gp/cart/view.html');

      // Proceed to checkout
      await page.click('#sc-buy-box-ptc-button');

      // Fill shipping address (if not already saved)
      await this.fillShippingAddress(page, order.shippingAddress);

      // Navigate to review page
      await this.navigateToReview(page);

      // Extract checkout details
      const checkoutDetails = await this.extractCheckoutDetails(page);

      // Keep browser open for admin to complete purchase
      const sessionId = `checkout_${order.id}_${Date.now()}`;
      const checkoutUrl = page.url();

      const session: CheckoutSession = {
        sessionId,
        checkoutUrl,
        checkoutDetails,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      };

      loggingService.info('Playwright checkout prepared', {
        orderId: order.id,
        sessionId
      });

      return session;
    } catch (error) {
      loggingService.error('Playwright checkout preparation failed', { error });
      
      // Clean up
      if (page) await page.close();
      if (context) await context.close();
      
      throw error;
    }
  }

  /**
   * Add product to cart
   */
  private async addToCart(page: Page, quantity: number): Promise<void> {
    // Set quantity
    if (quantity > 1) {
      await page.selectOption('#quantity', quantity.toString());
    }

    // Click add to cart button
    await page.click('#add-to-cart-button');

    // Wait for confirmation
    await page.waitForSelector('#NATC_SMART_WAGON_CONF_MSG_SUCCESS', {
      timeout: 5000
    });

    loggingService.debug('Product added to cart');
  }

  /**
   * Fill shipping address
   */
  private async fillShippingAddress(page: Page, address: any): Promise<void> {
    try {
      // Check if address form is present
      const hasAddressForm = await page.locator('#address-ui-widgets-enterAddressFullName').isVisible();

      if (hasAddressForm) {
        await page.fill('#address-ui-widgets-enterAddressFullName', address.name);
        await page.fill('#address-ui-widgets-enterAddressPostalCode', address.postalCode);
        await page.fill('#address-ui-widgets-enterAddressLine1', address.addressLine1);
        
        if (address.addressLine2) {
          await page.fill('#address-ui-widgets-enterAddressLine2', address.addressLine2);
        }

        await page.fill('#address-ui-widgets-enterAddressCity', address.city);
        await page.fill('#address-ui-widgets-enterAddressPhoneNumber', address.phoneNumber);

        // Submit address
        await page.click('#address-ui-widgets-form-submit-button');
      }

      loggingService.debug('Shipping address filled');
    } catch (error) {
      loggingService.warn('Could not fill shipping address, may already be saved', { error });
    }
  }

  /**
   * Navigate to final review page (stop before Place Order)
   */
  private async navigateToReview(page: Page): Promise<void> {
    // Continue through payment method selection
    // (assumes payment method is already saved)
    
    try {
      // Click continue to review
      await page.click('input[name="ppw-widgetEvent:SetPaymentPlanSelectContinueEvent"]');
      
      // Wait for review page
      await page.waitForSelector('#placeYourOrder', { timeout: 10000 });
      
      loggingService.debug('Navigated to review page');
    } catch (error) {
      loggingService.warn('Navigation to review page may have failed', { error });
    }
  }

  /**
   * Extract final checkout details from review page
   */
  private async extractCheckoutDetails(page: Page): Promise<CheckoutDetails> {
    try {
      // Extract total price
      const totalPriceText = await page.locator('#subtotals-marketplace-table .grand-total-price').textContent();
      const totalPrice = this.parsePrice(totalPriceText || '0');

      // Extract shipping cost
      const shippingText = await page.locator('#subtotals-marketplace-table .shipping-cost').textContent();
      const shippingCost = this.parsePrice(shippingText || '0');

      // Extract tax
      const taxText = await page.locator('#subtotals-marketplace-table .tax-amount').textContent();
      const tax = this.parsePrice(taxText || '0');

      // Extract delivery estimate
      const deliveryText = await page.locator('.shipment .delivery-date').textContent();
      const estimatedDelivery = deliveryText?.trim() || 'Unknown';

      // Extract product title
      const productTitle = await page.locator('.product-title').textContent();

      // Check stock status
      const inStock = !(await page.locator('.out-of-stock-message').isVisible());

      return {
        totalPrice,
        shippingCost,
        tax,
        estimatedDelivery,
        inStock,
        productTitle: productTitle?.trim() || 'Unknown',
        currentPrice: totalPrice - shippingCost - tax
      };
    } catch (error) {
      loggingService.error('Error extracting checkout details', { error });
      throw new Error('Failed to extract checkout details');
    }
  }

  /**
   * Parse Japanese Yen price string to number
   */
  private parsePrice(priceText: string): number {
    // Remove ¥, commas, and whitespace
    const cleaned = priceText.replace(/[¥,\s]/g, '');
    return parseInt(cleaned, 10) || 0;
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const browserAutomationService = new BrowserAutomationService();
