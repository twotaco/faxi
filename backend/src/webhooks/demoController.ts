import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection';
import { aiVisionInterpreter } from '../services/aiVisionInterpreter';
import { geminiAgentService, ToolCallResult } from '../services/geminiAgentService';
import { ResponseGenerator } from '../services/responseGenerator';
import { loggingService } from '../services/loggingService';
import { productCacheService } from '../services/productCacheService';
import { GeneralInquiryFaxGenerator } from '../services/generalInquiryFaxGenerator';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config';
import * as path from 'path';
import * as fs from 'fs/promises';

// Initialize Gemini for fallback responses
const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

// Demo user UUID from migration 014_add_demo_user.sql
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Generate response using Gemini Agent Service
 *
 * This uses Gemini's native function calling to:
 * 1. Intelligently interpret the OCR text
 * 2. Extract proper parameters (e.g., "shampoo" from "I need shampoo")
 * 3. Call the appropriate MCP tool
 * 4. Return clarification if confidence is low
 */
async function generateDemoResponse(
  extractedText: string,
  visualAnnotations: any[] = []
): Promise<{
  responseText: string;
  actionTaken: string;
  toolCalls?: ToolCallResult[];
}> {
  try {
    console.log('\n\n=== DEMO PROCESSING START ===');
    console.log('Extracted text:', extractedText.substring(0, 200));
    console.log('Demo User ID:', DEMO_USER_ID);

    loggingService.info('Processing with Gemini Agent', {
      textLength: extractedText.length,
      annotationCount: visualAnnotations.length,
      extractedTextPreview: extractedText.substring(0, 200),
      demoUserId: DEMO_USER_ID
    });

    // Use Gemini Agent Service for intelligent tool calling
    const agentResult = await geminiAgentService.processRequest(
      extractedText,
      visualAnnotations,
      DEMO_USER_ID
    );

    loggingService.info('Gemini Agent result', {
      success: agentResult.success,
      needsClarification: agentResult.needsClarification,
      toolCallCount: agentResult.toolCalls?.length || 0,
      hasAggregatedResponse: !!agentResult.aggregatedResponse,
      error: agentResult.error
    });

    // Handle clarification needed
    if (agentResult.needsClarification) {
      return {
        responseText: agentResult.clarificationFax || generateDefaultClarification(),
        actionTaken: 'Requested clarification - intent unclear'
      };
    }

    // Handle errors
    if (!agentResult.success) {
      loggingService.warn('Gemini Agent failed, using fallback', undefined, {
        error: agentResult.error
      });
      return await generateFallbackResponse(extractedText);
    }

    // Aggregate successful tool call results
    if (agentResult.aggregatedResponse) {
      const toolNames = agentResult.toolCalls
        .filter(t => t.success)
        .map(t => t.toolName)
        .join(', ');

      return {
        responseText: agentResult.aggregatedResponse,
        actionTaken: `Executed tools: ${toolNames}`,
        toolCalls: agentResult.toolCalls
      };
    }

    // No response generated - fallback
    return await generateFallbackResponse(extractedText);

  } catch (error) {
    console.log('\n=== DEMO ERROR ===');
    console.log('Error:', (error as Error).message);
    console.log('Stack:', (error as Error).stack?.substring(0, 500));

    loggingService.error('Failed to generate demo response', error as Error, undefined, {
      errorMessage: (error as Error).message,
      errorStack: (error as Error).stack?.substring(0, 500)
    });
    return await generateFallbackResponse(extractedText);
  }
}

/**
 * Generate default clarification fax
 */
function generateDefaultClarification(): string {
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ご確認のお願い / Clarification Needed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ご依頼の内容を確認させてください。
Please clarify your request.

何をご希望ですか？
What would you like to do?

1. 商品を探す (Shopping)
2. メールを送る (Send Email)
3. 質問する (Ask a Question)
4. その他 (Other)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
番号に○をつけてFAXでご返信ください。
Circle your choice and fax back.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
}

/**
 * Fallback response when Gemini Agent fails
 */
