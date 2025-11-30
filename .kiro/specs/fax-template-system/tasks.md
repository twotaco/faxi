# Fax Template System - Implementation Tasks

## Overview

This task list implements the fax template system design, building upon existing fax generation infrastructure. Tasks are organized to enable incremental development with early validation of core functionality.

## Task List

- [x] 1. Set up template system foundation
  - Create core services and type definitions for the template system
  - Establish testing infrastructure
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 1.1 Create TemplateRegistry service
  - Implement singleton registry with MCP server → template type mappings
  - Add methods: register(), getTemplate(), getFallbackTemplate()
  - Initialize default mappings for shopping, email, ai_chat, appointment, payment MCPs
  - _Requirements: 1.1, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 1.2 Write property test for template selection
  - **Property 1: Template selection correctness**
  - **Validates: Requirements 1.1, 7.1, 7.2, 7.3, 7.4, 7.5**

- [x] 1.3 Extend FaxContent type with image support
  - Add 'image' to content type union
  - Define ImageContent interface with url, buffer, dimensions, alignment, caption, fallbackText
  - Update FaxTemplate interface with TemplateMetadata
  - _Requirements: 1.2, 2.2_

- [x] 1.4 Add new template types to type definitions
  - Add 'appointment_selection', 'general_inquiry' to TemplateType union
  - Define AppointmentSelectionTemplateData interface
  - Define GeneralInquiryTemplateData interface
  - _Requirements: 4.1, 5.1_

- [x] 2. Implement image processing service
  - Create service for downloading, caching, and processing images
  - _Requirements: 2.2, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 2.1 Create ImageProcessingService class
  - Implement downloadImage() with 5-second timeout
  - Implement resizeImage() using sharp library
  - Implement cacheImage() and getCachedImage() using Redis
  - Add processAndCacheImage() orchestration method
  - Add URL validation for allowed domains
  - _Requirements: 2.2, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 2.2 Write property test for image caching
  - **Property 9: Image caching round-trip**
  - **Validates: Requirements 8.1, 8.2**

- [x] 2.3 Write property test for image compression
  - **Property 10: Image compression**
  - **Validates: Requirements 8.4**

- [x] 2.4 Write property test for image error handling
  - **Property 5: Fallback on rendering failure**
  - **Validates: Requirements 2.6, 8.5**

- [x] 2.5 Add image URL security validation
  - Implement isAllowedImageUrl() with domain whitelist
  - Add content-type validation for downloaded images
  - Add size limit checks (2MB max)
  - _Requirements: 8.2, 8.3_

- [ ] 3. Enhance FaxGenerator with image rendering
  - Add image content block rendering to existing FaxGenerator
  - _Requirements: 1.2, 2.2_

- [ ] 3.1 Implement renderImage() method in FaxGenerator
  - Handle both URL and buffer image sources
  - Integrate with ImageProcessingService for downloads
  - Support alignment (left, center, right)
  - Render captions below images
  - Implement fallback text on image failure
  - _Requirements: 1.2, 2.2, 2.6_

- [ ] 3.2 Write property test for content block rendering
  - **Property 2: Content block rendering completeness**
  - **Validates: Requirements 1.2**

- [ ] 3.3 Update renderContent() to handle image type
  - Add case for 'image' content type
  - Call renderImage() method
  - Handle errors gracefully
  - _Requirements: 1.2, 2.2_

- [ ] 4. Implement dynamic layout calculator
  - Create service for adaptive layout calculations
  - _Requirements: 1.4, 9.1, 9.2, 9.3, 9.4_

- [ ] 4.1 Create DynamicLayoutCalculator class
  - Implement calculateProductLayout() for 1-5 products
  - Implement calculateImageDimensions() for small/medium/large sizes
  - Implement calculatePagination() for multi-page content
  - Implement adjustSpacing() for dynamic spacing
  - _Requirements: 1.4, 9.1, 9.2, 9.3, 9.4_

- [ ] 4.2 Write property test for dynamic content accommodation
  - **Property 4: Dynamic content accommodation**
  - **Validates: Requirements 1.4, 9.1, 9.4**

- [ ] 4.3 Write property test for layout density adaptation
  - **Property 11: Layout density adaptation**
  - **Validates: Requirements 9.2, 9.3**

