import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

export interface SmartReplyOptions {
  replies: string[];
  hasQuestions: boolean;
  confidence: number;
}

export interface EmailForReply {
  from: string;
  subject: string;
  body: string;
  previousMessages?: string[]; // Previous messages in thread for context
}

/**
 * Smart Reply Service - Generates quick reply options for emails
 * 
 * This service analyzes email content to:
 * 1. Detect if the email contains clear questions
 * 2. Generate 2-3 appropriate quick reply options
 * 3. Format replies for fax template inclusion
 */
export class SmartReplyService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }

  /**
   * Analyze email and generate smart reply options
   */
  async generateReplies(email: EmailForReply): Promise<SmartReplyOptions> {
    try {
      const analysis = await this.analyzeEmailForReplies(email);
      
      if (!analysis.hasQuestions || analysis.confidence < 0.6) {
        return {
          replies: [],
          hasQuestions: false,
          confidence: analysis.confidence
        };
      }

      return {
        replies: analysis.replies,
        hasQuestions: true,
        confidence: analysis.confidence
      };
      
    } catch (error) {
      console.warn('Smart reply generation failed:', error);
      return {
        replies: [],
        hasQuestions: false,
        confidence: 0
      };
    }
  }

  /**
   * Use AI to analyze email and generate appropriate replies
   */
  private async analyzeEmailForReplies(email: EmailForReply): Promise<SmartReplyOptions> {
    const model = this.genAI.getGenerativeModel({ model: config.gemini.model });

    const contextMessages = email.previousMessages ? 
      `\nPrevious messages in conversation:\n${email.previousMessages.join('\n---\n')}` : '';

    const prompt = `
Analyze this email to determine if it contains clear questions that warrant quick reply options for an elderly fax user.

Email Details:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.body}${contextMessages}

Task: Determine if this email contains clear, direct questions that can be answered with simple yes/no or short responses.

Consider these factors:
1. Does the email ask specific questions that need answers?
2. Are the questions simple enough for quick replies?
3. Would an elderly person benefit from pre-written response options?
4. Avoid generating replies for: greetings only, statements, complex questions requiring detailed responses

If the email contains suitable questions, generate 2-3 short, polite reply options (max 10 words each).

Examples of good questions for quick replies:
- "Can you meet for lunch on Thursday?"
- "Did you receive my package?"
- "Are you available this weekend?"
- "Would you like me to call you?"

Examples of questions NOT suitable for quick replies:
- "How have you been?" (too open-ended)
- "What do you think about the new policy?" (requires detailed response)
- Complex multi-part questions

Respond with JSON only:
{
  "hasQuestions": true/false,
  "confidence": 0.0-1.0,
  "replies": ["Reply option 1", "Reply option 2", "Reply option 3"],
  "reasoning": "brief explanation"
}

Keep replies:
- Short and polite
- Appropriate for elderly users
- Natural and conversational
- Maximum 10 words each
`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      const analysis = JSON.parse(response);
      
      return {
        replies: analysis.replies || [],
        hasQuestions: analysis.hasQuestions || false,
        confidence: analysis.confidence || 0
      };
    } catch (parseError) {
      console.warn('Failed to parse smart reply analysis:', parseError);
      return {
        replies: [],
        hasQuestions: false,
        confidence: 0
      };
    }
  }

  /**
   * Generate fallback replies for common email types
   */
  private generateFallbackReplies(email: EmailForReply): string[] {
    const bodyLower = email.body.toLowerCase();
    const subjectLower = email.subject.toLowerCase();
    
    // Check for common patterns and provide appropriate replies
    if (bodyLower.includes('meet') || bodyLower.includes('lunch') || bodyLower.includes('dinner')) {
      return [
        'Yes, that works for me',
        'No, I\'m not available',
        'Can we do a different time?'
      ];
    }
    
    if (bodyLower.includes('call') || bodyLower.includes('phone')) {
      return [
        'Yes, please call me',
        'No, email is better',
        'I\'ll call you instead'
      ];
    }
    
    if (bodyLower.includes('visit') || bodyLower.includes('come over')) {
      return [
        'Yes, please come over',
        'Not today, maybe later',
        'Let me check my schedule'
      ];
    }
    
    if (bodyLower.includes('help') || bodyLower.includes('assist')) {
      return [
        'Yes, I can help',
        'No, I\'m busy right now',
        'What do you need help with?'
      ];
    }
    
    // Generic polite responses for questions
    if (bodyLower.includes('?')) {
      return [
        'Yes',
        'No',
        'Let me think about it'
      ];
    }
    
    return [];
  }

  /**
   * Format replies for fax template
   */
  formatRepliesForFax(replies: string[]): string {
    if (replies.length === 0) {
      return '';
    }

    const letters = ['A', 'B', 'C'];
    const formattedReplies = replies.slice(0, 3).map((reply, index) => {
      return `○ ${letters[index]}. ${reply}`;
    }).join('\n');

    return `QUICK REPLIES (Circle one):\n${formattedReplies}`;
  }

  /**
   * Check if email content suggests it needs a reply
   */
  needsReply(email: EmailForReply): boolean {
    const bodyLower = email.body.toLowerCase();
    
    // Look for question marks
    if (bodyLower.includes('?')) {
      return true;
    }
    
    // Look for request patterns
    const requestPatterns = [
      'please let me know',
      'let me know',
      'can you',
      'could you',
      'would you',
      'will you',
      'are you',
      'do you',
      'did you',
      'have you'
    ];
    
    return requestPatterns.some(pattern => bodyLower.includes(pattern));
  }
}

// Export singleton instance
export const smartReplyService = new SmartReplyService();