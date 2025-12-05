# Playwright Automation - Enabled

## Overview

Semi-automated Amazon checkout using Playwright has been enabled. The system now automates the tedious parts of order fulfillment while maintaining human oversight for compliance.

## What Was Implemented

### 1. Environment Configuration
Added to `backend/.env`:
```bash
AMAZON_EMAIL=your-business-account@example.com
AMAZON_PASSWORD=your-secure-password
```

### 2. Browser Automation Service Updates

**File:** `backend/src/services/browserAutomationService.ts`

**Key Features:**
- ✅ Automatic detection of Playwright credentials
- ✅ Falls back to mock mode if credentials not set
- ✅ Session persistence (saves login state)
- ✅ Automatic Amazon.co.jp login
- ✅ 2FA support (waits for manual input)
- ✅ Product page navigation
- ✅ Add to cart automation
- ✅ Shipping address auto-fill
- ✅ Navigate to checkout review page
- ✅ Extract final price/shipping/tax
- ✅ **STOPS before "Place Order" button**

### 3. Compliance Features

**Human-in-the-Loop:**
- Browser stays open and visible (not headless)
- Admin sees every step in real-time
- System stops at review page
- Admin must manually approve and complete purchase

**Anti-Detection Measures:**
- Realistic browser fingerprint
- Japanese locale and timezone
- Human-like delays (200-500ms between actions)
- Session persistence (no repeated logins)
- Real Chrome browser (not headless)

## How It Works

### Automated Flow

1. **Admin clicks "Prepare Checkout"** in dashboard
2. **System automatically:**
   - Launches visible Chrome browser
   - Logs into Amazon.co.jp (or reuses session)
   - Navigates to product page
   - Adds product to cart
   - Fills customer's shipping address
   - Navigates to final review page
   - Extracts final price, shipping, tax
   - **STOPS and waits**

3. **Admin reviews:**
   - Sees browser with Amazon checkout page
   - Sees extracted details in Faxi dashboard
   - Verifies price matches quote
   - Checks shipping address is correct

4. **Admin completes:**
   - Manually clicks "Place Order" in Amazon browser
   - Copies Amazon Order ID
   - Enters Order ID in Faxi dashboard
   - Order marked as `purchased`

### Session Management

**First Time:**
- System logs into Amazon with credentials
- Saves session to `amazon-session.json`
- Future orders reuse this session

**Subsequent Orders:**
- Loads saved session
- No login required (unless expired)
- Much faster checkout preparation

**2FA Handling:**
- If 2FA is enabled on Amazon account
- System detects 2FA prompt
- Waits 60 seconds for manual input
- Admin enters 2FA code in browser
- Session saved for future use

## Testing the Automation

### Prerequisites
1. Valid Amazon.co.jp business account
2. Credentials added to `backend/.env`
3. Backend running: `cd backend && npm run dev`
4. Admin dashboard running: `cd admin-dashboard && npm run dev`

### Test Steps

1. **Create a test order:**
   - Use existing test fixtures or create via API
   - Order should have status `paid`
   - Order should have valid product ASIN
   - Order should have customer shipping address

2. **Navigate to order:**
   - Go to `http://localhost:4001/orders/pending`
   - Click "Review" on the test order

3. **Prepare checkout:**
   - Click "Prepare Checkout" button
   - Watch browser window open
   - System will log into Amazon (first time only)
   - System navigates through checkout
   - Browser stops at review page

4. **Review and complete:**
   - Check final price in browser
   - Check shipping address is correct
   - Manually click "Place Order" in Amazon
   - Copy Amazon Order ID (e.g., `123-4567890-1234567`)
   - Enter Order ID in Faxi dashboard
   - Click "Complete Purchase"

### Expected Behavior

