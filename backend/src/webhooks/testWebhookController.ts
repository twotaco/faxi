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
    const allowedMimes = [
      'application/pdf',
      'image/tif',
      'image/png',
      'image/jpeg',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, PNG, and JPEG files are allowed.'));
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
            message: 'Please upload a fax file (PDF, PNG, or JPEG)' 
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
          const mockMediaUrl = `http://localhost:${process.env.PORT || 3000}/test/fax/media/${mockFaxId}`;

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

          // In TEST_MODE, process synchronously before responding
          // Otherwise, process asynchronously like real webhook handler
          console.log('[Test Fax Receive] TEST_MODE:', process.env.TEST_MODE, 'Will process:', process.env.TEST_MODE === 'true');
          if (process.env.TEST_MODE === 'true') {
            console.log('[Test Fax Receive] Processing test fax synchronously');
            try {
              await this.processTestWebhookAsync(mockPayload);
              
              res.status(200).json({
                success: true,
                message: 'Test fax received and processed',
                fax_id: mockFaxId,
                processing_url: `/test/fax/status/${mockFaxId}`,
              });
            } catch (error) {
              console.error('Error processing test fax synchronously:', error);
              res.status(500).json({
                error: 'Processing failed',
                message: error instanceof Error ? error.message : 'Unknown error',
                fax_id: mockFaxId,
              });
            }
          } else {
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
          }

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

      // Set appropriate headers (default to PDF for fax files)
      res.setHeader('Content-Type', 'application/pdf');
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

      // Query audit logs using entityId in event_data since test faxes log with entityId
      // Also join with fax_jobs to get logs by faxId
      const { db } = await import('../database/connection');
      const result = await db.query(
        `SELECT al.id, al.user_id, al.fax_job_id, al.event_type, al.event_data, al.created_at
         FROM audit_logs al
         LEFT JOIN fax_jobs fj ON al.fax_job_id = fj.id
         WHERE (al.event_data->>'entityId')::text = $1 
            OR al.fax_job_id::text = $1
            OR fj.fax_id = $1
         ORDER BY al.created_at DESC
         LIMIT 50`,
        [fax_id]
      );

      const logs = result.rows;
      console.log(`[Test Status] Found ${logs.length} audit logs for fax_id: ${fax_id}`);
      console.log(`[Test Status] Event types:`, logs.map(l => l.event_type));

      // Find the most recent status
      let status = 'unknown';
      let processingSteps: any[] = [];
      let errorMessage: string | undefined;
      let responseReferenceId: string | undefined;

      for (const log of logs) {
        processingSteps.push({
          timestamp: log.created_at,
          operation: log.event_type,
          details: log.event_data,
        });

        // Determine current status from operations (processing in DESC order, so first match wins)
        // Only update status if we haven't found a terminal status yet
        if (status === 'unknown' || status === 'received' || status === 'processing') {
          switch (log.event_type) {
            case 'test_fax.test_fax_received':
              if (status === 'unknown') {
                status = 'received';
              }
              break;
            case 'fax_job.processing_start':
              if (status === 'unknown' || status === 'received') {
                status = 'processing';
              }
              break;
            case 'fax_job.processing_complete':
              status = 'completed';
              if (log.event_data && typeof log.event_data === 'object') {
                responseReferenceId = log.event_data.responseReferenceId;
                if (log.event_data.success === false) {
                  status = 'failed';
                  errorMessage = log.event_data.errorMessage;
                }
              }
              break;
            case 'fax_job.processing_failed':
              status = 'failed';
              if (log.event_data && typeof log.event_data === 'object') {
                errorMessage = log.event_data.error || log.event_data.errorMessage;
              }
              break;
          }
        }
      }

      res.json({
        fax_id,
        status,
        processing_steps: processingSteps, // Already in DESC order (most recent first)
        error_message: errorMessage,
        response_reference_id: responseReferenceId,
        last_updated: logs.length > 0 ? logs[0].created_at : null,
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

      // In test mode, process synchronously without queue
      if (process.env.TEST_MODE === 'true') {
        await this.processTestFaxDirectly(payload);
      } else {
        // Use the same webhook handler service but mark as test mode
        await webhookHandlerService.processInboundFax(payload);
      }

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
   * Process test fax directly without queue (for testing)
   * Ensures all processing steps execute in sequence with comprehensive error handling
   */
  private async processTestFaxDirectly(payload: TelnyxWebhookPayload): Promise<void> {
    const { fax_id, from, to, page_count } = payload.data.payload;
    let faxJobId: string | undefined;

    try {
      // Step 1: Import all required services
      console.log(`[Test Processing] Starting direct processing for fax ${fax_id}`);
      const { userRepository } = await import('../repositories/userRepository');
      const { faxJobRepository } = await import('../repositories/faxJobRepository');
      const { s3Storage } = await import('../storage/s3');
      const { aiVisionInterpreter } = await import('../services/aiVisionInterpreter');
      const { ResponseGenerator } = await import('../services/responseGenerator');
      const { mockFaxSender } = await import('../services/mockFaxSender');

      // Step 2: Find or create user
      console.log(`[Test Processing] Finding/creating user for ${from}`);
      const { user } = await userRepository.findOrCreate(from);
      
      await auditLogService.logOperation({
        entityType: 'fax_job',
        entityId: fax_id,
        operation: 'user_lookup',
        details: {
          fromNumber: from,
          userId: user.id,
        },
      });

      // Step 3: Create fax job
      console.log(`[Test Processing] Creating fax job for ${fax_id}`);
      const faxJob = await faxJobRepository.create({
        faxId: fax_id,
        userId: user.id,
        direction: 'inbound',
        fromNumber: from,
        toNumber: to,
        status: 'pending',
        pageCount: page_count,
        webhookPayload: payload,
      });
      faxJobId = faxJob.id;

      await auditLogService.logOperation({
        entityType: 'fax_job',
        entityId: faxJob.id,
        operation: 'job_created',
        details: {
          faxId: fax_id,
          userId: user.id,
          status: 'pending',
        },
      });

      // Step 4: Get fax image from temporary storage
      console.log(`[Test Processing] Retrieving fax image from temporary storage`);
      const testFaxFiles = (global as any).testFaxFiles as Map<string, Buffer>;
      const faxImageBuffer = testFaxFiles?.get(fax_id);

      if (!faxImageBuffer) {
        throw new Error('Test fax image not found in temporary storage');
      }

      await auditLogService.logOperation({
        entityType: 'fax_job',
        entityId: faxJob.id,
        operation: 'image_retrieved',
        details: {
          bufferSize: faxImageBuffer.length,
        },
      });

      // Step 5: Upload to S3
      console.log(`[Test Processing] Uploading to S3`);
      const storageKey = s3Storage.generateFaxKey(fax_id);
      await s3Storage.uploadFile(storageKey, faxImageBuffer, 'application/pdf');
      await faxJobRepository.update(faxJob.id, { storageKey });

      await auditLogService.logOperation({
        entityType: 'fax_job',
        entityId: faxJob.id,
        operation: 's3_upload_complete',
        details: {
          storageKey,
        },
      });

      // Step 6: Update status to processing and log start
      console.log(`[Test Processing] Starting AI interpretation`);
      await faxJobRepository.update(faxJob.id, { status: 'processing' });

      await auditLogService.logOperation({
        entityType: 'fax_job',
        entityId: faxJob.id,
        operation: 'processing_start',
        details: {
          faxId: fax_id,
          userId: user.id,
        },
      });

      // Step 7: Interpret fax with AI
      const interpretation = await aiVisionInterpreter.interpretFax({
        imageData: faxImageBuffer,
        userId: user.id,
      });

      await auditLogService.logOperation({
        entityType: 'fax_job',
        entityId: faxJob.id,
        operation: 'ai_interpretation_complete',
        details: {
          intent: interpretation.intent,
          confidence: interpretation.confidence,
          requiresClarification: interpretation.requiresClarification,
        },
      });

      // Step 8: Process with MCP Controller Agent
      console.log(`[Test Processing] Processing with MCP Controller Agent`);
      const { mcpControllerAgent } = await import('../services/mcpControllerAgent');
      const agentResponse = await mcpControllerAgent.processRequest({
        interpretation,
        userId: user.id,
        faxJobId: faxJob.id,
        conversationContext: interpretation.context,
      });

      console.log(`[Test Processing] Agent response received`, {
        success: agentResponse.success,
        responseType: agentResponse.responseType,
        hasFaxTemplate: !!agentResponse.faxTemplate,
        userMessage: agentResponse.userMessage,
        stepsExecuted: agentResponse.steps.length,
      });
      
      if (agentResponse.steps.length > 0) {
        console.log(`[Test Processing] Agent steps:`, agentResponse.steps.map(s => ({
          tool: `${s.toolServer}.${s.toolName}`,
          success: s.success,
          error: s.error
        })));
      }

      // Step 9: Generate response fax from agent response
      console.log(`[Test Processing] Generating response fax`);
      
      // If agent failed or faxTemplate is missing, create a generic error response
      if (!agentResponse.success || !agentResponse.faxTemplate) {
        console.log(`[Test Processing] Agent processing failed, generating error response`);
        const responseResult = await ResponseGenerator.generateResponse({
          type: 'confirmation',
          data: {
            type: 'general',
            actionType: interpretation.intent,
            description: `Error processing your ${interpretation.intent} request`,
            result: 'Failed',
            nextSteps: [agentResponse.userMessage || 'Please try again or contact support.']
          }
        });
        
        // Log response generation
        await auditLogService.logOperation({
          entityType: 'fax_job',
          entityId: faxJob.id,
          operation: 'response_generated',
          details: {
            referenceId: responseResult.referenceId,
            pdfSize: responseResult.pdfBuffer.length,
            isErrorResponse: true,
          },
        });

        // Send error response and mark job as failed
        const sendResult = await mockFaxSender.sendFax({
          toNumber: from,
          fromNumber: to,
          mediaUrl: `test://mock-media-url/${responseResult.referenceId}`,
          referenceId: responseResult.referenceId,
          mediaBuffer: responseResult.pdfBuffer,
          userId: user.id,
          faxJobId: faxJob.id,
        });
        
        // Log response sent
        await auditLogService.logOperation({
          entityType: 'fax_job',
          entityId: faxJob.id,
          operation: 'response_sent',
          details: {
            responseFaxId: sendResult.faxId,
            deliveryStatus: sendResult.deliveryStatus,
            isErrorResponse: true,
          },
        });
        
        // Update job status to failed
        await faxJobRepository.update(faxJob.id, {
          status: 'failed',
          errorMessage: agentResponse.userMessage || 'Agent processing failed',
          actionResults: {
            responseReferenceId: responseResult.referenceId,
            responseFaxId: sendResult.faxId,
          },
        });
        
        // Log processing complete (even though it failed, we still completed the workflow)
        console.log('[Test Processing] Logging processing complete (with failure) to audit logs');
        await auditLogService.logOperation({
          entityType: 'fax_job',
          entityId: faxJob.id,
          operation: 'processing_complete',
          details: {
            success: false,
            responseReferenceId: responseResult.referenceId,
            responseFaxId: sendResult.faxId,
            agentResponse,
            interpretation: {
              intent: interpretation.intent,
              confidence: interpretation.confidence,
            },
            errorMessage: agentResponse.userMessage || 'Agent processing failed',
          },
        });
        
        console.log('[Test Processing] ✅ Processing complete audit log saved (with failure)');
        console.log('[Test Processing] Test fax processed with errors', {
          faxJobId: faxJob.id,
          faxId: fax_id,
          responseReferenceId: responseResult.referenceId,
          responseFaxId: sendResult.faxId,
          error: agentResponse.userMessage,
        });
        
        return;
      }
      
      const responseResult = await ResponseGenerator.generateResponse({
        type: agentResponse.faxTemplate.type,
        data: agentResponse.faxTemplate.contextData,
      });

      await auditLogService.logOperation({
        entityType: 'fax_job',
        entityId: faxJob.id,
        operation: 'response_generated',
        details: {
          referenceId: responseResult.referenceId,
          pdfSize: responseResult.pdfBuffer.length,
        },
      });

      // Step 10: Send response fax
      console.log(`[Test Processing] Sending response fax`);
      const sendResult = await mockFaxSender.sendFax({
        toNumber: from,
        fromNumber: to,
        mediaUrl: `test://mock-media-url/${responseResult.referenceId}`,
        referenceId: responseResult.referenceId,
        mediaBuffer: responseResult.pdfBuffer,
        userId: user.id,
        faxJobId: faxJob.id,
      });

      if (!sendResult.success) {
        throw new Error(`Failed to send response fax: ${sendResult.errorMessage || 'Unknown error'}`);
      }

      await auditLogService.logOperation({
        entityType: 'fax_job',
        entityId: faxJob.id,
        operation: 'response_sent',
        details: {
          responseFaxId: sendResult.faxId,
          deliveryStatus: sendResult.deliveryStatus,
        },
      });

      // Step 11: Update job with results and mark as completed
      console.log(`[Test Processing] Marking job as completed`);
      await faxJobRepository.update(faxJob.id, {
        status: 'completed',
        actionResults: {
          responseReferenceId: responseResult.referenceId,
          responseFaxId: sendResult.faxId,
        },
      });

      // Step 12: Log processing complete
      console.log('[Test Processing] Logging processing complete to audit logs');
      await auditLogService.logOperation({
        entityType: 'fax_job',
        entityId: faxJob.id,
        operation: 'processing_complete',
        details: {
          success: true,
          responseReferenceId: responseResult.referenceId,
          responseFaxId: sendResult.faxId,
          agentResponse,
          interpretation: {
            intent: interpretation.intent,
            confidence: interpretation.confidence,
          },
        },
      });
      
      console.log('[Test Processing] ✅ Processing complete audit log saved');

      console.log('[Test Processing] Test fax processed successfully', {
        faxJobId: faxJob.id,
        faxId: fax_id,
        responseReferenceId: responseResult.referenceId,
        responseFaxId: sendResult.faxId,
      });

    } catch (error) {
      console.error('[Test Processing] Error processing test fax directly:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Comprehensive error handling: update job status and log failure
      try {
        if (faxJobId) {
          // We have a job ID, update it
          const { faxJobRepository } = await import('../repositories/faxJobRepository');
          
          await faxJobRepository.update(faxJobId, {
            status: 'failed',
            errorMessage,
          });

          await auditLogService.logOperation({
            entityType: 'fax_job',
            entityId: faxJobId,
            operation: 'processing_failed',
            details: {
              success: false,
              error: errorMessage,
              errorStack,
            },
          });

          console.log('[Test Processing] Job status updated to failed', { faxJobId, errorMessage });
        } else {
          // No job ID yet, try to find by fax_id
          const { faxJobRepository } = await import('../repositories/faxJobRepository');
          const job = await faxJobRepository.findByFaxId(fax_id);
          
          if (job) {
            await faxJobRepository.update(job.id, {
              status: 'failed',
              errorMessage,
            });

            await auditLogService.logOperation({
              entityType: 'fax_job',
              entityId: job.id,
              operation: 'processing_failed',
              details: {
                success: false,
                error: errorMessage,
                errorStack,
              },
            });

            console.log('[Test Processing] Job status updated to failed', { faxJobId: job.id, errorMessage });
          } else {
            // No job found, log to audit with fax_id
            await auditLogService.logOperation({
              entityType: 'test_fax',
              entityId: fax_id,
              operation: 'processing_failed',
              details: {
                success: false,
                error: errorMessage,
                errorStack,
                note: 'Failed before job creation',
              },
            });

            console.log('[Test Processing] Logged failure without job ID', { faxId: fax_id, errorMessage });
          }
        }
      } catch (updateError) {
        console.error('[Test Processing] Failed to update job status or log error:', updateError);
        
        // Last resort: log to audit with whatever info we have
        try {
          await auditLogService.logOperation({
            entityType: 'test_fax',
            entityId: fax_id,
            operation: 'processing_failed_critical',
            details: {
              originalError: errorMessage,
              updateError: updateError instanceof Error ? updateError.message : 'Unknown error',
            },
          });
        } catch (finalError) {
          console.error('[Test Processing] Critical: Could not log error to audit:', finalError);
        }
      }

      // Re-throw the error so caller knows processing failed
      throw error;
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
      const { format = 'pdf' } = req.query;

      const { mockFaxSender } = await import('../services/mockFaxSender');
      const mockFax = mockFaxSender.getMockFax(fax_id);

      if (!mockFax) {
        res.status(404).json({ error: 'Mock fax not found' });
        return;
      }

      // Set appropriate headers (PDF is the default fax format)
      const contentType = 'application/pdf';
      const extension = 'pdf';

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
      } else if (filename.endsWith('.pdf')) {
        contentType = 'application/pdf';
      } else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
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