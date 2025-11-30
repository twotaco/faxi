/**
 * Capture Demo Screenshots Script
 * 
 * This script captures screenshots of the demo page for documentation.
 * Run with: npx tsx backend/scripts/capture-demo-screenshots.ts
 */

import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

async function captureScreenshots() {
  console.log('🎬 Faxi Demo Screenshot Capture');
  console.log('================================\n');

  const baseUrl = 'http://localhost:4003/en/demo';
  const screenshotDir = path.join(process.cwd(), 'docs/screenshots');

  // Ensure screenshot directory exists
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log('📸 Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('📸 Capturing demo homepage...');
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: path.join(screenshotDir, 'demo-homepage.png'),
      fullPage: false
    });
    console.log('✅ Saved: demo-homepage.png');

    console.log('\n📸 Capturing sample faxes gallery...');
    // Ensure Sample Faxes mode is selected
    const sampleFaxesButton = page.locator('button:has-text("Sample Faxes")');
    if (await sampleFaxesButton.count() > 0) {
      await sampleFaxesButton.click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ 
      path: path.join(screenshotDir, 'sample-faxes-gallery.png'),
      fullPage: false
    });
    console.log('✅ Saved: sample-faxes-gallery.png');

    console.log('\n📸 Capturing sample fax preview dialog...');
    // Click on first fixture if available
    const fixtures = page.locator('[class*="fixture"], [data-testid*="fixture"]');
    const firstFixture = fixtures.first();
    if (await firstFixture.count() > 0) {
      await firstFixture.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ 
        path: path.join(screenshotDir, 'sample-fax-preview-dialog.png'),
        fullPage: false
      });
      console.log('✅ Saved: sample-fax-preview-dialog.png');
      
      // Close dialog
      const cancelButton = page.locator('button:has-text("Cancel")');
      if (await cancelButton.count() > 0) {
        await cancelButton.click();
        await page.waitForTimeout(500);
      }
    } else {
      console.log('⚠️  No fixtures found, skipping preview dialog');
    }

    console.log('\n📸 Capturing Create Your Own mode...');
    const createButton = page.locator('button:has-text("Create Your Own")');
    if (await createButton.count() > 0) {
      await createButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotDir, 'create-your-own-mode.png'),
        fullPage: false
      });
      console.log('✅ Saved: create-your-own-mode.png');

      console.log('\n📸 Capturing custom fax canvas...');
      // Try to draw on canvas if it exists
      const canvas = page.locator('canvas').first();
      if (await canvas.count() > 0) {
        const box = await canvas.boundingBox();
        if (box) {
          // Draw a simple shape
          await page.mouse.move(box.x + 100, box.y + 100);
          await page.mouse.down();
          await page.mouse.move(box.x + 300, box.y + 100);
          await page.mouse.move(box.x + 300, box.y + 150);
          await page.mouse.move(box.x + 100, box.y + 150);
          await page.mouse.move(box.x + 100, box.y + 100);
          await page.mouse.up();
          await page.waitForTimeout(500);
        }
        await page.screenshot({ 
          path: path.join(screenshotDir, 'custom-fax-canvas.png'),
          fullPage: false
        });
        console.log('✅ Saved: custom-fax-canvas.png');
      } else {
        console.log('⚠️  No canvas found, skipping canvas screenshot');
      }
    } else {
      console.log('⚠️  Create Your Own button not found');
    }

    console.log('\n📸 Capturing Upload File mode...');
    const uploadButton = page.locator('button:has-text("Upload File")');
    if (await uploadButton.count() > 0) {
      await uploadButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotDir, 'upload-file-mode.png'),
        fullPage: false
      });
      console.log('✅ Saved: upload-file-mode.png');

      console.log('\n📸 Capturing file upload area...');
      await page.screenshot({ 
        path: path.join(screenshotDir, 'file-upload-area.png'),
        fullPage: false
      });
      console.log('✅ Saved: file-upload-area.png');
    } else {
      console.log('⚠️  Upload File button not found');
    }

    console.log('\n✅ Screenshot capture complete!');
    console.log(`📁 Screenshots saved to: ${screenshotDir}`);
    console.log('\n📝 Next steps:');
    console.log('1. Review screenshots in docs/screenshots/');
    console.log('2. Manually capture processing and results screenshots by:');
    console.log('   - Processing a sample fax');
    console.log('   - Taking screenshots during and after processing');
    console.log('3. Update demo-guide.md with actual image references');

  } catch (error) {
    console.error('\n❌ Error capturing screenshots:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the script
captureScreenshots().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

