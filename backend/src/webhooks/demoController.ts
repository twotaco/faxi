import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection';
import { FaxProcessingPipeline } from '../services/faxProcessingPipeline';
import { loggingService } from '../services/loggingService';
import { config } from '../config';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { FaxJobData } from '../queue/faxQueue';

// Demo user UUID from migration 014_add_demo_user.sql
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

// Create a single pipeline instance for demo processing
const demoProcessingPipeline = new FaxProcessingPipeline();

const router = Router();

// Rate limiting map (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Rate limit middleware
function rateLimitMiddleware(req: Request, res: Response, next: Function) {
  // Skip rate limiting for static fixture assets
  if (req.path.includes('/fixtures') || req.path.includes('/fixture-image')) {
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 30;

  const clientData = rateLimitMap.get(ip);

  if (!clientData || now > clientData.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    next();
  } else if (clientData.count < maxRequests) {
    clientData.count++;
    next();
  } else {
    res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  }
}

router.use(rateLimitMiddleware);

/**
 * GET /api/demo/fixtures
 * List available test fixtures
 */
router.get('/fixtures', async (req: Request, res: Response) => {
  try {
    const fixturesPath = path.join(__dirname, '../../src/test/fixtures/fax-images');

    try {
      await fs.access(fixturesPath);
    } catch {
      return res.json({ fixtures: [] });
    }

    const files = await fs.readdir(fixturesPath);
    const imageFiles = files.filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));

    const fixtures = imageFiles.map(filename => {
      const id = filename.replace(/\.(png|jpg|jpeg)$/i, '');
      const name = id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

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
 * Process a fax image using the REAL fax processing pipeline.
 * Only bypasses Telnyx receive/send - uses same code path as production.
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { fixtureId, imageData } = req.body;
    const sessionId = uuidv4();
    const visitorIp = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    loggingService.info('Demo process request received', {
      sessionId,
      hasFixtureId: !!fixtureId,
      hasImageData: !!imageData,
      imageDataLength: imageData?.length || 0
    });

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
      const isValidFormat = imageData.startsWith('data:image/') || imageData.startsWith('data:application/pdf');
      if (!isValidFormat) {
        return res.status(400).json({ error: 'Invalid format. Must be an image or PDF.' });
      }

      const base64Data = imageData.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');

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

    // Create fake FaxJobData for the pipeline
    const faxData: FaxJobData = {
      faxId: `demo-${sessionId}`,
      faxJobId: sessionId,
      fromNumber: '+15551234567', // Demo phone number
      toNumber: config.telnyx.faxNumber || '+15559876543',
      mediaUrl: 'demo://local-image', // Placeholder - we pass buffer directly
      pageCount: 1,
      receivedAt: new Date().toISOString(),
      webhookPayload: { isDemo: true, sessionId }
    };

    // Process using the REAL fax processing pipeline
    // Only difference: we pass imageBuffer directly and skipFaxSend=true
    const pipelineResult = await demoProcessingPipeline.processFax(faxData, {
      imageBuffer,
      skipFaxSend: true, // Don't send via Telnyx
      userId: DEMO_USER_ID // Use demo user
    });

    // Update demo session with result
    await db.query(`
      UPDATE demo_sessions
      SET processing_result = $1, completed_at = NOW()
      WHERE session_id = $2
    `, [JSON.stringify(pipelineResult), sessionId]);

    // Convert response PDF to base64 if available
    let responsePdfUrl: string | undefined;
    if (pipelineResult.responsePdfBuffer) {
      responsePdfUrl = `data:application/pdf;base64,${pipelineResult.responsePdfBuffer.toString('base64')}`;
    }

    // Return processing result
    res.json({
      sessionId,
      status: pipelineResult.success ? 'completed' : 'failed',
      result: {
        faxId: sessionId,
        extractedText: pipelineResult.interpretation?.extractedText,
        annotations: pipelineResult.interpretation?.visualAnnotations?.map(ann => ({
          type: ann.type,
          boundingBox: ann.boundingBox,
          associatedText: ann.associatedText,
          confidence: ann.confidence,
          color: ann.color
        })) || [],
        intent: {
          primary: pipelineResult.interpretation?.intent,
          parameters: pipelineResult.interpretation?.parameters,
          confidence: pipelineResult.interpretation?.confidence
        },
        confidence: pipelineResult.interpretation?.confidence,
        processingTime: pipelineResult.interpretation?.processingTime,
        visualizationData: pipelineResult.interpretation?.visualizationData,
        textRegions: pipelineResult.interpretation?.textRegions,
        generatedResponse: {
          faxContent: pipelineResult.agentResponse?.userMessage || 'Processing complete',
          actionTaken: pipelineResult.agentResponse?.responseType || 'processed',
          responsePdfUrl,
          // Include agent steps for debugging
          steps: pipelineResult.agentResponse?.steps?.map(step => ({
            toolName: step.toolName,
            toolServer: step.toolServer,
            success: step.success,
            output: step.output,
            error: step.error
          }))
        }
      },
      error: pipelineResult.errorMessage
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
 * Poll for processing result
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
        progress: { stage: 'analyzing', percentage: 50 }
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

export const demoController = router;
