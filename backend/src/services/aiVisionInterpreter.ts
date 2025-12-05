import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import {
  InterpretationRequest,
  InterpretationResult,
  VisualAnnotation,
  ContextRecoveryResult,
  ConversationContext
} from '../types/vision.js';
import { FaxTemplate } from '../types/fax.js';
import { auditLogService } from './auditLogService';
import { intentExtractor } from './intentExtractor';
import { visualAnnotationDetector } from './visualAnnotationDetector';
import { contextRecoveryService, extractReferenceIdFromText } from './contextRecoveryService';

export class AIVisionInterpreter {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: config.gemini.model });
  }

  /**
   * Main interpretation method that processes fax images
   */
  async interpretFax(request: InterpretationRequest): Promise<InterpretationResult> {
    const startTime = Date.now();
    
    try {
      // Log the interpretation request
      await auditLogService.logOperation({
        entityType: 'fax_interpretation',
        entityId: request.userId || 'unknown',
        operation: 'vision_analysis_start',
        details: {
          hasImageUrl: !!request.imageUrl,
          hasImageData: !!request.imageData,
          hasContext: !!request.context
        }
      });

      // Preprocess image if needed (returns array of pages)
      const processedImagePages = await this.preprocessImage(request);

      console.log(`Processing ${processedImagePages.length} page(s) for interpretation`);

      // Process pages sequentially with context carryover
      let combinedInterpretation: InterpretationResult | null = null;
      let accumulatedContext = '';

      for (let i = 0; i < processedImagePages.length; i++) {
        const pageNum = i + 1;
        console.log(`Processing page ${pageNum}/${processedImagePages.length}`);

        // Generate system prompt with accumulated context from previous pages
        const systemPrompt = this.generateSystemPrompt(request.context, accumulatedContext, pageNum, processedImagePages.length);

        // Call Gemini API for this page
        const geminiResult = await this.callGeminiAPI(processedImagePages[i], systemPrompt);

        // Parse this page's result
        const pageInterpretation = await this.parseGeminiResponse(geminiResult, request);

        if (i === 0) {
          // First page - use as base interpretation
          combinedInterpretation = pageInterpretation;
        } else {
          // Subsequent pages - merge with accumulated interpretation
          combinedInterpretation = this.mergePageInterpretations(combinedInterpretation!, pageInterpretation, pageNum);
        }

        // Add this page's extracted text to accumulated context for next page
        accumulatedContext += `\n\n--- Page ${pageNum} Content ---\n${pageInterpretation.extractedText || ''}`;
      }

      const interpretation = combinedInterpretation!;

      // Enhance visual annotations with detailed analysis
      if (interpretation.visualAnnotations && interpretation.extractedText) {
        interpretation.visualAnnotations = await visualAnnotationDetector.detectAnnotations(
          interpretation.visualAnnotations,
          interpretation.extractedText
        );

        // Filter to high-quality annotations only
        interpretation.visualAnnotations = visualAnnotationDetector.filterHighQualityAnnotations(
          interpretation.visualAnnotations,
          0.3
        );
      }

      // Refine intent and parameters using dedicated extractor
      if (interpretation.extractedText) {
        const refinedIntent = await intentExtractor.extractIntent(
          interpretation.extractedText,
          interpretation.visualAnnotations || [],
          interpretation
        );

        // Update interpretation with refined results
        interpretation.intent = refinedIntent.intent as any;
        interpretation.parameters = { ...interpretation.parameters, ...refinedIntent.parameters };
        
        // Recalculate confidence based on parameter completeness
        const parameterCompleteness = intentExtractor.assessParameterCompleteness(
          interpretation.intent,
          interpretation.parameters
        );
        const visualQuality = this.assessVisualAnnotationQuality(interpretation.visualAnnotations || []);
        
        interpretation.confidence = intentExtractor.calculateConfidence(
          refinedIntent.confidence,
          parameterCompleteness,
          visualQuality
        );
      }

      // Perform context recovery if needed
      if (request.userId) {
        interpretation.contextRecovery = await contextRecoveryService.recoverContext(
          interpretation,
          request.userId
        );

        // If context was recovered, update the context status
        if (interpretation.contextRecovery.matchedContextId) {
          await contextRecoveryService.updateContextAfterRecovery(
            interpretation.contextRecovery.matchedContextId,
            interpretation
          );
        }

        // Generate disambiguation request if multiple matches found
        if (interpretation.contextRecovery.ambiguousMatches && 
            interpretation.contextRecovery.ambiguousMatches.length > 1) {
          const disambiguation = await contextRecoveryService.generateDisambiguationRequest(
            interpretation.contextRecovery.ambiguousMatches,
            request.userId
          );
          
          interpretation.requiresClarification = true;
          interpretation.clarificationQuestion = disambiguation.clarificationQuestion;
        }
      }

      // Calculate processing time
      const processingTime = Date.now() - startTime;
      interpretation.processingTime = processingTime;

      // Generate visualization data
      interpretation.visualizationData = this.generateVisualizationData(interpretation);
      interpretation.textRegions = this.extractTextRegions(interpretation);

      // Log the interpretation result
      await auditLogService.logOperation({
        entityType: 'fax_interpretation',
        entityId: request.userId || 'unknown',
        operation: 'vision_analysis_complete',
        details: {
          intent: interpretation.intent,
          confidence: interpretation.confidence,
          requiresClarification: interpretation.requiresClarification,
          hasReferenceId: !!interpretation.referenceId,
          processingTime
        }
      });

      return interpretation;

    } catch (error) {
      await auditLogService.logOperation({
        entityType: 'fax_interpretation',
        entityId: request.userId || 'unknown',
        operation: 'vision_analysis_error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  /**
   * Preprocess image for optimal fax interpretation
   * Returns array of base64 image data URLs (one per page for PDFs)
   */
  private async preprocessImage(request: InterpretationRequest): Promise<string[]> {
    // For now, return the image URL or convert buffer to base64
    if (request.imageUrl) {
      return [request.imageUrl];
    }
    
    if (request.imageData) {
      // Check if it's a PDF
      const isPDF = request.imageData.slice(0, 4).toString() === '%PDF';
      
      if (isPDF) {
        // Convert PDF to PNG pages
        console.log('Converting multi-page PDF to PNG for Gemini');
        try {
          const pngBuffers = await this.convertPdfToPng(request.imageData);
          return pngBuffers.map(buffer => {
            const base64 = buffer.toString('base64');
            return `data:image/png;base64,${base64}`;
          });
        } catch (error) {
          console.error('Failed to convert PDF to PNG:', error);
          throw new Error(`PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Convert any image format to PNG for Gemini compatibility
      const sharp = require('sharp');
      try {
        const pngBuffer = await sharp(request.imageData).png().toBuffer();
        const base64 = pngBuffer.toString('base64');
        return [`data:image/png;base64,${base64}`];
      } catch (error) {
        console.error('Failed to convert image to PNG:', error);
        // Fallback to original if conversion fails
        const base64 = request.imageData.toString('base64');
        return [`data:image/png;base64,${base64}`];
      }
    }
    
    throw new Error('No image data provided');
  }

  /**
   * Convert PDF to PNG images (all pages)
   */
  private async convertPdfToPng(pdfBuffer: Buffer): Promise<Buffer[]> {
    const { pdfToPng } = require('pdf-to-png-converter');
    
    try {
      // Convert all pages of PDF to PNG
      const pngPages = await pdfToPng(pdfBuffer, {
        disableFontFace: false,
        useSystemFonts: false,
        viewportScale: 2.0, // Higher quality
        outputFolder: undefined, // Return buffer instead of saving
        strictPagesToProcess: false, // Process all pages
      });
      
      if (!pngPages || pngPages.length === 0) {
        throw new Error('No pages extracted from PDF');
      }
      
      console.log(`Converted PDF to ${pngPages.length} PNG pages`);
      return pngPages.map((page: { content: Buffer }) => page.content);
    } catch (error) {
      console.error('PDF to PNG conversion error:', error);
      throw error;
    }
  }

  /**
   * Merge interpretations from multiple pages
   */
  private mergePageInterpretations(
    base: InterpretationResult,
    newPage: InterpretationResult,
    pageNum: number
  ): InterpretationResult {
    return {
      ...base,
      // Concatenate extracted text
      extractedText: `${base.extractedText}\n\n[Page ${pageNum}]\n${newPage.extractedText}`,
      // Merge visual annotations
      visualAnnotations: [...(base.visualAnnotations || []), ...(newPage.visualAnnotations || [])],
      // Keep highest confidence intent, or update if new page has higher confidence
      intent: newPage.confidence > base.confidence ? newPage.intent : base.intent,
      confidence: Math.max(base.confidence, newPage.confidence),
      // Merge parameters (new page can add/override)
      parameters: { ...base.parameters, ...newPage.parameters },
      // Use reference ID from any page that has one
      referenceId: base.referenceId || newPage.referenceId,
      // Require clarification if any page needs it
      requiresClarification: base.requiresClarification || newPage.requiresClarification,
      clarificationQuestion: base.clarificationQuestion || newPage.clarificationQuestion,
    };
  }

  /**
   * Generate system prompt explaining Faxi context and user behaviors
   */
  private generateSystemPrompt(
    context?: ConversationContext,
    accumulatedContext?: string,
    currentPage?: number,
    totalPages?: number
  ): string {
    let multiPageContext = '';
    if (currentPage && totalPages && totalPages > 1) {
      multiPageContext = `
MULTI-PAGE FAX:
- This is page ${currentPage} of ${totalPages}
${accumulatedContext ? `- Previous pages contained:\n${accumulatedContext}` : ''}
- Consider context from previous pages when interpreting this page
- The complete request may span multiple pages
`;
    }

    const basePrompt = `
You are an AI vision interpreter for Faxi, a fax-to-internet bridge service. Your job is to analyze fax images and understand user intent.

CONTEXT:
- Users are typically elderly or prefer offline communication
- They send handwritten or printed requests via fax machine
- Common requests: send emails, shop online, ask AI questions, register payment methods
${multiPageContext}
- Users may circle options, check boxes, or draw arrows to indicate selections
- Faxes may contain reference IDs in format "FX-YYYY-NNNNNN" for context recovery

FAXI TEMPLATE RECOGNITION:
- Email reply forms: Have quick reply options (Circle A/B/C) and space for custom replies
- Product selection forms: Have product options with circles/checkboxes and pricing
- Confirmation pages: Show completed actions with order numbers or message IDs

VISUAL ANNOTATION DETECTION:
- Circles around text or options (most common selection method)
- Checkmarks next to items
- Underlines for emphasis
- Arrows pointing to specific items
- Hand-drawn boxes around text

INTENT CLASSIFICATION:
1. "email" - User wants to send an email (extract recipient, subject, body)
2. "shopping" - User wants to buy something (extract product description, preferences)
3. "ai_chat" - User has a question or wants to chat with AI
4. "payment_registration" - User wants to add/manage payment methods
5. "reply" - User is responding to a previous Faxi template (look for reference ID and selections)
6. "unknown" - Intent is unclear, needs clarification

CONFIDENCE SCORING:
- 0.9-1.0: Very clear intent with all necessary parameters
- 0.7-0.89: Clear intent but may need minor clarification
- 0.5-0.69: Somewhat clear but missing important details
- 0.3-0.49: Unclear intent, significant clarification needed
- 0.0-0.29: Cannot determine intent

PARAMETER EXTRACTION:
- For emails: Look for "send email to [name/address]", "tell [person] that...", etc.
- For shopping: Look for product names, quantities, delivery preferences
- For AI chat: Look for questions, "ask AI about...", general inquiries
- For replies: Look for circled options (A, B, C), checkmarks, filled forms

REFERENCE ID EXTRACTION:
- Look for "Ref: FX-YYYY-NNNNNN" written anywhere on the fax
- May be handwritten or printed
- Critical for context recovery

Analyze the provided fax image and return a structured JSON response with your interpretation.
`;

    if (context) {
      return basePrompt + `
CONVERSATION CONTEXT:
- Previous conversation ID: ${context.id}
- Topic: ${context.contextData?.topic || 'Unknown'}
- Status: ${context.contextData?.status || 'active'}
- Last activity: ${context.updatedAt.toISOString()}
- This may be a follow-up or reply to the previous conversation
`;
    }

    return basePrompt;
  }

  /**
   * Call Gemini API with image and prompt
   */
  private async callGeminiAPI(imageData: string, systemPrompt: string): Promise<any> {
    const prompt = `${systemPrompt}

Please analyze this fax image and provide a JSON response with the following structure:
{
  "intent": "email|shopping|ai_chat|payment_registration|reply|unknown",
  "confidence": 0.0-1.0,
  "extractedText": "full text content from the fax",
  "parameters": {
    // Intent-specific parameters
  },
  "visualAnnotations": [
    {
      "type": "circle|checkmark|underline|arrow|checkbox",
      "boundingBox": {"x": 0, "y": 0, "width": 0, "height": 0},
      "associatedText": "text near the annotation",
      "confidence": 0.0-1.0
    }
  ],
  "referenceId": "FX-YYYY-NNNNNN if found",
  "requiresClarification": true/false,
  "clarificationQuestion": "specific question if clarification needed"
}

Analyze the image now:`;

    let imagePart;
    if (imageData.startsWith('data:')) {
      // Base64 data URL
      const base64Data = imageData.split(',')[1];
      const mimeType = imageData.split(';')[0].split(':')[1] || 'image/png';
      imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      };
    } else {
      // URL - we'll need to fetch it first
      const response = await fetch(imageData);
      const buffer = await response.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString('base64');

      // Detect mime type from Content-Type header or buffer magic bytes
      let mimeType = response.headers.get('content-type') || 'image/png';

      // If no content-type, detect from magic bytes
      if (!response.headers.get('content-type')) {
        const bufferView = Buffer.from(buffer);
        if (bufferView.length >= 4) {
          // PDF: %PDF
          if (bufferView[0] === 0x25 && bufferView[1] === 0x50 && bufferView[2] === 0x44 && bufferView[3] === 0x46) {
            mimeType = 'application/pdf';
          }
          // PNG
          else if (bufferView[0] === 0x89 && bufferView[1] === 0x50 && bufferView[2] === 0x4E && bufferView[3] === 0x47) {
            mimeType = 'image/png';
          }
        }
      }

      imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      };
    }

    const result = await this.model.generateContent([prompt, imagePart]);
    const response = await result.response;
    return response.text();
  }

  /**
   * Parse Gemini response into structured format
   */
  private async parseGeminiResponse(geminiResponse: string, request: InterpretationRequest): Promise<InterpretationResult> {
    try {
      // Extract JSON from response (Gemini might include extra text)
      const jsonMatch = geminiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Gemini response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and structure the response
      const result: InterpretationResult = {
        intent: parsed.intent || 'unknown',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        parameters: parsed.parameters || {},
        visualAnnotations: this.validateVisualAnnotations(parsed.visualAnnotations || []),
        requiresClarification: parsed.requiresClarification || parsed.confidence < 0.7,
        clarificationQuestion: parsed.clarificationQuestion,
        extractedText: parsed.extractedText,
        referenceId: parsed.referenceId
      };

      // Ensure reference ID is extracted - backup extraction from text if Gemini didn't detect it
      if (!result.referenceId && result.extractedText) {
        const extractedRefId = extractReferenceIdFromText(result.extractedText);
        if (extractedRefId) {
          result.referenceId = extractedRefId;
        }
      }

      // Additional validation and processing
      result.requiresClarification = result.requiresClarification || result.confidence < 0.7;

      if (result.requiresClarification && !result.clarificationQuestion) {
        result.clarificationQuestion = this.generateDefaultClarificationQuestion(result);
      }

      return result;

    } catch (error) {
      // Fallback interpretation if parsing fails
      return {
        intent: 'unknown',
        confidence: 0.1,
        parameters: {},
        requiresClarification: true,
        clarificationQuestion: 'I had trouble reading your fax. Could you please resend with clearer writing or provide more details about what you need?',
        extractedText: geminiResponse.substring(0, 500) // First 500 chars as fallback
      };
    }
  }

  /**
   * Validate and clean visual annotations
   */
  private validateVisualAnnotations(annotations: any[]): VisualAnnotation[] {
    return annotations
      .filter(ann => ann && typeof ann === 'object')
      .map(ann => ({
        type: ann.type || 'circle',
        boundingBox: {
          x: Math.max(0, ann.boundingBox?.x || 0),
          y: Math.max(0, ann.boundingBox?.y || 0),
          width: Math.max(0, ann.boundingBox?.width || 0),
          height: Math.max(0, ann.boundingBox?.height || 0)
        },
        associatedText: ann.associatedText || '',
        confidence: Math.max(0, Math.min(1, ann.confidence || 0.5))
      }))
      .filter(ann => ann.confidence > 0.3); // Filter out low-confidence annotations
  }

  /**
   * Generate default clarification question based on intent
   */
  private generateDefaultClarificationQuestion(result: InterpretationResult): string {
    switch (result.intent) {
      case 'email':
        return 'I can help you send an email. Please specify: 1) Who should receive it (name or email address), 2) What the subject should be, 3) What message you want to send.';
      
      case 'shopping':
        return 'I can help you shop online. Please specify: 1) What product you want to buy, 2) Any specific brand or size preferences, 3) Where it should be delivered.';
      
      case 'ai_chat':
        return 'I can answer questions for you. Please write your question more clearly or provide more details about what you want to know.';
      
      case 'payment_registration':
        return 'I can help you register a payment method. Please specify if you want to: 1) Add a credit card, 2) Set up convenience store payments, or 3) Update existing payment information.';
      
      case 'reply':
        return 'I see you\'re replying to a previous request. Please include the reference number (Ref: FX-YYYY-NNNNNN) from the original fax, or circle your choices clearly.';
      
      default:
        return 'I couldn\'t understand your request clearly. Please write more clearly or provide more details about what you need help with.';
    }
  }



  /**
   * Detect if fax matches known Faxi template structures
   */
  async detectFaxiTemplate(interpretation: InterpretationResult): Promise<FaxTemplate | null> {
    if (!interpretation.visualAnnotations || !interpretation.extractedText) {
      return null;
    }

    return await visualAnnotationDetector.detectFaxiTemplateStructure(
      interpretation.visualAnnotations,
      interpretation.extractedText
    );
  }

  /**
   * Assess the quality of visual annotations
   */
  private assessVisualAnnotationQuality(annotations: VisualAnnotation[]): number {
    if (annotations.length === 0) return 0.5; // Neutral score for no annotations

    const avgConfidence = annotations.reduce((sum, ann) => sum + ann.confidence, 0) / annotations.length;
    const hasHighConfidenceAnnotations = annotations.some(ann => ann.confidence > 0.8);
    const hasRelevantText = annotations.some(ann => ann.associatedText && ann.associatedText.length > 0);

    let quality = avgConfidence * 0.6;
    if (hasHighConfidenceAnnotations) quality += 0.2;
    if (hasRelevantText) quality += 0.2;

    return Math.min(quality, 1.0);
  }

  /**
   * Generate visualization data from interpretation result
   */
  private generateVisualizationData(interpretation: InterpretationResult): any {
    const regions: any[] = [];

    // Add text regions
    if (interpretation.extractedText) {
      const textLines = interpretation.extractedText.split('\n').filter(line => line.trim());
      textLines.forEach((line, index) => {
        regions.push({
          type: 'text',
          boundingBox: {
            x: 50,
            y: 50 + (index * 30),
            width: 500,
            height: 25
          },
          label: line.substring(0, 50) + (line.length > 50 ? '...' : ''),
          confidence: 0.85,
          color: '#3B82F6' // Blue for text
        });
      });
    }

    // Add annotation regions
    if (interpretation.visualAnnotations) {
      interpretation.visualAnnotations.forEach(ann => {
        regions.push({
          type: 'annotation',
          boundingBox: ann.boundingBox,
          label: `${ann.type}${ann.associatedText ? ': ' + ann.associatedText : ''}`,
          confidence: ann.confidence,
          color: this.getAnnotationColor(ann.type)
        });
      });
    }

    // Add form field regions based on parameters
    if (interpretation.parameters) {
      let yOffset = 200;
      Object.entries(interpretation.parameters).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          regions.push({
            type: 'form-field',
            boundingBox: {
              x: 100,
              y: yOffset,
              width: 400,
              height: 30
            },
            label: `${key}: ${value}`,
            confidence: 0.9,
            color: '#10B981' // Green for form fields
          });
          yOffset += 40;
        }
      });
    }

    return {
      regions
    };
  }

  /**
   * Extract text regions from interpretation
   */
  private extractTextRegions(interpretation: InterpretationResult): any[] {
    if (!interpretation.extractedText) return [];

    const textRegions: any[] = [];
    const lines = interpretation.extractedText.split('\n').filter(line => line.trim());

    lines.forEach((line, index) => {
      // Detect if line is likely handwritten (heuristic: shorter, more informal)
      const isHandwritten = line.length < 30 && !/^[A-Z][a-z]+:/.test(line);

      textRegions.push({
        text: line,
        boundingBox: {
          x: 50,
          y: 50 + (index * 30),
          width: Math.min(line.length * 10, 600),
          height: 25
        },
        confidence: isHandwritten ? 0.75 : 0.9,
        type: isHandwritten ? 'handwritten' : 'printed'
      });
    });

    return textRegions;
  }

  /**
   * Get color code for annotation type
   */
  private getAnnotationColor(type: string): string {
    const colorMap: Record<string, string> = {
      circle: '#EF4444', // Red
      checkmark: '#10B981', // Green
      underline: '#F59E0B', // Amber
      arrow: '#8B5CF6', // Purple
      checkbox: '#06B6D4' // Cyan
    };
    return colorMap[type] || '#6B7280'; // Gray default
  }
}

// Export singleton instance
export const aiVisionInterpreter = new AIVisionInterpreter();