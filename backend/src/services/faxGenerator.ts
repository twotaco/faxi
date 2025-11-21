import { createCanvas, Canvas, CanvasRenderingContext2D, registerFont } from 'canvas';
import JsBarcode from 'jsbarcode';
import sharp from 'sharp';
import {
  FaxTemplate,
  FaxPage,
  FaxContent,
  FaxGenerationOptions,
  BarcodeData,
  CircleOption
} from '../types/fax.js';

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
    height: 2200, // ~10.8 inches at 204 DPI (allows for margins)
    backgroundColor: '#FFFFFF',
    textColor: '#000000',
    defaultFontSize: 20, // Increased from 12 for elderly readability
    margins: {
      top: 60,
      bottom: 60,
      left: 80,
      right: 80
    }
  };

  /**
   * Generate PDF from a fax template (for Telnyx API)
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

      // Render each content element
      for (const content of page.content) {
        currentY = await this.renderContent(ctx, content, currentY, opts);
      }

      // Convert canvas to PNG buffer for PDF conversion
      const pngBuffer = canvas.toBuffer('image/png');
      pageBuffers.push(pngBuffer);
    }

    // Convert all pages to a single PDF
    // Start with the first page
    let pdfPipeline = sharp(pageBuffers[0])
      .png() // Keep as PNG for quality
      .toFormat('pdf', {
        compressionLevel: 6
      });

    // For multi-page PDFs, we'll need to use a different approach
    // Since sharp doesn't support multi-page PDFs directly, we'll create a single-page PDF
    // TODO: For multi-page support, consider using pdf-lib or pdfkit
    const pdfBuffer = await pdfPipeline.toBuffer();

    return pdfBuffer;
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
      ctx.fillText(line, x, y + (index * lineHeight));
    });

    return y + (lines.length * lineHeight);
  }

  /**
   * Render circle options (radio buttons)
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
    const lineHeight = fontSize * 1.8;
    const circleRadius = 14; // Increased from 8 for better visibility with larger fonts
    const circleMargin = 20;

    ctx.font = `normal ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.lineWidth = 3; // Thicker lines for better visibility

    content.options.forEach((option, index) => {
      const lineY = y + (index * lineHeight);
      const circleX = margins.left + circleRadius;
      const circleY = lineY + fontSize / 2;
      const textX = margins.left + circleRadius * 2 + circleMargin;

      // Draw circle
      ctx.beginPath();
      ctx.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI);
      ctx.stroke();

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
    } catch (error) {
      console.error('Error generating barcode:', error);
      // Fallback: render barcode data as text
      ctx.font = `normal ${options.defaultFontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(
        barcodeData.data,
        margins.left + contentWidth / 2,
        y + barcodeHeight / 2
      );
      return y + barcodeHeight;
    }
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

    // Render each content element
    for (const content of page.content) {
      currentY = await this.renderContent(ctx, content, currentY, opts);
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