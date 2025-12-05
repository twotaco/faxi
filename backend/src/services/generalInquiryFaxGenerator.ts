import {
  FaxTemplate,
  FaxPage,
  FaxContent,
  GeneralInquiryTemplateData,
  ImageContent
} from '../types/fax.js';
import { FaxTemplateEngine } from './faxTemplateEngine.js';
import { FaxGenerator } from './faxGenerator.js';
import { DynamicLayoutCalculator } from './dynamicLayoutCalculator.js';

/**
 * Generator for general inquiry (AI Q&A) faxes
 * Creates user-friendly faxes for AI-generated responses with support for images and structured content
 */
export class GeneralInquiryFaxGenerator {
  /**
   * Generate a general inquiry fax
   * @param data General inquiry data including question, answer, and optional images
   * @param referenceId Optional reference ID (will be generated if not provided)
   * @returns PDF buffer of the generated fax
   */
  static async generateInquiryFax(
    data: GeneralInquiryTemplateData,
    referenceId?: string
  ): Promise<Buffer> {
    const template = this.createInquiryTemplate(data, referenceId);
    return await FaxGenerator.generatePdf(template);
  }

  /**
   * Create general inquiry template
   * @param data General inquiry data
   * @param referenceId Optional reference ID
   * @returns Complete fax template ready for PDF generation
   */
  static createInquiryTemplate(
    data: GeneralInquiryTemplateData,
    referenceId?: string
  ): FaxTemplate {
    const refId = referenceId || FaxTemplateEngine.generateReferenceId();
    
    // Check if content needs pagination
    const needsPagination = this.needsPagination(data);
    
    if (needsPagination) {
      return this.createMultiPageInquiryTemplate(data, refId);
    } else {
      return this.createSinglePageInquiryTemplate(data, refId);
    }
  }

  /**
   * Create single-page inquiry template
   */
  private static createSinglePageInquiryTemplate(
    data: GeneralInquiryTemplateData,
    referenceId: string
  ): FaxTemplate {
    const pages: FaxPage[] = [];
    const content: FaxContent[] = [];

    // Use FaxTemplateEngine for consistent header
    content.push(this.createHeader());

    // Page title
    content.push({
      type: 'text',
      text: 'AI ASSISTANT RESPONSE',
      fontSize: 68, // 24pt page title
      bold: true,
      alignment: 'center',
      marginBottom: 16
    });

    // Question section with Q: prefix
    content.push({
      type: 'text',
      text: 'Q: ' + data.question,
      fontSize: 51, // 18pt subheader
      bold: true,
      marginBottom: 12
    });

    // Visual separator
    content.push({
      type: 'text',
      text: '─'.repeat(40),
      fontSize: 45, // 16pt body text
      marginBottom: 12
    });

    // Answer section with A: prefix
    content.push({
      type: 'text',
      text: 'A: ' + this.formatAnswerText(data.answer),
      fontSize: 45, // 16pt body text
      marginBottom: 16
    });

    // Add inline images if present
    if (data.images) {
      const inlineImages = data.images.filter(img => img.position === 'inline');
      for (const imageRef of inlineImages) {
        content.push(this.createImageContent(imageRef));
      }
    }

    // Add separator before end images
    if (data.images && data.images.some(img => img.position === 'end')) {
      content.push({
        type: 'text',
        text: '─'.repeat(40),
        fontSize: 45, // 16pt body text
        marginBottom: 12
      });
    }

    // Add end images if present
    if (data.images) {
      const endImages = data.images.filter(img => img.position === 'end');
      for (const imageRef of endImages) {
        content.push(this.createImageContent(imageRef));
      }
    }

    // Add related topics if present
    if (data.relatedTopics && data.relatedTopics.length > 0) {
      content.push({
        type: 'text',
        text: '',
        marginBottom: 8
      });
      content.push({
        type: 'text',
        text: 'Related topics you might ask about:',
        fontSize: 45, // 16pt body text
        bold: true,
        marginBottom: 8
      });
      
      for (const topic of data.relatedTopics) {
        content.push({
          type: 'text',
          text: `• ${topic}`,
          fontSize: 45, // 16pt body text
          marginBottom: 4
        });
      }
    }

    // Add extra margin before footer to prevent overlap
    content.push({
      type: 'blank_space',
      height: 40,
      marginBottom: 0
    });

    // Use FaxTemplateEngine for consistent footer
    content.push(this.createFooter(referenceId));

    pages.push({
      content,
      pageNumber: 1,
      totalPages: 1
    });

    return {
      type: 'general_inquiry',
      referenceId,
      pages,
      contextData: {
        question: data.question,
        answer: data.answer
      }
    };
  }

