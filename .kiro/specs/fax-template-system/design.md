# Fax Template System - Design Document

## Overview

The Fax Template System provides a flexible, template-based architecture for generating professional fax documents across different use cases. The system pairs templates with MCP servers to create consistent, user-friendly faxes that bridge the gap between traditional fax machines and modern digital services.

### Key Design Goals

1. **Flexibility**: Support diverse content types (text, images, selection options, barcodes) within a unified framework
2. **Consistency**: Maintain branding and styling across all fax types
3. **Usability**: Optimize layouts for elderly users with clear fonts, spacing, and selection markers
4. **Performance**: Efficiently handle image processing and PDF generation
5. **Extensibility**: Easy to add new templates for future use cases

### Current State Analysis

The existing codebase already has foundational components:
- `FaxGenerator`: Low-level PDF/PNG generation with canvas rendering
- `FaxTemplateEngine`: Template creation with standard header/footer
- Specialized generators: `ProductSelectionFaxGenerator`, `EmailFaxGenerator`
- Type definitions in `backend/src/types/fax.ts`

This design builds upon these foundations while addressing gaps identified in the requirements.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Controller Agent                      │
│              (Orchestrates fax generation)                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Template Selection Layer                        │
│         (Maps MCP server + intent → template)                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Template Rendering Engine                       │
│    (FaxTemplateEngine + specialized generators)              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Content Processing Layer                        │
│  (Image download, resize, text wrapping, pagination)         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              PDF Generation Layer                            │
│         (FaxGenerator - Canvas → PDF conversion)             │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**Template Selection Layer**
- Maps (MCP server, intent) pairs to appropriate templates
- Handles fallback to default templates
- Validates template availability

**Template Rendering Engine**
- Orchestrates content block rendering
- Manages pagination for multi-page faxes
- Applies consistent branding (header, footer, reference ID)
- Handles dynamic layout adjustments

**Content Processing Layer**
- Downloads and caches images from URLs
- Resizes images to fax-appropriate resolution (200 DPI)
- Wraps text to fit page width
- Generates barcodes and QR codes

**PDF Generation Layer**
- Renders content blocks to canvas
- Converts canvas to PDF format
- Handles multi-page PDF assembly

## Components and Interfaces

### Template Registry

A centralized registry that maps MCP servers and intents to template types.

```typescript
interface TemplateMapping {
  mcpServer: string;
  intent?: string;
  templateType: TemplateType;
  priority: number; // For handling conflicts
}

class TemplateRegistry {
  private mappings: TemplateMapping[];
  
  register(mapping: TemplateMapping): void;
  getTemplate(mcpServer: string, intent?: string): TemplateType;
  getFallbackTemplate(): TemplateType;
}
```

**Design Rationale**: Centralized registry allows easy addition of new templates without modifying core logic. Priority system handles cases where multiple templates could apply.

### Enhanced Template Types

Extend existing `FaxTemplate` interface to support new template types:

```typescript
type TemplateType = 
  | 'email_reply' 
  | 'product_selection' 
  | 'payment_barcodes' 
  | 'confirmation' 
  | 'clarification'
  | 'appointment_selection'  // NEW
  | 'general_inquiry'        // NEW
  | 'government_form'        // NEW (future)
  | 'multi_action';          // Existing

interface FaxTemplate {
  type: TemplateType;
  referenceId: string;
  pages: FaxPage[];
  contextData: any;
  metadata?: TemplateMetadata; // NEW
}

interface TemplateMetadata {
  mcpServer: string;
  intent?: string;
  generatedAt: Date;
  expiresAt?: Date;
  version: string;
}
```

### Image Handling Service

New service for efficient image processing:

```typescript
interface ImageProcessingOptions {
  maxWidth: number;
  maxHeight: number;
  targetDPI: number;
  format: 'png' | 'jpeg';
  quality?: number;
  grayscale?: boolean;
}

class ImageProcessingService {
  async downloadImage(url: string, timeout?: number): Promise<Buffer>;
  async resizeImage(buffer: Buffer, options: ImageProcessingOptions): Promise<Buffer>;
  async cacheImage(url: string, buffer: Buffer, ttl?: number): Promise<void>;
  async getCachedImage(url: string): Promise<Buffer | null>;
  async embedImageInCanvas(
    ctx: CanvasRenderingContext2D, 
    imageBuffer: Buffer, 
    x: number, 
    y: number, 
    width: number, 
    height: number
  ): Promise<void>;
}
```

**Design Rationale**: Separates image concerns from template rendering. Caching reduces redundant downloads. Timeout prevents hanging on slow image servers.

### Dynamic Layout Calculator

Handles responsive layout adjustments based on content quantity:

```typescript
interface LayoutConstraints {
  maxItemsPerPage: number;
  minItemSpacing: number;
  imageSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
}

class DynamicLayoutCalculator {
  calculateProductLayout(productCount: number): LayoutConstraints;
  calculateAppointmentLayout(slotCount: number): LayoutConstraints;
  calculatePagination(contentHeight: number, pageHeight: number): number;
  adjustSpacing(itemCount: number, availableHeight: number): number;
}
```