- [ ] 5. Enhance ProductSelectionFaxGenerator with images
  - Add image embedding to product selection faxes
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 5.1 Integrate DynamicLayoutCalculator into product template
  - Use calculateProductLayout() to determine layout constraints
  - Use calculateImageDimensions() for product images
  - Adjust spacing based on product count
  - _Requirements: 2.4, 9.2, 9.3_

- [ ] 5.2 Add product image embedding
  - Create image content blocks for each product
  - Use ImageProcessingService to download and cache images
  - Position images based on layout constraints
  - Handle missing/failed images gracefully
  - _Requirements: 2.1, 2.2, 2.6_

- [ ] 5.3 Write property test for product display completeness
  - **Property 6: Product display completeness**
  - **Validates: Requirements 2.1, 2.3**

- [ ] 5.4 Write property test for image embedding
  - **Property 7: Image embedding**
  - **Validates: Requirements 2.2, 8.2, 8.3**

- [ ] 5.5 Write property test for title truncation
  - **Property 8: Title truncation**
  - **Validates: Requirements 2.5**

- [ ] 6. Enhance EmailFaxGenerator
  - Improve email template with better quick reply detection
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 6.1 Improve quick reply detection logic
  - Enhance detectQuickReplies() with more question patterns
  - Add context-aware reply generation
  - Limit to 3 most relevant replies
  - _Requirements: 3.3_

- [ ] 6.2 Write property test for email quick reply generation
  - **Property 13: Email quick reply generation**
  - **Validates: Requirements 3.3**

- [ ] 6.3 Add attachment indicators to email template
  - Show attachment count when attachments exist
  - Add attachment icon or text indicator
  - _Requirements: 3.5_

- [ ] 6.4 Improve email pagination for long bodies
  - Calculate content height for email body
  - Use DynamicLayoutCalculator for pagination
  - Add page numbers to multi-page emails
  - _Requirements: 3.4_

- [ ] 7. Implement AppointmentSelectionFaxGenerator
  - Create new generator for appointment booking faxes
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 7.1 Create AppointmentSelectionFaxGenerator class
  - Implement generateAppointmentSelectionFax() method
  - Create appointment template with service name, provider, location
  - _Requirements: 5.1_

- [ ] 7.2 Implement appointment slot rendering
  - Display date, time, duration for each slot
  - Show availability status (available/unavailable)
  - Add selection markers (A, B, C, etc.)
  - Group slots by date when multiple days available
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 7.3 Write property test for appointment slot formatting
  - **Property 14: Appointment slot formatting**
  - **Validates: Requirements 5.1, 5.2, 5.3**

- [ ] 7.4 Add appointment details section
  - Include service description
  - Show provider information
  - Display location/address
  - _Requirements: 5.5_

- [ ] 8. Implement GeneralInquiryFaxGenerator
  - Create new generator for AI Q&A faxes
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 8.1 Create GeneralInquiryFaxGenerator class
  - Implement generateInquiryFax() method
  - Create free-form text layout template
  - _Requirements: 4.1_

- [ ] 8.2 Add inline image support for AI responses
  - Embed images within text content
  - Position images based on 'inline' or 'end' position
  - Add captions to images
  - _Requirements: 4.2_

- [ ] 8.3 Implement structured data formatting
  - Format tables with clear borders and alignment
  - Format lists with bullets or numbers
  - Format sections with headers
  - _Requirements: 4.4_

- [ ] 8.4 Add question/answer distinction
  - Display original question in different style (bold or indented)
  - Separate question from answer visually
  - _Requirements: 4.5_

- [ ] 8.5 Implement pagination for long responses
  - Use DynamicLayoutCalculator for page breaks
  - Add page numbers and reference ID to each page
  - _Requirements: 4.3_

- [ ] 9. Implement branding consistency
  - Ensure all templates have consistent branding elements
  - _Requirements: 1.3, 11.1, 11.2, 11.3_

- [ ] 9.1 Update FaxTemplateEngine header/footer
  - Ensure createHeader() includes Faxi branding
  - Ensure createFooter() includes contact information
  - Verify font consistency (Arial at specified sizes)
  - _Requirements: 11.1, 11.2, 11.3_

