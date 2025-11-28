import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../database/connection';
import { aiVisionInterpreter } from '../services/aiVisionInterpreter';
import { faxJobRepository } from '../repositories/faxJobRepository';
import { loggingService } from '../services/loggingService';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// Rate limiting map (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Rate limit middleware (100 requests per 15 minutes in dev, 10 in prod)
function rateLimitMiddleware(req: Request, res: Response, next: Function) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = process.env.NODE_ENV === 'production' ? 10 : 100;

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
    await pool.query(`
      INSERT INTO demo_sessions (session_id, fixture_id, visitor_ip, user_agent)
      VALUES ($1, $2, $3, $4)
    `, [sessionId, fixtureId || null, visitorIp, userAgent]);

    // Process the fax
    const interpretation = await aiVisionInterpreter.interpretFax({
      imageData: imageBuffer,
      userId: `demo-${sessionId}`
    });

    // Update demo session with result
    await pool.query(`
      UPDATE demo_sessions
      SET processing_result = $1, completed_at = NOW()
      WHERE session_id = $2
    `, [JSON.stringify(interpretation), sessionId]);

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
        textRegions: interpretation.textRegions
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

    const result = await pool.query(`
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

export const demoController = router;