  /**
   * Create multi-page inquiry template for long responses
   */
  private static createMultiPageInquiryTemplate(
    data: GeneralInquiryTemplateData,
    referenceId: string
  ): FaxTemplate {
    const layoutCalculator = new DynamicLayoutCalculator();
    const availableHeight = layoutCalculator.getAvailableContentHeight();
    
    // Split answer into chunks that fit on pages
    const answerChunks = this.splitAnswerText(data.answer, availableHeight);
    const totalPages = answerChunks.length;
    
    const pages: FaxPage[] = [];
    
    answerChunks.forEach((chunk, index) => {
      const pageNumber = index + 1;
      const isFirstPage = pageNumber === 1;
      const isLastPage = pageNumber === totalPages;
      
      const content: FaxContent[] = [];
      
      // Use FaxTemplateEngine for consistent header on every page
      content.push(this.createHeader());
      
      // Add title and question only on first page
      if (isFirstPage) {
        content.push({
          type: 'text',
          text: 'AI ASSISTANT RESPONSE',
          fontSize: 68,
          bold: true,
          alignment: 'center',
          marginBottom: 16
        });
        
        content.push({
          type: 'text',
          text: 'Q: ' + data.question,
          fontSize: 51,
          bold: true,
          marginBottom: 12
        });
        
        content.push({
          type: 'text',
          text: '─'.repeat(40),
          fontSize: 45,
          marginBottom: 12
        });
        
        content.push({
          type: 'text',
          text: 'A: ' + this.formatAnswerText(chunk),
          fontSize: 45,
          marginBottom: 16
        });
      } else {
        // Add continuation indicator on subsequent pages
        content.push({
          type: 'text',
          text: '(continued)',
          fontSize: 45,
          marginBottom: 12
        });
        
        content.push({
          type: 'text',
          text: this.formatAnswerText(chunk),
          fontSize: 45,
          marginBottom: 16
        });
      }
      
      // Add images only on last page
      if (isLastPage && data.images && data.images.length > 0) {
        content.push({
          type: 'text',
          text: '─'.repeat(40),
          fontSize: 45,
          marginBottom: 12
        });
        
        for (const imageRef of data.images) {
          content.push(this.createImageContent(imageRef));
        }
      }
      
      // Add related topics only on last page
      if (isLastPage && data.relatedTopics && data.relatedTopics.length > 0) {
        content.push({
          type: 'text',
          text: '',
          marginBottom: 8
        });
        content.push({
          type: 'text',
          text: 'Related topics you might ask about:',
          fontSize: 45,
          bold: true,
          marginBottom: 8
        });
        
        for (const topic of data.relatedTopics) {
          content.push({
            type: 'text',
            text: `• ${topic}`,
            fontSize: 45,
            marginBottom: 4
          });
        }
      }
      
      // Add footer with reference ID and page number on every page
      content.push({
        type: 'blank_space',
        height: 40,
        marginBottom: 0
      });
      // Use FaxTemplateEngine for consistent footer with page numbers
      content.push(this.createFooterWithPageNumber(referenceId, pageNumber, totalPages));
      
      pages.push({
        content,
        pageNumber,
        totalPages
      });
    });
    
    return {
      type: 'general_inquiry',
      referenceId,
      pages,
      contextData: {
        question: data.question,
        answer: data.answer
      }
    };
  }

  /**
   * Format answer text with structured data formatting
   * Detects and formats tables, lists, and sections
   */
  private static formatAnswerText(text: string): string {
    let formatted = text;
    
    // Format numbered lists (1., 2., 3., etc.)
    formatted = formatted.replace(/^(\d+)\.\s+(.+)$/gm, (match, num, content) => {
      return `${num}. ${content}`;
    });
    
    // Format bullet lists (-, *, •)
    formatted = formatted.replace(/^[-*]\s+(.+)$/gm, (match, content) => {
      return `• ${content}`;
    });
    
    // Format section headers (lines ending with :)
    formatted = formatted.replace(/^([A-Z][^:\n]{2,50}):$/gm, (match, header) => {
      return `${header.toUpperCase()}:`;
    });
    
    // Format bold text markers (**text** or __text__)
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '$1');
    formatted = formatted.replace(/__([^_]+)__/g, '$1');
    
