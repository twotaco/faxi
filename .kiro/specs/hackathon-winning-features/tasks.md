# Implementation Plan

- [x] 1. Backend API enhancements for demo and metrics
  - Create new API endpoints to support the marketing website demo and metrics dashboard
  - Enhance existing AI services to return visualization data
  - Add database tables for tracking metrics
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.3, 2.4, 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 1.1 Create database migrations for new tables
  - Create `processing_metrics` table for tracking AI accuracy and performance
  - Create `demo_sessions` table for tracking demo usage
  - Create `accuracy_snapshots` table for historical accuracy data
  - Add indexes for efficient querying
  - _Requirements: 1.5, 2.1_

- [x] 1.2 Enhance AI vision interpreter to return visualization data
  - Modify `aiVisionInterpreter.ts` to return bounding boxes for detected text regions
  - Add `textRegions` array with coordinates and confidence scores
  - Generate `visualizationData` with annotated regions
  - Include region types (text, annotation, form-field, signature)
  - _Requirements: 1.2, 1.3_

- [x] 1.3 Write property test for visualization data completeness
  - **Property 2: Visualization data completeness**
  - **Validates: Requirements 1.2, 1.3, 1.4**

- [x] 1.4 Enhance visual annotation detector to return bounding boxes
  - Modify `visualAnnotationDetector.ts` to return bounding box coordinates
  - Add color codes for each annotation type (checkmark, circle, arrow, underline)
  - Include confidence scores for each detected annotation
  - _Requirements: 1.4_

- [x] 1.5 Enhance intent extractor to return detailed confidence breakdown
  - Modify `intentExtractor.ts` to return confidence by component
  - Add alternative intents with confidence scores
  - Include reasoning for intent classification
  - _Requirements: 1.2_

- [x] 1.6 Create metrics calculation service
  - Implement service to calculate overall accuracy from processing_metrics table
  - Calculate accuracy by category (OCR, annotation, intent)
  - Calculate accuracy by use case
  - Generate accuracy trends over time
  - Calculate processing statistics (avg time, success rate, confidence distribution)
  - _Requirements: 2.1, 2.3, 2.4_

- [x] 1.7 Create demo API endpoints
  - Implement `GET /api/demo/fixtures` to list available test fixtures
  - Implement `POST /api/demo/process` to process uploaded images or fixture IDs
  - Implement `GET /api/demo/result/:faxId` to poll for processing results
  - Add request validation and error handling
  - Include rate limiting (10 requests per 15 minutes)
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 1.8 Create metrics API endpoints
  - Implement `GET /api/metrics/accuracy` to return accuracy metrics
  - Implement `GET /api/metrics/processing-stats` to return processing statistics
  - Add caching for metrics (5 minute TTL)
  - Include error handling with fallback to cached data
  - _Requirements: 2.1, 2.3, 2.4, 10.4_

- [x] 1.9 Configure CORS for marketing website
  - Add CORS middleware for `/api/demo` and `/api/metrics` endpoints
  - Allow requests from marketing website origin (port 4003)
  - Configure appropriate headers and methods
  - _Requirements: 10.5_

- [x] 1.10 Write property test for CORS header presence
  - **Property 5: CORS header presence**
  - **Validates: Requirements 10.5**

- [x] 1.11 Write property test for metrics API completeness
  - **Property 4: Metrics API completeness**
  - **Validates: Requirements 2.1, 2.3, 2.4**

- [x] 1.12 Write unit tests for demo and metrics endpoints
  - Test fixture listing endpoint
  - Test demo processing endpoint with valid and invalid inputs
  - Test metrics endpoints with and without data
  - Test rate limiting behavior
  - Test CORS configuration
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 2. Initialize marketing website project
  - Set up Next.js 14 project with TypeScript and Tailwind CSS
  - Configure bilingual support (Japanese and English)
  - Set up project structure and routing
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2.1 Create Next.js project in marketing-website directory
  - Initialize Next.js 14 with App Router
  - Configure TypeScript
  - Set up Tailwind CSS
  - Install shadcn/ui components
  - Install Recharts for data visualization
  - Install Framer Motion for animations
  - Install next-intl for internationalization
  - _Requirements: 3.1, 3.5_

- [x] 2.2 Set up bilingual support with next-intl
  - Configure Japanese and English locales
  - Create translation files for both languages
  - Set up language detection and switching
  - Implement URL structure for locales (/ja, /en)
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 2.3 Create page structure and routing
  - Create home page (/)
  - Create service page (/service) for families
  - Create partnering page (/partnering) for B2B
  - Create demo page (/demo) for interactive demo
  - Create tech page (/tech) for technical details
  - Create about page (/about)
  - Create policy pages (/privacy, /terms)
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 2.4 Create shared layout components
  - Create header with language toggle and navigation
  - Create footer with links and contact info
  - Create responsive navigation menu
  - Add SEO meta tags and Open Graph tags
  - _Requirements: 3.2, 3.5_

