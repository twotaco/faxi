# Fax Template System - Implementation Tasks

## Overview

This task list implements the fax template system design, building upon existing fax generation infrastructure. Tasks are organized to enable incremental development with early validation of core functionality.

**Last Updated:** Task list refreshed based on current codebase analysis. Tasks 1.1-2.5 are complete with TemplateRegistry, ImageProcessingService, and associated tests implemented.

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

- [x] 3. Enhance FaxGenerator with image rendering
  - Add image content block rendering to existing FaxGenerator
  - _Requirements: 1.2, 2.2_

- [x] 3.1 Implement renderImage() method in FaxGenerator
  - Handle both URL and buffer image sources
  - Integrate with ImageProcessingService for downloads
  - Support alignment (left, center, right)
  - Render captions below images
  - Implement fallback text on image failure
  - Use canvas loadImage to render image buffers
  - _Requirements: 1.2, 2.2, 2.6_

- [x] 3.2 Write property test for content block rendering
  - **Property 2: Content block rendering completeness**
  - **Validates: Requirements 1.2**

- [x] 3.3 Update renderContent() method to handle image type
  - Add case for 'image' content type in the switch statement
  - Call renderImage() method for image content
  - Handle errors gracefully with try-catch
  - _Requirements: 1.2, 2.2_

- [x] 4. Implement dynamic layout calculator
  - Create service for adaptive layout calculations
  - _Requirements: 1.4, 9.1, 9.2, 9.3, 9.4_

- [x] 4.1 Create DynamicLayoutCalculator class
  - Implement calculateProductLayout() for 1-5 products
  - Implement calculateImageDimensions() for small/medium/large sizes
  - Implement calculatePagination() for multi-page content
  - Implement adjustSpacing() for dynamic spacing
  - _Requirements: 1.4, 9.1, 9.2, 9.3, 9.4_

- [x] 4.2 Write property test for dynamic content accommodation
  - **Property 4: Dynamic content accommodation**
  - **Validates: Requirements 1.4, 9.1, 9.4**

- [x] 4.3 Write property test for layout density adaptation
  - **Property 11: Layout density adaptation**
  - **Validates: Requirements 9.2, 9.3**

- [x] 5. Enhance ProductSelectionFaxGenerator with images
  - Add image embedding to product selection faxes
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 5.1 Integrate DynamicLayoutCalculator into product template
  - Import DynamicLayoutCalculator in ProductSelectionFaxGenerator
  - Use calculateProductLayout() to determine layout constraints based on product count
  - Use calculateImageDimensions() to get appropriate image sizes
  - Adjust spacing and layout based on compact mode flag
  - _Requirements: 2.4, 9.2, 9.3_

- [x] 5.2 Add product image embedding to ProductSelectionFaxGenerator
  - Add image content blocks for each product in the template
  - Include imageUrl from CuratedProduct in ImageContent
  - Set appropriate width/height from DynamicLayoutCalculator
  - Add fallbackText for products without images
  - Position images with left alignment for consistency
  - _Requirements: 2.1, 2.2, 2.6_

- [x] 5.3 Write property test for product display completeness
  - **Property 6: Product display completeness**
  - **Validates: Requirements 2.1, 2.3**

- [x] 5.4 Write property test for image embedding
  - **Property 7: Image embedding**
  - **Validates: Requirements 2.2, 8.2, 8.3**

- [x] 5.5 Write property test for title truncation
  - **Property 8: Title truncation**
  - **Validates: Requirements 2.5**
  - Note: Title truncation may already be implemented in productSearchService

- [x] 6. Enhance EmailFaxGenerator
  - Improve email template with better quick reply detection
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6.1 Improve quick reply detection logic in EmailFaxGenerator
  - Review and enhance detectQuickReplies() with additional question patterns
  - Add more contextual reply options (scheduling, preferences, confirmations)
  - Ensure limit of 3 most relevant replies is enforced
  - Test with various email content types
  - _Requirements: 3.3_

- [x] 6.2 Write property test for email quick reply generation
  - **Property 13: Email quick reply generation**
  - **Validates: Requirements 3.3**

- [x] 6.3 Add attachment indicators to email template
  - Update FaxTemplateEngine.createEmailReplyTemplate() to show attachment count
  - Add text indicator like "📎 2 attachments" or "Attachments: 2"
  - Only show when attachmentCount > 0
  - _Requirements: 3.5_

- [x] 6.4 Improve email pagination for long bodies
  - Calculate estimated content height for email body text
  - Use DynamicLayoutCalculator.calculatePagination() for page breaks
  - Ensure reference ID appears on each page of multi-page emails
  - Add page numbers (Page 1 of 3) to multi-page emails
  - _Requirements: 3.4_

