import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseGenerator } from './responseGenerator.js';
import { TemplateRegistry } from './templateRegistry.js';
import {
  AppointmentSelectionTemplateData,
  GeneralInquiryTemplateData
} from '../types/fax.js';

describe('ResponseGenerator - Template Registry Integration', () => {
  beforeEach(() => {
    // Reset template registry to defaults before each test
    TemplateRegistry.getInstance().resetToDefaults();
  });

  describe('Template Selection via MCP Server', () => {
    it('should select appointment_selection template for appointment MCP', () => {
      const templateType = ResponseGenerator.getTemplateTypeFromMcp('appointment', 'search_appointments');
      expect(templateType).toBe('appointment_selection');
    });

    it('should select general_inquiry template for ai_chat MCP', () => {
      const templateType = ResponseGenerator.getTemplateTypeFromMcp('ai_chat');
      expect(templateType).toBe('general_inquiry');
    });

    it('should select email_reply template for email MCP', () => {
      const templateType = ResponseGenerator.getTemplateTypeFromMcp('email', 'send_email');
      expect(templateType).toBe('email_reply');
    });

    it('should select product_selection template for shopping MCP', () => {
      const templateType = ResponseGenerator.getTemplateTypeFromMcp('shopping', 'search_products');
      expect(templateType).toBe('product_selection');
    });

    it('should fallback to general_inquiry for unknown MCP server', () => {
      const templateType = ResponseGenerator.getTemplateTypeFromMcp('unknown_server');
      expect(templateType).toBe('general_inquiry');
    });
  });

  describe('Appointment Selection Fax Generation', () => {
    it('should generate appointment selection fax', async () => {
      const appointmentData: AppointmentSelectionTemplateData = {
        serviceName: 'Medical Checkup',
        provider: 'Dr. Tanaka',
        location: 'Tokyo Medical Center',
        slots: [
          {
            id: '1',
            date: new Date('2025-02-01'),
            startTime: '09:00',
            endTime: '09:30',
            duration: 30,
            available: true,
            selectionMarker: 'A'
          },
          {
            id: '2',
            date: new Date('2025-02-01'),
            startTime: '10:00',
            endTime: '10:30',
            duration: 30,
            available: true,
            selectionMarker: 'B'
          }
        ]
      };

      const result = await ResponseGenerator.generateAppointmentFax(appointmentData);

      expect(result).toBeDefined();
      expect(result.pdfBuffer).toBeInstanceOf(Buffer);
      expect(result.pdfBuffer.length).toBeGreaterThan(0);
      expect(result.template.type).toBe('appointment_selection');
      expect(result.referenceId).toMatch(/^FX-\d{4}-\d{6}$/);
    });
  });

  describe('General Inquiry Fax Generation', () => {
    it('should generate general inquiry fax', async () => {
      const inquiryData: GeneralInquiryTemplateData = {
        question: 'What is the weather today?',
        answer: 'The weather today is sunny with a high of 25°C and a low of 18°C. Perfect for outdoor activities!',
        relatedTopics: ['Weather forecast', 'Temperature']
      };

      const result = await ResponseGenerator.generateInquiryFax(inquiryData);

      expect(result).toBeDefined();
      expect(result.pdfBuffer).toBeInstanceOf(Buffer);
      expect(result.pdfBuffer.length).toBeGreaterThan(0);
      expect(result.template.type).toBe('general_inquiry');
      expect(result.referenceId).toMatch(/^FX-\d{4}-\d{6}$/);
    });

    it('should generate inquiry fax with images', async () => {
      const inquiryData: GeneralInquiryTemplateData = {
        question: 'Show me pictures of Mount Fuji',
        answer: 'Here are some beautiful views of Mount Fuji, Japan\'s iconic mountain.',
        images: [
          {
            url: 'https://example.com/fuji1.jpg',
            caption: 'Mount Fuji at sunrise',
            position: 'inline'
          },
          {
            url: 'https://example.com/fuji2.jpg',
            caption: 'Mount Fuji in winter',
            position: 'end'
          }
        ]
      };

      const result = await ResponseGenerator.generateInquiryFax(inquiryData);

      expect(result).toBeDefined();
      expect(result.pdfBuffer).toBeInstanceOf(Buffer);
      expect(result.pdfBuffer.length).toBeGreaterThan(0);
      expect(result.template.type).toBe('general_inquiry');
    });
  });

  describe('MCP-based Generation', () => {
    it('should generate fax using MCP server routing', async () => {
      const inquiryData: GeneralInquiryTemplateData = {
        question: 'Test question',
        answer: 'Test answer'
      };

      const result = await ResponseGenerator.generateFromMcp(
        'ai_chat',
        undefined,
        inquiryData
      );

      expect(result).toBeDefined();
      expect(result.pdfBuffer).toBeInstanceOf(Buffer);
      expect(result.template.type).toBe('general_inquiry');
    });

    it('should use fallback template for unknown MCP server', async () => {
      const data: GeneralInquiryTemplateData = {
        question: 'Unknown request type',
        answer: 'This request was processed using the fallback template.'
      };

      const result = await ResponseGenerator.generateFromMcp(
        'unknown_mcp',
        undefined,
        data
      );

      expect(result).toBeDefined();
      expect(result.pdfBuffer).toBeInstanceOf(Buffer);
      expect(result.template.type).toBe('general_inquiry');
    });
  });

  describe('Fallback Handling', () => {
    it('should fallback to general_inquiry for unsupported type', async () => {
      const result = await ResponseGenerator.generateResponse({
        type: 'unsupported_type' as any,
        data: { message: 'Test message' }
      });

      expect(result).toBeDefined();
      expect(result.pdfBuffer).toBeInstanceOf(Buffer);
      expect(result.template.type).toBe('general_inquiry');
    });
  });

  describe('Page Count Estimation', () => {
    it('should estimate 1 page for short appointment fax', () => {
      const request = {
        type: 'appointment_selection' as const,
        data: {
          serviceName: 'Test',
          provider: 'Test',
          slots: [
            { id: '1', date: new Date(), startTime: '09:00', endTime: '09:30', duration: 30, available: true, selectionMarker: 'A' }
          ]
        }
      };

      const pageCount = ResponseGenerator.estimatePageCount(request);
      expect(pageCount).toBe(1);
    });

    it('should estimate 2 pages for long appointment fax', () => {
      const slots = Array.from({ length: 15 }, (_, i) => ({
        id: `${i}`,
        date: new Date(),
        startTime: '09:00',
        endTime: '09:30',
        duration: 30,
        available: true,
        selectionMarker: String.fromCharCode(65 + i)
      }));

      const request = {
        type: 'appointment_selection' as const,
        data: {
          serviceName: 'Test',
          provider: 'Test',
          slots
        }
      };

      const pageCount = ResponseGenerator.estimatePageCount(request);
      expect(pageCount).toBe(2);
    });

    it('should estimate pages for general inquiry based on content length', () => {
      const shortAnswer = 'Short answer';
      const longAnswer = 'A'.repeat(3000); // ~3000 chars, should be 2 pages

      const shortRequest = {
        type: 'general_inquiry' as const,
        data: { question: 'Q', answer: shortAnswer }
      };

      const longRequest = {
        type: 'general_inquiry' as const,
        data: { question: 'Q', answer: longAnswer }
      };

      expect(ResponseGenerator.estimatePageCount(shortRequest)).toBe(1);
      expect(ResponseGenerator.estimatePageCount(longRequest)).toBe(2);
    });
  });
});