- [x] 2.5 Create API client for backend communication
  - Implement fetch wrapper with error handling
  - Create hooks for demo processing
  - Create hooks for metrics fetching
  - Add loading and error states
  - Configure API base URL from environment variables
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 3. Implement home page with hero and content sections
  - Create hero section with audience-specific messaging
  - Add problem/solution section
  - Add use case highlights
  - Add testimonials
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3.1 Create hero section component
  - Implement responsive hero with headline and subheadline
  - Add primary CTA buttons
  - Support audience-specific messaging (families, partners, investors)
  - Add language toggle
  - Include background image or gradient
  - _Requirements: 3.1, 3.2_

- [x] 3.2 Create problem/solution section
  - Add problem statement with Japan-specific statistics
  - Add solution description
  - Include data visualizations for digital divide
  - Add animated number counters for impact metrics
  - _Requirements: 3.3, 6.1, 6.3_

- [x] 3.3 Create use case highlights section
  - Display 4+ use case cards (healthcare, shopping, government, AI chat)
  - Include icons and descriptions
  - Add hover effects and animations
  - Link to detailed use case pages
  - _Requirements: 3.3, 4.1_

- [x] 3.4 Create testimonials section
  - Display user testimonials with quotes
  - Include demographic information
  - Add photos (if available)
  - Implement carousel or grid layout
  - _Requirements: 6.2_

- [x] 3.5 Write unit tests for home page components
  - Test hero section rendering
  - Test problem/solution section
  - Test use case cards
  - Test testimonials display
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Implement service page for families
  - Use provided Japanese content for service descriptions
  - Translate to English
  - Add step-by-step guide
  - Include examples and illustrations
  - _Requirements: 3.3, 4.1, 4.2, 4.3_

- [x] 4.1 Create service overview section
  - Display service registration process
  - Show how fax-to-email works
  - Include example fax formats
  - Add visual diagrams
  - _Requirements: 3.3, 4.1_

- [x] 4.2 Create use case detail cards
  - Implement expandable use case cards
  - Include before/after fax images
  - Add technical details in expandable sections
  - Implement lazy loading for images
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4.3 Write property test for use case completeness
  - **Property 6: Use case completeness**
  - **Validates: Requirements 4.2, 4.3, 4.5**

- [x] 4.4 Create FAQ section
  - Add common questions and answers
  - Implement accordion UI
  - Include contact information
  - _Requirements: 3.3_

- [x] 4.5 Write unit tests for service page components
  - Test service overview rendering
  - Test use case cards
  - Test FAQ accordion
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Implement partnering page for B2B
  - Use provided Japanese content for partner descriptions
  - Translate to English
  - Add partner types and benefits
  - Include contact form
  - _Requirements: 3.3, 4.1, 4.2, 4.3_

- [x] 5.1 Create partner value proposition section
  - Display market opportunity (10M+ elderly users)
  - Show partner types (healthcare, e-commerce, government, advertisers, data buyers)
  - Include benefits for each partner type
  - Add case studies or examples
  - _Requirements: 3.3, 6.1_

- [x] 5.2 Create partner benefits section
  - Display data insights available to partners
  - Show market statistics
  - Include revenue opportunities
  - Add testimonials from partners (if available)
  - _Requirements: 6.1, 6.2, 6.4_

- [x] 5.3 Create partner contact form
  - Implement form with partner type selection
  - Add company information fields
  - Include message textarea
  - Add form validation
  - Integrate with backend or email service
  - _Requirements: 8.1, 8.2_

- [x] 5.4 Write unit tests for partnering page components
  - Test partner value proposition rendering
  - Test partner benefits section
  - Test contact form validation
  - _Requirements: 3.3, 6.1, 8.1_

- [x] 6. Implement interactive demo page
  - Create fixture selection interface
  - Add upload functionality
  - Display processing results with visualizations
  - Show AI confidence scores and metrics
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 6.1 Create fixture selection component
  - Display 6+ test fixtures from backend API
  - Show fixture thumbnails and descriptions
  - Group by category (email, shopping, AI chat, payment)
  - Add click to select functionality
  - _Requirements: 5.1_

- [x] 6.2 Create file upload component
  - Implement drag-and-drop file upload
  - Add file type validation (PNG, JPEG, PDF)
  - Show file preview
  - Add upload progress indicator
  - Include disclaimers for custom uploads
  - _Requirements: 5.5_

- [x] 6.3 Create processing status component
  - Display real-time processing steps
  - Show progress indicators
  - Add loading animations
  - Display estimated time remaining
  - _Requirements: 5.2_

