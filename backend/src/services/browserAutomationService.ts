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

    // Check if Playwright automation is enabled
    const usePlaywright = process.env.AMAZON_EMAIL && process.env.AMAZON_PASSWORD;

    if (usePlaywright) {
      loggingService.info('Using Playwright automation for checkout preparation');
      return await this.prepareCheckoutWithPlaywright(order);
    } else {
      loggingService.info('Using mock checkout (Playwright disabled - set AMAZON_EMAIL and AMAZON_PASSWORD)');
      return await this.prepareCheckoutMock(order);
    }
  }

  /**
   * Mock checkout preparation (when Playwright is disabled)
   */
  private async prepareCheckoutMock(order: ShoppingOrder): Promise<CheckoutSession> {
    try {
      // Get fresh product data for validation
      const productDetails = await productSearchService.getProductDetails(
        order.productAsin!,
        true // force fresh scrape
      );

      if (!productDetails) {
        throw new Error(`Product not found: ${order.productAsin}`);
      }

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
      const checkoutUrl = `https://www.amazon.co.jp/dp/${order.productAsin}`;

      const session: CheckoutSession = {
        sessionId,
        checkoutUrl,
        checkoutDetails,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      };

      loggingService.info('Mock checkout prepared successfully', {
        orderId: order.id,
        sessionId,
        currentPrice: checkoutDetails.currentPrice,
        quotedPrice: order.quotedPrice
      });

      return session;
    } catch (error) {
      loggingService.error('Error preparing mock checkout', {
        orderId: order.id,
        error
      });
      throw error;
    }
  }

  /**
   * Full Playwright implementation
   * Automates Amazon checkout up to the final review page
   */
  private async prepareCheckoutWithPlaywright(order: ShoppingOrder): Promise<CheckoutSession> {
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      // Launch browser
      if (!this.browser) {
        loggingService.info('Launching browser for automation');
        this.browser = await chromium.launch({
          headless: false, // Show browser for transparency
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--no-sandbox'
          ]
        });
      }

      // Try to load existing session
      const sessionPath = './amazon-session.json';
      let storageState = undefined;
      try {
        const fs = await import('fs');
        if (fs.existsSync(sessionPath)) {
          storageState = sessionPath;
          loggingService.info('Loading existing Amazon session');
        }
      } catch (err) {
        loggingService.debug('No existing session found, will log in');
      }

      // Create context with realistic fingerprint
      context = await this.browser.newContext({
        locale: 'ja-JP',
        timezoneId: 'Asia/Tokyo',
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        storageState
      });

      page = await context.newPage();

      // Check if we need to log in
      await page.goto('https://www.amazon.co.jp', { waitUntil: 'networkidle' });
      
      const isLoggedIn = await page.locator('#nav-link-accountList-nav-line-1').textContent()
        .then(text => !text?.includes('ログイン'))
        .catch(() => false);

      if (!isLoggedIn) {
        loggingService.info('Not logged in, performing login');
        await this.loginToAmazon(page);
        
        // Save session for future use
        try {
          await context.storageState({ path: sessionPath });
          loggingService.info('Amazon session saved');
        } catch (err) {
          loggingService.warn('Failed to save session', { error: err });
        }
      } else {
        loggingService.info('Already logged in to Amazon');
      }

      // Clear cart before starting (ensures clean state for each order)
      await this.clearCart(page);

      // Navigate to product page
      const productUrl = `https://www.amazon.co.jp/dp/${order.productAsin}`;
      loggingService.info('Navigating to product page', { productUrl });
      await page.goto(productUrl, { waitUntil: 'networkidle' });

      // Add to cart
      await this.addToCart(page, order.quantity);

      // Navigate to cart
      await page.goto('https://www.amazon.co.jp/gp/cart/view.html', { waitUntil: 'networkidle' });

      // Proceed to checkout
      loggingService.info('Proceeding to checkout');
      await page.click('#sc-buy-box-ptc-button');
      await page.waitForLoadState('networkidle');

      // Fill shipping address (if not already saved)
      await this.fillShippingAddress(page, order.shippingAddress);

      // Navigate to review page (stop before Place Order)
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

      loggingService.info('Playwright checkout prepared successfully', {
        orderId: order.id,
        sessionId,
        checkoutUrl
      });

      // Don't close browser - admin needs to see it
      return session;
    } catch (error) {
      loggingService.error('Playwright checkout preparation failed', { error });
      
      // Clean up on error
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
      
      throw error;
    }
  }

  /**
   * Log into Amazon.co.jp
   */
  private async loginToAmazon(page: Page): Promise<void> {
    const email = process.env.AMAZON_EMAIL;
    const password = process.env.AMAZON_PASSWORD;

    if (!email || !password) {
      throw new Error('AMAZON_EMAIL and AMAZON_PASSWORD must be set in environment variables');
    }

    try {
      // Go to login page
      await page.goto('https://www.amazon.co.jp/ap/signin', { waitUntil: 'networkidle' });

      // Enter email
      await page.fill('#ap_email', email);
      await page.click('#continue');
      await page.waitForLoadState('networkidle');

      // Enter password
      await page.fill('#ap_password', password);
      await page.click('#signInSubmit');
      await page.waitForLoadState('networkidle');

      // Handle 2FA if present (wait for manual input)
      const has2FA = await page.locator('#auth-mfa-otpcode').isVisible().catch(() => false);
      if (has2FA) {
        loggingService.warn('2FA detected - waiting for manual input (60 seconds)');
        await page.waitForNavigation({ timeout: 60000 }).catch(() => {
          throw new Error('2FA timeout - please complete 2FA within 60 seconds');
        });
      }

      loggingService.info('Successfully logged into Amazon');
    } catch (error) {
      loggingService.error('Amazon login failed', { error });
      throw new Error('Failed to log into Amazon - check credentials');
    }
  }

  /**
   * Add product to cart
   */
  private async addToCart(page: Page, quantity: number): Promise<void> {
    try {
      // Set quantity if more than 1
      if (quantity > 1) {
        const quantitySelector = await page.locator('#quantity').isVisible().catch(() => false);
        if (quantitySelector) {
          await page.selectOption('#quantity', quantity.toString());
          await page.waitForTimeout(500); // Human-like delay
        }
      }

      // Try different add to cart button selectors
      const addToCartSelectors = [
        '#add-to-cart-button',
        '#buy-now-button',
        'input[name="submit.add-to-cart"]',
        '#add-to-cart-button-ubb'
      ];

      let clicked = false;
      for (const selector of addToCartSelectors) {
        const isVisible = await page.locator(selector).isVisible().catch(() => false);
        if (isVisible) {
          await page.click(selector);
          clicked = true;
          loggingService.debug('Clicked add to cart button', { selector });
          break;
        }
      }

      if (!clicked) {
        throw new Error('Could not find add to cart button');
      }

      // Wait for confirmation (try multiple possible selectors)
      await Promise.race([
        page.waitForSelector('#NATC_SMART_WAGON_CONF_MSG_SUCCESS', { timeout: 5000 }),
        page.waitForSelector('#huc-v2-order-row-confirm-text', { timeout: 5000 }),
        page.waitForURL('**/gp/cart/**', { timeout: 5000 })
      ]).catch(() => {
        loggingService.warn('Add to cart confirmation not detected, but continuing');
      });

      loggingService.info('Product added to cart successfully');
    } catch (error) {
      loggingService.error('Failed to add product to cart', { error });
      throw new Error('Failed to add product to cart');
    }
  }

  /**
   * Fill shipping address
   */
  private async fillShippingAddress(page: Page, address: any): Promise<void> {
    try {
      // Wait for page to load
      await page.waitForLoadState('networkidle');

      // Check if we need to add a new address
      const needsNewAddress = await page.locator('#address-ui-widgets-enterAddressFullName').isVisible().catch(() => false);

      if (needsNewAddress) {
        loggingService.info('Filling new shipping address');
        
        // Fill address form
        await page.fill('#address-ui-widgets-enterAddressFullName', address.name);
        await page.waitForTimeout(200);
        
        await page.fill('#address-ui-widgets-enterAddressPostalCode', address.postalCode);
        await page.waitForTimeout(200);
        
        await page.fill('#address-ui-widgets-enterAddressLine1', address.addressLine1);
        await page.waitForTimeout(200);
        
        if (address.addressLine2) {
          await page.fill('#address-ui-widgets-enterAddressLine2', address.addressLine2);
          await page.waitForTimeout(200);
        }

        await page.fill('#address-ui-widgets-enterAddressCity', address.city);
        await page.waitForTimeout(200);
        
        await page.fill('#address-ui-widgets-enterAddressPhoneNumber', address.phoneNumber);
        await page.waitForTimeout(200);

        // Submit address
        await page.click('#address-ui-widgets-form-submit-button');
        await page.waitForLoadState('networkidle');
        
        loggingService.info('Shipping address submitted');
      } else {
        // Check if there's an existing address we can use
        const hasExistingAddress = await page.locator('.address-plus-pm-container').isVisible().catch(() => false);
        
        if (hasExistingAddress) {
          loggingService.info('Using existing saved address');
          // Address is already selected, continue
        } else {
          loggingService.warn('No address form found, may already be on next step');
        }
      }
    } catch (error) {
      loggingService.warn('Could not fill shipping address, may already be saved', { error });
      // Don't throw - address might already be saved
    }
  }

  /**
   * Navigate to final review page (stop before Place Order)
   */
  private async navigateToReview(page: Page): Promise<void> {
    try {
      await page.waitForLoadState('networkidle');

      // Look for payment method selection
      const paymentContinueSelectors = [
        'input[name="ppw-widgetEvent:SetPaymentPlanSelectContinueEvent"]',
        '#continue-top',
        '#orderSummaryPrimaryActionBtn',
        'input[name="placeYourOrder1"]'
      ];

      // Try to find and click continue button
      let foundContinue = false;
      for (const selector of paymentContinueSelectors) {
        const isVisible = await page.locator(selector).isVisible().catch(() => false);
        if (isVisible) {
          const text = await page.locator(selector).textContent().catch(() => '');
          // Don't click "Place Order" - only click "Continue" type buttons
          if (!text.includes('注文') && !text.includes('Place Order')) {
            await page.click(selector);
            await page.waitForLoadState('networkidle');
            foundContinue = true;
            loggingService.info('Clicked continue button', { selector });
            break;
          }
        }
      }

      // Wait for review page - look for Place Order button (but don't click it!)
      const placeOrderSelectors = [
        '#placeYourOrder',
        'input[name="placeYourOrder1"]',
        '#submitOrderButtonId'
      ];

      let onReviewPage = false;
      for (const selector of placeOrderSelectors) {
        const isVisible = await page.locator(selector).isVisible().catch(() => false);
        if (isVisible) {
          onReviewPage = true;
          loggingService.info('Reached review page - STOPPING before Place Order button');
          break;
        }
      }

      if (!onReviewPage) {
        loggingService.warn('Could not confirm we are on review page');
      }
    } catch (error) {
      loggingService.error('Error navigating to review page', { error });
      throw new Error('Failed to navigate to review page');
    }
  }

  /**
   * Extract final checkout details from review page
   */
  private async extractCheckoutDetails(page: Page): Promise<CheckoutDetails> {
    try {
      await page.waitForLoadState('networkidle');

      // Try multiple selectors for total price
      let totalPrice = 0;
      const totalSelectors = [
        '#subtotals-marketplace-table .grand-total-price',
        '.grand-total-price',
        '#order-summary-total',
        '.payment-summary-total'
      ];

      for (const selector of totalSelectors) {
        const text = await page.locator(selector).textContent().catch(() => null);
        if (text) {
          totalPrice = this.parsePrice(text);
          if (totalPrice > 0) break;
        }
      }

      // Extract shipping cost
      let shippingCost = 0;
      const shippingSelectors = [
        '#subtotals-marketplace-table .shipping-cost',
        '.shipping-cost',
        '#order-summary-shipping'
      ];

      for (const selector of shippingSelectors) {
        const text = await page.locator(selector).textContent().catch(() => null);
        if (text) {
          shippingCost = this.parsePrice(text);
          break;
        }
      }

      // Extract tax
      let tax = 0;
      const taxSelectors = [
        '#subtotals-marketplace-table .tax-amount',
        '.tax-amount',
        '#order-summary-tax'
      ];

      for (const selector of taxSelectors) {
        const text = await page.locator(selector).textContent().catch(() => null);
        if (text) {
          tax = this.parsePrice(text);
          break;
        }
      }

      // Extract delivery estimate
      let estimatedDelivery = 'Unknown';
      const deliverySelectors = [
        '.shipment .delivery-date',
        '.delivery-date',
        '#order-summary-delivery-date'
      ];

      for (const selector of deliverySelectors) {
        const text = await page.locator(selector).textContent().catch(() => null);
        if (text) {
          estimatedDelivery = text.trim();
          break;
        }
      }

      // Extract product title
      let productTitle = 'Unknown';
      const titleSelectors = [
        '.product-title',
        '.sc-product-title',
        '#order-summary-product-title'
      ];

      for (const selector of titleSelectors) {
        const text = await page.locator(selector).textContent().catch(() => null);
        if (text) {
          productTitle = text.trim();
          break;
        }
      }

      // Check stock status
      const inStock = !(await page.locator('.out-of-stock-message').isVisible().catch(() => false));

      const currentPrice = totalPrice - shippingCost - tax;

      loggingService.info('Extracted checkout details', {
        totalPrice,
        shippingCost,
        tax,
        currentPrice,
        estimatedDelivery,
        inStock
      });

      return {
        totalPrice,
        shippingCost,
        tax,
        estimatedDelivery,
        inStock,
        productTitle,
        currentPrice
      };
    } catch (error) {
      loggingService.error('Error extracting checkout details', { error });
      
      // Return fallback values rather than failing
      return {
        totalPrice: 0,
        shippingCost: 0,
        tax: 0,
        estimatedDelivery: 'Unknown',
        inStock: true,
        productTitle: 'Unknown',
        currentPrice: 0
      };
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
   * Clear Amazon cart to ensure clean state for each order
   */
  private async clearCart(page: Page): Promise<void> {
    try {
      loggingService.info('Clearing Amazon cart');
      
      // Navigate to cart
      await page.goto('https://www.amazon.co.jp/gp/cart/view.html', { waitUntil: 'networkidle' });
      
      // Check if cart has items
      const cartEmpty = await page.locator('.sc-cart-empty').isVisible().catch(() => false);
      
      if (cartEmpty) {
        loggingService.info('Cart is already empty');
        return;
      }

      // Find all delete buttons and click them
      const deleteSelectors = [
        'input[value="削除"]', // Japanese "Delete"
        'input[data-action="delete"]',
        '.sc-action-delete input',
        'input[name^="submit.delete"]'
      ];

      let deletedCount = 0;
      for (const selector of deleteSelectors) {
        const deleteButtons = await page.locator(selector).all();
        
        for (const button of deleteButtons) {
          const isVisible = await button.isVisible().catch(() => false);
          if (isVisible) {
            await button.click();
            await page.waitForTimeout(500); // Wait for item to be removed
            deletedCount++;
          }
        }
        
        if (deletedCount > 0) {
          break; // Found and clicked delete buttons
        }
      }

      if (deletedCount > 0) {
        loggingService.info('Cart cleared successfully', { itemsDeleted: deletedCount });
        await page.waitForLoadState('networkidle');
      } else {
        loggingService.warn('Could not find delete buttons, cart may already be empty');
      }
    } catch (error) {
      loggingService.warn('Error clearing cart, continuing anyway', { error });
      // Don't throw - cart clearing is best-effort
    }
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
