/**
 * Autonomous Navigator Service
 * 
 * Intelligent browser automation that figures out how to interact with UI
 * without requiring explicit selectors. Finds elements by text, labels,
 * and semantic meaning.
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import type { DocumentationPlan, PlannedStep } from './appDiscoveryService.js';

export interface ExecutionResult {
  success: boolean;
  screenshots: ScreenshotResult[];
  stepsCompleted: number;
  totalSteps: number;
  errors: string[];
}

export interface ScreenshotResult {
  path: string;
  name: string;
  width: number;
  height: number;
  fileSize: number;
  capturedAt: Date;
  stepDescription?: string;
}

export interface ClickResult {
  success: boolean;
  element?: string;
  fallbackUsed?: string;
}

export interface FillResult {
  success: boolean;
  field?: string;
  valueUsed: string;
}

export interface PatternResult {
  pattern: 'modal' | 'toast' | 'confirmation' | 'loading';
  handled: boolean;
  action?: string;
}

class AutonomousNavigatorService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  /**
   * Execute a documentation plan, taking screenshots at each step
   */
  async executeDocumentationPlan(
    plan: DocumentationPlan,
    baseUrl: string,
    outputDir: string = 'docs/screenshots'
  ): Promise<ExecutionResult> {
    const screenshots: ScreenshotResult[] = [];
    const errors: string[] = [];
    let stepsCompleted = 0;

    try {
      // Initialize browser
      await this.initializeBrowser();

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Execute each step
      for (const step of plan.steps) {
        try {
          // Navigate to the URL with timeout
          const fullUrl = this.buildFullUrl(baseUrl, step.url);
          await this.page!.goto(fullUrl, {
            waitUntil: 'networkidle',
            timeout: 30000, // 30 second page load timeout
          });

          // Wait for page to be stable
          await this.waitForStable();

          // Handle common UI patterns (modals, toasts, etc.)
          await this.handleCommonPatterns();

          // Execute actions if any
          for (const action of step.actions) {
            await this.executeAction(action);
          }

          // Capture screenshot
          const screenshot = await this.captureStep(
            step.screenshotName,
            outputDir,
            step.description
          );
          screenshots.push(screenshot);

          stepsCompleted++;
        } catch (error) {
          const errorMsg = `Step ${step.order} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg);
          // Continue with next step
        }
      }

      return {
        success: errors.length === 0,
        screenshots,
        stepsCompleted,
        totalSteps: plan.steps.length,
        errors,
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Initialize Playwright browser
   */
  private async initializeBrowser(): Promise<void> {
    if (this.browser) {
      return; // Already initialized
    }

    this.browser = await chromium.launch({
      headless: true,
      args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    this.page = await this.context.newPage();
  }

  /**
   * Build full URL from base and path
   */
  private buildFullUrl(baseUrl: string, urlPath: string): string {
    // Remove trailing slash from base
    const base = baseUrl.replace(/\/$/, '');
    // Ensure path starts with slash
    const path = urlPath.startsWith('/') ? urlPath : '/' + urlPath;
    return base + path;
  }

  /**
   * Execute an action (click, type, etc.)
   */
  private async executeAction(action: any): Promise<void> {
    switch (action.type) {
      case 'click':
        await this.findAndClick(action.target);
        break;
      case 'type':
        await this.fillField(action.target, action.value || '');
        break;
      case 'wait':
        await this.page!.waitForTimeout(action.value || 1000);
        break;
      case 'scroll':
        await this.page!.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        break;
    }
  }

  /**
   * Intelligently find and click a button/link by its text or purpose
   */
  async findAndClick(target: string): Promise<ClickResult> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      // Try multiple strategies to find the element

      // Strategy 1: Find button by text
      const buttonSelector = `button:has-text("${target}")`;
      if (await this.page.locator(buttonSelector).count() > 0) {
        await this.page.locator(buttonSelector).first().click();
        return { success: true, element: 'button' };
      }

      // Strategy 2: Find link by text
      const linkSelector = `a:has-text("${target}")`;
      if (await this.page.locator(linkSelector).count() > 0) {
        await this.page.locator(linkSelector).first().click();
        return { success: true, element: 'link' };
      }

      // Strategy 3: Find by aria-label
      const ariaSelector = `[aria-label="${target}"]`;
      if (await this.page.locator(ariaSelector).count() > 0) {
        await this.page.locator(ariaSelector).first().click();
        return { success: true, element: 'aria-label' };
      }

      // Strategy 4: Find by role and name
      const roleSelector = `[role="button"]:has-text("${target}")`;
      if (await this.page.locator(roleSelector).count() > 0) {
        await this.page.locator(roleSelector).first().click();
        return { success: true, element: 'role-button' };
      }

      // Strategy 5: Find any clickable element with the text
      const anyClickable = `*:has-text("${target}")`;
      const elements = await this.page.locator(anyClickable).all();
      for (const element of elements) {
        if (await element.isVisible()) {
          await element.click();
          return { success: true, element: 'generic', fallbackUsed: 'text-search' };
        }
      }

      return { success: false };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Fill a form field intelligently (find by label, placeholder, or name)
   */
  async fillField(label: string, value: string): Promise<FillResult> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      // Strategy 1: Find input by label
      const labelSelector = `label:has-text("${label}")`;
      if (await this.page.locator(labelSelector).count() > 0) {
        const inputId = await this.page.locator(labelSelector).getAttribute('for');
        if (inputId) {
          await this.page.locator(`#${inputId}`).fill(value);
          return { success: true, field: 'label-for', valueUsed: value };
        }
      }

      // Strategy 2: Find input by placeholder
      const placeholderSelector = `input[placeholder*="${label}" i]`;
      if (await this.page.locator(placeholderSelector).count() > 0) {
        await this.page.locator(placeholderSelector).first().fill(value);
        return { success: true, field: 'placeholder', valueUsed: value };
      }

      // Strategy 3: Find input by name
      const nameSelector = `input[name*="${label.toLowerCase()}" i]`;
      if (await this.page.locator(nameSelector).count() > 0) {
        await this.page.locator(nameSelector).first().fill(value);
        return { success: true, field: 'name', valueUsed: value };
      }

      // Strategy 4: Find input by aria-label
      const ariaSelector = `input[aria-label*="${label}" i]`;
      if (await this.page.locator(ariaSelector).count() > 0) {
        await this.page.locator(ariaSelector).first().fill(value);
        return { success: true, field: 'aria-label', valueUsed: value };
      }

      return { success: false, valueUsed: value };
    } catch (error) {
      return { success: false, valueUsed: value };
    }
  }

  /**
   * Generate meaningful test data for forms
   */
  generateTestData(fieldType: string, hint?: string): string {
    const testData: { [key: string]: string } = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      phone: '555-0123',
      address: '123 Test Street',
      city: 'Test City',
      zip: '12345',
      country: 'United States',
      message: 'This is a test message for documentation purposes.',
      search: 'test query',
      username: 'testuser',
    };

    // Try to match by field type
    const lowerType = fieldType.toLowerCase();
    for (const [key, value] of Object.entries(testData)) {
      if (lowerType.includes(key)) {
        return value;
      }
    }

    // Try to match by hint
    if (hint) {
      const lowerHint = hint.toLowerCase();
      for (const [key, value] of Object.entries(testData)) {
        if (lowerHint.includes(key)) {
          return value;
        }
      }
    }

    // Default
    return 'Test Value';
  }

  /**
   * Wait for navigation/loading to complete
   */
  async waitForStable(): Promise<void> {
    if (!this.page) {
      return;
    }

    try {
      // Wait for network to be idle
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });

      // Wait a bit for animations
      await this.page.waitForTimeout(500);
    } catch (error) {
      // Timeout is acceptable, continue
    }
  }

  /**
   * Capture screenshot with descriptive metadata and retry logic
   */
  async captureStep(
    stepName: string,
    outputDir: string,
    description?: string
  ): Promise<ScreenshotResult> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const maxRetries = 2;
    const retryDelay = 2000; // 2 seconds
    let lastError: Error | null = null;

    // Try capturing screenshot with retries
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${stepName}_${timestamp}.png`;
        const filepath = path.join(outputDir, filename);

        // Capture screenshot with timeout
        const buffer = await this.page.screenshot({
          path: filepath,
          fullPage: true,
          timeout: 30000, // 30 second timeout
        });

        // Get viewport size
        const viewport = this.page.viewportSize() || { width: 1280, height: 720 };

        // Success!
        if (attempt > 0) {
          console.error(`Screenshot captured successfully on retry ${attempt}`);
        }

        return {
          path: filepath,
          name: filename,
          width: viewport.width,
          height: viewport.height,
          fileSize: buffer.length,
          capturedAt: new Date(),
          stepDescription: description,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Screenshot attempt ${attempt + 1} failed:`, lastError.message);

        // If this isn't the last attempt, wait before retrying
        if (attempt < maxRetries) {
          console.error(`Retrying in ${retryDelay}ms...`);
          await this.page.waitForTimeout(retryDelay);

          // Check if browser crashed and restart if needed
          if (lastError.message.includes('Target closed') || lastError.message.includes('Session closed')) {
            console.error('Browser appears to have crashed, restarting...');
            await this.cleanup();
            await this.initializeBrowser();
          }
        }
      }
    }

    // All retries failed
    throw new Error(
      `Failed to capture screenshot after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Handle common UI patterns (modals, confirmations, toasts)
   */
  async handleCommonPatterns(): Promise<PatternResult[]> {
    if (!this.page) {
      return [];
    }

    const results: PatternResult[] = [];

    try {
      // Check for cookie consent banners
      const cookieSelectors = [
        'button:has-text("Accept")',
        'button:has-text("Accept All")',
        'button:has-text("I Agree")',
        '[aria-label*="cookie" i] button',
      ];

      for (const selector of cookieSelectors) {
        if (await this.page.locator(selector).count() > 0) {
          await this.page.locator(selector).first().click();
          results.push({
            pattern: 'modal',
            handled: true,
            action: 'Accepted cookies',
          });
          await this.page.waitForTimeout(500);
          break;
        }
      }

      // Check for modals with close buttons
      const closeSelectors = [
        '[aria-label="Close"]',
        'button[aria-label*="close" i]',
        '.modal button:has-text("×")',
      ];

      for (const selector of closeSelectors) {
        if (await this.page.locator(selector).count() > 0) {
          const element = this.page.locator(selector).first();
          if (await element.isVisible()) {
            await element.click();
            results.push({
              pattern: 'modal',
              handled: true,
              action: 'Closed modal',
            });
            await this.page.waitForTimeout(500);
          }
        }
      }

      return results;
    } catch (error) {
      return results;
    }
  }

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Export singleton instance
export const autonomousNavigatorService = new AutonomousNavigatorService();
