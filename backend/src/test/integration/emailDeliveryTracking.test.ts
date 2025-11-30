import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { userRepository } from '../../repositories/userRepository';
import { emailThreadRepository, emailMessageRepository } from '../../repositories/emailThreadRepository';
import { db } from '../../database/connection';
import { awsSesService } from '../../services/awsSesService';

let app: Express;

/**
 * Integration Test: Email Delivery Tracking
 * 
 * Tests the complete flow: Email send → Delivery notification → Status update
 * and Email send → Bounce notification → Error fax
 * 
 * Requirements: 10.1-10.7
 */
describe('Email Delivery Tracking Integration Tests', () => {
  beforeEach(async () => {
    // Initialize test app
    const { createTestApp } = await import('../testApp');
    app = await createTestApp();
    
    // Mock AWS SES
    vi.spyOn(awsSesService, 'sendEmail').mockResolvedValue({
      messageId: `test-msg-${Date.now()}`
    });
  });

  afterEach(async () => {
    // Clean up test data
    await request(app).delete('/test/fax/clear');
    vi.restoreAllMocks();
  });

  describe('Delivery Status Tracking', () => {
    it('should update status to delivered on delivery notification', async () => {
      const testPhoneNumber = '+1555333000';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const recipientEmail = 'delivered@example.com';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Store an outbound email message
      const threadId = `thread_${Date.now()}`;
      await emailThreadRepository.create({
        userId: user.id,
        threadId,
        subject: 'Delivery Test',
        participants: [userEmail, recipientEmail],
        lastMessageAt: new Date()
      });

      const messageId = `msg_${Date.now()}`;
      await emailMessageRepository.create({
        threadId,
        messageId,
        fromAddress: userEmail,
        toAddresses: [recipientEmail],
        subject: 'Delivery Test',
        body: 'Testing delivery tracking',
        direction: 'outbound',
        sentAt: new Date()
      });

      // Simulate AWS SES delivery notification
      const deliveryNotification = {
        Type: 'Notification',
        MessageId: 'delivery-notification-123',
        Message: JSON.stringify({
          notificationType: 'Delivery',
          mail: {
            timestamp: new Date().toISOString(),
            source: userEmail,
            destination: [recipientEmail],
            messageId: messageId
          },
          delivery: {
            timestamp: new Date().toISOString(),
            processingTimeMillis: 1234,
            recipients: [recipientEmail],
            smtpResponse: '250 2.0.0 OK'
          }
        })
      };

      // Send delivery notification
      const webhookResponse = await request(app)
        .post('/webhooks/email/sns')
        .send(deliveryNotification);

      expect(webhookResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Requirement 10.4: Status should be updated to 'delivered'
      const result = await db.query(
        'SELECT delivery_status, delivery_timestamp FROM email_messages WHERE message_id = $1',
        [messageId]
      );

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].delivery_status).toBe('delivered');
      expect(result.rows[0].delivery_timestamp).toBeDefined();
    });

    it('should update status to bounced on bounce notification', async () => {
      const testPhoneNumber = '+1555333001';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const recipientEmail = 'bounced@example.com';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Store an outbound email message
      const threadId = `thread_${Date.now()}`;
      await emailThreadRepository.create({
        userId: user.id,
        threadId,
        subject: 'Bounce Test',
        participants: [userEmail, recipientEmail],
        lastMessageAt: new Date()
      });

      const messageId = `msg_${Date.now()}`;
      await emailMessageRepository.create({
        threadId,
        messageId,
        fromAddress: userEmail,
        toAddresses: [recipientEmail],
        subject: 'Bounce Test',
        body: 'Testing bounce tracking',
        direction: 'outbound',
        sentAt: new Date()
      });

      // Simulate AWS SES bounce notification
      const bounceNotification = {
        Type: 'Notification',
        MessageId: 'bounce-notification-123',
        Message: JSON.stringify({
          notificationType: 'Bounce',
          mail: {
            timestamp: new Date().toISOString(),
            source: userEmail,
            destination: [recipientEmail],
            messageId: messageId
          },
          bounce: {
            bounceType: 'Permanent',
            bounceSubType: 'General',
            bouncedRecipients: [
              {
                emailAddress: recipientEmail,
                status: '5.1.1',
                diagnosticCode: 'smtp; 550 5.1.1 user unknown'
              }
            ],
            timestamp: new Date().toISOString(),
            feedbackId: 'bounce-feedback-123'
          }
        })
      };

      // Send bounce notification
      const webhookResponse = await request(app)
        .post('/webhooks/email/sns')
        .send(bounceNotification);

      expect(webhookResponse.status).toBe(200);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Requirement 10.5: Status should be updated to 'bounced'
      const result = await db.query(
        'SELECT delivery_status, delivery_details FROM email_messages WHERE message_id = $1',
        [messageId]
      );

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].delivery_status).toBe('bounced');
      expect(result.rows[0].delivery_details).toBeDefined();
    });

    it('should generate error fax on bounce', async () => {
      const testPhoneNumber = '+1555333002';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const recipientEmail = 'error@example.com';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Store an outbound email message
      const threadId = `thread_${Date.now()}`;
      await emailThreadRepository.create({
        userId: user.id,
        threadId,
        subject: 'Error Fax Test',
        participants: [userEmail, recipientEmail],
        lastMessageAt: new Date()
      });

      const messageId = `msg_${Date.now()}`;
      await emailMessageRepository.create({
        threadId,
        messageId,
        fromAddress: userEmail,
        toAddresses: [recipientEmail],
        subject: 'Error Fax Test',
        body: 'Testing error fax generation',
        direction: 'outbound',
        sentAt: new Date()
      });

      // Simulate bounce notification
      const bounceNotification = {
        Type: 'Notification',
        MessageId: 'error-notification-123',
        Message: JSON.stringify({
          notificationType: 'Bounce',
          mail: {
            timestamp: new Date().toISOString(),
            source: userEmail,
            destination: [recipientEmail],
            messageId: messageId
          },
          bounce: {
            bounceType: 'Permanent',
            bounceSubType: 'General',
            bouncedRecipients: [{ emailAddress: recipientEmail }],
            timestamp: new Date().toISOString()
          }
        })
      };

      await request(app).post('/webhooks/email/sns').send(bounceNotification);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Requirement 10.6: Error notification fax should be generated
      const faxListResponse = await request(app).get('/test/fax/list');
      const faxJobs = faxListResponse.body.test_faxes;
      
      const errorFax = faxJobs.find((fax: any) => 
        fax.details?.type === 'error' && fax.to_number === testPhoneNumber
      );
      
      expect(errorFax).toBeDefined();
    });

    it('should handle complaint notifications', async () => {
      const testPhoneNumber = '+1555333003';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const recipientEmail = 'complaint@example.com';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Store an outbound email message
      const threadId = `thread_${Date.now()}`;
      await emailThreadRepository.create({
        userId: user.id,
        threadId,
        subject: 'Complaint Test',
        participants: [userEmail, recipientEmail],
        lastMessageAt: new Date()
      });

      const messageId = `msg_${Date.now()}`;
      await emailMessageRepository.create({
        threadId,
        messageId,
        fromAddress: userEmail,
        toAddresses: [recipientEmail],
        subject: 'Complaint Test',
        body: 'Testing complaint tracking',
        direction: 'outbound',
        sentAt: new Date()
      });

      // Simulate complaint notification
      const complaintNotification = {
        Type: 'Notification',
        MessageId: 'complaint-notification-123',
        Message: JSON.stringify({
          notificationType: 'Complaint',
          mail: {
            timestamp: new Date().toISOString(),
            source: userEmail,
            destination: [recipientEmail],
            messageId: messageId
          },
          complaint: {
            complainedRecipients: [{ emailAddress: recipientEmail }],
            timestamp: new Date().toISOString(),
            feedbackId: 'complaint-feedback-123',
            complaintFeedbackType: 'abuse'
          }
        })
      };

      await request(app).post('/webhooks/email/sns').send(complaintNotification);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Status should be updated to 'complained'
      const result = await db.query(
        'SELECT delivery_status FROM email_messages WHERE message_id = $1',
        [messageId]
      );

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].delivery_status).toBe('complained');
    });
  });

  describe('Delivery Event Logging', () => {
    it('should log delivery events in audit log', async () => {
      const testPhoneNumber = '+1555333004';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const recipientEmail = 'audit@example.com';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Store an outbound email message
      const threadId = `thread_${Date.now()}`;
      await emailThreadRepository.create({
        userId: user.id,
        threadId,
        subject: 'Audit Test',
        participants: [userEmail, recipientEmail],
        lastMessageAt: new Date()
      });

      const messageId = `msg_${Date.now()}`;
      await emailMessageRepository.create({
        threadId,
        messageId,
        fromAddress: userEmail,
        toAddresses: [recipientEmail],
        subject: 'Audit Test',
        body: 'Testing audit logging',
        direction: 'outbound',
        sentAt: new Date()
      });

      // Send delivery notification
      const deliveryNotification = {
        Type: 'Notification',
        MessageId: 'audit-notification-123',
        Message: JSON.stringify({
          notificationType: 'Delivery',
          mail: {
            timestamp: new Date().toISOString(),
            source: userEmail,
            destination: [recipientEmail],
            messageId: messageId
          },
          delivery: {
            timestamp: new Date().toISOString(),
            recipients: [recipientEmail]
          }
        })
      };

      await request(app).post('/webhooks/email/sns').send(deliveryNotification);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Requirement 10.7: Delivery event should be logged in audit log
      const auditResult = await db.query(
        `SELECT * FROM audit_logs 
         WHERE user_id = $1 
         AND event_type LIKE '%delivery%' 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [user.id]
      );

      expect(auditResult.rows.length).toBeGreaterThan(0);
      expect(auditResult.rows[0].event_type).toContain('delivery');
    });

    it('should log bounce events in audit log', async () => {
      const testPhoneNumber = '+1555333005';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const recipientEmail = 'bounce-audit@example.com';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Store an outbound email message
      const threadId = `thread_${Date.now()}`;
      await emailThreadRepository.create({
        userId: user.id,
        threadId,
        subject: 'Bounce Audit Test',
        participants: [userEmail, recipientEmail],
        lastMessageAt: new Date()
      });

      const messageId = `msg_${Date.now()}`;
      await emailMessageRepository.create({
        threadId,
        messageId,
        fromAddress: userEmail,
        toAddresses: [recipientEmail],
        subject: 'Bounce Audit Test',
        body: 'Testing bounce audit logging',
        direction: 'outbound',
        sentAt: new Date()
      });

      // Send bounce notification
      const bounceNotification = {
        Type: 'Notification',
        MessageId: 'bounce-audit-notification-123',
        Message: JSON.stringify({
          notificationType: 'Bounce',
          mail: {
            timestamp: new Date().toISOString(),
            source: userEmail,
            destination: [recipientEmail],
            messageId: messageId
          },
          bounce: {
            bounceType: 'Permanent',
            bouncedRecipients: [{ emailAddress: recipientEmail }],
            timestamp: new Date().toISOString()
          }
        })
      };

      await request(app).post('/webhooks/email/sns').send(bounceNotification);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Bounce event should be logged
      const auditResult = await db.query(
        `SELECT * FROM audit_logs 
         WHERE user_id = $1 
         AND event_type LIKE '%bounce%' 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [user.id]
      );

      expect(auditResult.rows.length).toBeGreaterThan(0);
      expect(auditResult.rows[0].event_type).toContain('bounce');
    });

    it('should log complaint events in audit log', async () => {
      const testPhoneNumber = '+1555333006';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const recipientEmail = 'complaint-audit@example.com';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Store an outbound email message
      const threadId = `thread_${Date.now()}`;
      await emailThreadRepository.create({
        userId: user.id,
        threadId,
        subject: 'Complaint Audit Test',
        participants: [userEmail, recipientEmail],
        lastMessageAt: new Date()
      });

      const messageId = `msg_${Date.now()}`;
      await emailMessageRepository.create({
        threadId,
        messageId,
        fromAddress: userEmail,
        toAddresses: [recipientEmail],
        subject: 'Complaint Audit Test',
        body: 'Testing complaint audit logging',
        direction: 'outbound',
        sentAt: new Date()
      });

      // Send complaint notification
      const complaintNotification = {
        Type: 'Notification',
        MessageId: 'complaint-audit-notification-123',
        Message: JSON.stringify({
          notificationType: 'Complaint',
          mail: {
            timestamp: new Date().toISOString(),
            source: userEmail,
            destination: [recipientEmail],
            messageId: messageId
          },
          complaint: {
            complainedRecipients: [{ emailAddress: recipientEmail }],
            timestamp: new Date().toISOString(),
            complaintFeedbackType: 'abuse'
          }
        })
      };

      await request(app).post('/webhooks/email/sns').send(complaintNotification);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Complaint event should be logged
      const auditResult = await db.query(
        `SELECT * FROM audit_logs 
         WHERE user_id = $1 
         AND event_type LIKE '%complaint%' 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [user.id]
      );

      expect(auditResult.rows.length).toBeGreaterThan(0);
      expect(auditResult.rows[0].event_type).toContain('complaint');
    });
  });

  describe('Database Updates', () => {
    it('should update delivery_timestamp on delivery', async () => {
      const testPhoneNumber = '+1555333007';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const recipientEmail = 'timestamp@example.com';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Store message
      const threadId = `thread_${Date.now()}`;
      await emailThreadRepository.create({
        userId: user.id,
        threadId,
        subject: 'Timestamp Test',
        participants: [userEmail, recipientEmail],
        lastMessageAt: new Date()
      });

      const messageId = `msg_${Date.now()}`;
      await emailMessageRepository.create({
        threadId,
        messageId,
        fromAddress: userEmail,
        toAddresses: [recipientEmail],
        subject: 'Timestamp Test',
        body: 'Testing timestamp update',
        direction: 'outbound',
        sentAt: new Date()
      });

      const deliveryTimestamp = new Date().toISOString();

      // Send delivery notification
      const deliveryNotification = {
        Type: 'Notification',
        MessageId: 'timestamp-notification-123',
        Message: JSON.stringify({
          notificationType: 'Delivery',
          mail: {
            timestamp: new Date().toISOString(),
            source: userEmail,
            destination: [recipientEmail],
            messageId: messageId
          },
          delivery: {
            timestamp: deliveryTimestamp,
            recipients: [recipientEmail]
          }
        })
      };

      await request(app).post('/webhooks/email/sns').send(deliveryNotification);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Requirement 10.1: delivery_timestamp should be updated
      const result = await db.query(
        'SELECT delivery_timestamp FROM email_messages WHERE message_id = $1',
        [messageId]
      );

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].delivery_timestamp).toBeDefined();
    });

    it('should store delivery details on bounce', async () => {
      const testPhoneNumber = '+1555333008';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const recipientEmail = 'details@example.com';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Store message
      const threadId = `thread_${Date.now()}`;
      await emailThreadRepository.create({
        userId: user.id,
        threadId,
        subject: 'Details Test',
        participants: [userEmail, recipientEmail],
        lastMessageAt: new Date()
      });

      const messageId = `msg_${Date.now()}`;
      await emailMessageRepository.create({
        threadId,
        messageId,
        fromAddress: userEmail,
        toAddresses: [recipientEmail],
        subject: 'Details Test',
        body: 'Testing details storage',
        direction: 'outbound',
        sentAt: new Date()
      });

      // Send bounce notification with details
      const bounceNotification = {
        Type: 'Notification',
        MessageId: 'details-notification-123',
        Message: JSON.stringify({
          notificationType: 'Bounce',
          mail: {
            timestamp: new Date().toISOString(),
            source: userEmail,
            destination: [recipientEmail],
            messageId: messageId
          },
          bounce: {
            bounceType: 'Permanent',
            bounceSubType: 'General',
            bouncedRecipients: [
              {
                emailAddress: recipientEmail,
                status: '5.1.1',
                diagnosticCode: 'smtp; 550 5.1.1 user unknown'
              }
            ],
            timestamp: new Date().toISOString()
          }
        })
      };

      await request(app).post('/webhooks/email/sns').send(bounceNotification);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // delivery_details should contain bounce information
      const result = await db.query(
        'SELECT delivery_details FROM email_messages WHERE message_id = $1',
        [messageId]
      );

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].delivery_details).toBeDefined();
      expect(result.rows[0].delivery_details).toContain('bounce');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing message ID gracefully', async () => {
      // Send delivery notification for non-existent message
      const deliveryNotification = {
        Type: 'Notification',
        MessageId: 'missing-msg-notification',
        Message: JSON.stringify({
          notificationType: 'Delivery',
          mail: {
            timestamp: new Date().toISOString(),
            source: 'test@me.faxi.jp',
            destination: ['recipient@example.com'],
            messageId: 'non-existent-message-id'
          },
          delivery: {
            timestamp: new Date().toISOString(),
            recipients: ['recipient@example.com']
          }
        })
      };

      const webhookResponse = await request(app)
        .post('/webhooks/email/sns')
        .send(deliveryNotification);

      // Should still return 200 to prevent SNS retries
      expect(webhookResponse.status).toBe(200);
    });

    it('should handle malformed delivery notification', async () => {
      const malformedNotification = {
        Type: 'Notification',
        MessageId: 'malformed-delivery',
        Message: JSON.stringify({
          notificationType: 'Delivery',
          // Missing required fields
        })
      };

      const webhookResponse = await request(app)
        .post('/webhooks/email/sns')
        .send(malformedNotification);

      expect(webhookResponse.status).toBe(200);
    });
  });
});
