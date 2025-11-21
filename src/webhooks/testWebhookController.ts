import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { TelnyxWebhookPayload } from './types';
import { webhookHandlerService } from '../services/webhookHandlerService';
import { auditLogService } from '../services/auditLogService';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept PDF and TIFF files
    const allowedMimes = [
      'application/pdf',
      'image/tiff',
      'image/tif',
      'image/png',
      'image/jpeg',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, TIFF, PNG, and JPEG files are allowed.'));
    }
  },
});

export class TestWebhookController {
  /**
   * Test endpoint for fax simulation
   * POST /test/fax/receive
   * Accepts file uploads and simulates Telnyx webhook
   */
  async handleTestFaxReceive(req: Request, res: Response): Promise<void> {
    try {
      // Use multer middleware to handle file upload
      upload.single('fax_file')(req, res, async (err) => {
        if (err) {
          console.error('File upload error:', err);
          res.status(400).json({ 
            error: 'File upload failed', 
            message: err.message 
          });
          return;
        }

        if (!req.file) {
          res.status(400).json({ 
            error: 'No file uploaded', 
            message: 'Please upload a fax file (PDF, TIFF, PNG, or JPEG)' 
          });
          return;
        }

        try {
          // Extract test parameters from request body
          const {
            from_number = '+1234567890',
            to_number = '+0987654321',
            test_user_phone = from_number,
          } = req.body;

          // Generate mock fax metadata
          const mockFaxId = `test_fax_${uuidv4()}`;
          const mockConnectionId = `test_connection_${uuidv4()}`;
          const currentTime = new Date().toISOString();

          // Create a temporary URL for the uploaded file
          // In a real implementation, this would be uploaded to S3 or similar
          const mockMediaUrl = `http://localhost:${process.env.PORT || 4000}/test/fax/media/${mockFaxId}`;

          // Store the file temporarily (in memory for this test implementation)
          // In production, you'd want to store this in a proper location
          (global as any).testFaxFiles = (global as any).testFaxFiles || new Map();
          ((global as any).testFaxFiles as Map<string, Buffer>).set(mockFaxId, req.file.buffer);

          // Create mock Telnyx webhook payload
          const mockPayload: TelnyxWebhookPayload = {
            data: {
              event_type: 'fax.received',
              id: uuidv4(),
              occurred_at: currentTime,
              payload: {
                fax_id: mockFaxId,
                connection_id: mockConnectionId,
                direction: 'inbound',
                from: from_number,
                to: to_number,
                media_url: mockMediaUrl,
                page_count: 1,
                status: 'received',
                // Additional test metadata
                test_mode: true,
                test_user_phone: test_user_phone,
                original_filename: req.file.originalname,
                file_size: req.file.size,
                mime_type: req.file.mimetype,
              },
            },
          };

          // Log the test fax receipt
          await auditLogService.logOperation({
            entityType: 'test_fax',
            entityId: mockFaxId,
            operation: 'test_fax_received',
            details: {
              fromNumber: from_number,
              toNumber: to_number,
              testUserPhone: test_user_phone,
              filename: req.file.originalname,
              fileSize: req.file.size,
              mimeType: req.file.mimetype,
            },
          });

          // Return success response immediately (like real Telnyx webhook)
          res.status(200).json({
            success: true,
            message: 'Test fax received and queued for processing',
            fax_id: mockFaxId,
            processing_url: `/test/fax/status/${mockFaxId}`,
          });

          // Process the webhook asynchronously (like real webhook handler)
          this.processTestWebhookAsync(mockPayload).catch((error) => {
            console.error('Error processing test webhook asynchronously:', error);
          });

        } catch (error) {
          console.error('Error processing test fax:', error);
          res.status(500).json({ 
            error: 'Internal server error', 
            message: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });

    } catch (error) {
      console.error('Error in test webhook handler:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Serve test fax media files
   * GET /test/fax/media/:fax_id
   */
  async serveTestFaxMedia(req: Request, res: Response): Promise<void> {
    try {
      const { fax_id } = req.params;
      
      // Retrieve file from temporary storage
      const testFaxFiles = (global as any).testFaxFiles as Map<string, Buffer>;
      if (!testFaxFiles || !testFaxFiles.has(fax_id)) {
        res.status(404).json({ error: 'Test fax file not found' });
        return;
      }

      const fileBuffer = testFaxFiles.get(fax_id)!;
      
      // Set appropriate headers
      res.setHeader('Content-Type', 'image/tiff');
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Send the file
      res.send(fileBuffer);

    } catch (error) {
      console.error('Error serving test fax media:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get test fax processing status
   * GET /test/fax/status/:fax_id
   */
  async getTestFaxStatus(req: Request, res: Response): Promise<void> {
    try {
      const { fax_id } = req.params;

      // Query audit logs to get processing status
      const logs = await auditLogService.queryLogs({
        faxJobId: fax_id,
        limit: 50,
      });

      // Find the most recent status
      let status = 'unknown';
      let processingSteps: any[] = [];
      let errorMessage: string | undefined;
      let responseReferenceId: string | undefined;

      for (const log of logs) {
        processingSteps.push({
          timestamp: log.createdAt,
          operation: log.eventType,
          details: log.eventData,
        });

        // Determine current status from operations
        switch (log.eventType) {
          case 'test_fax_received':
            status = 'received';
            break;
          case 'processing_start':
            status = 'processing';
            break;
          case 'processing_complete':
            status = 'completed';
            if (log.eventData && typeof log.eventData === 'object') {
              responseReferenceId = (log.eventData as any).responseReferenceId;
            }
            break;
          case 'processing_failed':
            status = 'failed';
            if (log.eventData && typeof log.eventData === 'object') {
              errorMessage = (log.eventData as any).error;
            }
            break;
        }
      }

      res.json({
        fax_id,
        status,
        processing_steps: processingSteps.reverse(), // Most recent first
        error_message: errorMessage,
        response_reference_id: responseReferenceId,
        last_updated: logs.length > 0 ? logs[0].createdAt : null,
      });

    } catch (error) {
      console.error('Error getting test fax status:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * List all test faxes
   * GET /test/fax/list
   */
  async listTestFaxes(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 20, offset = 0 } = req.query;

      // Query audit logs for test fax operations
      const logs = await auditLogService.queryLogs({
        eventType: 'test_fax_received',
        limit: Number(limit),
      });

      const testFaxes = logs.map(log => ({
        fax_id: log.faxJobId,
        timestamp: log.createdAt,
        details: log.eventData,
        status_url: `/test/fax/status/${log.faxJobId}`,
      }));

      res.json({
        test_faxes: testFaxes,
        total: testFaxes.length,
        limit: Number(limit),
        offset: Number(offset),
      });

    } catch (error) {
      console.error('Error listing test faxes:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Process test webhook asynchronously (bypasses Telnyx signature verification)
   */
  private async processTestWebhookAsync(payload: TelnyxWebhookPayload): Promise<void> {
    try {
      console.log('Processing test webhook asynchronously', {
        faxId: payload.data.payload.fax_id,
        testMode: true,
      });

      // Use the same webhook handler service but mark as test mode
      await webhookHandlerService.processInboundFax(payload);

    } catch (error) {
      console.error('Error in async test webhook processing:', error);
      
      // Log the error
      await auditLogService.logOperation({
        entityType: 'test_fax',
        entityId: payload.data.payload.fax_id,
        operation: 'test_processing_error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          payload: payload.data.payload,
        },
      });
    }
  }

  /**
   * Get mock sent faxes (response faxes)
   * GET /test/fax/responses
   */
  async getMockSentFaxes(req: Request, res: Response): Promise<void> {
    try {
      const { mockFaxSender } = await import('../services/mockFaxSender');
      const mockFaxes = mockFaxSender.getMockSentFaxes();

      res.json({
        mock_faxes: mockFaxes,
        total: mockFaxes.length,
      });

    } catch (error) {
      console.error('Error getting mock sent faxes:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Download mock fax file
   * GET /test/fax/download/:fax_id
   */
  async downloadMockFax(req: Request, res: Response): Promise<void> {
    try {
      const { fax_id } = req.params;
      const { format = 'tiff' } = req.query;

      const { mockFaxSender } = await import('../services/mockFaxSender');
      const mockFax = mockFaxSender.getMockFax(fax_id);

      if (!mockFax) {
        res.status(404).json({ error: 'Mock fax not found' });
        return;
      }

      // Set appropriate headers
      const contentType = format === 'pdf' ? 'application/pdf' : 'image/tiff';
      const extension = format === 'pdf' ? 'pdf' : 'tiff';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${mockFax.faxId}.${extension}"`);
      res.setHeader('Content-Length', mockFax.mediaBuffer.length);
      
      // Send the file
      res.send(mockFax.mediaBuffer);

    } catch (error) {
      console.error('Error downloading mock fax:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get mock fax sender statistics
   * GET /test/fax/stats
   */
  async getMockFaxStats(req: Request, res: Response): Promise<void> {
    try {
      const { mockFaxSender } = await import('../services/mockFaxSender');
      const stats = mockFaxSender.getStatistics();

      res.json(stats);

    } catch (error) {
      console.error('Error getting mock fax stats:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * List available test fixtures
   * GET /test/fax/fixtures
   */
  async listTestFixtures(req: Request, res: Response): Promise<void> {
    try {
      const { testFaxFixtureGenerator } = await import('../test/fixtures/createTestFaxes');
      const fixtures = testFaxFixtureGenerator.listFixtures();

      res.json({
        fixtures: fixtures.map(filename => ({
          filename,
          url: `/test/fax/fixtures/${filename}`,
        })),
        total: fixtures.length,
      });

    } catch (error) {
      console.error('Error listing test fixtures:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Serve test fixture file
   * GET /test/fax/fixtures/:filename
   */
  async serveTestFixture(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      
      const { testFaxFixtureGenerator } = await import('../test/fixtures/createTestFaxes');
      const fileBuffer = testFaxFixtureGenerator.getFixture(filename);

      if (!fileBuffer) {
        res.status(404).json({ error: 'Test fixture not found' });
        return;
      }

      // Determine content type
      let contentType = 'application/octet-stream';
      if (filename.endsWith('.png')) {
        contentType = 'image/png';
      } else if (filename.endsWith('.tiff') || filename.endsWith('.tif')) {
        contentType = 'image/tiff';
      } else if (filename.endsWith('.pdf')) {
        contentType = 'application/pdf';
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      res.send(fileBuffer);

    } catch (error) {
      console.error('Error serving test fixture:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generate test fixtures
   * POST /test/fax/fixtures/generate
   */
  async generateTestFixtures(req: Request, res: Response): Promise<void> {
    try {
      const { testFaxFixtureGenerator } = await import('../test/fixtures/createTestFaxes');
      const fixtures = testFaxFixtureGenerator.generateAllFixtures();

      res.json({
        success: true,
        message: `Generated ${fixtures.length} test fixtures`,
        fixtures: fixtures.map(f => ({
          filename: f.filename,
          description: f.description,
          scenario: f.scenario,
          expectedIntent: f.expectedIntent,
          url: `/test/fax/fixtures/${f.filename}`,
        })),
      });

    } catch (error) {
      console.error('Error generating test fixtures:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clear test data (for cleanup)
   * DELETE /test/fax/clear
   */
  async clearTestData(req: Request, res: Response): Promise<void> {
    try {
      // Clear temporary file storage
      if ((global as any).testFaxFiles) {
        (global as any).testFaxFiles.clear();
      }

      // Clear test fax storage
      if ((global as any).testResponseFaxes) {
        (global as any).testResponseFaxes.clear();
      }

      // Clear mock fax sender data
      const { mockFaxSender } = await import('../services/mockFaxSender');
      mockFaxSender.clearMockFaxes();

      res.json({
        success: true,
        message: 'Test data cleared successfully',
      });

    } catch (error) {
      console.error('Error clearing test data:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const testWebhookController = new TestWebhookController();