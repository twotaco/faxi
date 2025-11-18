import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { addressBookRepository } from '../repositories/addressBookRepository';

export interface EmailSpamAnalysis {
  isSpam: boolean;
  confidence: number; // 0-1
  reason: string;
  category: 'personal' | 'transactional' | 'promotional' | 'spam' | 'newsletter';
}

export interface IncomingEmail {
  from: string;
  to: string;
  subject: string;
  body: string;
  headers?: Record<string, string>;
}

/**
 * Spam Filter Service - Analyzes incoming emails to determine if they should be faxed
 * 
 * Filtering strategy:
 * - Always allow: Personal emails, important transactional emails, emails from address book
 * - Filter out: Promotional emails, newsletters, automated notifications, spam
 * - Use AI to analyze content and sender patterns
 */
export class SpamFilterService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }

  /**
   * Analyze email to determine if it should be faxed to user
   */
  async analyzeEmail(email: IncomingEmail, userId: string): Promise<EmailSpamAnalysis> {
    try {
      // Check if sender is in address book (always allow)
      const contact = await addressBookRepository.findByUserAndEmail(userId, email.from);
      if (contact) {
        return {
          isSpam: false,
          confidence: 1.0,
          reason: 'Sender is in address book',
          category: 'personal'
        };
      }

      // Use AI to analyze email content
      const aiAnalysis = await this.analyzeWithAI(email);
      
      // Apply additional heuristics
      const heuristicAnalysis = this.applyHeuristics(email);
      
      // Combine AI and heuristic analysis
      const finalAnalysis = this.combineAnalyses(aiAnalysis, heuristicAnalysis);
      
      return finalAnalysis;
      
    } catch (error) {
      // If analysis fails, err on the side of caution and allow the email
      console.warn('Spam analysis failed:', error);
      return {
        isSpam: false,
        confidence: 0.5,
        reason: 'Analysis failed - allowing by default',
        category: 'personal'
      };
    }
  }

  /**
   * Use AI to analyze email content for spam indicators
   */
  private async analyzeWithAI(email: IncomingEmail): Promise<EmailSpamAnalysis> {
    const model = this.genAI.getGenerativeModel({ model: config.gemini.model });

    const prompt = `
Analyze this email to determine if it should be faxed to an elderly user who only wants personal and important emails.

Email Details:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.body.substring(0, 1000)}

Classify this email into one of these categories:
1. PERSONAL - Personal communication from friends, family, or individuals
2. TRANSACTIONAL - Important business emails (receipts, confirmations, account notifications)
3. PROMOTIONAL - Marketing emails, sales offers, advertisements
4. NEWSLETTER - Newsletters, updates, regular communications from organizations
5. SPAM - Obvious spam, phishing, or malicious content

Consider these factors:
- Is this a personal message from an individual?
- Is this an important transactional email (receipt, confirmation, etc.)?
- Does this contain marketing language or promotional content?
- Is this an automated newsletter or bulk email?
- Are there spam indicators (suspicious links, poor grammar, etc.)?

Respond with JSON only:
{
  "category": "PERSONAL|TRANSACTIONAL|PROMOTIONAL|NEWSLETTER|SPAM",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "shouldFax": true/false
}
`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      const analysis = JSON.parse(response);
      
      return {
        isSpam: !analysis.shouldFax,
        confidence: analysis.confidence,
        reason: analysis.reasoning,
        category: analysis.category.toLowerCase()
      };
    } catch (parseError) {
      // If JSON parsing fails, return conservative result
      return {
        isSpam: false,
        confidence: 0.5,
        reason: 'AI analysis parsing failed',
        category: 'personal'
      };
    }
  }

  /**
   * Apply heuristic rules for spam detection
   */
  private applyHeuristics(email: IncomingEmail): EmailSpamAnalysis {
    let spamScore = 0;
    const reasons: string[] = [];

    // Check for promotional keywords in subject
    const promotionalKeywords = [
      'sale', 'discount', 'offer', 'deal', 'free', 'limited time',
      'act now', 'urgent', 'winner', 'congratulations', 'prize',
      'unsubscribe', 'newsletter', 'promotion', 'marketing'
    ];
    
    const subjectLower = email.subject.toLowerCase();
    const bodyLower = email.body.toLowerCase();
    
    for (const keyword of promotionalKeywords) {
      if (subjectLower.includes(keyword) || bodyLower.includes(keyword)) {
        spamScore += 0.2;
        reasons.push(`Contains promotional keyword: ${keyword}`);
      }
    }

    // Check for automated sender patterns
    const automatedPatterns = [
      /no-?reply@/i,
      /noreply@/i,
      /donotreply@/i,
      /automated@/i,
      /newsletter@/i,
      /marketing@/i,
      /notifications?@/i
    ];

    for (const pattern of automatedPatterns) {
      if (pattern.test(email.from)) {
        spamScore += 0.3;
        reasons.push('Automated sender address');
        break;
      }
    }

    // Check for unsubscribe links (strong indicator of bulk email)
    if (bodyLower.includes('unsubscribe') || bodyLower.includes('opt out')) {
      spamScore += 0.4;
      reasons.push('Contains unsubscribe link');
    }

    // Check for excessive capitalization
    const capsRatio = (email.subject.match(/[A-Z]/g) || []).length / email.subject.length;
    if (capsRatio > 0.5 && email.subject.length > 10) {
      spamScore += 0.2;
      reasons.push('Excessive capitalization');
    }

    // Check for multiple exclamation marks
    if ((email.subject.match(/!/g) || []).length > 2) {
      spamScore += 0.1;
      reasons.push('Multiple exclamation marks');
    }

    // Determine category based on heuristics
    let category: EmailSpamAnalysis['category'] = 'personal';
    if (spamScore > 0.5) {
      category = spamScore > 0.8 ? 'spam' : 'promotional';
    }

    return {
      isSpam: spamScore > 0.6, // Threshold for filtering
      confidence: Math.min(spamScore, 1.0),
      reason: reasons.join(', ') || 'No spam indicators found',
      category
    };
  }

  /**
   * Combine AI and heuristic analyses
   */
  private combineAnalyses(aiAnalysis: EmailSpamAnalysis, heuristicAnalysis: EmailSpamAnalysis): EmailSpamAnalysis {
    // Weight AI analysis more heavily, but use heuristics as backup
    const aiWeight = 0.7;
    const heuristicWeight = 0.3;

    const combinedConfidence = (aiAnalysis.confidence * aiWeight) + (heuristicAnalysis.confidence * heuristicWeight);
    
    // If either analysis strongly indicates spam, filter it
    const isSpam = (aiAnalysis.isSpam && aiAnalysis.confidence > 0.7) || 
                   (heuristicAnalysis.isSpam && heuristicAnalysis.confidence > 0.8) ||
                   (aiAnalysis.isSpam && heuristicAnalysis.isSpam);

    // Use AI category if confidence is high, otherwise use heuristic
    const category = aiAnalysis.confidence > 0.6 ? aiAnalysis.category : heuristicAnalysis.category;

    return {
      isSpam,
      confidence: combinedConfidence,
      reason: `AI: ${aiAnalysis.reason}; Heuristic: ${heuristicAnalysis.reason}`,
      category
    };
  }

  /**
   * Get user's spam sensitivity setting (placeholder for future user preferences)
   */
  private async getUserSpamSensitivity(userId: string): Promise<'low' | 'medium' | 'high'> {
    // For now, return medium sensitivity
    // In the future, this would check user preferences
    return 'medium';
  }

  /**
   * Adjust spam threshold based on user sensitivity
   */
  private adjustThresholdForSensitivity(baseThreshold: number, sensitivity: 'low' | 'medium' | 'high'): number {
    switch (sensitivity) {
      case 'low': return baseThreshold + 0.2; // More permissive
      case 'high': return baseThreshold - 0.2; // More restrictive
      default: return baseThreshold; // Medium - use base threshold
    }
  }
}

// Export singleton instance
export const spamFilterService = new SpamFilterService();