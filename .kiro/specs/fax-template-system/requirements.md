# Fax Template System - Requirements

## Introduction

The Faxi system needs a flexible, template-based approach to generating fax documents for different use cases. Currently, fax generation is ad-hoc with limited support for images and structured layouts. This specification defines a template system that pairs with MCP servers to create consistent, professional fax documents.

## Glossary

- **Fax Template**: A reusable layout definition for a specific use case (e.g., order form, email reply)
- **Template Engine**: Service that renders templates with dynamic data into PDF documents
- **MCP Server**: Model Context Protocol server that provides domain-specific tools (shopping, email, appointments)
- **Content Block**: A discrete element in a template (text, image, selection options, barcode)
- **Order Form Template**: Template for displaying selectable items (products, appointments, options)

## Requirements

### Requirement 1: Template System Architecture

**User Story:** As a developer, I want a flexible template system for fax generation, so that I can create consistent, professional documents for different use cases.

#### Acceptance Criteria

1. WHEN a fax needs to be generated THEN the system SHALL select the appropriate template based on the MCP server and intent
2. WHEN a template is rendered THEN the system SHALL support text, images, selection options, barcodes, and blank spaces as content blocks
3. WHEN multiple templates exist THEN the system SHALL maintain consistent styling and branding across all templates
4. WHEN a template is reused THEN the system SHALL dynamically accommodate varying amounts of content (1-10 products, 1-5 email threads, etc.)
5. WHEN rendering fails THEN the system SHALL fall back to a simple text-only template

### Requirement 2: E-commerce Order Form Template

**User Story:** As an elderly user, I want to see product options with images and prices in a clear format, so that I can circle my choice and fax it back to place an order.

#### Acceptance Criteria

1. WHEN displaying products THEN the system SHALL show product images, titles, prices, ratings, and Prime eligibility
2. WHEN products have images THEN the system SHALL download and embed images from Amazon URLs into the PDF
3. WHEN displaying selection options THEN the system SHALL provide clear circle markers (A, B, C, D, E) for user selection
4. WHEN products vary in count THEN the template SHALL dynamically accommodate 1-5 products per page
5. WHEN product titles are long THEN the system SHALL truncate to fit the fax format while maintaining readability
6. WHEN images fail to load THEN the system SHALL render the product information without images

### Requirement 3: Email Response Template

**User Story:** As a user, I want email responses formatted clearly on fax, so that I can read and reply to emails easily.

#### Acceptance Criteria

1. WHEN displaying an email THEN the system SHALL show sender, subject, date, and body in a structured format
2. WHEN email threads exist THEN the system SHALL display the most recent message prominently
3. WHEN quick replies are available THEN the system SHALL provide checkbox options for common responses
4. WHEN email body is long THEN the system SHALL paginate across multiple fax pages
5. WHEN attachments exist THEN the system SHALL indicate attachment presence with icons or text

### Requirement 4: General LLM Inquiry Template

**User Story:** As a user, I want AI responses formatted clearly, so that I can read answers to my questions easily.

#### Acceptance Criteria

1. WHEN displaying AI responses THEN the system SHALL use a free-form text layout with appropriate line breaks
2. WHEN responses include images THEN the system SHALL embed images inline with text
3. WHEN responses are long THEN the system SHALL paginate appropriately
4. WHEN responses include structured data THEN the system SHALL format tables, lists, and sections clearly
5. WHEN the original question is included THEN the system SHALL distinguish it visually from the answer

### Requirement 5: Appointment/Reservation Template

**User Story:** As a user, I want to see available appointment times in a selection format, so that I can circle my preferred time and fax it back.

#### Acceptance Criteria

1. WHEN displaying appointments THEN the system SHALL show date, time, duration, and location for each option
2. WHEN appointments have availability THEN the system SHALL indicate available vs unavailable slots
3. WHEN displaying time slots THEN the system SHALL use clear circle markers for selection
4. WHEN multiple days are available THEN the template SHALL group by date
5. WHEN appointment details are complex THEN the system SHALL include a details section

### Requirement 6: Government Forms Template (Future)

**User Story:** As a user, I want government forms pre-filled with my information, so that I can review and submit them easily.

#### Acceptance Criteria

1. WHEN a government form is needed THEN the system SHALL download the official PDF form
2. WHEN form fields are identified THEN the system SHALL pre-fill with user data
3. WHEN forms require signatures THEN the system SHALL indicate signature locations
4. WHEN forms are multi-page THEN the system SHALL maintain original pagination
5. WHEN forms cannot be pre-filled THEN the system SHALL provide a blank form with instructions

### Requirement 7: Template-MCP Pairing

**User Story:** As a developer, I want templates automatically paired with MCP servers, so that the correct template is used for each use case.

#### Acceptance Criteria

1. WHEN the Shopping MCP is invoked THEN the system SHALL use the E-commerce Order Form template
2. WHEN the Email MCP is invoked THEN the system SHALL use the Email Response template
3. WHEN the AI Chat MCP is invoked THEN the system SHALL use the General LLM Inquiry template
4. WHEN the Appointment MCP is invoked THEN the system SHALL use the Appointment/Reservation template
5. WHEN no specific template matches THEN the system SHALL use a default free-form template