- [x] 7. Implement AppointmentSelectionFaxGenerator
  - Create new generator for appointment booking faxes
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7.1 Create AppointmentSelectionFaxGenerator class
  - Create new file: backend/src/services/appointmentSelectionFaxGenerator.ts
  - Implement generateAppointmentSelectionFax() static method
  - Create createAppointmentTemplate() private method
  - Use FaxTemplateEngine for header/footer consistency
  - Accept AppointmentSelectionTemplateData as input
  - _Requirements: 5.1_

- [x] 7.2 Implement appointment slot rendering in template
  - Display date, time (startTime-endTime), duration for each slot
  - Show availability status with clear indicators (✓ Available / ✗ Unavailable)
  - Add circle selection markers (A, B, C, etc.) for available slots
  - Group slots by date when multiple days are present
  - Use clear formatting with adequate spacing for elderly users
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 7.3 Write property test for appointment slot formatting
  - **Property 14: Appointment slot formatting**
  - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 7.4 Add appointment details section to template
  - Include service name and description at top
  - Show provider name and information
  - Display location/address clearly
  - Add instructions for selection and fax-back
  - _Requirements: 5.5_

- [x] 8. Implement GeneralInquiryFaxGenerator
  - Create new generator for AI Q&A faxes
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 8.1 Create GeneralInquiryFaxGenerator class
  - Create new file: backend/src/services/generalInquiryFaxGenerator.ts
  - Implement generateInquiryFax() static method
  - Create createInquiryTemplate() private method
  - Use free-form text layout with appropriate line breaks
  - Accept GeneralInquiryTemplateData as input
  - _Requirements: 4.1_

- [x] 8.2 Add inline image support for AI responses
  - Process images array from GeneralInquiryTemplateData
  - Create image content blocks based on position ('inline' or 'end')
  - Embed inline images within text flow
  - Place 'end' images at the end of the response
  - Add captions below images
  - _Requirements: 4.2_

- [x] 8.3 Implement structured data formatting
  - Detect and format tables with clear borders and alignment
  - Format lists with bullets (•) or numbers (1., 2., 3.)
  - Format sections with bold headers
  - Use appropriate spacing between sections
  - _Requirements: 4.4_

- [x] 8.4 Add question/answer distinction
  - Display original question in bold or with "Q:" prefix
  - Display answer with "A:" prefix or normal weight
  - Add visual separator (line or spacing) between question and answer
  - Ensure question is clearly distinguishable from answer
  - _Requirements: 4.5_

- [x] 8.5 Implement pagination for long responses
  - Calculate content height for question + answer + images
  - Use DynamicLayoutCalculator.calculatePagination() for page breaks
  - Split content across multiple pages when needed
  - Add page numbers (Page 1 of N) to each page
  - Ensure reference ID appears on every page
  - _Requirements: 4.3_

- [x] 9. Implement branding consistency
  - Ensure all templates have consistent branding elements
  - _Requirements: 1.3, 11.1, 11.2, 11.3_

- [x] 9.1 Review and update FaxTemplateEngine header/footer
  - Review createHeader() to ensure it includes Faxi branding/logo
  - Review createFooter() to ensure it includes contact information
  - Verify font consistency across all templates (Arial at specified sizes)
  - Ensure all new generators (Appointment, GeneralInquiry) use FaxTemplateEngine
  - _Requirements: 11.1, 11.2, 11.3_

- [x] 9.2 Write property test for branding consistency
  - **Property 3: Branding consistency**
  - **Validates: Requirements 1.3, 11.1, 11.2, 11.3**
  - Test that all template types include header and footer
  - Verify consistent font usage across templates

- [x] 10. Implement reference ID enhancements
  - Ensure reference IDs are prominent and on all pages
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 10.1 Enhance reference ID display in FaxTemplateEngine
  - Review current reference ID font size and increase to minimum 34pt if needed
  - Ensure reference ID is positioned prominently in header or footer
  - Use bold font weight for reference ID
  - Verify format is FX-YYYY-NNNNNN
  - _Requirements: 10.1, 10.2_

- [x] 10.2 Verify reference ID on all pages
  - Review multi-page rendering logic in FaxGenerator
  - Ensure reference ID appears in header or footer of every page
  - Test with multi-page templates (email, general inquiry)
  - _Requirements: 10.3_

- [x] 10.3 Write property test for reference ID format and placement
  - **Property 12: Reference ID format and placement**
  - **Validates: Requirements 10.1, 10.2, 10.3**
  - Test reference ID format matches FX-YYYY-NNNNNN pattern
  - Test reference ID appears on all pages of multi-page faxes

- [x] 11. Integrate template registry with response generation
  - Connect template selection to fax generation pipeline
  - _Requirements: 1.1, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 11.1 Update ResponseGenerator to use TemplateRegistry
  - Import TemplateRegistry in responseGenerator.ts
  - Add method to get template type from MCP server and intent
  - Update generateResponse() to use TemplateRegistry for routing
  - Map template types to appropriate generator classes
  - Add cases for 'appointment_selection' and 'general_inquiry' template types
  - _Requirements: 1.1, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 11.2 Add fallback template handling in ResponseGenerator
  - Use GeneralInquiryFaxGenerator as fallback when template type is 'general_inquiry'
  - Log when fallback template is used (info level)
  - Ensure fallback provides graceful degradation
  - _Requirements: 1.5, 7.5_