**Design Rationale**: Encapsulates layout logic for different content densities. Makes templates adaptive without manual configuration.

### Enhanced Content Block Types

Extend `FaxContent` to support images:

```typescript
interface FaxContent {
  type: 'text' | 'checkbox' | 'circle_option' | 'barcode' | 'blank_space' | 'header' | 'footer' | 'image'; // Added 'image'
  
  // Existing fields...
  text?: string;
  fontSize?: number;
  bold?: boolean;
  alignment?: 'left' | 'center' | 'right';
  marginTop?: number;
  marginBottom?: number;
  options?: CircleOption[];
  barcodeData?: BarcodeData;
  height?: number;
  
  // NEW: Image support
  imageData?: ImageContent;
}

interface ImageContent {
  url?: string;           // Download from URL
  buffer?: Buffer;        // Pre-loaded image buffer
  width: number;
  height: number;
  alignment?: 'left' | 'center' | 'right';
  caption?: string;
  fallbackText?: string;  // Text to show if image fails
}
```

## Data Models

### Product Selection Template Data

```typescript
interface ProductSelectionTemplateData {
  searchQuery: string;
  products: ProductForFax[];
  userName?: string;
  deliveryAddress?: string;
  hasPaymentMethod: boolean;
}

interface ProductForFax {
  asin: string;
  title: string;              // Pre-truncated to 60 chars
  price: number;
  currency: string;
  primeEligible: boolean;
  rating?: number;
  reviewCount?: number;
  deliveryEstimate?: string;
  imageUrl?: string;
  selectionMarker: 'A' | 'B' | 'C' | 'D' | 'E';
}
```

### Email Template Data

```typescript
interface EmailTemplateData {
  from: string;
  subject: string;
  body: string;
  threadId?: string;
  hasQuickReplies: boolean;
  quickReplies?: string[];
  attachmentCount?: number;
}
```

### Appointment Selection Template Data

```typescript
interface AppointmentSelectionTemplateData {
  serviceName: string;
  provider: string;
  location?: string;
  slots: AppointmentSlot[];
}

interface AppointmentSlot {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  duration: number;          // minutes
  available: boolean;
  selectionMarker: string;   // A, B, C, etc.
}
```

### General Inquiry Template Data