### Requirement 8: Image Handling

**User Story:** As a system, I want to efficiently handle product images, so that faxes include visual information without performance issues.

#### Acceptance Criteria

1. WHEN product images are scraped THEN the system SHALL cache image URLs in the database
2. WHEN rendering a fax THEN the system SHALL download images from cached URLs
3. WHEN images are downloaded THEN the system SHALL resize to appropriate fax resolution (200 DPI)
4. WHEN images are large THEN the system SHALL compress to reduce fax transmission time
5. WHEN image download fails THEN the system SHALL render without the image and log the failure

### Requirement 9: Dynamic Layout

**User Story:** As a template engine, I want to dynamically adjust layouts, so that content fits appropriately regardless of quantity.

#### Acceptance Criteria

1. WHEN content varies in length THEN the template SHALL adjust spacing and pagination automatically
2. WHEN products number 1-3 THEN the system SHALL use larger images and more spacing
3. WHEN products number 4-5 THEN the system SHALL use compact layout with smaller images
4. WHEN content exceeds one page THEN the system SHALL paginate with page numbers and reference IDs
5. WHEN blank space remains THEN the system SHALL include instructions or branding

### Requirement 10: Reference ID Tracking

**User Story:** As a system, I want reference IDs prominently displayed on all faxes, so that user replies can be matched to the original conversation context.

#### Acceptance Criteria

1. WHEN any fax is generated THEN the system SHALL include a unique reference ID (FX-YYYY-NNNNNN) in a prominent location
2. WHEN a user replies to a fax THEN the system SHALL extract the reference ID to retrieve conversation context
3. WHEN displaying the reference ID THEN the system SHALL use large, clear text that is easy to read and transcribe
4. WHEN multiple pages exist THEN the system SHALL include the reference ID on every page
5. WHEN context data is stored THEN the system SHALL link it to the reference ID for retrieval on reply

### Requirement 11: Consistent Branding

**User Story:** As a business, I want all faxes to have consistent branding, so that users recognize official Faxi communications.

#### Acceptance Criteria

1. WHEN any fax is generated THEN the system SHALL include the Faxi logo/header
2. WHEN any fax is generated THEN the system SHALL use consistent fonts and sizing
3. WHEN any fax is generated THEN the system SHALL include footer with contact information
4. WHEN templates vary THEN the system SHALL maintain brand colors and styling
5. WHEN faxes are multi-page THEN the system SHALL include page numbers and reference ID on each page

## Template Catalog

### 1. E-commerce Order Form Template
- **MCP Server**: Shopping
- **Use Case**: Product selection and ordering
- **Content**: Product images, titles, prices, ratings, selection circles
- **Layout**: Grid or list with 1-5 products per page

### 2. Email Response Template
- **MCP Server**: Email
- **Use Case**: Email reading and replying
- **Content**: Email headers, body, quick reply options
- **Layout**: Structured email format with optional threading

### 3. General LLM Inquiry Template
- **MCP Server**: AI Chat
- **Use Case**: Q&A and general assistance
- **Content**: Question, answer, optional images
- **Layout**: Free-form with appropriate text wrapping

### 4. Appointment/Reservation Template
- **MCP Server**: Appointment (future)
- **Use Case**: Scheduling appointments
- **Content**: Date/time options, location, selection circles
- **Layout**: Calendar-style or list with time slots

### 5. Payment Confirmation Template
- **MCP Server**: Payment
- **Use Case**: Payment registration and confirmation
- **Content**: Barcodes, payment instructions, amounts
- **Layout**: Structured with prominent barcode display

### 6. Government Forms Template
- **MCP Server**: Government Services (future)
- **Use Case**: Form filling and submission
- **Content**: Pre-filled form fields, instructions
- **Layout**: Matches official government form layout

### 7. Multi-Action Template
- **MCP Server**: Multiple
- **Use Case**: Clarification or multiple options
- **Content**: Multiple action choices with checkboxes
- **Layout**: Simple list with clear selection options

## Technical Considerations

### Image Processing
- Download from URLs (Amazon, external sources)
- Resize to 200 DPI for fax quality
- Convert to grayscale for better fax transmission
- Cache processed images to avoid re-downloading

### PDF Generation
- Use PDFKit for flexible layout control
- Support for images, text, shapes, and barcodes
- Page size: Letter (8.5" x 11") or A4
- Resolution: 200 DPI (fax standard)

### Template Engine
- Template definitions in TypeScript/JSON
- Dynamic content injection
- Layout calculation and pagination
- Fallback to simpler templates on error

### Performance
- Image download timeout: 5 seconds
- Maximum image size: 2MB
- PDF generation timeout: 10 seconds
- Cache processed images for 24 hours

## Future Enhancements

1. **Template Customization**: Allow users to customize templates
2. **Multi-language Support**: Templates in Japanese and English
3. **Accessibility**: High contrast mode for vision-impaired users
4. **Interactive Elements**: QR codes for digital follow-up
5. **Template Analytics**: Track which templates are most effective
