import {
  VisualAnnotation,
  FaxTemplate
} from '../types/vision';
import { auditLogService } from './auditLogService';

export class VisualAnnotationDetector {

  /**
   * Detect and analyze visual annotations from Gemini response
   */
  async detectAnnotations(
    geminiAnnotations: any[],
    extractedText: string,
    imageWidth?: number,
    imageHeight?: number
  ): Promise<VisualAnnotation[]> {
    
    const annotations: VisualAnnotation[] = [];

    // Process each annotation from Gemini
    for (const rawAnnotation of geminiAnnotations) {
      const processed = await this.processRawAnnotation(rawAnnotation, extractedText);
      if (processed) {
        annotations.push(processed);
      }
    }

    // Enhance annotations with context analysis
    const enhancedAnnotations = await this.enhanceAnnotationsWithContext(annotations, extractedText);

    // Log annotation detection results
    await auditLogService.logOperation({
      entityType: 'visual_annotation',
      entityId: 'system',
      operation: 'annotations_detected',
      details: {
        totalAnnotations: enhancedAnnotations.length,
        annotationTypes: this.getAnnotationTypeCounts(enhancedAnnotations),
        highConfidenceCount: enhancedAnnotations.filter(ann => ann.confidence > 0.8).length
      }
    });

    return enhancedAnnotations;
  }

  /**
   * Process raw annotation from Gemini into structured format
   */
  private async processRawAnnotation(rawAnnotation: any, extractedText: string): Promise<VisualAnnotation | null> {
    if (!rawAnnotation || typeof rawAnnotation !== 'object') {
      return null;
    }

    // Validate annotation type
    const validTypes = ['circle', 'checkmark', 'underline', 'arrow', 'checkbox'];
    const type = rawAnnotation.type?.toLowerCase();
    if (!validTypes.includes(type)) {
      return null;
    }

    // Validate bounding box
    const bbox = rawAnnotation.boundingBox;
    if (!bbox || typeof bbox !== 'object') {
      return null;
    }

    const boundingBox = {
      x: Math.max(0, bbox.x || 0),
      y: Math.max(0, bbox.y || 0),
      width: Math.max(0, bbox.width || 0),
      height: Math.max(0, bbox.height || 0)
    };

    // Skip annotations with invalid dimensions
    if (boundingBox.width === 0 || boundingBox.height === 0) {
      return null;
    }

    // Extract and validate associated text
    let associatedText = rawAnnotation.associatedText?.trim() || '';
    
    // If no associated text provided, try to extract from nearby text
    if (!associatedText) {
      associatedText = this.extractNearbyText(boundingBox, extractedText);
    }

    // Calculate confidence based on various factors
    const confidence = this.calculateAnnotationConfidence(
      type,
      boundingBox,
      associatedText,
      rawAnnotation.confidence || 0.5
    );

    return {
      type: type as any,
      boundingBox,
      associatedText,
      confidence
    };
  }

  /**
   * Extract text that appears near the annotation bounding box
   */
  private extractNearbyText(boundingBox: any, extractedText: string): string {
    // This is a simplified implementation
    // In a real system, you'd need OCR coordinates to match text to positions
    
    const lines = extractedText.split('\n');
    
    // Look for single letters (common for option selections)
    const singleLetterPattern = /\b[A-Z]\b/g;
    const matches = extractedText.match(singleLetterPattern);
    
    if (matches && matches.length > 0) {
      // Return the first single letter found (simplified heuristic)
      return matches[0];
    }

    // Look for short meaningful text
    const shortTextPattern = /\b\w{1,10}\b/g;
    const shortMatches = extractedText.match(shortTextPattern);
    
    if (shortMatches && shortMatches.length > 0) {
      return shortMatches[0];
    }

    return '';
  }

