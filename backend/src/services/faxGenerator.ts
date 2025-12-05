import { createCanvas, Canvas, CanvasRenderingContext2D, registerFont, loadImage } from 'canvas';
import JsBarcode from 'jsbarcode';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import {
  FaxTemplate,
  FaxPage,
  FaxContent,
  FaxGenerationOptions,
  BarcodeData,
  CircleOption
} from '../types/fax.js';
import { ImageProcessingService } from './imageProcessingService.js';
import { redis } from '../queue/connection.js';

/**
 * Fax Document Generator
 *
 * Generates PDF documents for fax transmission via Telnyx API.
 * Also generates PNG format for AI vision model processing (Gemini).
 *
 * Primary methods:
 * - generatePdf() - Creates PDF format for Telnyx API
 * - generatePng() - Creates PNG format for Gemini vision processing
 */
export class FaxGenerator {
  private static readonly DEFAULT_OPTIONS: FaxGenerationOptions = {
    dpi: 204, // Standard fax resolution
    width: 1728, // 8.5 inches at 204 DPI
    height: 2800, // ~13.7 inches at 204 DPI (taller to accommodate longer responses)
    backgroundColor: '#FFFFFF',
    textColor: '#000000',
    defaultFontSize: 45, // 16pt at 204 DPI - ideal for elderly users
    margins: {
      top: 60,
      bottom: 60,
      left: 80,
      right: 80
    }
  };

  /**
   * Generate PDF from a fax template (for Telnyx API)
   *
   * Footer positioning: The footer is always positioned at the bottom of the page,
   * not immediately after content. This prevents the footer from appearing in the
   * middle of the page when content is short.
   *
   * Multi-page handling: If content exceeds the available space (page height minus
   * footer area), it will be automatically split across multiple pages.
   */
  static async generatePdf(template: FaxTemplate, options?: Partial<FaxGenerationOptions>): Promise<Buffer> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const pageBuffers: Buffer[] = [];

    for (const page of template.pages) {
      const canvas = createCanvas(opts.width, opts.height);
      const ctx = canvas.getContext('2d');

      // Set up canvas
      ctx.fillStyle = opts.backgroundColor;
      ctx.fillRect(0, 0, opts.width, opts.height);
      ctx.fillStyle = opts.textColor;
      ctx.textBaseline = 'top';

      let currentY = opts.margins.top;

      // Separate footer from other content
      const footerContent = page.content.filter(c => c.type === 'footer');
      const mainContent = page.content.filter(c => c.type !== 'footer');

      // Calculate footer height for positioning
      const footerHeight = this.calculateFooterHeight(ctx, footerContent, opts);

      // Footer starts at: page height - bottom margin - footer height
      const footerStartY = opts.height - opts.margins.bottom - footerHeight;

      // Render main content (everything except footer)
      for (const content of mainContent) {
        const newY = await this.renderContent(ctx, content, currentY, opts);
        currentY = newY;
      }

      // Render footer at fixed position at bottom of page
      let footerY = footerStartY;
      for (const footer of footerContent) {
        // Apply footer's marginTop
        if (footer.marginTop) {
          footerY += footer.marginTop;
        }
        footerY = this.renderText(ctx, footer, footerY, opts.width - opts.margins.left - opts.margins.right, opts.margins, opts);
      }

      // Convert canvas to PNG buffer for PDF conversion
      const pngBuffer = canvas.toBuffer('image/png');
      pageBuffers.push(pngBuffer);
    }