- [x] 6.4 Create results display component
  - Show extracted text with formatting
  - Display detected annotations with color-coded overlays
  - Show identified intent and parameters
  - Display AI confidence scores
  - Show processing time
  - Include visualization of bounding boxes
  - _Requirements: 5.3, 5.4_

- [x] 6.5 Write property test for demo result display completeness
  - **Property 7: Demo result display completeness**
  - **Validates: Requirements 5.3, 5.4**

- [x] 6.6 Write integration tests for demo flow
  - Test fixture selection and processing
  - Test file upload and processing
  - Test error handling
  - Test result display
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7. Implement metrics dashboard for investors/judges
  - Display AI accuracy metrics
  - Show processing statistics
  - Add interactive charts
  - Include real-time data updates
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 7.1 Create accuracy metrics component
  - Display overall accuracy percentage
  - Show breakdown by category (OCR, annotation, intent)
  - Show breakdown by use case
  - Add accuracy trend chart over time
  - _Requirements: 2.1, 2.4_

- [x] 7.2 Create processing statistics component
  - Display average processing time
  - Show success rate percentage
  - Display confidence score distribution chart
  - Show total faxes processed
  - _Requirements: 2.3_

- [x] 7.3 Create interactive charts with Recharts
  - Implement line chart for accuracy trends
  - Implement bar chart for use case breakdown
  - Implement pie chart for confidence distribution
  - Add tooltips and legends
  - Make charts responsive
  - _Requirements: 2.2_

- [x] 7.4 Add real-time data fetching
  - Implement polling for metrics updates (every 30 seconds)
  - Add manual refresh button
  - Show last updated timestamp
  - Handle loading and error states
  - _Requirements: 2.5_

- [x] 7.5 Write unit tests for metrics dashboard components
  - Test accuracy metrics display
  - Test processing statistics display
  - Test chart rendering
  - Test data fetching and updates
  - _Requirements: 2.1, 2.3, 2.4_

- [x] 8. Implement technical architecture page for investors/judges
  - Add architecture diagram
  - Display tech stack
  - Show MCP integration examples
  - Explain AI models and techniques
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8.1 Create architecture diagram section
  - Create Mermaid diagram or SVG of system architecture
  - Show component relationships
  - Include data flow
  - Add interactive tooltips for components
  - _Requirements: 7.1_

- [x] 8.2 Create tech stack section
  - List frontend technologies (Next.js, React, TypeScript, Tailwind)
  - List backend technologies (Express, PostgreSQL, Redis, S3)
  - List AI technologies (Claude, GPT-4 Vision, etc.)
  - Include brief descriptions for each
  - Add icons for technologies
  - _Requirements: 7.3_

- [x] 8.3 Create MCP integration section
  - Display available MCP servers (email, shopping, AI chat, payment, appointments)
  - Show example integrations
  - Explain extensibility
  - Add code snippets (optional)
  - _Requirements: 7.4_

- [x] 8.4 Create AI models section
  - List AI models used (vision, NLP, intent classification)
  - Show accuracy metrics for each model
  - Explain techniques (OCR, annotation detection, etc.)
  - Balance technical depth with accessibility
  - _Requirements: 7.2, 7.5_

- [x] 8.5 Write unit tests for technical page components
  - Test architecture diagram rendering
  - Test tech stack display
  - Test MCP integration section
  - Test AI models section
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 9. Implement impact and social proof section
  - Add impact statistics with sources
  - Display testimonials
  - Create data visualizations
  - Add animated counters
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 9.1 Create impact statistics component
  - Display key statistics (10M+ fax users, 25% seniors offline, etc.)
  - Add source citations for each statistic
  - Implement animated number counters
  - Make statistics visually prominent
  - _Requirements: 6.1, 6.4_

- [x] 9.2 Write property test for statistics source attribution
  - **Property 11: Statistics source attribution**
  - **Validates: Requirements 6.4**

- [x] 9.3 Create data visualization component
  - Create chart showing digital divide in Japan
  - Show elderly population demographics
  - Display fax machine usage statistics
  - Use Recharts for visualizations
  - _Requirements: 6.3_

- [x] 9.4 Write unit tests for impact section components
  - Test statistics display
  - Test source citations
  - Test data visualizations
  - _Requirements: 6.1, 6.3, 6.4_

- [x] 10. Implement CTAs and conversion elements
  - Add CTAs throughout the site
  - Create distinct CTAs for different audiences
  - Add GitHub and documentation links
  - Implement visual hierarchy
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 10.1 Create CTA components
  - Implement primary CTA button component
  - Implement secondary CTA button component
  - Add CTAs for families (sign up, pricing)
  - Add CTAs for partners (partner with us, request demo)
  - Add CTAs for investors (technical details, GitHub)
  - _Requirements: 8.1, 8.3_