```typescript
interface GeneralInquiryTemplateData {
  question: string;
  answer: string;
  images?: ImageReference[];
  relatedTopics?: string[];
}

interface ImageReference {
  url: string;
  caption?: string;
  position: 'inline' | 'end';
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Acceptance Criteria Testing Prework

1.1 WHEN a fax needs to be generated THEN the system SHALL select the appropriate template based on the MCP server and intent
Thoughts: This is about the template selection logic working correctly across all MCP server and intent combinations. We can generate random MCP server/intent pairs and verify the correct template type is returned.
Testable: yes - property

1.2 WHEN a template is rendered THEN the system SHALL support text, images, selection options, barcodes, and blank spaces as content blocks
Thoughts: This is testing that all content block types can be rendered without errors. We can generate random combinations of content blocks and ensure rendering succeeds.
Testable: yes - property

1.3 WHEN multiple templates exist THEN the system SHALL maintain consistent styling and branding across all templates
Thoughts: This is about visual consistency which is hard to test programmatically. We can verify that all templates include required branding elements (header, footer, reference ID).
Testable: yes - property

1.4 WHEN a template is reused THEN the system SHALL dynamically accommodate varying amounts of content
Thoughts: This tests the dynamic layout system. We can generate templates with varying content counts (1-10 products, 1-5 appointments) and verify proper pagination and spacing.
Testable: yes - property

1.5 WHEN rendering fails THEN the system SHALL fall back to a simple text-only template
Thoughts: This is error handling behavior. We can inject failures (bad image URLs, invalid data) and verify fallback occurs.
Testable: yes - property

2.1 WHEN displaying products THEN the system SHALL show product images, titles, prices, ratings, and Prime eligibility
Thoughts: This tests that product faxes contain all required fields. We can generate random products and verify all fields are present in the rendered output.
Testable: yes - property

2.2 WHEN products have images THEN the system SHALL download and embed images from Amazon URLs into the PDF
Thoughts: This tests image downloading and embedding. We can provide product data with image URLs and verify images are present in the PDF.
Testable: yes - property

2.3 WHEN displaying selection options THEN the system SHALL provide clear circle markers (A, B, C, D, E) for user selection
Thoughts: This tests that selection markers are correctly assigned and rendered. We can generate products and verify markers A-E are present.
Testable: yes - property

2.4 WHEN products vary in count THEN the template SHALL dynamically accommodate 1-5 products per page
Thoughts: This tests dynamic layout. We can generate templates with 1, 2, 3, 4, and 5 products and verify proper rendering.
Testable: yes - property

2.5 WHEN product titles are long THEN the system SHALL truncate to fit the fax format while maintaining readability
Thoughts: This tests title truncation logic. We can generate products with varying title lengths and verify truncation at 60 characters.
Testable: yes - property

2.6 WHEN images fail to load THEN the system SHALL render the product information without images
Thoughts: This is error handling. We can provide invalid image URLs and verify the fax still renders with product info.
Testable: yes - property

8.1 WHEN product images are scraped THEN the system SHALL cache image URLs in the database
Thoughts: This tests caching behavior. We can scrape products and verify URLs are stored in the cache.
Testable: yes - property

8.2 WHEN rendering a fax THEN the system SHALL download images from cached URLs
Thoughts: This tests that rendering uses cached URLs. We can render a fax and verify image downloads use cached data.
Testable: yes - property

8.3 WHEN images are downloaded THEN the system SHALL resize to appropriate fax resolution (200 DPI)
Thoughts: This tests image processing. We can download images and verify they are resized to 200 DPI.
Testable: yes - property

8.4 WHEN images are large THEN the system SHALL compress to reduce fax transmission time
Thoughts: This tests compression. We can provide large images and verify output size is reduced.
Testable: yes - property

8.5 WHEN image download fails THEN the system SHALL render without the image and log the failure
Thoughts: This is error handling. We can provide failing URLs and verify rendering continues and logs the error.
Testable: yes - property

9.1 WHEN content varies in length THEN the template SHALL adjust spacing and pagination automatically
Thoughts: This tests dynamic pagination. We can generate content of varying lengths and verify proper page breaks.
Testable: yes - property

9.2 WHEN products number 1-3 THEN the system SHALL use larger images and more spacing
Thoughts: This tests layout adaptation. We can generate 1-3 product faxes and verify larger image sizes.
Testable: yes - property

9.3 WHEN products number 4-5 THEN the system SHALL use compact layout with smaller images
Thoughts: This tests compact layout. We can generate 4-5 product faxes and verify smaller image sizes.
Testable: yes - property

9.4 WHEN content exceeds one page THEN the system SHALL paginate with page numbers and reference IDs
Thoughts: This tests multi-page handling. We can generate long content and verify page numbers and reference IDs on each page.
Testable: yes - property

10.1 WHEN any fax is generated THEN the system SHALL include a unique reference ID (FX-YYYY-NNNNNN) in a prominent location
Thoughts: This tests reference ID generation and placement. We can generate any fax and verify the reference ID format and presence.
Testable: yes - property

10.2 WHEN displaying the reference ID THEN the system SHALL use large, clear text that is easy to read and transcribe
Thoughts: This tests reference ID formatting. We can verify font size meets minimum requirements.
Testable: yes - property

10.3 WHEN multiple pages exist THEN the system SHALL include the reference ID on every page
Thoughts: This tests multi-page reference ID placement. We can generate multi-page faxes and verify reference ID on all pages.
Testable: yes - property

11.1 WHEN any fax is generated THEN the system SHALL include the Faxi logo/header
Thoughts: This tests branding consistency. We can generate any template type and verify header presence.
Testable: yes - property

11.2 WHEN any fax is generated THEN the system SHALL use consistent fonts and sizing
Thoughts: This tests font consistency. We can verify all templates use the same font family and size standards.
Testable: yes - property

11.3 WHEN any fax is generated THEN the system SHALL include footer with contact information
Thoughts: This tests footer presence. We can generate any template and verify footer with contact info.
Testable: yes - property

### Property Reflection

After reviewing all properties, several can be consolidated:

- Properties 11.1, 11.2, 11.3 (branding consistency) can be combined into a single comprehensive branding property
- Properties 2.3 and 2.4 (selection markers and dynamic layout) are related but test different aspects, so both should remain
- Properties 8.1 and 8.2 (caching) can be combined into a single cache round-trip property
- Properties 9.2 and 9.3 (layout adaptation) can be combined into a single layout density property

The consolidated set provides comprehensive coverage without redundancy.

### Correctness Properties

Property 1: Template selection correctness
*For any* MCP server and intent combination, the template registry should return a valid template type, and the same inputs should always return the same template type
**Validates: Requirements 1.1, 7.1, 7.2, 7.3, 7.4, 7.5**

Property 2: Content block rendering completeness
*For any* valid content block type (text, image, selection option, barcode, blank space), the rendering engine should successfully render it without throwing errors
**Validates: Requirements 1.2**

Property 3: Branding consistency
*For any* generated fax template, it should include a header with Faxi branding, a footer with contact information, and use consistent fonts (Arial at specified sizes)
**Validates: Requirements 1.3, 11.1, 11.2, 11.3**

Property 4: Dynamic content accommodation
*For any* template with varying content counts (1-10 products, 1-5 appointments, etc.), the system should properly paginate and adjust spacing without content overflow
**Validates: Requirements 1.4, 9.1, 9.4**

Property 5: Fallback on rendering failure
*For any* rendering error (invalid image URL, missing data, etc.), the system should fall back to a text-only template and log the error
**Validates: Requirements 1.5, 2.6, 8.5**

Property 6: Product display completeness
*For any* product selection fax, all products should display title, price, rating, Prime eligibility, and selection marker
**Validates: Requirements 2.1, 2.3**

Property 7: Image embedding
*For any* product with a valid image URL, the image should be downloaded, resized to 200 DPI, and embedded in the PDF
**Validates: Requirements 2.2, 8.2, 8.3**

Property 8: Title truncation
*For any* product title longer than 60 characters, it should be truncated to 60 characters with ellipsis while maintaining word boundaries when possible
**Validates: Requirements 2.5**

Property 9: Image caching round-trip
*For any* image URL that is cached, subsequent retrievals should return the cached image without re-downloading
**Validates: Requirements 8.1, 8.2**

Property 10: Image compression
*For any* image larger than 2MB, the compressed output should be smaller than the input while maintaining readability at 200 DPI
**Validates: Requirements 8.4**

Property 11: Layout density adaptation
*For any* product count, when count ≤ 3 the system should use large images and spacing, when count ≥ 4 the system should use compact layout
**Validates: Requirements 9.2, 9.3**

Property 12: Reference ID format and placement
*For any* generated fax, it should include a reference ID in format FX-YYYY-NNNNNN with font size ≥ 34pt, and the reference ID should appear on every page
**Validates: Requirements 10.1, 10.2, 10.3**

Property 13: Email quick reply generation
*For any* email with clear questions, the system should generate 1-3 contextually appropriate quick reply options
**Validates: Requirements 3.3**

Property 14: Appointment slot formatting
*For any* appointment selection fax, all slots should display date, time, duration, availability status, and selection marker
**Validates: Requirements 5.1, 5.2, 5.3**

## Error Handling

### Error Categories

1. **Image Processing Errors**
   - Download timeout (5 seconds)
   - Invalid image format
   - Image too large (>2MB before compression)
   - Network failures

2. **Template Rendering Errors**
   - Invalid template data
   - Missing required fields
   - Content overflow
   - Font rendering issues

3. **PDF Generation Errors**
   - Canvas creation failure
   - PDF assembly failure
   - Memory constraints

### Error Handling Strategy

```typescript
interface RenderingError {
  type: 'image' | 'template' | 'pdf' | 'unknown';
  severity: 'warning' | 'error' | 'critical';
  message: string;
  context: any;
  fallbackApplied: boolean;
}