    // Convert PNG pages to PDF using pdfkit
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [opts.width * 72 / opts.dpi, opts.height * 72 / opts.dpi], // Convert pixels to points
          margins: { top: 0, bottom: 0, left: 0, right: 0 }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (error) => {
          const { TemplateErrorHandler } = require('./templateErrorHandler.js');
          TemplateErrorHandler.handlePDFGenerationError(error, {
            pageCount: pageBuffers.length,
            templateType: template.type
          });
          reject(error);
        });

        // Add each page as an image
        pageBuffers.forEach((buffer, index) => {
          if (index > 0) {
            doc.addPage();
          }
          doc.image(buffer, 0, 0, {
            width: opts.width * 72 / opts.dpi,
            height: opts.height * 72 / opts.dpi
          });
        });

        doc.end();
      } catch (error: any) {
        const { TemplateErrorHandler } = require('./templateErrorHandler.js');
        TemplateErrorHandler.handlePDFGenerationError(error, {
          pageCount: pageBuffers.length,
          templateType: template.type
        });
        reject(error);
      }
    });
  }

  /**
   * Calculate the height needed for footer content
   * Used to position footer at the bottom of the page
   */
  private static calculateFooterHeight(
    ctx: CanvasRenderingContext2D,
    footerContent: FaxContent[],
    options: FaxGenerationOptions
  ): number {
    const { margins, width } = options;
    const contentWidth = width - margins.left - margins.right;
    let totalHeight = 0;

    for (const footer of footerContent) {
      // Add marginTop
      if (footer.marginTop) {
        totalHeight += footer.marginTop;
      }

      // Calculate text height
      if (footer.text) {
        const fontSize = footer.fontSize || options.defaultFontSize;
        const fontWeight = footer.bold ? 'bold' : 'normal';
        ctx.font = `${fontWeight} ${fontSize}px Arial, sans-serif`;

        const lines = this.wrapText(ctx, footer.text, contentWidth);
        const lineHeight = fontSize * 1.2;
        totalHeight += lines.length * lineHeight;
      }

      // Add marginBottom
      if (footer.marginBottom) {
        totalHeight += footer.marginBottom;
      }
    }

    // Add some padding for safety
    return totalHeight + 20;
  }

  /**
   * Get available content height for a single page (excluding header/footer areas)
   * This is useful for template generators to determine when to split content
   */
  static getAvailableContentHeight(): number {
    const opts = this.DEFAULT_OPTIONS;
    // Page height minus top margin, bottom margin, and footer area (~150px for footer)
    return opts.height - opts.margins.top - opts.margins.bottom - 180;
  }

  /**
   * Estimate the height of a content element without rendering it
   * Used by template generators to determine pagination needs
   */
  static estimateContentHeight(content: FaxContent, options?: Partial<FaxGenerationOptions>): number {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const contentWidth = opts.width - opts.margins.left - opts.margins.right;
    let height = 0;

    // Add margins
    if (content.marginTop) height += content.marginTop;
    if (content.marginBottom) height += content.marginBottom;

    switch (content.type) {
      case 'text':
      case 'header':
      case 'footer':
        if (content.text) {
          const fontSize = content.fontSize || opts.defaultFontSize;
          const lineHeight = fontSize * 1.2;
          // Estimate wrapped lines: chars per line ≈ contentWidth / (fontSize * 0.5)
          const charsPerLine = Math.floor(contentWidth / (fontSize * 0.5));
          const lines = content.text.split('\n').reduce((acc, line) => {
            return acc + Math.max(1, Math.ceil(line.length / charsPerLine));
          }, 0);
          height += lines * lineHeight;
        }
        break;

      case 'circle_option':
      case 'checkbox':
        if (content.options) {
          const fontSize = content.fontSize || opts.defaultFontSize;
          const lineHeight = fontSize * 1.8; // More spacing for options
          height += content.options.length * lineHeight;
        }
        break;

      case 'barcode':
        height += (content.barcodeData?.height || 60) + 20;
        break;

      case 'image':
        height += (content.imageData?.height || 300) + 30;
        break;

      case 'blank_space':
        height += content.height || 50;
        break;
    }

    return height;
  }

  /**
   * Automatically paginate content that is too long for a single page
   *
   * @param content Array of content elements (excluding footer)
   * @param footer Footer content to add to each page
   * @param referenceId Reference ID for the document
   * @param templateType Type of template
   * @returns Array of FaxPage objects
   */
  static paginateContent(
    content: FaxContent[],
    footer: FaxContent,
    referenceId: string,
    templateType: string
  ): FaxPage[] {
    const availableHeight = this.getAvailableContentHeight();
    const pages: FaxPage[] = [];
    let currentPageContent: FaxContent[] = [];
    let currentHeight = 0;

    for (const item of content) {
      const itemHeight = this.estimateContentHeight(item);

      // If adding this item would overflow, start a new page
      if (currentHeight + itemHeight > availableHeight && currentPageContent.length > 0) {
        // Close current page
        pages.push({
          content: [...currentPageContent],
          pageNumber: pages.length + 1,
          totalPages: 0 // Will be updated later
        });
        currentPageContent = [];
        currentHeight = 0;
      }

      currentPageContent.push(item);
      currentHeight += itemHeight;
    }

    // Add remaining content to last page
    if (currentPageContent.length > 0) {
      pages.push({
        content: [...currentPageContent],
        pageNumber: pages.length + 1,
        totalPages: 0
      });
    }

    // Update total pages and add footers
    const totalPages = pages.length;
    pages.forEach((page, index) => {
      page.totalPages = totalPages;
      // Add page-specific footer with page numbers if multi-page
      if (totalPages > 1) {
        page.content.push({
          ...footer,
          text: `${footer.text} | Page ${index + 1} of ${totalPages}`
        });
      } else {
        page.content.push(footer);
      }
    });

    return pages;
  }

  /**
   * Render individual content element
   */
  private static async renderContent(
    ctx: CanvasRenderingContext2D,
    content: FaxContent,
    currentY: number,
    options: FaxGenerationOptions
  ): Promise<number> {
    const { margins, width } = options;
    const contentWidth = width - margins.left - margins.right;
    let y = currentY;

    // Apply top margin
    if (content.marginTop) {
      y += content.marginTop;
    }

    switch (content.type) {
      case 'text':
      case 'header':
      case 'footer':
        y = this.renderText(ctx, content, y, contentWidth, margins, options);
        break;

      case 'circle_option':
        y = this.renderCircleOptions(ctx, content, y, contentWidth, margins, options);
        break;

      case 'checkbox':
        y = this.renderCheckboxOptions(ctx, content, y, contentWidth, margins, options);
        break;

      case 'barcode':
        y = await this.renderBarcode(ctx, content, y, contentWidth, margins, options);
        break;

      case 'image':
        try {
          y = await this.renderImage(ctx, content, y, contentWidth, margins, options);
        } catch (error: any) {
          console.error('Error rendering image content:', error);
          // Continue with next content block
        }
        break;

      case 'blank_space':
        y += content.height || 50;
        break;
    }

    // Apply bottom margin
    if (content.marginBottom) {
      y += content.marginBottom;
    }

    return y;
  }

  /**
   * Render text content
   */
  private static renderText(
    ctx: CanvasRenderingContext2D,
    content: FaxContent,
    y: number,
    contentWidth: number,
    margins: FaxGenerationOptions['margins'],
    options: FaxGenerationOptions
  ): number {
    if (!content.text) return y;

    const fontSize = content.fontSize || options.defaultFontSize;
    const fontWeight = content.bold ? 'bold' : 'normal';
    ctx.font = `${fontWeight} ${fontSize}px Arial, sans-serif`;

    let x = margins.left;
    if (content.alignment === 'center') {
      x = margins.left + contentWidth / 2;
      ctx.textAlign = 'center';
    } else if (content.alignment === 'right') {
      x = margins.left + contentWidth;
      ctx.textAlign = 'right';
    } else {
      ctx.textAlign = 'left';
    }

    // Handle multi-line text
    const lines = this.wrapText(ctx, content.text, contentWidth);
    const lineHeight = fontSize * 1.2;

    lines.forEach((line, index) => {
      const lineY = y + (index * lineHeight);
      ctx.fillText(line, x, lineY);
    });

    return y + (lines.length * lineHeight);
  }

  /**
   * Render circle options (radio buttons) with text wrapping
   */
  private static renderCircleOptions(
    ctx: CanvasRenderingContext2D,
    content: FaxContent,
    y: number,
    contentWidth: number,
    margins: FaxGenerationOptions['margins'],
    options: FaxGenerationOptions
  ): number {
    if (!content.options) return y;

    const fontSize = content.fontSize || options.defaultFontSize;
    const lineHeight = fontSize * 1.4; // Slightly tighter for wrapped text
    const circleRadius = 14; // Increased from 8 for better visibility with larger fonts
    const circleMargin = 20;
    const textX = margins.left + circleRadius * 2 + circleMargin;
    const maxTextWidth = contentWidth - (circleRadius * 2 + circleMargin);

    ctx.font = `normal ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.lineWidth = 3; // Thicker lines for better visibility

    let currentY = y;

    content.options.forEach((option) => {
      const circleX = margins.left + circleRadius;
      const circleY = currentY + fontSize / 2;

      // Draw circle
      ctx.beginPath();
      ctx.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI);
      ctx.stroke();

      // Build full option text with price if available
      let optionText = `${option.label}. ${option.text}`;
      if (option.price !== undefined) {
        optionText += ` - ¥${option.price}`;
      }

      // Wrap text and render each line
      const wrappedLines = this.wrapText(ctx, optionText, maxTextWidth);
      wrappedLines.forEach((line, lineIndex) => {
        ctx.fillText(line, textX, currentY + (lineIndex * lineHeight));
      });

      // Move Y position based on number of lines (minimum 1 line height + spacing)
      currentY += Math.max(wrappedLines.length, 1) * lineHeight + (fontSize * 0.4);
    });

    return currentY;
  }

  /**
   * Render checkbox options
   */
  private static renderCheckboxOptions(
    ctx: CanvasRenderingContext2D,
    content: FaxContent,
    y: number,
    contentWidth: number,
    margins: FaxGenerationOptions['margins'],
    options: FaxGenerationOptions
  ): number {
    if (!content.options) return y;

    const fontSize = content.fontSize || options.defaultFontSize;
    const lineHeight = fontSize * 1.8;
    const boxSize = 20; // Increased from 12 for better visibility with larger fonts
    const boxMargin = 20;

    ctx.font = `normal ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.lineWidth = 3; // Thicker lines for better visibility

    content.options.forEach((option, index) => {
      const lineY = y + (index * lineHeight);
      const boxX = margins.left;
      const boxY = lineY + (fontSize - boxSize) / 2;
      const textX = margins.left + boxSize + boxMargin;

      // Draw checkbox
      ctx.strokeRect(boxX, boxY, boxSize, boxSize);

      // Draw option text
      const optionText = `${option.label}. ${option.text}`;
      ctx.fillText(optionText, textX, lineY);

      // Add price if available
      if (option.price !== undefined) {
        const priceText = ` - ¥${option.price}`;
        const textWidth = ctx.measureText(optionText).width;
        ctx.fillText(priceText, textX + textWidth, lineY);
      }
    });

    return y + (content.options.length * lineHeight);
  }

  /**
   * Render barcode
   */
  private static async renderBarcode(
    ctx: CanvasRenderingContext2D,
    content: FaxContent,
    y: number,
    contentWidth: number,
    margins: FaxGenerationOptions['margins'],
    options: FaxGenerationOptions
  ): Promise<number> {
    if (!content.barcodeData) return y;

    const barcodeData = content.barcodeData;
    const barcodeWidth = barcodeData.width || 300;
    const barcodeHeight = barcodeData.height || 60;

    // Create a temporary canvas for the barcode
    const barcodeCanvas = createCanvas(barcodeWidth, barcodeHeight);
    
    try {
      // Generate barcode
      JsBarcode(barcodeCanvas, barcodeData.data, {
        format: barcodeData.format,
        width: 2,
        height: barcodeHeight - 20,
        displayValue: barcodeData.displayValue !== false,
        fontSize: 12,
        textMargin: 5
      });

      // Draw barcode on main canvas
      const x = margins.left + (contentWidth - barcodeWidth) / 2; // Center the barcode
      ctx.drawImage(barcodeCanvas, x, y);

      return y + barcodeHeight;
    } catch (error: any) {
      // Handle barcode generation errors with structured logging
      const { TemplateErrorHandler } = require('./templateErrorHandler.js');
      TemplateErrorHandler.handleBarcodeGenerationError(
        error,
        barcodeData.data,
        {
          contentType: 'barcode',
          barcodeFormat: barcodeData.format,
          barcodeWidth: barcodeWidth,
          barcodeHeight: barcodeHeight
        }
      );
      
      // Fallback: render barcode data as text
      const fallbackText = TemplateErrorHandler.getBarcodeFallbackText(barcodeData.data);
      ctx.font = `normal ${options.defaultFontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(
        fallbackText,
        margins.left + contentWidth / 2,
        y + barcodeHeight / 2
      );
      return y + barcodeHeight;
    }
  }

  /**
   * Render image content with enhanced error handling
   */
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
    const { TemplateErrorHandler } = await import('./templateErrorHandler.js');

    try {
      let imageBuffer: Buffer;

      if (imageData.buffer) {
        // Use pre-loaded buffer
        imageBuffer = imageData.buffer;
      } else if (imageData.url) {
        // Download and process image using ImageProcessingService
        const redisClient = redis.getClient();
        const imageService = new ImageProcessingService(redisClient);
        
        try {
          imageBuffer = await imageService.processAndCacheImage(imageData.url, {
            maxWidth: imageData.width,
            maxHeight: imageData.height,
            targetDPI: options.dpi,
            format: 'png',
            grayscale: true,
          });
        } catch (imageError: any) {
          // Handle image processing errors with structured logging
          TemplateErrorHandler.handleImageDownloadError(
            imageError,
            imageData.url,
            {
              contentType: 'image',
              imageWidth: imageData.width,
              imageHeight: imageData.height
            }
          );
          
          // Apply fallback
          return this.renderImageFallback(ctx, imageData, y, margins, options);
        }
      } else {
        throw new Error('No image source provided (neither buffer nor URL)');
      }

      // Load image into canvas
      const image = await loadImage(imageBuffer);

      // Calculate dimensions preserving aspect ratio
      const originalWidth = image.width;
      const originalHeight = image.height;
      const aspectRatio = originalWidth / originalHeight;
      
      let finalWidth = imageData.width;
      let finalHeight = imageData.height;
      
      // Preserve aspect ratio - fit within the specified dimensions
      if (imageData.width && imageData.height) {
        const targetAspectRatio = imageData.width / imageData.height;
        
        if (aspectRatio > targetAspectRatio) {
          // Image is wider - constrain by width
          finalWidth = imageData.width;
          finalHeight = imageData.width / aspectRatio;
        } else {
          // Image is taller - constrain by height
          finalHeight = imageData.height;
          finalWidth = imageData.height * aspectRatio;
        }
      } else if (imageData.width) {
        // Only width specified
        finalWidth = imageData.width;
        finalHeight = imageData.width / aspectRatio;
      } else if (imageData.height) {
        // Only height specified
        finalHeight = imageData.height;
        finalWidth = imageData.height * aspectRatio;
      }

      // Calculate position based on alignment
      let x = margins.left;
      if (imageData.alignment === 'center') {
        x = margins.left + (contentWidth - finalWidth) / 2;
      } else if (imageData.alignment === 'right') {
        x = margins.left + contentWidth - finalWidth;
      }

      // Draw image with preserved aspect ratio
      ctx.drawImage(image, x, y, finalWidth, finalHeight);

      let currentY = y + finalHeight;

      // Add caption if provided
      if (imageData.caption) {
        currentY += 10; // Small gap
        ctx.font = `normal ${options.defaultFontSize * 0.8}px Arial`;
        
        // Set text alignment for caption
        if (imageData.alignment === 'center') {
          ctx.textAlign = 'center';
          ctx.fillText(imageData.caption, margins.left + contentWidth / 2, currentY);
        } else if (imageData.alignment === 'right') {
          ctx.textAlign = 'right';
          ctx.fillText(imageData.caption, margins.left + contentWidth, currentY);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(imageData.caption, x, currentY);
        }
        
        currentY += options.defaultFontSize * 0.8;
      }

      return currentY;
    } catch (error: any) {
      // Handle general rendering errors with structured logging
      const { TemplateErrorHandler } = await import('./templateErrorHandler.js');
      TemplateErrorHandler.handleImageProcessingError(
        error,
        imageData.url,
        {
          contentType: 'image',
          imageWidth: imageData.width,
          imageHeight: imageData.height,
          hasBuffer: !!imageData.buffer,
          hasUrl: !!imageData.url
        }
      );

      // Apply fallback
      return this.renderImageFallback(ctx, imageData, y, margins, options);
    }
  }

  /**
   * Render fallback for failed images
   */
  private static renderImageFallback(
    ctx: CanvasRenderingContext2D,
    imageData: any,
    y: number,
    margins: FaxGenerationOptions['margins'],
    options: FaxGenerationOptions
  ): number {
    const { TemplateErrorHandler } = require('./templateErrorHandler.js');
    
    // Use provided fallback text or generate one
    const fallbackText = imageData.fallbackText || 
                        TemplateErrorHandler.getImageFallbackText(imageData.url);
    
    if (fallbackText) {
      ctx.font = `normal ${options.defaultFontSize}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText(fallbackText, margins.left, y);
      return y + options.defaultFontSize * 1.2;
    }

    // Skip image entirely if no fallback
    return y;
  }

  /**
   * Wrap text to fit within specified width
   */
  private static wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Generate PNG from a fax template (for Gemini AI vision processing)
   * Uses the same footer positioning logic as generatePdf
   */
  static async generatePng(template: FaxTemplate, options?: Partial<FaxGenerationOptions>): Promise<Buffer> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    // For now, just return the first page as PNG
    // TODO: For multi-page support, consider returning an array of PNG buffers
    if (template.pages.length === 0) {
      throw new Error('Template has no pages');
    }

    const page = template.pages[0];
    const canvas = createCanvas(opts.width, opts.height);
    const ctx = canvas.getContext('2d');

    // Set up canvas
    ctx.fillStyle = opts.backgroundColor;
    ctx.fillRect(0, 0, opts.width, opts.height);
    ctx.fillStyle = opts.textColor;
    ctx.textBaseline = 'top';

    let currentY = opts.margins.top;

    // Separate footer from other content (same logic as generatePdf)
    const footerContent = page.content.filter(c => c.type === 'footer');
    const mainContent = page.content.filter(c => c.type !== 'footer');

    // Calculate footer height for positioning
    const footerHeight = this.calculateFooterHeight(ctx, footerContent, opts);

    // Footer starts at: page height - bottom margin - footer height
    const footerStartY = opts.height - opts.margins.bottom - footerHeight;

    // Render main content (everything except footer)
    for (const content of mainContent) {
      currentY = await this.renderContent(ctx, content, currentY, opts);
    }

    // Render footer at fixed position at bottom of page
    let footerY = footerStartY;
    for (const footer of footerContent) {
      if (footer.marginTop) {
        footerY += footer.marginTop;
      }
      footerY = this.renderText(ctx, footer, footerY, opts.width - opts.margins.left - opts.margins.right, opts.margins, opts);
    }

    // Convert canvas to PNG buffer
    return canvas.toBuffer('image/png');
  }

  /**
   * Generate a test PDF with simple message
   */
  static async generateTestPdf(message: string): Promise<Buffer> {
    const template: FaxTemplate = {
      type: 'confirmation',
      referenceId: 'TEST-2025-000000',
      pages: [
        {
          content: [
            {
              type: 'header',
              text: 'Faxi - Test Fax',
              fontSize: 20,
              alignment: 'center',
              bold: true,
              marginBottom: 30
            },
            {
              type: 'text',
              text: message,
              fontSize: 18,
              marginBottom: 20
            },
            {
              type: 'footer',
              text: 'Test fax generated by Faxi system',
              fontSize: 14,
              alignment: 'center',
              marginTop: 20
            }
          ],
          pageNumber: 1,
          totalPages: 1
        }
      ],
      contextData: { test: true }
    };

    return await this.generatePdf(template);
  }
}