- [x] 10.2 Add GitHub and documentation links
  - Add GitHub repository link in header/footer
  - Add documentation link
  - Add API documentation link (if available)
  - Include social media links
  - _Requirements: 8.5_

- [x] 10.3 Write unit tests for CTA components
  - Test CTA rendering
  - Test navigation behavior
  - Test visual hierarchy
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 11. Implement accessibility and performance optimizations
  - Ensure WCAG 2.1 AA compliance
  - Optimize images and assets
  - Improve page load performance
  - Add keyboard navigation support
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 11.1 Implement image accessibility
  - Add descriptive alt text to all images
  - Ensure alt text is non-empty
  - Use semantic HTML for images
  - Implement lazy loading for images
  - _Requirements: 9.3_

- [x] 11.2 Write property test for image accessibility
  - **Property 8: Accessibility compliance for images**
  - **Validates: Requirements 9.3**

- [x] 11.3 Implement interactive element accessibility
  - Add ARIA labels to buttons and links
  - Ensure form inputs have labels
  - Add focus indicators
  - Use semantic HTML throughout
  - _Requirements: 9.5_

- [x] 11.4 Write property test for interactive element accessibility
  - **Property 9: Interactive elements accessibility**
  - **Validates: Requirements 9.5**

- [x] 11.5 Implement typography accessibility
  - Ensure body text is at least 16px
  - Set appropriate line heights (1.5+)
  - Use sufficient color contrast
  - Support font scaling
  - _Requirements: 3.4_

- [x] 11.6 Write property test for typography accessibility
  - **Property 10: Typography accessibility**
  - **Validates: Requirements 3.4**

- [x] 11.7 Optimize performance
  - Optimize images (WebP format, compression)
  - Implement code splitting
  - Add caching headers
  - Minimize JavaScript bundle size
  - Lazy load components
  - _Requirements: 9.1_

- [x] 11.8 Run Lighthouse audit and fix issues
  - Run Lighthouse performance audit
  - Run Lighthouse accessibility audit
  - Fix issues to achieve 85+ performance score
  - Fix issues to achieve WCAG 2.1 AA compliance
  - _Requirements: 9.1, 9.2_

- [x] 11.9 Implement keyboard navigation
  - Ensure all interactive elements are keyboard accessible
  - Add skip links for navigation
  - Test tab order
  - Add keyboard shortcuts (optional)
  - _Requirements: 9.4_

- [x] 11.10 Write integration tests for accessibility
  - Test keyboard navigation
  - Test screen reader compatibility
  - Test focus management
  - _Requirements: 9.2, 9.4, 9.5_

- [x] 12. Content integration and translation
  - Add provided Japanese content to all pages
  - Translate content to English
  - Ensure consistency across languages
  - Add Japanese fonts
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 12.1 Add Japanese content to pages
  - Add Japanese content to home page
  - Add Japanese content to service page
  - Add Japanese content to partnering page
  - Add Japanese content to other pages
  - _Requirements: 3.2, 3.3_

- [x] 12.2 Translate content to English
  - Translate home page content
  - Translate service page content
  - Translate partnering page content
  - Translate other page content
  - Ensure translations maintain meaning and tone
  - _Requirements: 3.2, 3.3_

- [x] 12.3 Configure Japanese fonts
  - Add Noto Sans JP or similar Japanese font
  - Configure font loading
  - Ensure proper font fallbacks
  - Test rendering on different devices
  - _Requirements: 3.4_

- [x] 13. Deployment and final testing
  - Deploy marketing website to Vercel
  - Configure environment variables
  - Test all functionality in production
  - Verify bilingual support
  - _Requirements: 3.1, 9.1_

- [x] 13.1 Deploy to Vercel
  - Create Vercel project
  - Configure build settings
  - Set environment variables (API URL)
  - Deploy to production
  - Set up custom domain (if available)
  - _Requirements: 3.1_

- [x] 13.2 Configure backend CORS for production
  - Update CORS configuration with production marketing site URL
  - Test CORS from production site
  - Verify API endpoints are accessible
  - _Requirements: 10.5_

- [x] 13.3 End-to-end testing in production
  - Test home page loading and navigation
  - Test demo functionality with fixtures
  - Test metrics dashboard data loading
  - Test language switching
  - Test all CTAs and links
  - Test on mobile, tablet, and desktop
  - _Requirements: 3.1, 3.5, 5.1, 5.2, 5.3, 5.4, 5.5, 9.1_

- [x] 13.4 Create README and documentation
  - Update main README with marketing website info
  - Document environment variables
  - Add deployment instructions
  - Include screenshots
  - Add link to live site
  - _Requirements: 8.5_

- [x] 14. Checkpoint - Ensure all tests pass and site is ready for demo
  - Ensure all tests pass, ask the user if questions arise.