class ErrorHandler {
  handleImageError(error: Error, imageUrl: string): ImageContent;
  handleTemplateError(error: Error, templateData: any): FaxTemplate;
  handlePDFError(error: Error): Buffer;
  logError(error: RenderingError): void;
}
```

**Fallback Hierarchy**:
1. Image fails → Render without image, show product info
2. Template rendering fails → Use simple text-only template
3. PDF generation fails → Return error fax with reference ID and support contact

**Design Rationale**: Graceful degradation ensures users always receive a fax, even if not optimal. Logging enables debugging and monitoring.

## Testing Strategy

### Unit Testing

Unit tests will cover individual components:

- **Template Registry**: Test template selection logic with various MCP server/intent combinations
- **Image Processing Service**: Test image download, resize, caching with mock images
- **Dynamic Layout Calculator**: Test layout calculations for different content counts
- **Content Block Rendering**: Test each content block type renders correctly

Example unit test structure:

```typescript
describe('TemplateRegistry', () => {
  it('should return product_selection template for shopping MCP', () => {
    const template = registry.getTemplate('shopping', 'search_products');
    expect(template).toBe('product_selection');
  });
  
  it('should return fallback template for unknown MCP server', () => {
    const template = registry.getTemplate('unknown_server');
    expect(template).toBe('general_inquiry');
  });
});
```

### Property-Based Testing

Property-based tests will use **fast-check** library to verify universal properties across many random inputs.

**Configuration**: Each property test should run a minimum of 100 iterations.

**Tagging Convention**: Each property-based test must include a comment with the format:
`// Feature: fax-template-system, Property N: [property description]`

Example property test structure:

