import { describe, it, expect } from 'vitest';
import { GeneralInquiryFaxGenerator } from './generalInquiryFaxGenerator.js';
import { GeneralInquiryTemplateData } from '../types/fax.js';

describe('GeneralInquiryFaxGenerator Integration Tests', () => {
  it('should generate valid PDF for text-only response', async () => {
    const data: GeneralInquiryTemplateData = {
      question: 'What is the weather like today?',
      answer: 'Today\'s weather is sunny with a high of 25°C and a low of 18°C. Perfect weather for outdoor activities!'
    };

    const pdfBuffer = await GeneralInquiryFaxGenerator.generateInquiryFax(data);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    // Verify it's a PDF by checking magic bytes
    expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
  });

  it('should generate valid PDF with inline images', async () => {
    const data: GeneralInquiryTemplateData = {
      question: 'Show me a picture of Mount Fuji',
      answer: 'Here is a beautiful view of Mount Fuji, Japan\'s iconic mountain.',
      images: [
        {
          url: 'https://example.com/fuji.jpg',
          caption: 'Mount Fuji at sunrise',
          position: 'inline'
        }
      ]
    };

    const pdfBuffer = await GeneralInquiryFaxGenerator.generateInquiryFax(data);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
  });

  it('should generate valid PDF with images at end', async () => {
    const data: GeneralInquiryTemplateData = {
      question: 'Tell me about Japanese gardens',
      answer: 'Japanese gardens are traditional gardens that create miniature idealized landscapes. They often feature elements like ponds, streams, hills, and carefully placed stones and plants.',
      images: [
        {
          url: 'https://example.com/garden1.jpg',
          caption: 'Zen rock garden',
          position: 'end'
        },
        {
          url: 'https://example.com/garden2.jpg',
          caption: 'Traditional tea garden',
          position: 'end'
        }
      ]
    };

    const pdfBuffer = await GeneralInquiryFaxGenerator.generateInquiryFax(data);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
  });

  it('should generate valid PDF with long response (pagination)', async () => {
    const longAnswer = `
Japanese culture is rich and diverse, with a history spanning thousands of years.

TRADITIONAL ARTS:
1. Calligraphy - The art of beautiful writing
2. Tea ceremony - A ritualized way of preparing and serving tea
3. Ikebana - The art of flower arrangement
4. Origami - The art of paper folding

MODERN CULTURE:
• Anime and manga have become globally popular
• Japanese cuisine is celebrated worldwide
• Technology and innovation are highly valued
• Traditional festivals are still widely celebrated

SOCIAL CUSTOMS:
Bowing is a common greeting and shows respect. Removing shoes before entering homes is customary. Gift-giving is an important social practice.

The blend of ancient traditions with modern innovation makes Japanese culture unique and fascinating.
    `.trim();

    const data: GeneralInquiryTemplateData = {
      question: 'Tell me about Japanese culture',
      answer: longAnswer,
      relatedTopics: [
        'Japanese history',
        'Traditional festivals',
        'Modern Japanese society'
      ]
    };

    const pdfBuffer = await GeneralInquiryFaxGenerator.generateInquiryFax(data);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
  });

  it('should generate valid PDF with related topics', async () => {
    const data: GeneralInquiryTemplateData = {
      question: 'What is sushi?',
      answer: 'Sushi is a Japanese dish consisting of vinegared rice combined with various ingredients, typically raw fish or seafood.',
      relatedTopics: [
        'Types of sushi',
        'How to eat sushi properly',
        'Sushi etiquette in Japan'
      ]
    };

    const pdfBuffer = await GeneralInquiryFaxGenerator.generateInquiryFax(data);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
  });

  it('should handle structured data formatting', async () => {
    const structuredAnswer = `
Here are the steps to make green tea:

INGREDIENTS:
1. Green tea leaves or tea bag
2. Hot water (70-80°C)
3. Teacup

INSTRUCTIONS:
1. Heat water to the correct temperature
2. Place tea leaves in the cup
3. Pour hot water over the leaves
4. Steep for 1-2 minutes
5. Remove tea leaves and enjoy

TIPS:
• Don't use boiling water as it can make the tea bitter
• Use about 1 teaspoon of tea per cup
• Quality tea leaves make a big difference
    `.trim();

    const data: GeneralInquiryTemplateData = {
      question: 'How do I make green tea?',
      answer: structuredAnswer
    };

    const pdfBuffer = await GeneralInquiryFaxGenerator.generateInquiryFax(data);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
  });

  it('should include reference ID in generated fax', async () => {
    const data: GeneralInquiryTemplateData = {
      question: 'Test question',
      answer: 'Test answer'
    };

    const customRefId = 'FX-2025-123456';
    const pdfBuffer = await GeneralInquiryFaxGenerator.generateInquiryFax(data, customRefId);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    
    // The reference ID should be in the template
    const template = GeneralInquiryFaxGenerator.createInquiryTemplate(data, customRefId);
    expect(template.referenceId).toBe(customRefId);
  });

  it('should handle very long answers with pagination', async () => {
    // Create a very long answer that will definitely need pagination
    const veryLongAnswer = Array(50).fill(
      'This is a paragraph of text that will be repeated many times to create a very long answer that requires multiple pages. '
    ).join('\n\n');

    const data: GeneralInquiryTemplateData = {
      question: 'Tell me everything about a complex topic',
      answer: veryLongAnswer
    };

    const pdfBuffer = await GeneralInquiryFaxGenerator.generateInquiryFax(data);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
    
    // Verify multi-page template was created
    const template = GeneralInquiryFaxGenerator.createInquiryTemplate(data);
    expect(template.pages.length).toBeGreaterThan(1);
    
    // Verify each page has correct page numbers
    template.pages.forEach((page, index) => {
      expect(page.pageNumber).toBe(index + 1);
      expect(page.totalPages).toBe(template.pages.length);
    });
  });

  it('should handle mixed inline and end images', async () => {
    const data: GeneralInquiryTemplateData = {
      question: 'Show me different types of Japanese architecture',
      answer: 'Japanese architecture has evolved over centuries, blending traditional and modern styles.',
      images: [
        {
          url: 'https://example.com/temple.jpg',
          caption: 'Traditional temple',
          position: 'inline'
        },
        {
          url: 'https://example.com/modern.jpg',
          caption: 'Modern building',
          position: 'end'
        },
        {
          url: 'https://example.com/castle.jpg',
          caption: 'Historic castle',
          position: 'end'
        }
      ]
    };

    const pdfBuffer = await GeneralInquiryFaxGenerator.generateInquiryFax(data);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
  });
});