- [-] 12. Implement error handling and logging
  - Add comprehensive error handling and monitoring
  - _Requirements: 1.5, 2.6, 8.5_

- [ ] 12.1 Enhance error handling for template rendering
  - Review and enhance error handling in FaxGenerator.renderImage()
  - Ensure ImageProcessingService errors are caught and logged
  - Implement graceful fallback to text when images fail
  - Add structured error logging with context (URL, error type)
  - Consider creating TemplateErrorHandler utility class if needed
  - _Requirements: 1.5, 2.6, 8.5_

- [ ] 12.2 Add metrics collection for template system
  - Add template generation time tracking by type
  - Track image cache hit/miss rates in ImageProcessingService
  - Track error rates by type (image, template, PDF)
  - Track fallback usage frequency
  - Integrate with existing MonitoringService
  - _Requirements: 1.5_

- [ ] 12.3 Add audit logging for template generation
  - Log template type, MCP server, intent for each generation
  - Log generation time, page count, image count
  - Log errors and fallback usage with context
  - Use existing AuditLogService for consistency
  - _Requirements: 1.5_

- [ ] 13. Add configuration for template system
  - Create configuration entries for template system settings
  - _Requirements: 8.2, 8.3, 8.4_

- [ ] 13.1 Add template configuration to config file
  - Add to backend/src/config/index.ts
  - Add templates.imageDownloadTimeout (5000ms)
  - Add templates.maxImageSize (2MB = 2 * 1024 * 1024)
  - Add templates.imageCacheTTL (24 hours = 24 * 60 * 60)
  - Add templates.pdfGenerationTimeout (10000ms)
  - Add templates.allowedImageDomains array (Amazon CDN domains)
  - Export configuration for use in ImageProcessingService
  - _Requirements: 8.2, 8.3, 8.4_

- [ ] 14. Write integration tests
  - Test end-to-end template generation for each type
  - _Requirements: All_

- [ ] 14.1 Write integration test for product selection fax with images
  - Create test file: backend/src/test/integration/productSelectionFaxWithImages.test.ts
  - Generate fax with 1, 3, and 5 products
  - Verify PDF is valid (Buffer, non-zero length)
  - Test with products that have imageUrls
  - Test with products without imageUrls (fallback)
  - Verify image caching is working
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 14.2 Write integration test for email fax enhancements
  - Create test file: backend/src/test/integration/emailFaxEnhancements.test.ts
  - Generate fax with quick replies (questions in body)
  - Generate fax without quick replies
  - Test with long email bodies (>2000 chars) for pagination
  - Test with attachmentCount > 0
  - Verify attachment indicator appears
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 14.3 Write integration test for appointment fax
  - Create test file: backend/src/test/integration/appointmentSelectionFax.test.ts
  - Generate fax with 2, 5, and 10 appointment slots
  - Test with all available slots
  - Test with mix of available and unavailable slots
  - Test with slots across multiple days
  - Verify selection markers are correct
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 14.4 Write integration test for general inquiry fax
  - Create test file: backend/src/test/integration/generalInquiryFax.test.ts
  - Generate fax with text-only response
  - Generate fax with inline images
  - Generate fax with images at end
  - Test with long responses (pagination)
  - Test question/answer distinction
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 14.5 Write integration test for template error scenarios
  - Create test file: backend/src/test/integration/templateErrorHandling.test.ts
  - Test with invalid image URLs (should fallback gracefully)
  - Test with missing required data fields
  - Test with oversized content (pagination)
  - Verify fallback to text-only template works
  - Verify error logging occurs
  - _Requirements: 1.5, 2.6, 8.5_

- [ ] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Documentation and deployment preparation
  - Update documentation and prepare for deployment
  - _Requirements: All_

- [x] 16.1 Update API documentation
  - Document new template types (appointment_selection, general_inquiry)
  - Document ImageProcessingService API and caching behavior
  - Document TemplateRegistry usage and MCP server mappings
  - Document configuration options in config/index.ts
  - Add JSDoc comments to new classes and methods

- [x] 16.2 Create migration guide
  - Create TEMPLATE_SYSTEM_GUIDE.md in backend/docs/
  - Document how to use TemplateRegistry for new MCP servers
  - Provide code examples for each template type
  - Document backward compatibility (existing generators unchanged)
  - Explain image processing and caching

- [x] 16.3 Update monitoring dashboards
  - Add template generation metrics to MonitoringService
  - Add image processing metrics (cache hits, download times)
  - Add error rate tracking by template type
  - Add cache performance metrics to admin dashboard
  - Update Prometheus metrics if applicable
