# Design Document

## Overview

The Help page is a comprehensive resource center for Faxi users (elderly Japanese citizens and their caregivers) to learn how to use the service, find answers to common questions, and troubleshoot issues. The page will be built as part of the marketing website using Next.js 14+ with the App Router, following the existing patterns for internationalization (i18n) and component architecture.

The Help page serves as a critical onboarding and support resource, reducing support burden while empowering users to independently access and use Faxi services. It must be accessible, easy to navigate, and available in both Japanese and English.

## Architecture

### Page Structure

The Help page follows the Next.js App Router pattern with locale-based routing:

```
marketing-website/
├── app/
│   └── [locale]/
│       └── help/
│           └── page.tsx          # Main Help page component
├── components/
│   └── help/
│       ├── HelpHero.tsx          # Page header
│       ├── GettingStarted.tsx    # Getting started section
│       ├── Instructions.tsx      # Step-by-step instructions
│       ├── FAQAccordion.tsx      # FAQ with accordion UI
│       ├── Troubleshooting.tsx   # Troubleshooting guide
│       ├── DownloadResources.tsx # Downloadable resources
│       └── ContactSupport.tsx    # Contact form and info
├── messages/
│   ├── en.json                   # English translations
│   └── ja.json                   # Japanese translations
└── public/
    └── downloads/
        ├── faxi-quick-guide-en.pdf
        ├── faxi-quick-guide-ja.pdf
        ├── fax-templates/
        │   ├── email-template.pdf
        │   ├── shopping-template.pdf
        │   └── appointment-template.pdf
        └── images/
            └── help/
                ├── fax-example-email.png
                ├── fax-example-shopping.png
                └── fax-example-appointment.png
```

### Navigation Integration

The Help page will be added to the main navigation menu in the Header component, accessible from all pages. A prominent "Help" link will be displayed in both the desktop and mobile navigation.

## Components and Interfaces

### 1. HelpHero Component

**Purpose**: Page header with title, subtitle, and quick navigation

**Props**:
```typescript
interface HelpHeroProps {
  locale: string;
}
```

**Features**:
- Large, clear title and subtitle
- Quick links to major sections (Getting Started, FAQ, Troubleshooting, Contact)
- Search bar for FAQ filtering (future enhancement)

### 2. GettingStarted Component

**Purpose**: Overview of Faxi service and basic concepts

**Props**:
```typescript
interface GettingStartedProps {
  locale: string;
}
```

**Features**:
- Brief explanation of what Faxi is
- Key benefits highlighted
- Visual diagram showing the fax-to-internet flow
- Link to full instructions

### 3. Instructions Component

**Purpose**: Detailed step-by-step guide for using Faxi

**Props**:
```typescript
interface InstructionsProps {
  locale: string;
}
```

**Features**:
- Numbered steps with icons
- Faxi fax numbers prominently displayed (Japan and USA)
- Tabbed interface for different use cases (Email, Shopping, Appointments, Q&A)
- Visual examples of properly formatted faxes for each use case
- Expected response times and what to expect

**Use Case Tabs**:
1. Email: How to send emails via fax
2. Shopping: How to browse and order products
3. Appointments: How to book healthcare appointments
4. Q&A: How to ask questions and get information

### 4. FAQAccordion Component

**Purpose**: Searchable/filterable FAQ with expandable answers

**Props**:
```typescript
interface FAQAccordionProps {
  locale: string;
}
```

**Features**:
- Category-based organization (Getting Started, Using the Service, Troubleshooting, Billing, Privacy)
- Accordion UI for easy navigation (similar to existing FAQSection component)
- Search/filter functionality
- Minimum 15 FAQ items covering common questions

**FAQ Categories**:
- **Getting Started**: Registration, setup, first fax
- **Using the Service**: How to format requests, response times, supported services
- **Troubleshooting**: Fax not received, unclear responses, errors
- **Billing**: Pricing, payment methods, refunds
- **Privacy & Security**: Data protection, information security

### 5. Troubleshooting Component

