import PDFDocument from 'pdfkit';
import { FaxTemplate, FaxContent, FaxGenerationOptions } from '../types/fax.js';

/**
 * PDF-based Fax Generator
 * 
 * Generates proper text-based PDFs using pdfkit instead of canvas->image->PDF.
 * Benefits:
 * - Selectable text
 * - Smaller file sizes
 * - Better quality
 * - No rendering overlap issues
 */
export class PdfFaxGenerator {
  private static readonly DEFAULT_OPTIONS = {
    dpi: 204,
    pageWidth: 612, // 8.5 inches in points (72 points per inch)
    pageHeight: 792, // 11 inches in points
    margins: {
      top: 50,
      bottom: 50,
      left: 60,
      right: 60
    },
    fontSize: {
      header: 12,
      body: 16,
      footer: 10
    }
  };

  /**
   * Generate PDF from fax template
   */
  static async generatePdf(template: FaxTemplate): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: this.DEFAULT_OPTIONS.margins
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Render each page
      template.pages.forEach((page, pageIndex) => {
        if (pageIndex > 0) {
          doc.addPage();
        }

        // Render page content
        page.content.forEach((content) => {
          this.renderContent(doc, content);
        });
      });

      doc.end();
    });
  }

  /**
   * Render individual content element
   */
  private static renderContent(doc: PDFKit.PDFDocument, content: FaxContent): void {
    const opts = this.DEFAULT_OPTIONS;

    // Apply top margin
    if (content.marginTop) {
      doc.moveDown(content.marginTop / 20); // Approximate conversion
    }

    switch (content.type) {
      case 'header':
        this.renderHeader(doc, content);
        break;

      case 'footer':
        this.renderFooter(doc, content);
        break;

      case 'text':
        this.renderText(doc, content);
        break;

      case 'blank_space':
        doc.moveDown((content.height || 50) / 20);
        break;

      case 'circle_option':
        this.renderCircleOptions(doc, content);
        break;

      case 'checkbox':
        this.renderCheckboxOptions(doc, content);
        break;
    }

    // Apply bottom margin
    if (content.marginBottom) {
      doc.moveDown(content.marginBottom / 20);
    }
  }

  /**
   * Render header
   */
  private static renderHeader(doc: PDFKit.PDFDocument, content: FaxContent): void {
    if (!content.text) return;

    doc
      .fontSize(this.DEFAULT_OPTIONS.fontSize.header)
      .font('Helvetica')
      .text(content.text, {
        align: content.alignment || 'center'
      })
      .moveDown(0.5);
  }

  /**
   * Render footer
   */
  private static renderFooter(doc: PDFKit.PDFDocument, content: FaxContent): void {
    if (!content.text) return;

    doc
      .fontSize(this.DEFAULT_OPTIONS.fontSize.footer)
      .font('Helvetica')
      .text(content.text, {
        align: content.alignment || 'center'
      });
  }

  /**
   * Render text content
   */
  private static renderText(doc: PDFKit.PDFDocument, content: FaxContent): void {
    if (!content.text) return;

    const fontSize = content.fontSize ? content.fontSize / 3 : this.DEFAULT_OPTIONS.fontSize.body;
    const font = content.bold ? 'Helvetica-Bold' : 'Helvetica';

    doc
      .fontSize(fontSize)
      .font(font)
      .text(content.text, {
        align: content.alignment || 'left',
        lineGap: 4
      });
  }

  /**
   * Render circle options (radio buttons)
   */
  private static renderCircleOptions(doc: PDFKit.PDFDocument, content: FaxContent): void {
    if (!content.options) return;

    content.options.forEach((option) => {
      const y = doc.y;
      const x = doc.x;

      // Draw circle
      doc.circle(x + 8, y + 8, 6).stroke();

      // Draw option text
      doc
        .fontSize(this.DEFAULT_OPTIONS.fontSize.body)
        .font('Helvetica')
        .text(`${option.label}. ${option.text}`, x + 25, y, {
          continued: option.price !== undefined
        });

      if (option.price !== undefined) {
        doc.text(` - ¥${option.price}`);
      } else {
        doc.text(''); // End the line
      }

      doc.moveDown(0.3);
    });
  }

  /**
   * Render checkbox options
   */
  private static renderCheckboxOptions(doc: PDFKit.PDFDocument, content: FaxContent): void {
    if (!content.options) return;

    content.options.forEach((option) => {
      const y = doc.y;
      const x = doc.x;

      // Draw checkbox
      doc.rect(x, y + 2, 12, 12).stroke();

      // Draw option text
      doc
        .fontSize(this.DEFAULT_OPTIONS.fontSize.body)
        .font('Helvetica')
        .text(`${option.label}. ${option.text}`, x + 20, y, {
          continued: option.price !== undefined
        });

      if (option.price !== undefined) {
        doc.text(` - ¥${option.price}`);
      } else {
        doc.text(''); // End the line
      }

      doc.moveDown(0.3);
    });
  }
}
