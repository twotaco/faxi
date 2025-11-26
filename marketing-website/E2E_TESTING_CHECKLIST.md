# End-to-End Testing Checklist

## Pre-Deployment Verification

Before deploying to production, verify the following in your local environment:

- [ ] Marketing website builds successfully (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] Backend API is accessible
- [ ] Environment variables are configured

## Production Deployment Testing

### 1. Home Page Testing

#### Desktop (1920x1080)
- [ ] Page loads within 3 seconds
- [ ] Hero section displays correctly
- [ ] Language toggle works (Japanese ↔ English)
- [ ] All CTAs are clickable and navigate correctly
- [ ] Problem/Solution section renders with statistics
- [ ] Use case cards display with hover effects
- [ ] Testimonials section loads
- [ ] Footer links work
- [ ] No console errors

#### Tablet (768x1024)
- [ ] Responsive layout adjusts correctly
- [ ] Navigation menu collapses to hamburger
- [ ] All content is readable
- [ ] Touch interactions work
- [ ] Images scale appropriately

#### Mobile (375x667)
- [ ] Mobile layout renders correctly
- [ ] Text is readable without zooming
- [ ] Buttons are tap-friendly (min 44x44px)
- [ ] Navigation menu works
- [ ] No horizontal scrolling

### 2. Service Page Testing

#### Content Verification
- [ ] Service overview section loads
- [ ] Use case detail cards display
- [ ] Before/after images load correctly
- [ ] FAQ accordion expands/collapses
- [ ] All links work
- [ ] Japanese and English content both display correctly

#### Responsive Testing
- [ ] Desktop layout (1920x1080)
- [ ] Tablet layout (768x1024)
- [ ] Mobile layout (375x667)

### 3. Partnering Page Testing

#### Content Verification
- [ ] Partner value proposition displays
- [ ] Partner benefits section loads
- [ ] Contact form renders
- [ ] Form validation works
- [ ] Submit button is functional
- [ ] All statistics display correctly

#### Form Testing
- [ ] Required field validation
- [ ] Email format validation
- [ ] Partner type selection works
- [ ] Message textarea accepts input
- [ ] Form submission (if backend connected)

### 4. Demo Page Testing

#### Fixture Selection
- [ ] Fixtures load from backend API
- [ ] Fixture thumbnails display
- [ ] Fixture categories are organized
- [ ] Click to select works
- [ ] Selected fixture is highlighted

#### File Upload
- [ ] Drag-and-drop area is visible
- [ ] File type validation works (PNG, JPEG, PDF)
- [ ] File preview displays
- [ ] Upload progress indicator shows
- [ ] Error messages for invalid files

#### Processing
- [ ] Processing status updates in real-time
- [ ] Progress indicators animate
- [ ] Processing steps display
- [ ] Estimated time shows (if applicable)

#### Results Display
- [ ] Extracted text displays correctly
- [ ] Detected annotations show with overlays
- [ ] Identified intent is clear
- [ ] AI confidence scores display
- [ ] Processing time is shown
- [ ] Visualization of bounding boxes works

#### API Integration
- [ ] `/api/demo/fixtures` endpoint responds
- [ ] `/api/demo/process` endpoint works
- [ ] CORS headers are present
- [ ] Error handling works for failed requests
- [ ] Loading states display correctly

### 5. Tech Page Testing

#### Content Verification
- [ ] Architecture diagram renders
- [ ] Tech stack section displays
- [ ] MCP integration section loads
- [ ] AI models section shows
- [ ] All tooltips work (if interactive)
- [ ] Code snippets are formatted correctly

#### Responsive Testing
- [ ] Desktop layout
- [ ] Tablet layout
- [ ] Mobile layout (diagram may need horizontal scroll)

### 6. Metrics Dashboard Testing (if accessible)

#### Data Loading
- [ ] Accuracy metrics load from backend
- [ ] Processing statistics display
- [ ] Charts render correctly (Recharts)
- [ ] Real-time updates work (if polling enabled)
- [ ] Last updated timestamp shows

#### Chart Interactions
- [ ] Line chart for accuracy trends
- [ ] Bar chart for use case breakdown
- [ ] Pie chart for confidence distribution
- [ ] Tooltips display on hover
- [ ] Legends are readable

#### API Integration
- [ ] `/api/metrics/accuracy` endpoint responds
- [ ] `/api/metrics/processing-stats` endpoint works
- [ ] CORS headers are present
- [ ] Caching works (5 minute TTL)
- [ ] Error handling for failed requests

### 7. Language Switching Testing

#### Japanese (ja)
- [ ] All pages load in Japanese
- [ ] URL structure correct (`/ja/...`)
- [ ] Content displays in Japanese
- [ ] Fonts render correctly (Noto Sans JP)
- [ ] No English fallback text visible

#### English (en)
- [ ] All pages load in English
- [ ] URL structure correct (`/en/...`)
- [ ] Content displays in English
- [ ] Translations are accurate
- [ ] No Japanese fallback text visible

#### Switching
- [ ] Language toggle in header works
- [ ] Current language is indicated
- [ ] Switching preserves current page
- [ ] URL updates correctly
- [ ] No page reload (if using client-side routing)

### 8. Navigation Testing

#### Header Navigation
- [ ] Logo links to home page
- [ ] All navigation links work
- [ ] Active page is highlighted
- [ ] Dropdown menus work (if any)
- [ ] Language toggle is accessible