**Purpose**: Common problems and step-by-step solutions

**Props**:
```typescript
interface TroubleshootingProps {
  locale: string;
}
```

**Features**:
- Problem categories with expandable solutions
- Step-by-step resolution instructions
- Visual indicators for severity (info, warning, error)
- Links to contact support for unresolved issues

**Problem Categories**:
1. Fax Not Received: Check fax number, verify transmission, wait times
2. Response Delayed: Expected processing times, peak hours, status checking
3. Unclear Response: How to request clarification, formatting tips
4. Service Errors: Common error codes and their meanings
5. Technical Issues: Fax machine problems, transmission errors

### 6. DownloadResources Component

**Purpose**: Downloadable guides, templates, and reference materials

**Props**:
```typescript
interface DownloadResourcesProps {
  locale: string;
}
```

**Features**:
- Grid layout of downloadable resources
- File type and size indicators
- Preview thumbnails
- Download tracking for analytics

**Resources**:
- Quick Reference Guide (PDF, both languages)
- Fax Templates (Email, Shopping, Appointment, Q&A)
- Printable instruction cards
- Sample fax images

### 7. ContactSupport Component

**Purpose**: Contact information and support request form

**Props**:
```typescript
interface ContactSupportProps {
  locale: string;
}
```

**Features**:
- Multiple contact methods (phone, email, fax)
- Support hours and expected response times
- Simple contact form with validation
- Success/error messaging

**Form Fields**:
- Name (required)
- Email or Phone (required)
- Fax Number (optional)
- Issue Category (dropdown)
- Message (required, min 10 characters)

## Data Models

### FAQ Item

```typescript
interface FAQItem {
  id: string;
  category: 'getting-started' | 'using-service' | 'troubleshooting' | 'billing' | 'privacy';
  question: string;
  answer: string;
  keywords?: string[]; // For search functionality
}
```

### Troubleshooting Issue

```typescript
interface TroubleshootingIssue {
  id: string;
  category: 'fax-not-received' | 'response-delayed' | 'unclear-response' | 'service-errors' | 'technical-issues';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
  steps: string[];
  relatedFAQs?: string[]; // IDs of related FAQ items
}
```

### Downloadable Resource

```typescript
interface DownloadableResource {
  id: string;
  title: string;
  description: string;
  fileType: 'pdf' | 'png' | 'jpg';
  fileSize: string; // e.g., "2.5 MB"
  filePath: string; // Path in /public/downloads/
  language: 'en' | 'ja' | 'both';
  category: 'guide' | 'template' | 'reference';
  thumbnailPath?: string;
}
```

### Contact Form Submission