async function generateFallbackResponse(extractedText: string): Promise<{
  responseText: string;
  actionTaken: string;
}> {
  try {
    const prompt = `You are Faxi, a helpful AI assistant that responds to fax messages.
The user sent a fax with this content: "${extractedText}"

Please provide a helpful response that would be suitable to fax back to an elderly person in Japan.
If you can identify what they want (shopping, email, question), help them with that.
If unclear, politely ask for clarification.
Keep the response concise but informative. Use simple language.
Format the response nicely for a fax (no markdown, use plain text).
Include both Japanese and English where appropriate.`;

    const response = await ai.models.generateContent({
      model: config.gemini.model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    return {
      responseText: response.text ?? generateDefaultClarification(),
      actionTaken: 'Generated fallback response'
    };
  } catch (error) {
    loggingService.error('Fallback response generation failed', error as Error);
    return {
      responseText: generateDefaultClarification(),
      actionTaken: 'Error - sent clarification request'
    };
  }
}

/**
 * Transforms MCP tool results to template-expected data formats
 */
function transformToolResultForTemplate(
  serverName: string,
  toolName: string,
  toolResult: any,
  originalQuestion: string,
  responseText: string
): any {
  switch (serverName) {
    case 'shopping':
      // ProductSelectionData format
      console.log('[Demo] Transforming shopping tool result:', {
        hasProducts: !!toolResult.products,
        productCount: toolResult.products?.length,
        hasQuery: !!toolResult.query,
        queryValue: toolResult.query,
        hasGroupedResults: !!toolResult.groupedResults
      });
      
      // Handle grouped results (multi-product search)
      if (toolResult.groupedResults) {
        return {
          groupedResults: toolResult.groupedResults
        };
      }
      
      // Handle single product search
      return {
        products: toolResult.products || [],
        searchQuery: toolResult.query || originalQuestion,
        complementaryItems: toolResult.complementaryItems || [],
        hasPaymentMethod: false,
        deliveryAddress: undefined
      };

    case 'email':
      // EmailReplyData format
      return {
        from: toolResult.from || toolResult.recipient || 'Unknown',
        subject: toolResult.subject || 'Email Response',
        body: toolResult.body || responseText,
        hasQuickReplies: false
      };

    case 'appointment':
      // AppointmentSelectionTemplateData format
      return {
        serviceName: toolResult.serviceName || 'Appointment',
        provider: toolResult.provider || 'Service Provider',
        location: toolResult.location,
        slots: (toolResult.slots || []).map((slot: any, index: number) => ({
          ...slot,
          selectionMarker: String.fromCharCode(65 + index) // A, B, C...
        }))
      };

    case 'payment':
      // PaymentBarcodeData format
      return {
        products: toolResult.products || [],
        barcodes: toolResult.barcodes || [],
        expirationDate: toolResult.expirationDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        instructions: toolResult.instructions || 'Please pay at any convenience store.'
      };

    case 'ai_chat':
    case 'chat':
    default:
      // GeneralInquiryTemplateData format (fallback)
      return {
        question: originalQuestion,
        answer: responseText,
        relatedTopics: []
      };
  }
}

const router = Router();

// Rate limiting map (simple in-memory implementation)
// Uses path-based keys so fixture images don't count against process limit
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Rate limit middleware
// - Fixture/image endpoints: no rate limit (static assets)
// - Process endpoint: 30 requests per 15 minutes (the expensive AI calls)
function rateLimitMiddleware(req: Request, res: Response, next: Function) {
  // Skip rate limiting for static fixture assets
  if (req.path.includes('/fixtures') || req.path.includes('/fixture-image')) {
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 30; // Reasonable limit for AI processing requests

  const clientData = rateLimitMap.get(ip);

  if (!clientData || now > clientData.resetTime) {
    // New window
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    next();
  } else if (clientData.count < maxRequests) {
    // Within limit
    clientData.count++;
    next();
  } else {
    // Rate limit exceeded
    res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  }
}

// Apply rate limiting to all demo routes
router.use(rateLimitMiddleware);

/**
 * GET /api/demo/fixtures
 * List available test fixtures
 */
router.get('/fixtures', async (req: Request, res: Response) => {
  try {
    const fixturesPath = path.join(__dirname, '../../src/test/fixtures/fax-images');
    
    // Check if fixtures directory exists
    try {
      await fs.access(fixturesPath);
    } catch {
      // Return empty list if fixtures don't exist
      return res.json({ fixtures: [] });
    }

    const files = await fs.readdir(fixturesPath);
    const imageFiles = files.filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));

    const fixtures = imageFiles.map(filename => {
      const id = filename.replace(/\.(png|jpg|jpeg)$/i, '');
      const name = id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      // Categorize based on filename
      let category = 'general';
      if (filename.includes('email')) category = 'email';
      else if (filename.includes('shopping') || filename.includes('product')) category = 'shopping';
      else if (filename.includes('ai') || filename.includes('chat')) category = 'ai-chat';
      else if (filename.includes('payment')) category = 'payment';

      return {
        id,
        name,
        description: `Test fixture: ${name}`,
        category,
        thumbnailUrl: `/api/demo/fixture-image/${id}`,
        imageUrl: `/api/demo/fixture-image/${id}`
      };
    });

    res.json({ fixtures });
  } catch (error) {
    loggingService.error('Failed to list fixtures', error as Error);
    res.status(500).json({ error: 'Failed to list fixtures' });
  }
});

/**
 * GET /api/demo/fixture-image/:id
 * Serve fixture image
 */
router.get('/fixture-image/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const fixturesPath = path.join(__dirname, '../../src/test/fixtures/fax-images');
    
    // Try different extensions
    const extensions = ['png', 'jpg', 'jpeg'];
    let imagePath: string | null = null;

    for (const ext of extensions) {
      const testPath = path.join(fixturesPath, `${id}.${ext}`);
      try {
        await fs.access(testPath);
        imagePath = testPath;
        break;
      } catch {
        continue;
      }
    }

    if (!imagePath) {
      return res.status(404).json({ error: 'Fixture not found' });
    }

    const imageBuffer = await fs.readFile(imagePath);
    const ext = path.extname(imagePath).substring(1);
    res.contentType(`image/${ext}`);
    res.send(imageBuffer);
  } catch (error) {
    loggingService.error('Failed to serve fixture image', error as Error);
    res.status(500).json({ error: 'Failed to serve fixture image' });
  }
});