    // Preserve line breaks and spacing
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    
    return formatted;
  }

  /**
   * Create image content block from image reference
   */
  private static createImageContent(imageRef: { url: string; caption?: string; position: 'inline' | 'end' }): FaxContent {
    const imageContent: ImageContent = {
      url: imageRef.url,
      width: 400,  // Default width for general inquiry images
      height: 300, // Default height
      alignment: 'center',
      caption: imageRef.caption,
      fallbackText: imageRef.caption || 'Image could not be loaded'
    };

    return {
      type: 'image',
      imageData: imageContent,
      marginBottom: 16
    };
  }

  /**
   * Check if content needs pagination based on estimated content height
   */
  private static needsPagination(data: GeneralInquiryTemplateData): boolean {
    // More accurate line estimation:
    // - Page width: 1728px, margins: 80px each side = 1568px content width
    // - Font size 45px, average char width ~25px = ~62 chars per line
    const charsPerLine = 55; // Conservative estimate for readability
    const lineHeight = 54; // 45px font * 1.2 line height

    // Count actual lines including newlines in the text
    const countLines = (text: string): number => {
      const lines = text.split('\n');
      let totalLines = 0;
      for (const line of lines) {
        // Each line wraps based on character count
        totalLines += Math.max(1, Math.ceil(line.length / charsPerLine));
      }
      return totalLines;
    };

    const questionLines = countLines(data.question);
    const answerLines = countLines(data.answer);

    const questionHeight = questionLines * lineHeight;
    const answerHeight = answerLines * lineHeight;
    const imageCount = data.images?.length || 0;
    const imageHeight = imageCount * 350; // ~350px per image (300 + margins)
    const relatedTopicsHeight = (data.relatedTopics?.length || 0) * 60;
    const headerFooterHeight = 450; // Headers, title, separators, margins, footer

    const totalHeight = questionHeight + answerHeight + imageHeight + relatedTopicsHeight + headerFooterHeight;

    // Check if content exceeds single page
    const layoutCalculator = new DynamicLayoutCalculator();
    const availableHeight = layoutCalculator.getAvailableContentHeight();

    return totalHeight > availableHeight;
  }

  /**
   * Split answer text into chunks that fit on pages
   */
  private static splitAnswerText(answer: string, availableHeight: number): string[] {
    const chunks: string[] = [];

    // More accurate line calculation
    const lineHeight = 54; // 45px font * 1.2
    const charsPerLine = 55; // Conservative for readability

    // Reserve space for header elements on first page (title, question, separator)
    const firstPageReserved = 300;
    // Reserve space for continuation header on subsequent pages
    const continuationReserved = 100;
    // Reserve space for footer
    const footerReserved = 100;

    const firstPageLines = Math.floor((availableHeight - firstPageReserved - footerReserved) / lineHeight);
    const subsequentPageLines = Math.floor((availableHeight - continuationReserved - footerReserved) / lineHeight);

    // Count lines for a piece of text (accounting for newlines AND wrapping)
    const countLines = (text: string): number => {
      const lines = text.split('\n');
      let totalLines = 0;
      for (const line of lines) {
        totalLines += Math.max(1, Math.ceil(line.length / charsPerLine));
      }
      return totalLines;
    };

    // Split text into logical segments (by single newlines to preserve formatting)
    const segments = answer.split('\n');
    let currentChunk = '';
    let currentLines = 0;
    let isFirstPage = true;
    const maxLines = () => isFirstPage ? firstPageLines : subsequentPageLines;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentLines = Math.max(1, Math.ceil(segment.length / charsPerLine));

      // Check if adding this segment would overflow the page
      if (currentLines + segmentLines > maxLines() && currentChunk.length > 0) {
        // Save current chunk and start new page
        chunks.push(currentChunk.trim());
        currentChunk = segment;
        currentLines = segmentLines;
        isFirstPage = false;
      } else {
        // Add segment to current chunk
        if (currentChunk.length > 0) {
          currentChunk += '\n' + segment;
        } else {
          currentChunk = segment;
        }
        currentLines += segmentLines;
      }

      // Handle very long single segments that need to be split mid-text
      while (currentLines > maxLines() && currentChunk.length > 0) {
        // Find a good break point (word boundary near the limit)
        const targetChars = maxLines() * charsPerLine;
        let breakPoint = targetChars;

        // Look for a space near the target to break at
        const searchStart = Math.max(0, targetChars - 50);
        const searchEnd = Math.min(currentChunk.length, targetChars + 50);
        const searchRegion = currentChunk.substring(searchStart, searchEnd);
        const lastSpace = searchRegion.lastIndexOf(' ');

        if (lastSpace > 0) {
          breakPoint = searchStart + lastSpace;
        }

        // Split at the break point
        const firstPart = currentChunk.substring(0, breakPoint).trim();
        const remainder = currentChunk.substring(breakPoint).trim();

        chunks.push(firstPart);
        currentChunk = remainder;
        currentLines = countLines(remainder);
        isFirstPage = false;
      }
    }

    // Add remaining content
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    // Ensure at least one chunk
    if (chunks.length === 0) {
      chunks.push(answer);
    }

    return chunks;
  }

  /**
   * Create standard header content using FaxTemplateEngine branding
   */
  private static createHeader(): FaxContent {
    return {
      type: 'header',
      text: 'Faxi - Your Fax to Internet Bridge',
      fontSize: 34, // 12pt header/footer
      alignment: 'center',
      marginBottom: 12
    };
  }

  /**
   * Create standard footer content
   * Format: [Template Label] | Ref: FX-YYYY-NNNNNN
   */
  private static createFooter(referenceId: string): FaxContent {
    return {
      type: 'footer',
      text: `AI Response | Ref: ${referenceId}`,
      fontSize: 45, // 16pt - consistent across all templates
      bold: true,
      alignment: 'center',
      marginTop: 16
    };
  }

  /**
   * Create footer with page numbers for multi-page faxes
   * Format: [Template Label] | Ref: FX-YYYY-NNNNNN | Page X of Y
   */
  private static createFooterWithPageNumber(referenceId: string, pageNumber: number, totalPages: number): FaxContent {
    return {
      type: 'footer',
      text: `AI Response | Ref: ${referenceId} | Page ${pageNumber} of ${totalPages}`,
      fontSize: 45, // 16pt - consistent across all templates
      bold: true,
      alignment: 'center',
      marginTop: 16
    };
  }
}