  /**
   * Calculate confidence score for an annotation
   */
  private calculateAnnotationConfidence(
    type: string,
    boundingBox: any,
    associatedText: string,
    baseConfidence: number
  ): number {
    let confidence = Math.max(0.1, Math.min(1.0, baseConfidence));

    // Boost confidence for common patterns
    if (type === 'circle' && /^[A-Z]$/.test(associatedText)) {
      confidence += 0.2; // Single letter circles are very common in forms
    }

    if (type === 'checkmark' && associatedText.length > 0) {
      confidence += 0.15; // Checkmarks with associated text are reliable
    }

    // Reduce confidence for very small or very large annotations
    const area = boundingBox.width * boundingBox.height;
    if (area < 100) { // Very small
      confidence -= 0.1;
    } else if (area > 10000) { // Very large
      confidence -= 0.15;
    }

    // Boost confidence if associated text makes sense
    if (this.isRelevantAssociatedText(associatedText, type)) {
      confidence += 0.1;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Check if associated text is relevant for the annotation type
   */
  private isRelevantAssociatedText(text: string, type: string): boolean {
    if (!text) return false;

    switch (type) {
      case 'circle':
        // Single letters, numbers, or short option text
        return /^[A-Z0-9]$/.test(text) || /^(yes|no|option|choice)$/i.test(text);
      
      case 'checkmark':
        // Any meaningful text is good for checkmarks
        return text.length > 0 && text.length < 50;
      
      case 'underline':
        // Underlined text should be meaningful
        return text.length > 2 && text.length < 100;
      
      case 'arrow':
        // Arrows can point to various things
        return text.length > 0;
      
      case 'checkbox':
        // Similar to checkmarks
        return text.length > 0 && text.length < 50;
      
      default:
        return text.length > 0;
    }
  }

  /**
   * Enhance annotations with contextual analysis
   */
  private async enhanceAnnotationsWithContext(
    annotations: VisualAnnotation[],
    extractedText: string
  ): Promise<VisualAnnotation[]> {
    
    const enhanced = [...annotations];

    // Group related annotations
    const groups = this.groupRelatedAnnotations(enhanced);

    // Analyze each group for patterns
    for (const group of groups) {
      await this.analyzeAnnotationGroup(group, extractedText);
    }

    // Sort by confidence (highest first)
    enhanced.sort((a, b) => b.confidence - a.confidence);

    return enhanced;
  }

  /**
   * Group annotations that are likely related (e.g., multiple choice options)
   */
  private groupRelatedAnnotations(annotations: VisualAnnotation[]): VisualAnnotation[][] {
    const groups: VisualAnnotation[][] = [];
    const processed = new Set<number>();

    for (let i = 0; i < annotations.length; i++) {
      if (processed.has(i)) continue;

      const group = [annotations[i]];
      processed.add(i);

      // Look for nearby annotations of the same type
      for (let j = i + 1; j < annotations.length; j++) {
        if (processed.has(j)) continue;

        if (this.areAnnotationsRelated(annotations[i], annotations[j])) {
          group.push(annotations[j]);
          processed.add(j);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Check if two annotations are likely related
   */
  private areAnnotationsRelated(ann1: VisualAnnotation, ann2: VisualAnnotation): boolean {
    // Same type is a good indicator
    if (ann1.type !== ann2.type) return false;

    // Check if they're both single-letter circles (common in forms)
    if (ann1.type === 'circle' && 
        /^[A-Z]$/.test(ann1.associatedText || '') && 
        /^[A-Z]$/.test(ann2.associatedText || '')) {
      return true;
    }

    // Check if they're vertically or horizontally aligned
    const verticalDistance = Math.abs(ann1.boundingBox.y - ann2.boundingBox.y);
    const horizontalDistance = Math.abs(ann1.boundingBox.x - ann2.boundingBox.x);

    // Consider them related if they're reasonably close
    return verticalDistance < 100 || horizontalDistance < 100;
  }

  /**
   * Analyze a group of annotations for patterns
   */
  private async analyzeAnnotationGroup(group: VisualAnnotation[], extractedText: string): Promise<void> {
    if (group.length < 2) return;

    // Check if this looks like a multiple choice question
    const isMultipleChoice = group.every(ann => 
      ann.type === 'circle' && /^[A-Z]$/.test(ann.associatedText || '')
    );

    if (isMultipleChoice) {
      // Boost confidence for multiple choice patterns
      for (const ann of group) {
        ann.confidence = Math.min(1.0, ann.confidence + 0.15);
      }

      // Log the pattern detection
      await auditLogService.logOperation({
        entityType: 'visual_pattern',
        entityId: 'system',
        operation: 'multiple_choice_detected',
        details: {
          optionCount: group.length,
          options: group.map(ann => ann.associatedText).filter(Boolean)
        }
      });
    }
  }

  /**
   * Detect Faxi template structures from annotations
   */
  async detectFaxiTemplateStructure(annotations: VisualAnnotation[], extractedText: string): Promise<FaxTemplate | null> {
    // Look for reference ID in text
    const refIdMatch = extractedText.match(/(?:ref|reference):\s*(FX-\d{4}-\d{6})/i);
    
    if (refIdMatch) {
      const referenceId = refIdMatch[1];
      
      // Check for reply form patterns
      const hasOptionCircles = annotations.some(ann => 
        ann.type === 'circle' && /^[A-Z]$/.test(ann.associatedText || '')
      );

      if (hasOptionCircles) {
        const expectedSelections = annotations
          .filter(ann => ann.type === 'circle' && /^[A-Z]$/.test(ann.associatedText || ''))
          .map(ann => ann.associatedText || '')
          .sort();

        // Determine template type based on content
        let templateType: FaxTemplate['type'] = 'email_reply';
        
        if (extractedText.toLowerCase().includes('product') || extractedText.toLowerCase().includes('order')) {
          templateType = 'product_selection';
        } else if (extractedText.toLowerCase().includes('payment') || extractedText.toLowerCase().includes('barcode')) {
          templateType = 'payment_barcodes';
        }

        return {
          type: templateType,
          referenceId,
          hasReplyForm: true,
          expectedSelections,
          contextData: {
            detectedAt: new Date().toISOString(),
            annotationCount: annotations.length
          }
        };
      }
    }

    // Check for other template patterns without reference ID
    const hasMultipleCircles = annotations.filter(ann => 
      ann.type === 'circle' && ann.confidence > 0.7
    ).length >= 2;

    if (hasMultipleCircles) {
      // This might be a template response without clear reference ID
      return {
        type: 'product_selection', // Default assumption
        referenceId: '', // Will need context recovery
        hasReplyForm: true,
        expectedSelections: annotations
          .filter(ann => ann.type === 'circle' && /^[A-Z]$/.test(ann.associatedText || ''))
          .map(ann => ann.associatedText || '')
      };
    }

    return null;
  }

  /**
   * Get counts of annotation types for logging
   */
  private getAnnotationTypeCounts(annotations: VisualAnnotation[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const annotation of annotations) {
      counts[annotation.type] = (counts[annotation.type] || 0) + 1;
    }
    
    return counts;
  }

  /**
   * Validate annotation quality and filter out low-quality ones
   */
  filterHighQualityAnnotations(annotations: VisualAnnotation[], minConfidence: number = 0.3): VisualAnnotation[] {
    return annotations.filter(ann => 
      ann.confidence >= minConfidence &&
      ann.boundingBox.width > 0 &&
      ann.boundingBox.height > 0
    );
  }

  /**
   * Extract form field associations from annotations
   */
  extractFormFieldAssociations(annotations: VisualAnnotation[], extractedText: string): Record<string, string> {
    const associations: Record<string, string> = {};
    
    // Look for patterns like "Name: ___" with nearby annotations
    const fieldPatterns = [
      /name:\s*([^\n\r]*)/i,
      /address:\s*([^\n\r]*)/i,
      /phone:\s*([^\n\r]*)/i,
      /email:\s*([^\n\r]*)/i,
      /quantity:\s*([^\n\r]*)/i
    ];

    for (const pattern of fieldPatterns) {
      const match = extractedText.match(pattern);
      if (match) {
        const fieldName = pattern.source.split(':')[0].replace(/[^a-zA-Z]/g, '');
        const fieldValue = match[1]?.trim();
        
        if (fieldValue) {
          associations[fieldName] = fieldValue;
        }
      }
    }

    return associations;
  }
}

// Export singleton instance
export const visualAnnotationDetector = new VisualAnnotationDetector();