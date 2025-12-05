# Fax Template System Guide

## Overview

The Fax Template System provides a flexible, template-based architecture for generating professional fax documents across different use cases. This guide explains how to use the template system, add new templates, and integrate with MCP servers.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Template Types](#template-types)
3. [Using the Template Registry](#using-the-template-registry)
4. [Image Processing](#image-processing)
5. [Dynamic Layouts](#dynamic-layouts)
6. [Creating New Templates](#creating-new-templates)
7. [Configuration](#configuration)
8. [Backward Compatibility](#backward-compatibility)
9. [Examples](#examples)
10. [Troubleshooting](#troubleshooting)

## Architecture Overview

The template system consists of several key components:

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Controller Agent                      │
│              (Orchestrates fax generation)                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Template Selection Layer                        │
│         (TemplateRegistry: MCP → template)                   │
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
│  (ImageProcessingService, DynamicLayoutCalculator)           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              PDF Generation Layer                            │
│         (FaxGenerator - Canvas → PDF conversion)             │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

- **TemplateRegistry**: Maps MCP servers and intents to template types
- **ImageProcessingService**: Downloads, caches, and processes images
- **DynamicLayoutCalculator**: Calculates adaptive layouts based on content quantity
- **FaxGenerator**: Low-level PDF/PNG generation with canvas rendering
- **FaxTemplateEngine**: Template creation with standard header/footer
- **Specialized Generators**: Template-specific generators (ProductSelection, Email, Appointment, GeneralInquiry)

## Template Types

The system supports the following template types:

### 1. Product Selection (`product_selection`)
- **Use Case**: E-commerce product browsing and ordering
- **MCP Server**: `shopping`
- **Features**: Product images, prices, ratings, selection markers
- **Generator**: `ProductSelectionFaxGenerator`

### 2. Email Reply (`email_reply`)
- **Use Case**: Email reading and replying
- **MCP Server**: `email`
- **Features**: Email headers, body, quick reply options, attachment indicators
- **Generator**: `EmailFaxGenerator`

### 3. Appointment Selection (`appointment_selection`)
- **Use Case**: Appointment booking and scheduling
- **MCP Server**: `appointment`
- **Features**: Time slots, availability indicators, selection markers
- **Generator**: `AppointmentSelectionFaxGenerator`

### 4. General Inquiry (`general_inquiry`)
- **Use Case**: AI Q&A and general assistance
- **MCP Server**: `ai_chat`, `chat`
- **Features**: Question/answer formatting, inline images, structured data
- **Generator**: `GeneralInquiryFaxGenerator`

### 5. Payment Barcodes (`payment_barcodes`)
- **Use Case**: Payment registration and confirmation
- **MCP Server**: `payment`
- **Features**: Barcodes, payment instructions
- **Generator**: `PaymentBarcodeFaxGenerator`

### 6. Other Templates
- `confirmation`: Order/action confirmations
- `clarification`: Clarification requests
- `welcome`: Welcome/onboarding faxes
- `multi_action`: Multiple action choices

## Using the Template Registry

The `TemplateRegistry` is a singleton service that maps MCP servers to template types.

### Basic Usage

```typescript
import { templateRegistry } from './services/templateRegistry';

// Get template type for a specific MCP server and intent
const templateType = templateRegistry.getTemplate('shopping', 'search_products');
// Returns: 'product_selection'

// Get template type with only MCP server (no intent)
const emailTemplate = templateRegistry.getTemplate('email');
// Returns: 'email_reply'

// Get fallback template for unknown MCP server
const fallback = templateRegistry.getTemplate('unknown_server');
// Returns: 'general_inquiry'
```

### Registering New Mappings

```typescript
// Register a new template mapping
templateRegistry.register(
  'custom_mcp',           // MCP server name
  'custom_intent',        // Intent (optional)
  'general_inquiry',      // Template type
  10                      // Priority (higher = more specific)
);

// Register server-level mapping (no specific intent)
templateRegistry.register(
  'custom_mcp',
  undefined,
  'general_inquiry',
  5
);
```

### Priority System

When multiple mappings could apply, the registry uses priority to resolve conflicts:

- **Priority 10**: Specific intent mappings (e.g., `shopping:search_products`)
- **Priority 5**: Server-level mappings (e.g., `shopping`)
- **Priority 1**: Fallback mappings

Higher priority values take precedence.

## Image Processing

The `ImageProcessingService` handles downloading, caching, and processing images for fax generation.

### Basic Usage

```typescript
import { ImageProcessingService } from './services/imageProcessingService';
import { redis } from './queue/connection';

const imageService = new ImageProcessingService(redis.getClient());

// Process and cache an image
const processedImage = await imageService.processAndCacheImage(
  'https://images-na.ssl-images-amazon.com/product.jpg',
  {
    maxWidth: 400,
    maxHeight: 400,
    targetDPI: 200,
    format: 'png',
    grayscale: true,
    quality: 80
  }
);
```

### Security Features

The service implements several security measures:

1. **Domain Whitelisting**: Only allows images from approved domains
   - `images-na.ssl-images-amazon.com`
   - `m.media-amazon.com`
   - `images-fe.ssl-images-amazon.com`

2. **Protocol Validation**: Only HTTPS URLs are allowed

3. **Size Limits**: Maximum 2MB per image

4. **Timeout Protection**: 5-second download timeout

5. **Content-Type Validation**: Verifies response is actually an image

### Caching Behavior

- **Cache Duration**: 24 hours (86400 seconds)
- **Cache Key**: SHA-256 hash of URL
- **Storage**: Redis with base64 encoding
- **Cache Hit Performance**: ~50ms
- **Cache Miss Performance**: 1-3 seconds (download + process)

### Checking URL Validity

```typescript
const isAllowed = imageService.isAllowedImageUrl(imageUrl);
if (!isAllowed) {
  console.error('Image URL not from allowed domain');
  // Use fallback text instead
}
```

## Dynamic Layouts

The `DynamicLayoutCalculator` provides adaptive layout calculations based on content quantity.

### Basic Usage

```typescript
import { DynamicLayoutCalculator } from './services/dynamicLayoutCalculator';

const calculator = new DynamicLayoutCalculator();

// Calculate layout for products
const layout = calculator.calculateProductLayout(3);
// Returns: { maxItemsPerPage: 3, minItemSpacing: 60, imageSize: 'large', compactMode: false }

const compactLayout = calculator.calculateProductLayout(5);
// Returns: { maxItemsPerPage: 5, minItemSpacing: 30, imageSize: 'small', compactMode: true }

// Get image dimensions
const dimensions = calculator.calculateImageDimensions('large');
// Returns: { width: 400, height: 400 }

// Calculate pagination
const pages = calculator.calculatePagination(5000); // 5000px of content
// Returns: 2 (number of pages needed)

// Calculate spacing
const spacing = calculator.adjustSpacing(5, 2450); // 5 items, 2450px available
// Returns: 60 (pixels between items)
```

### Layout Rules

**Product Layouts:**
- **1-3 products**: Large images (400x400), generous spacing (60px), non-compact
- **4-5 products**: Small images (150x150), compact spacing (30px), compact mode

**Appointment Layouts:**
- **1-5 slots**: Medium images, generous spacing (50px), non-compact
- **6-10 slots**: Small images, compact spacing (25px), compact mode

**Page Dimensions:**
- Total page height: 2800px (at 200 DPI)
- Header height: 200px
- Footer height: 150px
- Available content height: 2450px

## Creating New Templates

To create a new template type, follow these steps:

### Step 1: Define Template Data Interface

```typescript
// In backend/src/types/fax.ts

export interface MyCustomTemplateData {
  title: string;
  description: string;
  items: MyCustomItem[];
  // ... other fields
}

export interface MyCustomItem {
  id: string;
  name: string;
  // ... other fields
}
```

### Step 2: Add Template Type

```typescript
// In backend/src/types/fax.ts

type TemplateType = 
  | 'email_reply' 
  | 'product_selection'
  // ... existing types
  | 'my_custom_template';  // Add your new type
```

### Step 3: Create Generator Class

```typescript
// In backend/src/services/myCustomFaxGenerator.ts

import {
  FaxTemplate,
  FaxPage,
  FaxContent,
  MyCustomTemplateData
} from '../types/fax.js';
import { FaxTemplateEngine } from './faxTemplateEngine.js';
import { FaxGenerator } from './faxGenerator.js';

export class MyCustomFaxGenerator {
  /**
   * Generate a custom fax
   */
  static async generateCustomFax(
    data: MyCustomTemplateData,
    referenceId?: string
  ): Promise<Buffer> {
    const template = this.createCustomTemplate(data, referenceId);
    return await FaxGenerator.generatePdf(template);
  }

  /**
   * Create custom template
   */
  private static createCustomTemplate(
    data: MyCustomTemplateData,
    referenceId?: string
  ): FaxTemplate {
    const refId = referenceId || FaxTemplateEngine.generateReferenceId();
    const pages: FaxPage[] = [];

    const content: FaxContent[] = [
      // Use FaxTemplateEngine for consistent header
      this.createHeader(),
      
      // Page title
      {
        type: 'text',
        text: data.title,
        fontSize: 68, // 24pt page title
        bold: true,
        alignment: 'center',
        marginBottom: 16
      },
      
      // Description
      {
        type: 'text',
        text: data.description,
        fontSize: 45, // 16pt body text
        marginBottom: 12
      },
      
      // Add your custom content here
      // ...
      
      // Use FaxTemplateEngine for consistent footer
      this.createFooter(refId)
    ];

    pages.push({
      content,
      pageNumber: 1,
      totalPages: 1
    });

    return {
      type: 'my_custom_template',
      referenceId: refId,
      pages,
      contextData: data
    };
  }

  private static createHeader(): FaxContent {
    return {
      type: 'header',
      text: 'Faxi - Your Fax to Internet Bridge',
      fontSize: 34, // 12pt header/footer
      alignment: 'center',
      marginBottom: 12
    };
  }

  private static createFooter(referenceId: string): FaxContent {
    return {
      type: 'footer',
      text: `Reply via fax. Ref: ${referenceId} | Support: help@faxi.jp | +81-3-1234-5678`,
      fontSize: 96, // 34pt minimum for reference ID prominence
      bold: true,
      alignment: 'center',
      marginTop: 16
    };
  }
}
```

### Step 4: Register Template Mapping

```typescript
// In backend/src/services/templateRegistry.ts

private initializeMappings(): void {
  // ... existing mappings
  
  // Add your custom mapping
  this.register('my_custom_mcp', 'my_custom_intent', 'my_custom_template', 10);
  this.register('my_custom_mcp', undefined, 'my_custom_template', 5);
}
```

### Step 5: Integrate with Response Generator

```typescript
// In backend/src/services/responseGenerator.ts

import { MyCustomFaxGenerator } from './myCustomFaxGenerator.js';

// In generateResponse method:
case 'my_custom_template':
  return await MyCustomFaxGenerator.generateCustomFax(
    templateData as MyCustomTemplateData,
    referenceId
  );
```

### Step 6: Write Tests

```typescript
// In backend/src/services/myCustomFaxGenerator.test.ts

import { describe, it, expect } from 'vitest';
import { MyCustomFaxGenerator } from './myCustomFaxGenerator';

describe('MyCustomFaxGenerator', () => {
  it('should generate valid PDF', async () => {
    const data = {
      title: 'Test Title',
      description: 'Test Description',
      items: []
    };
    
    const pdf = await MyCustomFaxGenerator.generateCustomFax(data);
    
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
  });
});
```

## Configuration

The template system can be configured via environment variables:

### Environment Variables

```bash
# Image download timeout in milliseconds (default: 5000)
TEMPLATE_IMAGE_DOWNLOAD_TIMEOUT=5000

# Maximum image size in bytes (default: 2MB)
TEMPLATE_MAX_IMAGE_SIZE=2097152

# Image cache TTL in seconds (default: 24 hours)
TEMPLATE_IMAGE_CACHE_TTL=86400

# PDF generation timeout in milliseconds (default: 10000)
TEMPLATE_PDF_GENERATION_TIMEOUT=10000

# Allowed image domains (comma-separated)
TEMPLATE_ALLOWED_IMAGE_DOMAINS=images-na.ssl-images-amazon.com,m.media-amazon.com,images-fe.ssl-images-amazon.com
```

### Accessing Configuration

```typescript
import { config } from '../config/index';

const timeout = config.templates.imageDownloadTimeout;
const maxSize = config.templates.maxImageSize;
const cacheTTL = config.templates.imageCacheTTL;
const pdfTimeout = config.templates.pdfGenerationTimeout;
const allowedDomains = config.templates.allowedImageDomains;
```

## Backward Compatibility

The template system is designed to be fully backward compatible with existing code:

### Existing Generators Continue to Work

All existing fax generators continue to work unchanged:
- `ProductSelectionFaxGenerator`
- `EmailFaxGenerator`
- `PaymentBarcodeFaxGenerator`
- `ConfirmationFaxGenerator`
- `ClarificationFaxGenerator`
- `WelcomeFaxGenerator`

### No Breaking Changes

- All existing APIs remain unchanged
- Template registry provides fallback for unmapped MCP servers
- Image processing is opt-in via new content block type
- Existing fax generation code requires no modifications

### Migration Path

You can gradually migrate existing generators to use new services:

```typescript
// Before (existing code)
const pdf = await ProductSelectionFaxGenerator.generateProductSelectionFax(data);

// After (with template registry)
const templateType = templateRegistry.getTemplate('shopping', 'search_products');
const pdf = await generateFaxForTemplate(templateType, data);
```

## Examples

### Example 1: Generate Product Selection Fax

```typescript
import { ProductSelectionFaxGenerator } from './services/productSelectionFaxGenerator';

const data = {
  searchQuery: 'wireless headphones',
  products: [
    {
      asin: 'B08PZHYWJS',
      title: 'Sony WH-1000XM4 Wireless Headphones',
      price: 34800,
      currency: 'JPY',
      primeEligible: true,
      rating: 4.7,
      reviewCount: 12543,
      imageUrl: 'https://images-na.ssl-images-amazon.com/...',
      selectionMarker: 'A'
    },
    // ... more products
  ],
  userName: 'Tanaka-san',
  hasPaymentMethod: true
};

const pdf = await ProductSelectionFaxGenerator.generateProductSelectionFax(data);
// Returns: Buffer containing PDF
```

### Example 2: Generate Appointment Selection Fax

```typescript
import { AppointmentSelectionFaxGenerator } from './services/appointmentSelectionFaxGenerator';

const data = {
  serviceName: 'Medical Checkup',
  provider: 'Tokyo General Hospital',
  location: '1-2-3 Shibuya, Tokyo',
  slots: [
    {
      id: 'slot-1',
      date: new Date('2025-02-15'),
      startTime: '9:00 AM',
      endTime: '10:00 AM',
      duration: 60,
      available: true,
      selectionMarker: 'A'
    },
    {
      id: 'slot-2',
      date: new Date('2025-02-15'),
      startTime: '10:00 AM',
      endTime: '11:00 AM',
      duration: 60,
      available: false,
      selectionMarker: 'B'
    },
    // ... more slots
  ]
};

const pdf = await AppointmentSelectionFaxGenerator.generateAppointmentSelectionFax(data);
```

### Example 3: Generate General Inquiry Fax

```typescript
import { GeneralInquiryFaxGenerator } from './services/generalInquiryFaxGenerator';

const data = {
  question: 'What are the health benefits of green tea?',
  answer: `Green tea offers numerous health benefits:

1. Rich in antioxidants that protect cells
2. May improve brain function
3. Increases fat burning
4. May lower risk of certain cancers
5. May reduce risk of heart disease

Studies show that regular consumption of 3-5 cups per day provides optimal benefits.`,
  images: [
    {
      url: 'https://images-na.ssl-images-amazon.com/green-tea.jpg',
      caption: 'Traditional Japanese green tea',
      position: 'end'
    }
  ],
  relatedTopics: [
    'Different types of green tea',
    'How to brew green tea properly',
    'Green tea vs black tea'
  ]
};

const pdf = await GeneralInquiryFaxGenerator.generateInquiryFax(data);
```

### Example 4: Using Template Registry

```typescript
import { templateRegistry } from './services/templateRegistry';
import { ProductSelectionFaxGenerator } from './services/productSelectionFaxGenerator';
import { EmailFaxGenerator } from './services/emailFaxGenerator';
import { AppointmentSelectionFaxGenerator } from './services/appointmentSelectionFaxGenerator';
import { GeneralInquiryFaxGenerator } from './services/generalInquiryFaxGenerator';

async function generateFaxForMCP(
  mcpServer: string,
  intent: string | undefined,
  data: any,
  referenceId?: string
): Promise<Buffer> {
  // Get template type from registry
  const templateType = templateRegistry.getTemplate(mcpServer, intent);
  
  // Route to appropriate generator
  switch (templateType) {
    case 'product_selection':
      return await ProductSelectionFaxGenerator.generateProductSelectionFax(data, referenceId);
    
    case 'email_reply':
      return await EmailFaxGenerator.generateEmailFax(data, referenceId);
    
    case 'appointment_selection':
      return await AppointmentSelectionFaxGenerator.generateAppointmentSelectionFax(data, referenceId);
    
    case 'general_inquiry':
      return await GeneralInquiryFaxGenerator.generateInquiryFax(data, referenceId);
    
    default:
      // Fallback to general inquiry
      return await GeneralInquiryFaxGenerator.generateInquiryFax(data, referenceId);
  }
}

// Usage
const pdf = await generateFaxForMCP('shopping', 'search_products', productData);
```

### Example 5: Processing Images

```typescript
import { ImageProcessingService } from './services/imageProcessingService';
import { redis } from './queue/connection';

const imageService = new ImageProcessingService(redis.getClient());

// Check if URL is allowed
if (!imageService.isAllowedImageUrl(imageUrl)) {
  console.error('Image URL not from allowed domain');
  // Use fallback
  return;
}

// Process and cache image
try {
  const processedImage = await imageService.processAndCacheImage(imageUrl, {
    maxWidth: 400,
    maxHeight: 400,
    targetDPI: 200,
    format: 'png',
    grayscale: true
  });
  
  // Use processed image in fax
  const imageContent: ImageContent = {
    buffer: processedImage,
    width: 400,
    height: 400,
    alignment: 'center',
    caption: 'Product image',
    fallbackText: 'Image not available'
  };
  
} catch (error) {
  console.error('Image processing failed:', error);
  // Use fallback text
}
```

## Troubleshooting

### Image Download Failures

**Problem**: Images fail to download or timeout

**Solutions**:
1. Check if URL is from allowed domain:
   ```typescript
   const isAllowed = imageService.isAllowedImageUrl(url);
   ```

2. Increase timeout in configuration:
   ```bash
   TEMPLATE_IMAGE_DOWNLOAD_TIMEOUT=10000
   ```

3. Check network connectivity to image CDN

4. Verify image URL is valid and accessible

### Template Not Found

**Problem**: Template registry returns fallback for known MCP server

**Solutions**:
1. Check if mapping is registered:
   ```typescript
   const mappings = templateRegistry.getAllMappings();
   console.log(mappings);
   ```

2. Register missing mapping:
   ```typescript
   templateRegistry.register('my_mcp', 'my_intent', 'my_template', 10);
   ```

3. Check MCP server name matches exactly (case-sensitive)

### PDF Generation Timeout

**Problem**: PDF generation times out for large faxes

**Solutions**:
1. Increase timeout in configuration:
   ```bash
   TEMPLATE_PDF_GENERATION_TIMEOUT=20000
   ```

2. Reduce image sizes:
   ```typescript
   const layout = calculator.calculateProductLayout(productCount);
   const dimensions = calculator.calculateImageDimensions(layout.imageSize);
   ```

3. Split content across multiple pages

### Cache Not Working

**Problem**: Images are re-downloaded on every request

**Solutions**:
1. Check Redis connection:
   ```typescript
   const healthy = await redis.healthCheck();
   ```

2. Verify cache TTL is set:
   ```bash
   TEMPLATE_IMAGE_CACHE_TTL=86400
   ```

3. Check Redis memory limits

4. Monitor cache hit rate:
   ```typescript
   const metrics = await monitoringService.getCacheMetrics();
   console.log('Hit rate:', metrics.hitRate);
   ```

### Layout Issues

**Problem**: Content doesn't fit on page or overlaps

**Solutions**:
1. Use dynamic layout calculator:
   ```typescript
   const layout = calculator.calculateProductLayout(productCount);
   ```

2. Check content height:
   ```typescript
   const pages = calculator.calculatePagination(contentHeight);
   ```

3. Adjust spacing:
   ```typescript
   const spacing = calculator.adjustSpacing(itemCount, availableHeight);
   ```

4. Enable compact mode for more items

## Best Practices

1. **Always use TemplateRegistry** for template selection instead of hardcoding template types

2. **Cache images aggressively** - use `processAndCacheImage()` instead of downloading directly

3. **Validate URLs** before processing images with `isAllowedImageUrl()`

4. **Use DynamicLayoutCalculator** for responsive layouts instead of fixed dimensions

5. **Include fallback text** for all images in case download fails

6. **Test with various content quantities** (1 item, 3 items, 5 items, 10 items)

7. **Monitor cache hit rates** to ensure caching is working effectively

8. **Use consistent branding** by calling `createHeader()` and `createFooter()` from FaxTemplateEngine

9. **Handle errors gracefully** with try-catch and fallback to text-only templates

10. **Write property-based tests** to verify correctness across many inputs

## Additional Resources

- [Design Document](.kiro/specs/fax-template-system/design.md)
- [Requirements Document](.kiro/specs/fax-template-system/requirements.md)
- [Task List](.kiro/specs/fax-template-system/tasks.md)
- [API Documentation](../src/services/) - See JSDoc comments in source files

## Support

For questions or issues with the template system:
- Check this guide first
- Review the design document for architectural details
- Examine existing generators for examples
- Check test files for usage patterns
- Contact the development team

---

**Last Updated**: December 2025
**Version**: 1.0.0