```typescript
interface ContactFormData {
  name: string;
  contact: string; // Email or phone
  faxNumber?: string;
  issueCategory: 'technical' | 'billing' | 'service' | 'other';
  message: string;
  locale: string;
  timestamp: Date;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Acceptance Criteria Testing Prework

1.1 WHEN a user navigates to the Help page THEN the Marketing Website SHALL display a dedicated Help page at the route `/[locale]/help`
Thoughts: This is testing that the route exists and renders correctly. We can test this by navigating to the route in both locales and verifying the page loads without errors.
Testable: yes - example

1.2 WHEN the Help page loads THEN the Marketing Website SHALL display a clear page title and introduction explaining the purpose of the page
Thoughts: This is testing that specific UI elements are present. We can test this by rendering the page and checking for the presence of title and introduction text.
Testable: yes - example

1.3 WHEN the Help page renders THEN the Marketing Website SHALL organize content into distinct sections including Getting Started, How to Use, FAQ, and Troubleshooting
Thoughts: This is testing the page structure. We can verify that all required sections are present in the rendered output.
Testable: yes - example

1.4 WHEN a user views the Help page THEN the Marketing Website SHALL display content in the user's selected language (Japanese or English)
Thoughts: This is a property that should hold for all locales. We can test that for any valid locale, the content is displayed in that language.
Testable: yes - property

1.5 WHEN the Help page is displayed THEN the Marketing Website SHALL use clear, simple language appropriate for elderly users with limited technical knowledge
Thoughts: This is subjective and about content quality, not a computable property.
Testable: no

2.1 WHEN a user views the Instructions section THEN the Marketing Website SHALL display numbered steps for sending a fax to Faxi
Thoughts: This is testing that specific content is present. We can verify the steps are rendered.
Testable: yes - example

2.2 WHEN instructions are displayed THEN the Marketing Website SHALL include the Faxi fax number prominently
Thoughts: This is testing that specific information is present and visible. We can check for the fax numbers in the rendered output.
Testable: yes - example

2.3 WHEN a user reads the instructions THEN the Marketing Website SHALL explain how to format different types of requests (email, shopping, appointments, Q&A)
Thoughts: This is testing that content for all use cases is present. We can verify each use case has instructions.
Testable: yes - example

2.4 WHEN instructions are shown THEN the Marketing Website SHALL include visual examples or diagrams of properly formatted fax requests
Thoughts: This is testing that images/diagrams are present. We can check for image elements with appropriate alt text.
Testable: yes - example

2.5 WHEN a user views instructions THEN the Marketing Website SHALL explain what to expect after sending a fax (response time, confirmation fax format)
Thoughts: This is testing that specific information is present in the content.
Testable: yes - example

3.1 WHEN a user views the FAQ section THEN the Marketing Website SHALL display at least 10 frequently asked questions with answers
Thoughts: This is a property about the minimum number of FAQ items. We can test that for any FAQ data, the count is at least 10.
Testable: yes - property

3.2 WHEN FAQ items are displayed THEN the Marketing Website SHALL organize questions into categories (Getting Started, Using the Service, Troubleshooting, Billing, Privacy)
Thoughts: This is testing that all required categories are present. We can verify the category structure.
Testable: yes - example

3.3 WHEN a user interacts with FAQ items THEN the Marketing Website SHALL use an expandable/collapsible accordion interface for easy navigation
Thoughts: This is testing UI behavior. We can test that clicking an FAQ item expands/collapses it.
Testable: yes - example

3.4 WHEN FAQ content is shown THEN the Marketing Website SHALL provide clear, concise answers in simple language
Thoughts: This is subjective content quality, not a computable property.
Testable: no

3.5 WHEN a user searches for information THEN the Marketing Website SHALL include a search or filter functionality for FAQ items
Thoughts: This is testing that a search feature exists and works. We can test that filtering reduces the displayed items based on search terms.
Testable: yes - property

4.1 WHEN a user views the Troubleshooting section THEN the Marketing Website SHALL display common problems and their solutions
Thoughts: This is testing that troubleshooting content is present. We can verify problems and solutions are rendered.
Testable: yes - example

4.2 WHEN troubleshooting content is shown THEN the Marketing Website SHALL organize issues by category (Fax Not Received, Response Delayed, Unclear Response, Service Errors)
Thoughts: This is testing that all required categories are present.
Testable: yes - example

4.3 WHEN a user reads troubleshooting steps THEN the Marketing Website SHALL provide step-by-step resolution instructions
Thoughts: This is testing that solutions include step-by-step instructions. We can verify the structure of troubleshooting items.
Testable: yes - example

4.4 WHEN troubleshooting guidance is displayed THEN the Marketing Website SHALL include contact information for additional support
Thoughts: This is testing that contact information is present in the troubleshooting section.
Testable: yes - example

4.5 WHEN a user encounters an error THEN the Marketing Website SHALL explain common error codes or messages they might receive
Thoughts: This is testing that error code explanations are present in the content.
Testable: yes - example

5.1 WHEN a user views the Help page THEN the Marketing Website SHALL provide downloadable PDF guides in both Japanese and English
Thoughts: This is a property that should hold for all download resources. We can test that for each guide, both language versions exist.
Testable: yes - property

5.2 WHEN downloadable resources are offered THEN the Marketing Website SHALL include printable quick reference cards with key instructions
Thoughts: This is testing that specific resources are available.
Testable: yes - example

5.3 WHEN a user downloads resources THEN the Marketing Website SHALL provide sample fax templates for different use cases
Thoughts: This is testing that template resources exist for all use cases.
Testable: yes - example

5.4 WHEN resources are displayed THEN the Marketing Website SHALL clearly indicate file format and size before download
Thoughts: This is a property that should hold for all downloadable resources. For any resource, the file format and size should be displayed.
Testable: yes - property

5.5 WHEN a user accesses downloads THEN the Marketing Website SHALL track download metrics for analytics purposes
Thoughts: This is testing that analytics tracking is implemented. We can verify tracking events are fired on download.
Testable: yes - example

6.1 WHEN a user views the Help page THEN the Marketing Website SHALL display a table of contents or navigation menu for quick access to sections
Thoughts: This is testing that navigation UI is present.
Testable: yes - example

6.2 WHEN a user clicks a navigation link THEN the Marketing Website SHALL scroll smoothly to the corresponding section
Thoughts: This is testing UI behavior. We can test that clicking navigation triggers scroll to the correct section.
Testable: yes - example

6.3 WHEN a user scrolls through the page THEN the Marketing Website SHALL highlight the current section in the navigation menu
Thoughts: This is testing scroll-based UI updates. We can test that scrolling updates the active navigation item.
Testable: yes - example

6.4 WHEN the Help page is long THEN the Marketing Website SHALL provide a "back to top" button for easy navigation
Thoughts: This is testing that a specific UI element exists and functions.
Testable: yes - example

6.5 WHEN a user views the page on mobile THEN the Marketing Website SHALL display a responsive layout optimized for small screens
Thoughts: This is testing responsive design. We can test that the layout adapts to different viewport sizes.
Testable: yes - property

7.1 WHEN a user views the Help page THEN the Marketing Website SHALL display contact information for customer support
Thoughts: This is testing that contact information is present.
Testable: yes - example

7.2 WHEN contact options are shown THEN the Marketing Website SHALL provide multiple contact methods (phone, email, fax)
Thoughts: This is testing that all required contact methods are displayed.
Testable: yes - example

7.3 WHEN a user needs support THEN the Marketing Website SHALL display support hours and expected response times
Thoughts: This is testing that specific information is present.
Testable: yes - example

7.4 WHEN contact information is displayed THEN the Marketing Website SHALL include a simple contact form for submitting questions
Thoughts: This is testing that a form exists with required fields.
Testable: yes - example

7.5 WHEN a user submits a contact form THEN the Marketing Website SHALL validate input and provide confirmation of submission
Thoughts: This is a property about form validation. For any invalid input, validation should fail. For valid input, submission should succeed with confirmation.
Testable: yes - property

8.1 WHEN the Help page is developed THEN the Marketing Website SHALL store content in internationalization (i18n) JSON files for easy translation updates
Thoughts: This is about code organization, not runtime behavior.
Testable: no

8.2 WHEN content is rendered THEN the Marketing Website SHALL follow WCAG 2.1 AA accessibility standards
Thoughts: This is a broad accessibility requirement. We can test specific WCAG criteria like proper heading hierarchy, alt text, keyboard navigation.
Testable: yes - property

8.3 WHEN the page is accessed THEN the Marketing Website SHALL provide proper semantic HTML structure with headings, landmarks, and ARIA labels
Thoughts: This is a property about HTML structure. For any rendered page, we can verify semantic elements are used correctly.
Testable: yes - property

8.4 WHEN images or diagrams are displayed THEN the Marketing Website SHALL include descriptive alt text for screen readers
Thoughts: This is a property that should hold for all images. For any image element, alt text should be present and descriptive.
Testable: yes - property

8.5 WHEN the page is tested THEN the Marketing Website SHALL achieve a Lighthouse accessibility score of 90 or higher
Thoughts: This is a specific metric that can be measured.
Testable: yes - example

### Property Reflection

After reviewing all testable properties, I've identified the following consolidations:

- Properties 1.4, 5.1, and 5.4 all relate to internationalization and can be combined into a comprehensive i18n property
- Properties 8.2, 8.3, and 8.4 all relate to accessibility and can be combined into a comprehensive accessibility property
- Properties 3.5 and 6.5 are unique and provide distinct validation value
- Property 7.5 covers form validation comprehensively

The remaining properties are either examples (testing specific content/features) or provide unique validation for different aspects of the system.

### Correctness Properties

Property 1: Internationalization consistency
*For any* valid locale (en or ja), all page content, downloadable resources, and UI elements should be displayed in that locale's language
**Validates: Requirements 1.4, 5.1**

Property 2: FAQ minimum count
*For any* FAQ data configuration, the rendered FAQ section should display at least 10 question-answer pairs
**Validates: Requirements 3.1**

Property 3: FAQ search filtering
*For any* search query string, the filtered FAQ results should only include items where the query appears in the question, answer, or keywords
**Validates: Requirements 3.5**

Property 4: Download resource metadata
*For any* downloadable resource, the UI should display both file format and file size before the user initiates the download
**Validates: Requirements 5.4**

Property 5: Responsive layout adaptation
*For any* viewport width, the page layout should adapt appropriately (mobile layout for widths < 768px, tablet for 768-1024px, desktop for > 1024px)
**Validates: Requirements 6.5**

Property 6: Form validation
*For any* contact form submission, if required fields are missing or invalid, validation should fail with appropriate error messages; if all fields are valid, submission should succeed with confirmation
**Validates: Requirements 7.5**

Property 7: Accessibility compliance
*For any* rendered page element, it should follow WCAG 2.1 AA standards including proper semantic HTML, heading hierarchy, ARIA labels where needed, and descriptive alt text for all images
**Validates: Requirements 8.2, 8.3, 8.4**

## Error Handling

### Client-Side Errors

1. **Form Validation Errors**
   - Display inline error messages for invalid fields
   - Highlight invalid fields with red borders
   - Prevent submission until all errors are resolved
   - Provide clear, actionable error messages

2. **Download Errors**
   - Show toast notification if download fails
   - Provide retry button
   - Log error to analytics for monitoring

3. **Navigation Errors**
   - Gracefully handle missing sections
   - Scroll to top if target section not found
   - Log navigation errors for debugging

### Server-Side Errors

1. **Form Submission Errors**
   - Display user-friendly error message
   - Preserve form data so user doesn't lose input
   - Log error details for support team
   - Provide alternative contact methods

2. **Resource Loading Errors**
   - Show placeholder or error state for missing resources
   - Provide fallback content
   - Log errors for monitoring

## Testing Strategy

### Unit Tests

Unit tests will verify individual components render correctly and handle user interactions:

1. **Component Rendering**
   - Each component renders without errors
   - Props are correctly passed and used
   - Conditional rendering works as expected

2. **User Interactions**
   - FAQ accordion expands/collapses on click
   - Navigation links trigger scroll behavior
   - Form inputs update state correctly
   - Form validation triggers on blur and submit

3. **Internationalization**
   - Components use translation keys correctly
   - Locale switching updates content
   - Fallback to English if translation missing

### Property-Based Tests

Property-based tests will use fast-check to verify universal properties across many inputs:

**Testing Framework**: fast-check (already used in the marketing website)

**Configuration**: Each property test will run a minimum of 100 iterations

**Test Tagging**: Each property-based test will include a comment with the format:
`// Feature: help-page, Property {number}: {property_text}`

