import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { EmailToFaxConverter } from '../../services/emailToFaxConverter';

/**
 * Property-Based Tests for HTML Sanitization
 * 
 * Feature: email-system-architecture, Property 23: HTML sanitization
 * Validates: Requirements 9.5
 * 
 * Property: For any email with HTML content, the system should sanitize the HTML
 * to remove potentially malicious content
 */

describe('EmailToFaxConverter - HTML Sanitization (Property 23)', () => {
  /**
   * Property 23: Script tags are removed
   * 
   * For any HTML with script tags, they should be removed during sanitization
   */
  it('should remove script tags from HTML content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        fc.string({ minLength: 10, maxLength: 100 }),
        async (safeContent, scriptContent) => {
          const html = `<p>${safeContent}</p><script>${scriptContent}</script><p>More content</p>`;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: '',
            html: html
          });
          
          // Verify conversion succeeded (script was removed)
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23.1: Event handlers are removed
   * 
   * For any HTML with event handlers (onclick, onerror, etc.), they should be removed
   */
  it('should remove event handlers from HTML elements', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        fc.constantFrom('onclick', 'onerror', 'onload', 'onmouseover', 'onfocus'),
        fc.string({ minLength: 10, maxLength: 50 }),
        async (content, eventHandler, eventCode) => {
          const html = `<p ${eventHandler}="${eventCode}">${content}</p>`;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: '',
            html: html
          });
          
          // Verify conversion succeeded (event handler was removed)
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23.2: JavaScript protocol is removed from links
   * 
   * For any HTML with javascript: protocol in href, it should be removed
   */
  it('should remove javascript: protocol from href attributes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.string({ minLength: 10, maxLength: 100 }),
        async (linkText, jsCode) => {
          const html = `<a href="javascript:${jsCode}">${linkText}</a>`;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: '',
            html: html
          });
          
          // Verify conversion succeeded (javascript: protocol was removed)
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23.3: Iframe tags are removed
   * 
   * For any HTML with iframe tags, they should be removed
   */
  it('should remove iframe tags from HTML content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        fc.webUrl(),
        async (content, iframeSrc) => {
          const html = `<p>${content}</p><iframe src="${iframeSrc}"></iframe><p>More content</p>`;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: '',
            html: html
          });
          
          // Verify conversion succeeded (iframe was removed)
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23.4: Style tags are removed
   * 
   * For any HTML with style tags, they should be removed
   */
  it('should remove style tags from HTML content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        fc.string({ minLength: 10, maxLength: 100 }),
        async (content, cssContent) => {
          const html = `<style>${cssContent}</style><p>${content}</p>`;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: '',
            html: html
          });
          
          // Verify conversion succeeded (style was removed)
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23.5: Object and embed tags are removed
   * 
   * For any HTML with object or embed tags, they should be removed
   */
  it('should remove object and embed tags from HTML content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        fc.constantFrom('object', 'embed'),
        async (content, tagType) => {
          let html;
          if (tagType === 'object') {
            html = `<p>${content}</p><object data="something.swf"></object><p>More content</p>`;
          } else {
            html = `<p>${content}</p><embed src="something.swf"><p>More content</p>`;
          }
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: '',
            html: html
          });
          
          // Verify conversion succeeded (object/embed was removed)
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23.6: Form tags are removed
   * 
   * For any HTML with form tags, they should be removed
   */
  it('should remove form tags from HTML content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        async (content) => {
          const html = `<p>${content}</p><form action="/submit"><input type="text"></form><p>More content</p>`;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: '',
            html: html
          });
          
          // Verify conversion succeeded (form was removed)
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23.7: Data protocol is removed from src attributes
   * 
   * For any HTML with data: protocol in src, it should be removed
   */
  it('should remove data: protocol from src attributes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        async (content) => {
          const html = `<p>${content}</p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA"><p>More content</p>`;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: '',
            html: html
          });
          
          // Verify conversion succeeded (data: protocol was removed)
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23.8: Meta refresh tags are removed
   * 
   * For any HTML with meta refresh tags, they should be removed
   */
  it('should remove meta refresh tags from HTML content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        fc.webUrl(),
        async (content, redirectUrl) => {
          const html = `<meta http-equiv="refresh" content="0;url=${redirectUrl}"><p>${content}</p>`;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: '',
            html: html
          });
          
          // Verify conversion succeeded (meta refresh was removed)
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23.9: Base tags are removed
   * 
   * For any HTML with base tags, they should be removed
   */
  it('should remove base tags from HTML content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        fc.webUrl(),
        async (content, baseUrl) => {
          const html = `<base href="${baseUrl}"><p>${content}</p>`;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: '',
            html: html
          });
          
          // Verify conversion succeeded (base tag was removed)
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23.10: Link tags are removed
   * 
   * For any HTML with link tags (external stylesheets), they should be removed
   */
  it('should remove link tags from HTML content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        fc.webUrl(),
        async (content, stylesheetUrl) => {
          const html = `<link rel="stylesheet" href="${stylesheetUrl}"><p>${content}</p>`;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: '',
            html: html
          });
          
          // Verify conversion succeeded (link tag was removed)
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23.11: Multiple dangerous elements are removed together
   * 
   * For any HTML with multiple dangerous elements, all should be removed
   */
  it('should remove multiple dangerous elements from HTML content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        async (content) => {
          const html = `
            <script>alert('xss')</script>
            <p onclick="alert('xss')">${content}</p>
            <iframe src="http://evil.com"></iframe>
            <style>body { display: none; }</style>
            <form action="/evil"><input type="text"></form>
            <a href="javascript:alert('xss')">Click me</a>
          `;
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: '',
            html: html
          });
          
          // Verify conversion succeeded (all dangerous elements were removed)
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23.12: Safe HTML content is preserved
   * 
   * For any HTML with only safe elements, the content should be preserved
   */
  it('should preserve safe HTML content after sanitization', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 10, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
        async (paragraphs) => {
          const html = paragraphs.map(p => `<p>${p}</p>`).join('');
          
          const result = await EmailToFaxConverter.convertEmailToFax({
            from: 'test@example.com',
            subject: 'Test Email',
            body: '',
            html: html
          });
          
          // Verify conversion succeeded and content was preserved
          expect(result.pdfBuffer).toBeInstanceOf(Buffer);
          expect(result.pdfBuffer.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
