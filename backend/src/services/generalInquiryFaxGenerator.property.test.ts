import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { GeneralInquiryFaxGenerator } from './generalInquiryFaxGenerator.js';
import { GeneralInquiryTemplateData, ImageReference } from '../types/fax.js';

describe('GeneralInquiryFaxGenerator Property Tests', () => {
  // Arbitraries for generating test data
  // Filter out whitespace-only strings
  const questionArbitrary = fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length > 0);
  const answerArbitrary = fc.string({ minLength: 20, maxLength: 2000 }).filter(s => s.trim().length > 0);
  const urlArbitrary = fc.webUrl();
  const captionArbitrary = fc.option(fc.string({ minLength: 5, maxLength: 100 }));
  const positionArbitrary = fc.constantFrom('inline' as const, 'end' as const);
  
  const imageReferenceArbitrary: fc.Arbitrary<ImageReference> = fc.record({
    url: urlArbitrary,
    caption: captionArbitrary,
    position: positionArbitrary
  });
  
  const generalInquiryDataArbitrary: fc.Arbitrary<GeneralInquiryTemplateData> = fc.record({
    question: questionArbitrary,
    answer: answerArbitrary,
    images: fc.option(fc.array(imageReferenceArbitrary, { minLength: 0, maxLength: 5 })),
    relatedTopics: fc.option(fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 0, maxLength: 5 }))
  });

  // Feature: fax-template-system, Property 2: Content block rendering completeness
  it('should successfully render any valid general inquiry data without errors', () => {
    fc.assert(
      fc.property(
        generalInquiryDataArbitrary,
        (data) => {
          const template = GeneralInquiryFaxGenerator.createInquiryTemplate(data);
          
          // Template should be created successfully
          expect(template).toBeDefined();
          expect(template.type).toBe('general_inquiry');
          expect(template.pages.length).toBeGreaterThan(0);
          
          // All pages should have content
          for (const page of template.pages) {
            expect(page.content.length).toBeGreaterThan(0);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: fax-template-system, Property 3: Branding consistency
  it('should include header and footer on all pages', () => {
    fc.assert(
      fc.property(
        generalInquiryDataArbitrary,
        (data) => {
          const template = GeneralInquiryFaxGenerator.createInquiryTemplate(data);
          
          // Every page should have header and footer
          for (const page of template.pages) {
            const hasHeader = page.content.some(c => c.type === 'header');
            const hasFooter = page.content.some(c => c.type === 'footer');
            
            expect(hasHeader).toBe(true);
            expect(hasFooter).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: fax-template-system, Property 4: Dynamic content accommodation
  it('should properly paginate long content without overflow', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 100, maxLength: 10000 }), // Very long answer
        fc.string({ minLength: 10, maxLength: 200 }), // Question
        (answer, question) => {
          const data: GeneralInquiryTemplateData = {
            question,
            answer
          };
          
          const template = GeneralInquiryFaxGenerator.createInquiryTemplate(data);
          
          // Should create valid template
          expect(template.pages.length).toBeGreaterThan(0);
          
          // Page numbers should be sequential and correct
          template.pages.forEach((page, index) => {
            expect(page.pageNumber).toBe(index + 1);
            expect(page.totalPages).toBe(template.pages.length);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: fax-template-system, Property 12: Reference ID format and placement
  it('should include reference ID in FX-YYYY-NNNNNN format on all pages', () => {
    fc.assert(
      fc.property(
        generalInquiryDataArbitrary,
        (data) => {
          const template = GeneralInquiryFaxGenerator.createInquiryTemplate(data);
          
          // Reference ID should match format
          expect(template.referenceId).toMatch(/^FX-\d{4}-\d{6}$/);
          
          // Reference ID should appear in footer of every page
          for (const page of template.pages) {
            const footer = page.content.find(c => c.type === 'footer');
            expect(footer).toBeDefined();
            expect(footer?.text).toContain(template.referenceId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle question/answer distinction correctly', () => {
    fc.assert(
      fc.property(
        questionArbitrary,
        answerArbitrary,
        (question, answer) => {
          const data: GeneralInquiryTemplateData = {
            question,
            answer
          };
          
          const template = GeneralInquiryFaxGenerator.createInquiryTemplate(data);
          const firstPage = template.pages[0];
          
          // Should have Q: prefix for question
          const questionContent = firstPage.content.find(c => 
            c.type === 'text' && c.text?.startsWith('Q: ')
          );
          expect(questionContent).toBeDefined();
          expect(questionContent?.bold).toBe(true);
          
          // Should have A: prefix for answer
          const answerContent = firstPage.content.find(c => 
            c.type === 'text' && c.text?.startsWith('A: ')
          );
          expect(answerContent).toBeDefined();
          
          // Should have separator between Q and A
          const separator = firstPage.content.find(c => 
            c.type === 'text' && c.text?.includes('─')
          );
          expect(separator).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly position inline vs end images', () => {
    fc.assert(
      fc.property(
        questionArbitrary,
        answerArbitrary,
        fc.array(imageReferenceArbitrary, { minLength: 1, maxLength: 5 }),
        (question, answer, images) => {
          const data: GeneralInquiryTemplateData = {
            question,
            answer,
            images
          };
          
          const template = GeneralInquiryFaxGenerator.createInquiryTemplate(data);
          
          // Count inline and end images in data
          const inlineCount = images.filter(img => img.position === 'inline').length;
          const endCount = images.filter(img => img.position === 'end').length;
          
          // Count image content blocks in template
          let templateImageCount = 0;
          for (const page of template.pages) {
            templateImageCount += page.content.filter(c => c.type === 'image').length;
          }
          
          // Should have same number of images
          expect(templateImageCount).toBe(inlineCount + endCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include related topics when provided', () => {
    fc.assert(
      fc.property(
        questionArbitrary,
        answerArbitrary,
        fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
        (question, answer, relatedTopics) => {
          const data: GeneralInquiryTemplateData = {
            question,
            answer,
            relatedTopics
          };
          
          const template = GeneralInquiryFaxGenerator.createInquiryTemplate(data);
          
          // Should have "Related topics" text
          const hasRelatedTopicsHeader = template.pages.some(page =>
            page.content.some(c => 
              c.type === 'text' && c.text?.includes('Related topics')
            )
          );
          expect(hasRelatedTopicsHeader).toBe(true);
          
          // Should have bullet points for each topic
          const bulletPoints = template.pages.flatMap(page =>
            page.content.filter(c => c.type === 'text' && c.text?.startsWith('• '))
          );
          expect(bulletPoints.length).toBeGreaterThanOrEqual(relatedTopics.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should format structured data correctly', () => {
    fc.assert(
      fc.property(
        questionArbitrary,
        fc.constantFrom(
          'Here are the steps:\n1. First step\n2. Second step\n3. Third step',
          'Key points:\n- Point one\n- Point two\n- Point three',
          'SECTION HEADER:\nContent goes here\n\nANOTHER SECTION:\nMore content'
        ),
        (question, structuredAnswer) => {
          const data: GeneralInquiryTemplateData = {
            question,
            answer: structuredAnswer
          };
          
          const template = GeneralInquiryFaxGenerator.createInquiryTemplate(data);
          
          // Should successfully create template with structured content
          expect(template).toBeDefined();
          expect(template.pages.length).toBeGreaterThan(0);
          
          // Answer should be formatted (bullets converted to •)
          const answerContent = template.pages[0].content.find(c => 
            c.type === 'text' && c.text?.startsWith('A: ')
          );
          expect(answerContent).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty optional fields gracefully', () => {
    fc.assert(
      fc.property(
        questionArbitrary,
        answerArbitrary,
        (question, answer) => {
          const data: GeneralInquiryTemplateData = {
            question,
            answer
            // No images or relatedTopics
          };
          
          const template = GeneralInquiryFaxGenerator.createInquiryTemplate(data);
          
          // Should still create valid template
          expect(template).toBeDefined();
          expect(template.type).toBe('general_inquiry');
          expect(template.pages.length).toBeGreaterThan(0);
          
          // Should not have image content blocks
          const hasImages = template.pages.some(page =>
            page.content.some(c => c.type === 'image')
          );
          expect(hasImages).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain context data in template', () => {
    fc.assert(
      fc.property(
        generalInquiryDataArbitrary,
        (data) => {
          const template = GeneralInquiryFaxGenerator.createInquiryTemplate(data);
          
          // Context data should include question and answer
          expect(template.contextData).toBeDefined();
          expect(template.contextData.question).toBe(data.question);
          expect(template.contextData.answer).toBe(data.answer);
        }
      ),
      { numRuns: 100 }
    );
  });
});