1. **Property 1: Internationalization consistency** (Requirements 1.4, 5.1)
   - Generate random locale values ('en', 'ja')
   - Verify all content is in the correct language
   - Verify downloadable resources exist for both languages

2. **Property 2: FAQ minimum count** (Requirements 3.1)
   - Generate random FAQ data arrays
   - Verify rendered output contains at least 10 items

3. **Property 3: FAQ search filtering** (Requirements 3.5)
   - Generate random search queries
   - Verify filtered results match search criteria
   - Verify empty results when no matches

4. **Property 4: Download resource metadata** (Requirements 5.4)
   - Generate random resource objects
   - Verify file format and size are displayed
   - Verify format is correct (e.g., "PDF", "2.5 MB")

5. **Property 5: Responsive layout adaptation** (Requirements 6.5)
   - Generate random viewport widths
   - Verify correct layout class is applied
   - Verify mobile menu appears on small screens

6. **Property 6: Form validation** (Requirements 7.5)
   - Generate random form inputs (valid and invalid)
   - Verify validation errors for invalid inputs
   - Verify successful submission for valid inputs

7. **Property 7: Accessibility compliance** (Requirements 8.2, 8.3, 8.4)
   - Generate random page content
   - Verify proper heading hierarchy (h1 -> h2 -> h3)
   - Verify all images have alt text
   - Verify ARIA labels on interactive elements