```typescript
import fc from 'fast-check';

describe('Property Tests', () => {
  // Feature: fax-template-system, Property 1: Template selection correctness
  it('should always return valid template for any MCP server/intent', () => {
    fc.assert(
      fc.property(
        fc.string(), // mcpServer
        fc.option(fc.string()), // intent
        (mcpServer, intent) => {
          const template = registry.getTemplate(mcpServer, intent);
          expect(VALID_TEMPLATE_TYPES).toContain(template);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Feature: fax-template-system, Property 8: Title truncation
  it('should truncate long titles to 60 chars with ellipsis', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 61, maxLength: 200 }),
        (longTitle) => {
          const truncated = truncateTitle(longTitle, 60);
          expect(truncated.length).toBeLessThanOrEqual(60);
          if (longTitle.length > 60) {
            expect(truncated).toMatch(/\.\.\.$/);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

Integration tests will verify end-to-end template generation:

- Generate complete faxes for each template type
- Verify PDF output is valid and contains expected content
- Test with real product data from cache
- Test multi-page fax generation
- Test error scenarios with invalid data

Example integration test:

```typescript
describe('Product Selection Fax Generation', () => {
  it('should generate valid PDF with 5 products', async () => {
    const products = generateMockProducts(5);
    const pdfBuffer = await ProductSelectionFaxGenerator.generateProductSelectionFax({
      products,
      searchQuery: 'test query'
    });
    
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    
    // Verify PDF is valid
    const pdfInfo = await getPDFInfo(pdfBuffer);
    expect(pdfInfo.pageCount).toBeGreaterThanOrEqual(1);
  });
});
```

### Test Data Generators

Create generators for property-based testing:

```typescript
// Product generator
const productArbitrary = fc.record({
  asin: fc.string({ minLength: 10, maxLength: 10 }),
  title: fc.string({ minLength: 10, maxLength: 200 }),
  price: fc.integer({ min: 100, max: 100000 }),
  rating: fc.option(fc.float({ min: 0, max: 5 })),
  primeEligible: fc.boolean(),
  imageUrl: fc.option(fc.webUrl())
});

// Template data generator
const productSelectionDataArbitrary = fc.record({
  searchQuery: fc.string({ minLength: 1, maxLength: 100 }),
  products: fc.array(productArbitrary, { minLength: 1, maxLength: 5 })
});
```

## Implementation Details

### Template Registry Implementation

The template registry will be implemented as a singleton service:

```typescript
// backend/src/services/templateRegistry.ts
export class TemplateRegistry {
  private static instance: TemplateRegistry;
  private mappings: Map<string, TemplateType>;
  
  private constructor() {
    this.initializeMappings();
  }
  
  static getInstance(): TemplateRegistry {
    if (!TemplateRegistry.instance) {
      TemplateRegistry.instance = new TemplateRegistry();
    }
    return TemplateRegistry.instance;
  }
  
  private initializeMappings(): void {
    // Shopping MCP → Product Selection Template
    this.register('shopping', 'search_products', 'product_selection');
    this.register('shopping', 'get_product_details', 'product_selection');
    
    // Email MCP → Email Response Template
    this.register('email', 'send_email', 'email_reply');
    this.register('email', 'email_request', 'email_reply');
    
    // AI Chat MCP → General Inquiry Template
    this.register('ai_chat', undefined, 'general_inquiry');
    
    // Appointment MCP → Appointment Selection Template
    this.register('appointment', 'search_appointments', 'appointment_selection');
    
    // Payment MCP → Payment Barcode Template
    this.register('payment', 'generate_barcode', 'payment_barcodes');
  }
  
  register(mcpServer: string, intent: string | undefined, templateType: TemplateType): void {
    const key = this.createKey(mcpServer, intent);
    this.mappings.set(key, templateType);
  }
  
  getTemplate(mcpServer: string, intent?: string): TemplateType {
    // Try exact match first
    const exactKey = this.createKey(mcpServer, intent);
    if (this.mappings.has(exactKey)) {
      return this.mappings.get(exactKey)!;
    }
    
    // Try server-only match
    const serverKey = this.createKey(mcpServer, undefined);
    if (this.mappings.has(serverKey)) {
      return this.mappings.get(serverKey)!;
    }
    
    // Fallback to general inquiry
    return 'general_inquiry';
  }
  
  private createKey(mcpServer: string, intent?: string): string {
    return intent ? `${mcpServer}:${intent}` : mcpServer;
  }
}
```

### Image Processing Service Implementation

```typescript
// backend/src/services/imageProcessingService.ts
import sharp from 'sharp';
import axios from 'axios';
import { createClient } from 'redis';

export class ImageProcessingService {
  private redis: ReturnType<typeof createClient>;
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours
  private readonly DOWNLOAD_TIMEOUT = 5000; // 5 seconds
  private readonly MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
  
  constructor(redisClient: ReturnType<typeof createClient>) {
    this.redis = redisClient;
  }
  