✅ **Success Indicators:**
- Browser opens and is visible
- Login succeeds (or session reused)
- Product added to cart
- Shipping address filled
- Stops at review page (doesn't click Place Order)
- Extracted details match Amazon page

❌ **Failure Scenarios:**
- Invalid credentials → Login fails
- 2FA timeout → Manual intervention needed
- Product out of stock → Warning shown
- Amazon UI changed → Selectors may fail

## Compliance & Safety

### ToS Compliance

**What makes this compliant:**
1. ✅ Human reviews every purchase
2. ✅ Human clicks "Place Order"
3. ✅ Reasonable automation (not high-frequency bot)
4. ✅ Legitimate business purpose (proxy buying)
5. ✅ Using own business account
6. ✅ Transparent (browser visible)

**What would violate ToS:**
- ❌ Fully automated "Place Order" clicks
- ❌ Thousands of orders per minute
- ❌ Hiding automation (headless mode)
- ❌ Scraping other sellers' data
- ❌ Circumventing security measures

### Security Best Practices

**Credentials:**
- Store in `.env` file (not in code)
- Never commit `.env` to git
- Use strong, unique password
- Enable 2FA on Amazon account

**Session Management:**
- `amazon-session.json` contains login cookies
- Add to `.gitignore`
- Rotate sessions periodically
- Delete if compromised

**Rate Limiting:**
- Don't process >100 orders/hour
- Add delays between orders
- Operate during normal business hours
- Monitor for Amazon warnings

## Troubleshooting

### Browser doesn't open
**Cause:** Playwright not installed
**Fix:** `cd backend && npx playwright install chromium`

### Login fails
**Cause:** Invalid credentials or 2FA timeout
**Fix:** 
- Check `AMAZON_EMAIL` and `AMAZON_PASSWORD` in `.env`
- If 2FA enabled, enter code within 60 seconds
- Delete `amazon-session.json` and retry

### Can't find "Add to Cart" button
**Cause:** Amazon UI changed or product page different
**Fix:** 
- Check browser screenshot
- Update selectors in `addToCart()` method
- May need to handle different product page layouts

### Checkout navigation fails
**Cause:** Amazon checkout flow changed
**Fix:**
- Check browser at failure point
- Update selectors in `navigateToReview()` method
- May need to handle additional steps

### Price extraction returns 0
**Cause:** Selectors don't match Amazon's HTML
**Fix:**
- Inspect Amazon page HTML
- Update selectors in `extractCheckoutDetails()` method
- Add more fallback selectors

## Monitoring & Maintenance

### What to Monitor

1. **Success Rate:**
   - Track % of successful checkout preparations
   - Alert if drops below 90%

2. **Amazon Account Health:**
   - Watch for warning emails from Amazon
   - Monitor for CAPTCHA frequency
   - Check for account restrictions

3. **Session Expiry:**
   - Track how often re-login is needed
   - Typical: 1-2 weeks between logins

4. **Selector Failures:**
   - Log when selectors don't match
   - Update selectors when Amazon changes UI

### Maintenance Tasks

**Weekly:**
- Review automation logs
- Check for failed checkouts
- Update selectors if needed

**Monthly:**
- Rotate Amazon password
- Clear and refresh session
- Review Amazon account activity

**When Amazon Updates UI:**
- Test automation immediately
- Update selectors as needed
- May need to adjust flow logic

## Future Enhancements

### Phase 1: Optimization
- [ ] Parallel order processing
- [ ] Batch checkout for multiple orders
- [ ] Faster selector strategies
- [ ] Better error recovery

### Phase 2: Intelligence
- [ ] Auto-detect UI changes
- [ ] Self-healing selectors
- [ ] ML-based element detection
- [ ] Predictive failure alerts

### Phase 3: Scale
- [ ] Multiple Amazon accounts
- [ ] Load balancing across accounts
- [ ] Distributed browser instances
- [ ] Advanced rate limiting

## Summary

✅ **Playwright automation is now enabled and ready to use**

The system provides a perfect balance:
- **Automated:** Tedious navigation, form filling, data extraction
- **Human oversight:** Final review and purchase approval
- **Compliant:** Follows Amazon ToS with human-in-the-loop
- **Transparent:** Visible browser, clear audit trail
- **Scalable:** Can handle reasonable order volumes

This is exactly how successful proxy buying services operate - automation for efficiency, humans for compliance.