### Integration Tests

Integration tests will verify the complete user flow:

1. **Help Page Navigation Flow**
   - User navigates to /help from home page
   - Page loads with all sections visible
   - User clicks navigation link and scrolls to section
   - User expands FAQ item and reads answer

2. **Download Flow**
   - User views downloadable resources
   - User clicks download button
   - File download initiates
   - Analytics event is tracked

3. **Contact Form Flow**
   - User fills out contact form
   - User submits form with valid data
   - Success message is displayed
   - Form data is sent to backend (or logged in test mode)

4. **Search/Filter Flow**
   - User enters search query in FAQ search
   - FAQ list filters to matching items
   - User clears search and all items reappear

### Accessibility Testing

1. **Automated Testing**
   - Run axe-core accessibility tests on all components
   - Verify WCAG 2.1 AA compliance
   - Check color contrast ratios
   - Verify keyboard navigation

2. **Manual Testing**
   - Test with screen reader (VoiceOver on macOS, NVDA on Windows)
   - Verify all interactive elements are keyboard accessible
   - Test with keyboard only (no mouse)
   - Verify focus indicators are visible

3. **Lighthouse Audit**
   - Run Lighthouse accessibility audit
   - Target score: 90 or higher
   - Address any flagged issues

## Implementation Notes

### Internationalization

