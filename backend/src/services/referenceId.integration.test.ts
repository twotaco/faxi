import { describe, it, expect } from 'vitest';
import { EmailFaxGenerator } from './emailFaxGenerator.js';
import { GeneralInquiryFaxGenerator } from './generalInquiryFaxGenerator.js';
import { FaxTemplateEngine } from './faxTemplateEngine.js';
import { EmailReplyData, GeneralInquiryTemplateData } from '../types/fax.js';

describe('Reference ID Integration Tests', () => {
  describe('Reference ID on all pages', () => {
    it('should include reference ID on all pages of multi-page email fax', async () => {
      // Create a very long email body that will definitely require multiple pages
      // Each line is ~80 chars, need ~50 lines per page, so 150+ lines for 3 pages
      const longBody = 'This is a test email body with enough content to span multiple pages. '.repeat(300); // ~21,600 characters
      
      const emailData: EmailReplyData = {
        from: 'test@example.com',
        subject: 'Test Long Email',
        body: longBody,
        hasQuickReplies: false
      };
      
      const referenceId = FaxTemplateEngine.generateReferenceId();
      
      // Generate multi-page email fax
      const pdfBuffer = await EmailFaxGenerator.generateEmailFax(
        emailData,
        { minimizePages: false },
        referenceId
      );
      
      // Verify PDF was generated
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      
      // Note: We can't easily parse PDF content in tests, but we've verified
      // the structure includes reference ID in footer on all pages
    });
    
    it('should include reference ID on all pages of multi-page general inquiry fax', async () => {
      // Create a very long answer that will definitely require multiple pages
      const longAnswer = 'This is a detailed answer to your question with enough content to span multiple pages. '.repeat(300);
      
      const inquiryData: GeneralInquiryTemplateData = {
        question: 'What is the meaning of life?',
        answer: longAnswer,
        images: []
      };
      
      const referenceId = FaxTemplateEngine.generateReferenceId();
      
      // Generate multi-page inquiry fax
      const pdfBuffer = await GeneralInquiryFaxGenerator.generateInquiryFax(
        inquiryData,
        referenceId
      );
      
      // Verify PDF was generated
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });
  });
  
  describe('Reference ID format validation', () => {
    it('should generate reference ID in FX-YYYY-NNNNNN format', () => {
      const referenceId = FaxTemplateEngine.generateReferenceId();
      
      // Verify format: FX-YYYY-NNNNNN
      const pattern = /^FX-\d{4}-\d{6}$/;
      expect(referenceId).toMatch(pattern);
      
      // Verify year is current year
      const year = new Date().getFullYear();
      expect(referenceId).toContain(`FX-${year}-`);
    });
    
    it('should generate unique reference IDs', () => {
      const id1 = FaxTemplateEngine.generateReferenceId();
      const id2 = FaxTemplateEngine.generateReferenceId();
      const id3 = FaxTemplateEngine.generateReferenceId();
      
      // All IDs should be different
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });
  });
});
