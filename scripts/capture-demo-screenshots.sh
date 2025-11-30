#!/bin/bash

# Capture Demo Screenshots Script
# This script helps capture screenshots for the demo guide documentation

set -e

echo "🎬 Faxi Demo Screenshot Capture Script"
echo "========================================"
echo ""

# Check if marketing website is running
echo "Checking if marketing website is running on port 4003..."
if ! curl -s http://localhost:4003/en/demo > /dev/null; then
    echo "❌ Marketing website is not running on port 4003"
    echo ""
    echo "Please start the marketing website first:"
    echo "  cd marketing-website"
    echo "  npm run dev"
    echo ""
    exit 1
fi

echo "✅ Marketing website is running"
echo ""

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js"
    exit 1
fi

echo "📸 Capturing screenshots..."
echo ""

# Create screenshots directory if it doesn't exist
mkdir -p docs/screenshots

# Use Playwright to capture screenshots
# This requires the marketing website to be running

cat > /tmp/capture-demo-screenshots.mjs << 'EOF'
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  const baseUrl = 'http://localhost:4003/en/demo';
  const screenshotDir = path.join(process.cwd(), 'docs/screenshots');

  console.log('📸 Capturing demo homepage...');
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ 
    path: path.join(screenshotDir, 'demo-homepage.png'),
    fullPage: false
  });

  console.log('📸 Capturing sample faxes gallery...');
  // Already on the page, just ensure Sample Faxes is selected
  await page.click('button:has-text("Sample Faxes")');
  await page.waitForTimeout(1000);
  await page.screenshot({ 
    path: path.join(screenshotDir, 'sample-faxes-gallery.png'),
    fullPage: false
  });

  console.log('📸 Capturing sample fax preview dialog...');
  // Click on first fixture
  const firstFixture = await page.locator('.fixture-card, [data-testid="fixture-card"]').first();
  if (await firstFixture.count() > 0) {
    await firstFixture.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotDir, 'sample-fax-preview-dialog.png'),
      fullPage: false
    });
    
    // Close dialog
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(500);
  }

  console.log('📸 Capturing Create Your Own mode...');
  await page.click('button:has-text("Create Your Own")');
  await page.waitForTimeout(1000);
  await page.screenshot({ 
    path: path.join(screenshotDir, 'create-your-own-mode.png'),
    fullPage: false
  });

  console.log('📸 Capturing custom fax canvas...');
  // Draw something on canvas if it exists
  const canvas = await page.locator('canvas').first();
  if (await canvas.count() > 0) {
    const box = await canvas.boundingBox();
    if (box) {
      // Draw a simple line
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 50);
      await page.mouse.move(box.x + 200, box.y + 100);
      await page.mouse.up();
      await page.waitForTimeout(500);
    }
  }
  await page.screenshot({ 
    path: path.join(screenshotDir, 'custom-fax-canvas.png'),
    fullPage: false
  });

  console.log('📸 Capturing Upload File mode...');
  await page.click('button:has-text("Upload File")');
  await page.waitForTimeout(1000);
  await page.screenshot({ 
    path: path.join(screenshotDir, 'upload-file-mode.png'),
    fullPage: false
  });

  console.log('📸 Capturing file upload area...');
  await page.screenshot({ 
    path: path.join(screenshotDir, 'file-upload-area.png'),
    fullPage: false
  });

  console.log('✅ All screenshots captured successfully!');
  console.log('📁 Screenshots saved to: docs/screenshots/');

  await browser.close();
}

captureScreenshots().catch(console.error);
EOF

# Run the screenshot capture script
cd backend && npx playwright install chromium 2>/dev/null || true
cd ..
node /tmp/capture-demo-screenshots.mjs

# Clean up
rm /tmp/capture-demo-screenshots.mjs

echo ""
echo "✅ Screenshot capture complete!"
echo ""
echo "📝 Next steps:"
echo "1. Review screenshots in docs/screenshots/"
echo "2. Capture processing and results screenshots manually by:"
echo "   - Processing a sample fax"
echo "   - Taking screenshots during and after processing"
echo "3. Update demo-guide.md if needed"
echo ""
echo "🎉 Demo guide is ready at: docs/help/demo-guide.md"