All text content will be stored in the i18n JSON files (`messages/en.json` and `messages/ja.json`) under a new `help` key:

```json
{
  "help": {
    "title": "Help & Support",
    "subtitle": "Everything you need to know about using Faxi",
    "gettingStarted": { ... },
    "instructions": { ... },
    "faq": { ... },
    "troubleshooting": { ... },
    "downloads": { ... },
    "contact": { ... }
  }
}
```

### Styling

The Help page will use the existing Tailwind CSS configuration and design system:
- Color palette: faxi-brown, faxi-brown-dark, amber accents
- Typography: Existing font stack with clear hierarchy
- Spacing: Consistent with other pages (py-16 for sections, container mx-auto px-4)
- Components: Reuse existing UI components where possible (CTAButton, accordion patterns)

### Performance

1. **Image Optimization**
   - Use Next.js Image component for all images
   - Provide multiple sizes for responsive images
   - Lazy load images below the fold

2. **Code Splitting**
   - Components are automatically code-split by Next.js
   - Heavy components (like PDF viewer) loaded on demand

3. **Caching**
   - Static page generation for fast initial load
   - Cache downloadable resources with appropriate headers

### Analytics

Track the following events for product insights:

1. **Page Views**: Help page visits by locale
2. **Section Views**: Which sections users scroll to
3. **FAQ Interactions**: Which FAQ items are expanded
4. **Downloads**: Which resources are downloaded
5. **Form Submissions**: Contact form usage
6. **Search Queries**: What users search for in FAQ

### Future Enhancements

1. **Video Tutorials**: Embed video demonstrations of using Faxi
2. **Live Chat**: Add live chat widget for real-time support
3. **Community Forum**: User-generated Q&A and tips
4. **Feedback Widget**: Allow users to rate helpfulness of content
5. **AI-Powered Search**: Natural language search across all help content
6. **Personalized Help**: Show relevant help based on user's service usage
