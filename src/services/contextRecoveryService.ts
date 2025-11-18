import {
  InterpretationResult,
  ContextRecoveryResult,
  ConversationContext
} from '../types/vision.js';
import { FaxTemplate } from '../types/fax.js';
import { conversationContextRepository } from '../repositories/conversationContextRepository';
import { faxJobRepository } from '../repositories/faxJobRepository';
import { auditLogService } from './auditLogService';

export class ContextRecoveryService {

  /**
   * Perform comprehensive context recovery for ambiguous faxes
   */
  async recoverContext(
    interpretation: InterpretationResult,
    userId: string,
    faxJobId?: string
  ): Promise<ContextRecoveryResult> {
    
    try {
      // Try multiple recovery methods in order of reliability
      const methods = [
        () => this.recoverByReferenceId(interpretation, userId),
        () => this.recoverByTemplatePattern(interpretation, userId),
        () => this.recoverByContentSimilarity(interpretation, userId),
        () => this.recoverByTemporalProximity(interpretation, userId)
      ];

      for (const method of methods) {
        const result = await method();
        if (result.confidence > 0.6) {
          // Log successful recovery
          await auditLogService.logOperation({
            entityType: 'context_recovery',
            entityId: userId,
            operation: 'context_recovered',
            details: {
              method: result.method,
              confidence: result.confidence,
              matchedContextId: result.matchedContextId,
              faxJobId
            }
          });
          
          return result;
        }
      }

      // If no single method worked well, check for ambiguous matches
      const ambiguousResult = await this.detectAmbiguousMatches(interpretation, userId);
      
      // Log recovery attempt
      await auditLogService.logOperation({
        entityType: 'context_recovery',
        entityId: userId,
        operation: 'context_recovery_attempted',
        details: {
          finalMethod: ambiguousResult.method,
          confidence: ambiguousResult.confidence,
          ambiguousMatches: ambiguousResult.ambiguousMatches?.length || 0,
          faxJobId
        }
      });

      return ambiguousResult;

    } catch (error) {
      await auditLogService.logOperation({
        entityType: 'context_recovery',
        entityId: userId,
        operation: 'context_recovery_error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          faxJobId
        }
      });

      return {
        method: 'none',
        confidence: 0
      };
    }
  }

  /**
   * Recover context using reference ID extraction
   */
  private async recoverByReferenceId(
    interpretation: InterpretationResult,
    userId: string
  ): Promise<ContextRecoveryResult> {
    
    if (!interpretation.referenceId) {
      // Try to extract reference ID from text using more patterns
      const extractedRefId = this.extractReferenceIdFromText(interpretation.extractedText || '');
      if (extractedRefId) {
        interpretation.referenceId = extractedRefId;
      } else {
        return { method: 'reference_id', confidence: 0 };
      }
    }

    // Look up context by reference ID
    const context = await conversationContextRepository.findByReferenceId(interpretation.referenceId);
    
    if (context && context.userId === userId) {
      return {
        method: 'reference_id',
        confidence: 0.95,
        matchedContextId: context.id
      };
    }

    return { method: 'reference_id', confidence: 0 };
  }

  /**
   * Recover context by detecting Faxi template patterns
   */
  private async recoverByTemplatePattern(
    interpretation: InterpretationResult,
    userId: string
  ): Promise<ContextRecoveryResult> {
    
    const annotations = interpretation.visualAnnotations || [];
    
    // Check for reply form patterns (circled options)
    const circledOptions = annotations
      .filter(ann => ann.type === 'circle' && ann.confidence > 0.7)
      .map(ann => ann.associatedText)
      .filter((text): text is string => text !== undefined && /^[A-Z]$/.test(text));

    if (circledOptions.length === 0) {
      return { method: 'template_pattern', confidence: 0 };
    }

    // Find recent contexts that are waiting for replies
    const recentContexts = await conversationContextRepository.findRecentByUser(userId, 7); // Last 7 days
    const waitingContexts = recentContexts.filter(ctx => 
      ctx.contextData?.status === 'waiting_reply' && ctx.expiresAt > new Date()
    );

    if (waitingContexts.length === 0) {
      return { method: 'template_pattern', confidence: 0 };
    }

    // Check if any waiting context matches the template pattern
    for (const context of waitingContexts) {
      const templateMatch = await this.matchesExpectedTemplate(context, circledOptions);
      if (templateMatch > 0.7) {
        return {
          method: 'template_pattern',
          confidence: templateMatch,
          matchedContextId: context.id
        };
      }
    }

    // If multiple waiting contexts, this is ambiguous
    if (waitingContexts.length > 1) {
      return {
        method: 'template_pattern',
        confidence: 0.4,
        ambiguousMatches: waitingContexts.map(ctx => ctx.id).filter(id => id !== undefined)
      };
    }

    return { method: 'template_pattern', confidence: 0 };
  }

  /**
   * Recover context by content similarity matching
   */
  private async recoverByContentSimilarity(
    interpretation: InterpretationResult,
    userId: string
  ): Promise<ContextRecoveryResult> {
    
    const extractedText = interpretation.extractedText || '';
    if (extractedText.length < 20) {
      return { method: 'content_similarity', confidence: 0 };
    }

    // Get recent contexts for similarity comparison
    const recentContexts = await conversationContextRepository.findRecentByUser(userId, 7);
    
    if (recentContexts.length === 0) {
      return { method: 'content_similarity', confidence: 0 };
    }

    // Calculate similarity scores
    const similarities = await Promise.all(
      recentContexts.map(async (context) => ({
        contextId: context.id,
        similarity: await this.calculateContentSimilarity(extractedText, context)
      }))
    );

    // Find best match
    const bestMatch = similarities.reduce((best, current) => 
      current.similarity > best.similarity ? current : best
    );

    if (bestMatch.similarity > 0.6) {
      return {
        method: 'content_similarity',
        confidence: bestMatch.similarity,
        matchedContextId: bestMatch.contextId
      };
    }

    return { method: 'content_similarity', confidence: bestMatch.similarity };
  }

  /**
   * Recover context by temporal proximity (most recent interaction)
   */
  private async recoverByTemporalProximity(
    interpretation: InterpretationResult,
    userId: string
  ): Promise<ContextRecoveryResult> {
    
    // Get the most recent active context
    const recentContexts = await conversationContextRepository.findRecentByUser(userId, 1);
    
    if (recentContexts.length === 0) {
      return { method: 'temporal_proximity', confidence: 0 };
    }

    const mostRecent = recentContexts[0];
    const hoursSinceLastActivity = (Date.now() - mostRecent.updatedAt.getTime()) / (1000 * 60 * 60);

    // Confidence decreases with time
    let confidence = 0;
    if (hoursSinceLastActivity < 1) {
      confidence = 0.8;
    } else if (hoursSinceLastActivity < 6) {
      confidence = 0.6;
    } else if (hoursSinceLastActivity < 24) {
      confidence = 0.4;
    } else {
      confidence = 0.2;
    }

    return {
      method: 'temporal_proximity',
      confidence,
      matchedContextId: mostRecent.id
    };
  }

  /**
   * Detect when multiple contexts could match (ambiguous situation)
   */
  private async detectAmbiguousMatches(
    interpretation: InterpretationResult,
    userId: string
  ): Promise<ContextRecoveryResult> {
    
    // Get all recent active contexts
    const recentContexts = await conversationContextRepository.findRecentByUser(userId, 7);
    const activeContexts = recentContexts.filter(ctx => 
      ctx.expiresAt > new Date() && 
      (ctx.contextData?.status === 'active' || ctx.contextData?.status === 'waiting_reply')
    );

    if (activeContexts.length <= 1) {
      return { method: 'none', confidence: 0 };
    }

    // This is an ambiguous situation - multiple possible matches
    return {
      method: 'none',
      confidence: 0.3,
      ambiguousMatches: activeContexts.map(ctx => ctx.id).filter(id => id !== undefined)
    };
  }

  /**
   * Extract reference ID from text using various patterns
   */
  private extractReferenceIdFromText(text: string): string | null {
    const patterns = [
      /(?:ref|reference|ref#|ref:)\s*(FX-\d{4}-\d{6})/i,
      /(FX-\d{4}-\d{6})/i, // Just the ID itself
      /(?:order|ticket|case)#?\s*(FX-\d{4}-\d{6})/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return null;
  }

  /**
   * Check if circled options match expected template for a context
   */
  private async matchesExpectedTemplate(
    context: ConversationContext,
    circledOptions: string[]
  ): Promise<number> {
    
    // Get the expected template structure from context data
    const expectedOptions = context.contextData?.expectedSelections as string[] || [];
    
    if (expectedOptions.length === 0) {
      return 0.3; // No template info, low confidence
    }

    // Check if circled options are valid for this template
    const validSelections = circledOptions.filter(option => 
      expectedOptions.includes(option)
    );

    if (validSelections.length === 0) {
      return 0; // No valid selections
    }

    // Calculate match confidence
    const matchRatio = validSelections.length / circledOptions.length;
    const coverageRatio = validSelections.length / expectedOptions.length;

    return (matchRatio * 0.6) + (coverageRatio * 0.4);
  }

  /**
   * Calculate content similarity between extracted text and context
   */
  private async calculateContentSimilarity(
    extractedText: string,
    context: ConversationContext
  ): Promise<number> {
    
    const contextTopic = context.contextData?.topic || '';
    const contextMetadata = JSON.stringify(context.contextData || {});
    const contextText = (contextTopic + ' ' + contextMetadata).toLowerCase();
    const inputText = extractedText.toLowerCase();

    // Simple keyword-based similarity
    const contextWords = this.extractKeywords(contextText);
    const inputWords = this.extractKeywords(inputText);

    if (contextWords.length === 0 || inputWords.length === 0) {
      return 0;
    }

    // Calculate Jaccard similarity
    const intersection = contextWords.filter(word => inputWords.includes(word));
    const union = [...new Set([...contextWords, ...inputWords])];

    return intersection.length / union.length;
  }

  /**
   * Extract meaningful keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
    ]);

    return text
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, '').toLowerCase())
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 20); // Limit to top 20 keywords
  }

  /**
   * Generate disambiguation request when multiple contexts match
   */
  async generateDisambiguationRequest(
    ambiguousMatches: string[],
    userId: string
  ): Promise<{
    clarificationQuestion: string;
    contextSummaries: Array<{ id: string; summary: string; referenceId?: string }>;
  }> {
    
    const contexts = await Promise.all(
      ambiguousMatches.map(id => conversationContextRepository.findById(id))
    );

    const validContexts = contexts.filter(ctx => ctx !== null) as ConversationContext[];

    const contextSummaries = validContexts.map(context => ({
      id: context.id,
      summary: this.generateContextSummary(context),
      referenceId: context.referenceId
    }));

    const clarificationQuestion = this.buildDisambiguationQuestion(contextSummaries);

    return {
      clarificationQuestion,
      contextSummaries
    };
  }

  /**
   * Generate a brief summary of a conversation context
   */
  private generateContextSummary(context: ConversationContext): string {
    const topic = context.contextData?.topic || 'Unknown topic';
    const daysSince = Math.floor((Date.now() - context.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    
    let summary = topic;
    
    if (daysSince === 0) {
      summary += ' (today)';
    } else if (daysSince === 1) {
      summary += ' (yesterday)';
    } else {
      summary += ` (${daysSince} days ago)`;
    }

    return summary;
  }

  /**
   * Build disambiguation question for multiple context matches
   */
  private buildDisambiguationQuestion(
    contextSummaries: Array<{ id: string; summary: string; referenceId?: string }>
  ): string {
    
    let question = 'I received your fax but couldn\'t determine which request it\'s for. Recent conversations:\n\n';
    
    contextSummaries.forEach((context, index) => {
      const letter = String.fromCharCode(65 + index); // A, B, C, etc.
      question += `${letter}. ${context.summary}`;
      
      if (context.referenceId) {
        question += ` (Ref: ${context.referenceId})`;
      }
      
      question += '\n';
    });

    question += '\nPlease write the letter (';
    question += contextSummaries.map((_, index) => String.fromCharCode(65 + index)).join(' or ');
    question += ') and fax back with your original message.';

    return question;
  }

  /**
   * Update context status after successful recovery
   */
  async updateContextAfterRecovery(
    contextId: string,
    interpretation: InterpretationResult
  ): Promise<void> {
    
    const context = await conversationContextRepository.findById(contextId);
    if (!context) return;

    // Update context with new activity
    await conversationContextRepository.update(contextId, {
      contextData: {
        ...context.contextData,
        status: 'active',
        lastInterpretation: {
          intent: interpretation.intent,
          confidence: interpretation.confidence,
          timestamp: new Date().toISOString()
        }
      }
    });
  }
}

// Export singleton instance
export const contextRecoveryService = new ContextRecoveryService();