#### Footer Navigation
- [ ] All footer links work
- [ ] Social media links open in new tab
- [ ] GitHub link works
- [ ] Documentation link works
- [ ] Policy pages load (Privacy, Terms)

#### Mobile Navigation
- [ ] Hamburger menu opens/closes
- [ ] All links accessible in mobile menu
- [ ] Menu closes after selection
- [ ] No layout issues

### 9. CTA Testing

#### Primary CTAs
- [ ] "Sign Up" button works
- [ ] "Try Demo" button navigates to demo page
- [ ] "Partner With Us" button navigates to partnering page
- [ ] "View Technical Details" button navigates to tech page

#### Secondary CTAs
- [ ] "Learn More" links work
- [ ] "See How It Works" navigates correctly
- [ ] "Request Demo" button works
- [ ] GitHub repository link opens

#### Visual Hierarchy
- [ ] Primary CTAs are prominent
- [ ] Secondary CTAs are distinguishable
- [ ] Hover states work
- [ ] Focus states are visible (keyboard navigation)

### 10. Accessibility Testing

#### Keyboard Navigation
- [ ] Tab order is logical
- [ ] All interactive elements are reachable
- [ ] Focus indicators are visible
- [ ] Enter/Space activate buttons
- [ ] Escape closes modals/menus

#### Screen Reader Testing (NVDA/JAWS)
- [ ] Page title is announced
- [ ] Headings are properly structured (H1, H2, H3)
- [ ] Images have alt text
- [ ] Links have descriptive text
- [ ] Form labels are associated with inputs
- [ ] ARIA labels are present where needed

#### Visual Accessibility
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 for text)
- [ ] Text is at least 16px
- [ ] Line height is at least 1.5
- [ ] Focus indicators are visible
- [ ] No information conveyed by color alone

### 11. Performance Testing

#### Lighthouse Audit
- [ ] Performance score ≥ 85
- [ ] Accessibility score = 100
- [ ] Best Practices score ≥ 90
- [ ] SEO score ≥ 90

#### Load Times
- [ ] First Contentful Paint < 1.8s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Time to Interactive < 3.8s
- [ ] Cumulative Layout Shift < 0.1

#### Network
- [ ] Images are optimized (WebP format)
- [ ] Lazy loading works for images
- [ ] Code splitting is effective
- [ ] Caching headers are set
- [ ] Gzip/Brotli compression enabled

### 12. Cross-Browser Testing

#### Chrome (Latest)
- [ ] All functionality works
- [ ] Layout is correct
- [ ] No console errors

#### Firefox (Latest)
- [ ] All functionality works
- [ ] Layout is correct
- [ ] No console errors

#### Safari (Latest)
- [ ] All functionality works
- [ ] Layout is correct
- [ ] No console errors
- [ ] iOS Safari tested (if possible)

#### Edge (Latest)
- [ ] All functionality works
- [ ] Layout is correct
- [ ] No console errors

### 13. Error Handling Testing

#### Network Errors
- [ ] API timeout shows error message
- [ ] Failed requests show retry option
- [ ] Offline state is handled gracefully
- [ ] Error boundaries catch React errors

#### User Errors
- [ ] Invalid form input shows validation errors
- [ ] File upload errors are clear
- [ ] 404 page displays for invalid routes
- [ ] Error messages are user-friendly

### 14. SEO Testing

#### Meta Tags
- [ ] Title tags are present and unique
- [ ] Meta descriptions are present
- [ ] Open Graph tags for social sharing
- [ ] Twitter Card tags
- [ ] Canonical URLs are set

#### Structured Data
- [ ] Schema.org markup (if applicable)
- [ ] JSON-LD for organization/website
- [ ] Breadcrumbs markup (if applicable)

#### Sitemap & Robots
- [ ] sitemap.xml is accessible
- [ ] robots.txt is configured
- [ ] No pages blocked unintentionally

## Post-Deployment Verification

### Immediate Checks (Within 1 hour)
- [ ] Production URL is accessible
- [ ] SSL certificate is valid
- [ ] DNS is resolving correctly
- [ ] All pages load without errors
- [ ] Backend API is reachable from production
- [ ] CORS is configured correctly

### 24-Hour Checks
- [ ] Analytics are tracking (if configured)
- [ ] Error monitoring is working (if configured)
- [ ] No critical errors in logs
- [ ] Performance metrics are acceptable
- [ ] User feedback (if any) is positive

### Weekly Checks
- [ ] Uptime is ≥ 99.9%
- [ ] Performance hasn't degraded
- [ ] No security vulnerabilities reported
- [ ] Backup systems are working (if applicable)

## Testing Tools

### Automated Testing
- Lighthouse CI
- WebPageTest
- GTmetrix
- Pingdom

### Manual Testing
- Browser DevTools
- WAVE (Web Accessibility Evaluation Tool)
- axe DevTools
- Screen readers (NVDA, JAWS, VoiceOver)

### API Testing
- Postman
- curl
- Browser Network tab

## Reporting Issues

When reporting issues, include:
1. **Environment**: Browser, OS, device
2. **Steps to Reproduce**: Exact steps to trigger the issue
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Screenshots/Videos**: Visual evidence
6. **Console Errors**: Any JavaScript errors
7. **Network Logs**: Failed API requests

## Sign-Off

Testing completed by: ___________________
Date: ___________________
Environment: Production / Staging
All critical issues resolved: Yes / No

Notes:
_______________________________________
_______________________________________
_______________________________________
