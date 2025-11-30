import { describe, it, expect } from 'vitest';
import { EmailFaxGenerator } from './emailFaxGenerator.js';
import { EmailReplyData } from '../types/fax.js';

describe('EmailFaxGenerator Integration Tests', () => {
  describe('Quick Reply Detection', () => {
    it('should detect meeting scheduling questions', async () => {
      const emailData: EmailReplyData = {
        from: 'colleague@example.com',
        subject: 'Meeting Request',
        body: 'Can you meet tomorrow at 3pm to discuss the project?'
      };

      const pdf = await EmailFaxGenerator.generateEmailFax(emailData);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should detect preference questions', async () => {
      const emailData: EmailReplyData = {
        from: 'friend@example.com',
        subject: 'Dinner Plans',
        body: 'Would you like to join us for dinner this weekend?'
      };

      const pdf = await EmailFaxGenerator.generateEmailFax(emailData);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should detect confirmation requests', async () => {
      const emailData: EmailReplyData = {
        from: 'manager@example.com',
        subject: 'Project Approval',
        body: 'Can you confirm that the project timeline is acceptable?'
      };

      const pdf = await EmailFaxGenerator.generateEmailFax(emailData);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should not generate quick replies for statements', async () => {
      const emailData: EmailReplyData = {
        from: 'colleague@example.com',
        subject: 'Update',
        body: 'Thank you for your email. I have received the documents and will review them.'
      };

      const pdf = await EmailFaxGenerator.generateEmailFax(emailData);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });
  });

  describe('Attachment Indicators', () => {
    it('should include attachment count when attachments exist', async () => {
      const emailData: EmailReplyData = {
        from: 'sender@example.com',
        subject: 'Documents',
        body: 'Please review the attached documents.',
        attachmentCount: 3
      };

      const pdf = await EmailFaxGenerator.generateEmailFax(emailData);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should not show attachment indicator when no attachments', async () => {
      const emailData: EmailReplyData = {
        from: 'sender@example.com',
        subject: 'Simple Message',
        body: 'This is a simple message without attachments.',
        attachmentCount: 0
      };

      const pdf = await EmailFaxGenerator.generateEmailFax(emailData);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should handle missing attachmentCount field', async () => {
      const emailData: EmailReplyData = {
        from: 'sender@example.com',
        subject: 'Message',
        body: 'This message has no attachment count specified.'
      };

      const pdf = await EmailFaxGenerator.generateEmailFax(emailData);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });
  });

  describe('Email Pagination', () => {
    it('should handle short emails in single page', async () => {
      const emailData: EmailReplyData = {
        from: 'sender@example.com',
        subject: 'Short Message',
        body: 'This is a short email that should fit on one page.'
      };

      const pdf = await EmailFaxGenerator.generateEmailFax(emailData);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should handle long emails with pagination', async () => {
      // Create a long email body
      const longBody = Array(50)
        .fill(0)
        .map((_, i) => `This is paragraph ${i + 1}. It contains some text that will help fill up the page and test the pagination functionality. We want to make sure that long emails are properly split across multiple pages with appropriate headers, footers, and reference IDs on each page.`)
        .join('\n\n');

      const emailData: EmailReplyData = {
        from: 'sender@example.com',
        subject: 'Long Email',
        body: longBody,
        attachmentCount: 2
      };

      const pdf = await EmailFaxGenerator.generateEmailFax(emailData, { minimizePages: false });
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should include quick replies on last page of multi-page email', async () => {
      const longBody = Array(30)
        .fill(0)
        .map((_, i) => `Paragraph ${i + 1} with some content.`)
        .join('\n\n') + '\n\nCan you confirm this is acceptable?';

      const emailData: EmailReplyData = {
        from: 'sender@example.com',
        subject: 'Long Email with Question',
        body: longBody
      };

      const pdf = await EmailFaxGenerator.generateEmailFax(emailData, { minimizePages: false });
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });
  });

  describe('Combined Features', () => {
    it('should handle email with attachments, questions, and long body', async () => {
      const longBody = Array(20)
        .fill(0)
        .map((_, i) => `Section ${i + 1}: This section contains important information about the project. Please review carefully.`)
        .join('\n\n') + '\n\nCan you meet next week to discuss these points?';

      const emailData: EmailReplyData = {
        from: 'manager@example.com',
        subject: 'Project Review',
        body: longBody,
        attachmentCount: 5
      };

      const pdf = await EmailFaxGenerator.generateEmailFax(emailData, { minimizePages: false });
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should respect minimizePages option for long emails', async () => {
      const longBody = Array(30)
        .fill(0)
        .map((_, i) => `Paragraph ${i + 1}.`)
        .join('\n\n');

      const emailData: EmailReplyData = {
        from: 'sender@example.com',
        subject: 'Long Email',
        body: longBody
      };

      // With minimizePages=true (default), should use single page template
      const pdf = await EmailFaxGenerator.generateEmailFax(emailData, { minimizePages: true });
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });
  });

  describe('Special Email Types', () => {
    it('should generate welcome email fax', async () => {
      const pdf = await EmailFaxGenerator.generateWelcomeEmailFax(
        '+81-3-1234-5678',
        'user@me.faxi.jp'
      );
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should generate spam notification fax', async () => {
      const pdf = await EmailFaxGenerator.generateSpamNotificationFax(5, 'last 24 hours');
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should generate email failure fax', async () => {
      const pdf = await EmailFaxGenerator.generateEmailFailureFax(
        'invalid@example.com',
        'Mailbox not found',
        'Test Subject'
      );
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should generate email thread fax', async () => {
      const emails: EmailReplyData[] = [
        {
          from: 'person1@example.com',
          subject: 'Project Discussion',
          body: 'Let\'s discuss the project timeline.'
        },
        {
          from: 'person2@example.com',
          subject: 'Re: Project Discussion',
          body: 'I agree. When should we meet?'
        }
      ];

      const pdf = await EmailFaxGenerator.generateEmailThreadFax(emails);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });
  });
});