  async downloadImage(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: this.DOWNLOAD_TIMEOUT,
        maxContentLength: this.MAX_IMAGE_SIZE
      });
      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to download image from ${url}: ${error.message}`);
    }
  }
  
  async resizeImage(buffer: Buffer, options: ImageProcessingOptions): Promise<Buffer> {
    const { maxWidth, maxHeight, targetDPI, format, quality = 80, grayscale = true } = options;
    
    let pipeline = sharp(buffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .withMetadata({ density: targetDPI });
    
    if (grayscale) {
      pipeline = pipeline.grayscale();
    }
    
    if (format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality });
    } else {
      pipeline = pipeline.png({ compressionLevel: 9 });
    }
    
    return await pipeline.toBuffer();
  }
  
  async cacheImage(url: string, buffer: Buffer): Promise<void> {
    const key = `image:${this.hashUrl(url)}`;
    await this.redis.setEx(key, this.CACHE_TTL, buffer.toString('base64'));
  }
  
  async getCachedImage(url: string): Promise<Buffer | null> {
    const key = `image:${this.hashUrl(url)}`;
    const cached = await this.redis.get(key);
    return cached ? Buffer.from(cached, 'base64') : null;
  }
  
  async processAndCacheImage(url: string, options: ImageProcessingOptions): Promise<Buffer> {
    // Check cache first
    const cached = await this.getCachedImage(url);
    if (cached) {
      return cached;
    }
    
    // Download and process
    const downloaded = await this.downloadImage(url);
    const processed = await this.resizeImage(downloaded, options);
    
    // Cache for future use
    await this.cacheImage(url, processed);
    
    return processed;
  }
  
  private hashUrl(url: string): string {
    // Simple hash for cache key
    return Buffer.from(url).toString('base64').substring(0, 32);
  }
}
```

### Enhanced FaxGenerator with Image Support

Extend the existing `FaxGenerator` to handle image content blocks:

```typescript
// backend/src/services/faxGenerator.ts (additions)
private static async renderImage(
  ctx: CanvasRenderingContext2D,
  content: FaxContent,
  y: number,
  contentWidth: number,
  margins: FaxGenerationOptions['margins'],
  options: FaxGenerationOptions
): Promise<number> {
  if (!content.imageData) return y;
  
  const { imageData } = content;
  
  try {
    let imageBuffer: Buffer;
    
    if (imageData.buffer) {
      imageBuffer = imageData.buffer;
    } else if (imageData.url) {
      // Use image processing service to download and cache
      const imageService = new ImageProcessingService(redisClient);
      imageBuffer = await imageService.processAndCacheImage(imageData.url, {
        maxWidth: imageData.width,
        maxHeight: imageData.height,
        targetDPI: options.dpi,
        format: 'png',
        grayscale: true
      });
    } else {
      throw new Error('No image source provided');
    }
    
    // Load image into canvas
    const image = await loadImage(imageBuffer);
    
    // Calculate position based on alignment
    let x = margins.left;
    if (imageData.alignment === 'center') {
      x = margins.left + (contentWidth - imageData.width) / 2;
    } else if (imageData.alignment === 'right') {
      x = margins.left + contentWidth - imageData.width;
    }
    
    // Draw image
    ctx.drawImage(image, x, y, imageData.width, imageData.height);
    
    let currentY = y + imageData.height;
    
    // Add caption if provided
    if (imageData.caption) {
      currentY += 10; // Small gap
      ctx.font = `normal ${options.defaultFontSize * 0.8}px Arial`;
      ctx.textAlign = imageData.alignment || 'left';
      ctx.fillText(imageData.caption, x, currentY);
      currentY += options.defaultFontSize * 0.8;
    }
    
    return currentY;
    
  } catch (error) {
    console.error('Failed to render image:', error);
    
    // Fallback: render fallback text or skip
    if (imageData.fallbackText) {
      ctx.font = `normal ${options.defaultFontSize}px Arial`;
      ctx.fillText(imageData.fallbackText, margins.left, y);
      return y + options.defaultFontSize * 1.2;
    }
    
    return y; // Skip image entirely
  }
}
```

### Dynamic Layout Calculator Implementation

```typescript
// backend/src/services/dynamicLayoutCalculator.ts
export class DynamicLayoutCalculator {
  private readonly PAGE_HEIGHT = 2800;
  private readonly HEADER_HEIGHT = 200;
  private readonly FOOTER_HEIGHT = 150;
  
  calculateProductLayout(productCount: number): LayoutConstraints {
    if (productCount <= 3) {
      return {
        maxItemsPerPage: 3,
        minItemSpacing: 60,
        imageSize: 'large',
        compactMode: false
      };
    } else {
      return {
        maxItemsPerPage: 5,
        minItemSpacing: 30,
        imageSize: 'small',
        compactMode: true
      };
    }
  }
  
  calculateImageDimensions(imageSize: 'small' | 'medium' | 'large'): { width: number; height: number } {
    switch (imageSize) {
      case 'large':
        return { width: 400, height: 400 };
      case 'medium':
        return { width: 250, height: 250 };
      case 'small':
        return { width: 150, height: 150 };
    }
  }
  
  calculatePagination(contentHeight: number): number {
    const availableHeight = this.PAGE_HEIGHT - this.HEADER_HEIGHT - this.FOOTER_HEIGHT;
    return Math.ceil(contentHeight / availableHeight);
  }
  
  adjustSpacing(itemCount: number, availableHeight: number): number {
    const totalItemHeight = itemCount * 200; // Approximate item height
    const remainingSpace = availableHeight - totalItemHeight;
    return Math.max(30, remainingSpace / (itemCount + 1));
  }
}
```

### Template-Specific Generators

Each template type will have a dedicated generator that uses the core `FaxTemplateEngine`:

**Product Selection Generator** (already exists, will be enhanced):
- Add image embedding support
- Implement dynamic layout based on product count
- Add image fallback handling

**Email Generator** (already exists, will be enhanced):
- Improve quick reply detection
- Add attachment indicators
- Support email threading visualization

**Appointment Selection Generator** (new):
```typescript
// backend/src/services/appointmentSelectionFaxGenerator.ts
export class AppointmentSelectionFaxGenerator {
  static async generateAppointmentSelectionFax(
    data: AppointmentSelectionTemplateData,
    referenceId?: string
  ): Promise<Buffer> {
    const template = this.createAppointmentTemplate(data, referenceId);
    return await FaxGenerator.generatePdf(template);
  }
  
  private static createAppointmentTemplate(
    data: AppointmentSelectionTemplateData,
    referenceId?: string
  ): FaxTemplate {
    // Implementation details...
  }
}
```

**General Inquiry Generator** (new):
```typescript
// backend/src/services/generalInquiryFaxGenerator.ts
export class GeneralInquiryFaxGenerator {
  static async generateInquiryFax(
    data: GeneralInquiryTemplateData,
    referenceId?: string
  ): Promise<Buffer> {
    const template = this.createInquiryTemplate(data, referenceId);
    return await FaxGenerator.generatePdf(template);
  }
  
  private static createInquiryTemplate(
    data: GeneralInquiryTemplateData,
    referenceId?: string
  ): FaxTemplate {
    // Implementation details...
  }
}
```

## Performance Considerations

### Image Processing Performance

**Challenge**: Downloading and processing images can be slow and block fax generation.

**Solutions**:
1. **Aggressive Caching**: Cache processed images in Redis for 24 hours
2. **Timeout Limits**: 5-second timeout for image downloads
3. **Parallel Processing**: Download multiple images concurrently using `Promise.all()`
4. **Lazy Loading**: Only download images when actually rendering the fax
5. **Size Limits**: Reject images larger than 2MB before processing

**Expected Performance**:
- Cached image: <50ms
- Fresh download + processing: 1-3 seconds
- Timeout fallback: 5 seconds max

### PDF Generation Performance

**Challenge**: Canvas rendering and PDF conversion can be memory-intensive.

**Solutions**:
1. **Streaming**: Generate PDF pages incrementally rather than all at once
2. **Memory Management**: Clear canvas buffers after each page
3. **Compression**: Use PDFKit compression options
4. **Timeout**: 10-second timeout for complete PDF generation

**Expected Performance**:
- Single-page fax: 200-500ms
- Multi-page fax (3-5 pages): 1-2 seconds

### Caching Strategy

**Image Cache** (Redis):
- Key format: `image:{hash(url)}`
- TTL: 24 hours
- Max size per image: 500KB (after compression)

**Product Cache** (existing):
- Already implemented in `productCacheRepository`
- Includes image URLs for products
- TTL: 7 days

**Template Cache** (future optimization):
- Cache rendered templates for identical data
- Key format: `template:{type}:{hash(data)}`
- TTL: 1 hour

## Security Considerations

### Image URL Validation

**Risk**: Malicious URLs could be used for SSRF attacks or to download inappropriate content.

**Mitigations**:
1. **URL Whitelist**: Only allow images from trusted domains (Amazon, approved CDNs)
2. **Content-Type Validation**: Verify response is actually an image
3. **Size Limits**: Reject responses larger than 2MB
4. **Timeout**: Prevent hanging on slow/malicious servers
5. **Network Isolation**: Use separate network context for image downloads

```typescript
const ALLOWED_IMAGE_DOMAINS = [
  'images-na.ssl-images-amazon.com',
  'm.media-amazon.com',
  'images-fe.ssl-images-amazon.com'
];

function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_IMAGE_DOMAINS.some(domain => 
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}
```

### Reference ID Security

**Risk**: Predictable reference IDs could allow unauthorized access to conversation contexts.

**Mitigations**:
1. **Timestamp Component**: Include year for temporal context
2. **Random Component**: 6-digit random number (1 million possibilities)
3. **Database Lookup**: Always verify reference ID exists and belongs to user
4. **Expiration**: Context data expires after 7 days

### PDF Content Sanitization

**Risk**: User-provided content could contain malicious scripts or formatting.

**Mitigations**:
1. **Text Escaping**: Escape all user-provided text before rendering
2. **No JavaScript**: PDFs are static images, no executable content
3. **Input Validation**: Validate all template data against schemas
4. **Length Limits**: Enforce maximum lengths for all text fields

## Monitoring and Observability

### Metrics to Track

1. **Template Generation Metrics**:
   - Generation time by template type
   - Success/failure rates
   - Fallback usage frequency

2. **Image Processing Metrics**:
   - Cache hit/miss rates
   - Download times
   - Processing times
   - Failure rates by domain

3. **PDF Generation Metrics**:
   - Generation time by page count
   - Memory usage
   - File sizes