/**
 * POST /api/demo/process
 * Process a fax image (fixture or upload)
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { fixtureId, imageData } = req.body;
    const sessionId = uuidv4();
    const visitorIp = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    let imageBuffer: Buffer;

    if (fixtureId) {
      // Load fixture image
      const fixturesPath = path.join(__dirname, '../../src/test/fixtures/fax-images');
      const extensions = ['png', 'jpg', 'jpeg'];
      let imagePath: string | null = null;

      for (const ext of extensions) {
        const testPath = path.join(fixturesPath, `${fixtureId}.${ext}`);
        try {
          await fs.access(testPath);
          imagePath = testPath;
          break;
        } catch {
          continue;
        }
      }

      if (!imagePath) {
        return res.status(400).json({ error: 'Invalid fixture ID' });
      }

      imageBuffer = await fs.readFile(imagePath);
    } else if (imageData) {
      // Process uploaded image (base64)
      if (!imageData.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Invalid image format. Must be base64 data URL.' });
      }

      const base64Data = imageData.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');

      // Validate image size (max 10MB)
      if (imageBuffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image too large. Maximum size is 10MB.' });
      }
    } else {
      return res.status(400).json({ error: 'Either fixtureId or imageData must be provided' });
    }

    // Create demo session record
    await db.query(`
      INSERT INTO demo_sessions (session_id, fixture_id, visitor_ip, user_agent)
      VALUES ($1, $2, $3, $4)
    `, [sessionId, fixtureId || null, visitorIp, userAgent]);

    // Process the fax
    const interpretation = await aiVisionInterpreter.interpretFax({
      imageData: imageBuffer,
      userId: `demo-${sessionId}`
    });

    // Generate the actual response using Gemini Agent (intelligent tool calling)
    const demoResponse = await generateDemoResponse(
      interpretation.extractedText || '',
      interpretation.visualAnnotations || []
    );

    // Generate PDF from the response using appropriate template
    let responsePdfUrl: string | undefined;
    try {
      let pdfBuffer: Buffer;

      // Find first successful tool call for template routing
      const successfulToolCall = demoResponse.toolCalls?.find(t => t.success);

      if (successfulToolCall) {
        // Route through ResponseGenerator for proper template selection
        const result = await ResponseGenerator.generateFromMcp(
          successfulToolCall.serverName,
          successfulToolCall.toolName,
          transformToolResultForTemplate(
            successfulToolCall.serverName,
            successfulToolCall.toolName,
            successfulToolCall.result,
            interpretation.extractedText || 'Demo Request',
            demoResponse.responseText
          ),
          sessionId
        );
        pdfBuffer = result.pdfBuffer;
      } else {
        // Fallback to GeneralInquiryFaxGenerator for clarifications/errors
        pdfBuffer = await GeneralInquiryFaxGenerator.generateInquiryFax({
          question: interpretation.extractedText || 'Demo Request',
          answer: demoResponse.responseText,
          relatedTopics: []
        }, sessionId);
      }

      // Convert to base64 data URL
      responsePdfUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
      loggingService.info('Generated demo response PDF', {
        sessionId,
        pdfSize: pdfBuffer.length,
        template: successfulToolCall?.serverName || 'general_inquiry'
      });
    } catch (pdfError) {
      loggingService.warn('Failed to generate demo response PDF', undefined, {
        error: (pdfError as Error).message,
        sessionId
      });
    }

    // Update demo session with result
    await db.query(`
      UPDATE demo_sessions
      SET processing_result = $1, completed_at = NOW()
      WHERE session_id = $2
    `, [JSON.stringify({ ...interpretation, demoResponse }), sessionId]);

    // Return processing result
    res.json({
      sessionId,
      status: 'completed',
      result: {
        faxId: sessionId,
        extractedText: interpretation.extractedText,
        annotations: interpretation.visualAnnotations?.map(ann => ({
          type: ann.type,
          boundingBox: ann.boundingBox,
          associatedText: ann.associatedText,
          confidence: ann.confidence,
          color: ann.color
        })) || [],
        intent: {
          primary: interpretation.intent,
          parameters: interpretation.parameters,
          confidence: interpretation.confidence
        },
        confidence: interpretation.confidence,
        processingTime: interpretation.processingTime,
        visualizationData: interpretation.visualizationData,
        textRegions: interpretation.textRegions,
        // The actual response that would be faxed back
        generatedResponse: {
          faxContent: demoResponse.responseText,
          actionTaken: demoResponse.actionTaken,
          responsePdfUrl
        }
      }
    });
  } catch (error) {
    loggingService.error('Demo processing failed', error as Error);
    res.status(500).json({
      error: 'Processing failed. Please try a different image.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/demo/result/:sessionId
 * Poll for processing result (for async processing if needed)
 */
router.get('/result/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const result = await db.query(`
      SELECT processing_result, completed_at
      FROM demo_sessions
      WHERE session_id = $1
    `, [sessionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = result.rows[0];

    if (!session.completed_at) {
      return res.json({
        sessionId,
        status: 'processing',
        progress: {
          stage: 'analyzing',
          percentage: 50
        }
      });
    }

    res.json({
      sessionId,
      status: 'completed',
      result: session.processing_result
    });
  } catch (error) {
    loggingService.error('Failed to fetch demo result', error as Error);
    res.status(500).json({ error: 'Failed to fetch result' });
  }
});

/**
 * Clear product cache (for testing)
 * POST /api/demo/clear-cache
 */
router.post('/clear-cache', async (req: Request, res: Response) => {
  try {
    const result = await productCacheService.clearAllCache();
    loggingService.info('Product cache cleared via API', result);
    res.json({
      success: true,
      cleared: result
    });
  } catch (error) {
    loggingService.error('Failed to clear cache', error as Error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export const demoController = router;