- [ ] 9.2 Write property test for branding consistency
  - **Property 3: Branding consistency**
  - **Validates: Requirements 1.3, 11.1, 11.2, 11.3**

- [ ] 10. Implement reference ID enhancements
  - Ensure reference IDs are prominent and on all pages
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 10.1 Enhance reference ID display
  - Increase font size to minimum 34pt (12pt at 204 DPI)
  - Position prominently in header or footer
  - Use bold font weight
  - _Requirements: 10.1, 10.2_

- [ ] 10.2 Add reference ID to all pages
  - Update multi-page rendering to include reference ID on each page
  - Verify reference ID appears in header or footer of every page
  - _Requirements: 10.3_

- [ ] 10.3 Write property test for reference ID format and placement
  - **Property 12: Reference ID format and placement**
  - **Validates: Requirements 10.1, 10.2, 10.3**

- [ ] 11. Integrate template registry with MCP Controller
  - Connect template selection to fax generation pipeline
  - _Requirements: 1.1, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 11.1 Update response generator to use TemplateRegistry
  - Import and initialize TemplateRegistry
  - Call getTemplate() with MCP server and intent
  - Route to appropriate generator based on template type
  - _Requirements: 1.1, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 11.2 Add fallback template handling
  - Use general inquiry template as fallback
  - Log when fallback is used
  - _Requirements: 1.5, 7.5_

- [ ] 12. Implement error handling and logging
  - Add comprehensive error handling and monitoring
  - _Requirements: 1.5, 2.6, 8.5_

- [ ] 12.1 Create error handler for template rendering
  - Implement handleImageError() with fallback logic
  - Implement handleTemplateError() with text-only fallback
  - Implement handlePDFError() with error fax generation
  - Add structured error logging
  - _Requirements: 1.5, 2.6, 8.5_

- [ ] 12.2 Add metrics collection
  - Track template generation time by type
  - Track image cache hit/miss rates
  - Track error rates by type
  - Track fallback usage frequency
  - _Requirements: 1.5_

- [ ] 12.3 Add audit logging for template generation
  - Log template type, MCP server, intent
  - Log generation time, page count, image count
  - Log errors and fallback usage
  - _Requirements: 1.5_

- [ ] 13. Add configuration for template system
  - Create configuration entries for template system settings
  - _Requirements: 8.2, 8.3, 8.4_

- [ ] 13.1 Add template configuration to config file
  - Add imageDownloadTimeout (5000ms)
  - Add maxImageSize (2MB)
  - Add imageCacheTTL (24 hours)
  - Add pdfGenerationTimeout (10000ms)
  - Add allowedImageDomains array
  - _Requirements: 8.2, 8.3, 8.4_

- [ ] 14. Write integration tests
  - Test end-to-end template generation for each type
  - _Requirements: All_

- [ ] 14.1 Write integration test for product selection fax
  - Generate fax with 1, 3, and 5 products
  - Verify PDF is valid and contains expected content
  - Test with and without images
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 14.2 Write integration test for email fax
  - Generate fax with and without quick replies
  - Test with long email bodies (pagination)
  - Test with attachments
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 14.3 Write integration test for appointment fax
  - Generate fax with various slot counts
  - Test with available and unavailable slots
  - Test multi-day appointments
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 14.4 Write integration test for general inquiry fax
  - Generate fax with text only
  - Generate fax with inline images
  - Generate fax with structured data (tables, lists)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 14.5 Write integration test for error scenarios
  - Test with invalid image URLs
  - Test with missing required data
  - Test with oversized content
  - Verify fallback mechanisms work
  - _Requirements: 1.5, 2.6, 8.5_

- [ ] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Documentation and deployment preparation
  - Update documentation and prepare for deployment
  - _Requirements: All_

- [ ] 16.1 Update API documentation
  - Document new template types
  - Document ImageProcessingService API
  - Document TemplateRegistry usage
  - Document configuration options

- [ ] 16.2 Create migration guide
  - Document how to use new template system
  - Provide examples for each template type
  - Document backward compatibility

- [ ] 16.3 Update monitoring dashboards
  - Add template generation metrics
  - Add image processing metrics
  - Add error rate tracking
  - Add cache performance metrics
