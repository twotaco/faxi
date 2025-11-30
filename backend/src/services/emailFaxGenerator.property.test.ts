import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { EmailFaxGenerator } from './emailFaxGenerator.js';
import { EmailReplyData } from '../types/fax.js';

describe('EmailFaxGenerator Property Tests', () => {
  // Feature: fax-template-system, Property 13: Email quick reply generation
  // Validates: Requirements 3.3
  it('should generate 1-3 contextually appropriate quick reply options for emails with clear questions', () => {
    // Define question patterns that should trigger quick replies
    const questionPatterns = fc.oneof(
      fc.constant('Can you meet tomorrow at 3pm?'),
      fc.constant('Are you available next week?'),
      fc.constant('Would you like to join us for dinner?'),
      fc.constant('Do you want me to send the report?'),
      fc.constant('What do you think about this proposal?'),
      fc.constant('Can you help me with this project?'),
      fc.constant('When would be a good time to call?'),
      fc.constant('Where should we meet?'),
      fc.constant('Is this okay with you?'),
      fc.constant('Can you confirm your attendance?'),
      fc.constant('Will you be there on Friday?'),
      fc.constant('Could you please review this document?'),
      fc.constant('Do you prefer option A or option B?'),
      fc.constant('Are you happy with the results?'),
      fc.constant('Should we proceed with the plan?')
    );

    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 50 }), // from
        fc.string({ minLength: 5, maxLength: 100 }), // subject
        questionPatterns, // body with question
        (from, subject, body) => {
          const emailData: EmailReplyData = {
            from,
            subject,
            body,
            hasQuickReplies: undefined // Let the generator detect
          };

          // Generate the fax (this will process quick replies)
          const processedData = (EmailFaxGenerator as any).processEmailForQuickReplies(
            emailData,
            { includeQuickReplies: true, maxQuickReplies: 3 }
          );

          // Property: Should detect questions and generate quick replies
          expect(processedData.hasQuickReplies).toBe(true);
          expect(processedData.quickReplies).toBeDefined();
          expect(processedData.quickReplies!.length).toBeGreaterThan(0);
          expect(processedData.quickReplies!.length).toBeLessThanOrEqual(3);

          // Property: All quick replies should be non-empty strings
          processedData.quickReplies!.forEach((reply: string) => {
            expect(typeof reply).toBe('string');
            expect(reply.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not generate quick replies for emails without questions', () => {
    // Define statement patterns that should NOT trigger quick replies
    const statementPatterns = fc.oneof(
      fc.constant('Thank you for your email.'),
      fc.constant('I received your message and will respond soon.'),
      fc.constant('The meeting has been scheduled for next week.'),
      fc.constant('Here is the information you requested.'),
      fc.constant('I have completed the task.'),
      fc.constant('The project is progressing well.'),
      fc.constant('Please find the attached document.'),
      fc.constant('I look forward to hearing from you.')
    );

    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 50 }), // from
        fc.string({ minLength: 5, maxLength: 100 }), // subject
        statementPatterns, // body without question
        (from, subject, body) => {
          const emailData: EmailReplyData = {
            from,
            subject,
            body,
            hasQuickReplies: undefined
          };

          const processedData = (EmailFaxGenerator as any).processEmailForQuickReplies(
            emailData,
            { includeQuickReplies: true, maxQuickReplies: 3 }
          );

          // Property: Should not generate quick replies for statements
          expect(processedData.hasQuickReplies).toBe(false);
          expect(processedData.quickReplies).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should respect maxQuickReplies limit', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 50 }), // from
        fc.string({ minLength: 5, maxLength: 100 }), // subject
        fc.constant('Can you meet tomorrow? What time works for you?'), // body with questions
        fc.integer({ min: 1, max: 5 }), // maxQuickReplies
        (from, subject, body, maxReplies) => {
          const emailData: EmailReplyData = {
            from,
            subject,
            body,
            hasQuickReplies: undefined
          };

          const processedData = (EmailFaxGenerator as any).processEmailForQuickReplies(
            emailData,
            { includeQuickReplies: true, maxQuickReplies: maxReplies }
          );

          // Property: Should never exceed maxQuickReplies
          if (processedData.quickReplies) {
            expect(processedData.quickReplies.length).toBeLessThanOrEqual(maxReplies);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should respect explicit hasQuickReplies=false setting', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 50 }), // from
        fc.string({ minLength: 5, maxLength: 100 }), // subject
        fc.constant('Can you meet tomorrow?'), // body with question
        (from, subject, body) => {
          const emailData: EmailReplyData = {
            from,
            subject,
            body,
            hasQuickReplies: false // Explicitly disabled
          };

          const processedData = (EmailFaxGenerator as any).processEmailForQuickReplies(
            emailData,
            { includeQuickReplies: true, maxQuickReplies: 3 }
          );

          // Property: Should respect explicit hasQuickReplies=false
          expect(processedData.hasQuickReplies).toBe(false);
          expect(processedData.quickReplies).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate contextually appropriate replies for different question types', () => {
    const questionTypeTests = [
      {
        body: 'Can you meet tomorrow?',
        expectedKeywords: ['yes', 'no', 'time', 'available', 'works']
      },
      {
        body: 'Where should we meet?',
        expectedKeywords: ['suggestion', 'preference', 'fine', 'think']
      },
      {
        body: 'Do you want coffee or tea?',
        expectedKeywords: ['yes', 'no', 'please', 'thank']
      },
      {
        body: 'Can you help me with this?',
        expectedKeywords: ['yes', 'help', 'can', 'need', 'sorry']
      },
      {
        body: 'What do you think about this?',
        expectedKeywords: ['agree', 'disagree', 'information', 'think']
      }
    ];

    questionTypeTests.forEach(({ body, expectedKeywords }) => {
      const emailData: EmailReplyData = {
        from: 'test@example.com',
        subject: 'Test',
        body,
        hasQuickReplies: undefined
      };

      const processedData = (EmailFaxGenerator as any).processEmailForQuickReplies(
        emailData,
        { includeQuickReplies: true, maxQuickReplies: 3 }
      );

      // Property: Quick replies should be contextually relevant
      expect(processedData.hasQuickReplies).toBe(true);
      expect(processedData.quickReplies).toBeDefined();

      // At least one reply should contain a relevant keyword
      const allRepliesText = processedData.quickReplies!.join(' ').toLowerCase();
      const hasRelevantKeyword = expectedKeywords.some(keyword =>
        allRepliesText.includes(keyword.toLowerCase())
      );
      expect(hasRelevantKeyword).toBe(true);
    });
  });
});