4. **Error Metrics**:
   - Error rates by type (image, template, PDF)
   - Fallback trigger frequency
   - Timeout occurrences

### Logging Strategy

```typescript
interface TemplateGenerationLog {
  timestamp: Date;
  userId: string;
  referenceId: string;
  templateType: TemplateType;
  mcpServer: string;
  intent?: string;
  generationTimeMs: number;
  pageCount: number;
  imageCount: number;
  imageCacheHits: number;
  imageCacheMisses: number;
  errors: RenderingError[];
  fallbackUsed: boolean;
  success: boolean;
}
```

**Log Levels**:
- **INFO**: Successful template generation with metrics
- **WARN**: Fallback used, image download failed
- **ERROR**: Template generation failed, PDF generation failed
- **CRITICAL**: System-wide template service failure

### Alerting

**Alert Conditions**:
1. Template generation failure rate > 5% over 5 minutes
2. Image download failure rate > 20% over 5 minutes
3. Average generation time > 5 seconds over 5 minutes
4. PDF generation timeout rate > 1% over 5 minutes

## Migration Strategy

### Phase 1: Foundation (Week 1-2)

1. Implement `TemplateRegistry` service
2. Implement `ImageProcessingService` with caching
3. Implement `DynamicLayoutCalculator`
4. Add image content block support to `FaxGenerator`
5. Write unit tests for new components

### Phase 2: Template Enhancement (Week 3-4)

1. Enhance `ProductSelectionFaxGenerator` with image support
2. Enhance `EmailFaxGenerator` with improved quick replies
3. Implement `AppointmentSelectionFaxGenerator`
4. Implement `GeneralInquiryFaxGenerator`
5. Write integration tests for each template type

### Phase 3: Integration (Week 5)

1. Integrate `TemplateRegistry` with MCP Controller Agent
2. Update response generation to use template registry
3. Add monitoring and metrics collection
4. Write property-based tests

### Phase 4: Testing & Optimization (Week 6)

1. End-to-end testing with real data
2. Performance optimization based on metrics
3. Cache tuning
4. Documentation updates

### Backward Compatibility

**Existing Code**: All existing fax generators will continue to work unchanged.

**Migration Path**: 
- Existing generators can be gradually migrated to use new services
- Template registry provides fallback for unmapped MCP servers
- Image processing is opt-in via new content block type

**No Breaking Changes**: All existing APIs remain unchanged.

## Future Enhancements

### Template Customization (Future)

Allow users to customize template appearance:
- Font size preferences
- Language preferences (Japanese/English)
- Branding customization for business users

### Multi-language Support (Future)

Support for Japanese and English templates:
- Locale-aware date/time formatting
- Currency formatting
- Text direction and font selection

### Interactive Elements (Future)

Add QR codes for digital follow-up:
- QR code linking to web portal
- QR code for payment
- QR code for order tracking

### Government Forms Template (Future)

Support for pre-filling government forms:
- PDF form field detection
- Automated form filling
- Signature placement indicators

### Template Analytics (Future)

Track template effectiveness:
- Response rates by template type
- User preferences
- Error patterns
- A/B testing support

## Dependencies

### External Libraries

- **sharp**: Image processing and resizing
- **canvas**: Canvas rendering for PDF generation
- **pdfkit**: PDF document generation
- **jsbarcode**: Barcode generation
- **axios**: HTTP client for image downloads
- **redis**: Caching layer

### Internal Services

- `FaxGenerator`: Core PDF generation (existing)
- `FaxTemplateEngine`: Template creation (existing)
- `productCacheRepository`: Product data caching (existing)
- `conversationContextRepository`: Context storage (existing)
- `auditLogService`: Logging (existing)

### Configuration

```typescript
// backend/src/config/index.ts (additions)
export const config = {
  // ... existing config
  
  templates: {
    imageDownloadTimeout: 5000,
    maxImageSize: 2 * 1024 * 1024,
    imageCacheTTL: 24 * 60 * 60,
    pdfGenerationTimeout: 10000,
    allowedImageDomains: [
      'images-na.ssl-images-amazon.com',
      'm.media-amazon.com',
      'images-fe.ssl-images-amazon.com'
    ]
  }
};
```

## Conclusion

This design provides a comprehensive, extensible template system that addresses all requirements while building on existing infrastructure. The modular architecture allows for incremental implementation and easy addition of new template types. Property-based testing ensures correctness across a wide range of inputs, while performance optimizations and caching strategies ensure responsive fax generation.

Key design decisions:
1. **Template Registry**: Centralized mapping enables easy template management
2. **Image Processing Service**: Separate service with caching improves performance and reusability
3. **Dynamic Layout**: Adaptive layouts provide optimal user experience regardless of content quantity
4. **Graceful Degradation**: Fallback mechanisms ensure users always receive a fax
5. **Property-Based Testing**: Comprehensive testing strategy validates correctness properties

The system is designed to scale with future requirements while maintaining backward compatibility with existing code.
