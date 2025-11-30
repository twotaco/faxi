import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { userRepository } from '../../repositories/userRepository';
import { emailThreadRepository, emailMessageRepository } from '../../repositories/emailThreadRepository';

let app: Express;

/**
 * Integration Test: Email Thread Management
 * 
 * Tests the complete flow: Multiple emails → Thread creation → Thread retrieval
 * Verifies thread ID consistency and message ordering
 * 
 * Requirements: 8.1-8.7
 */
describe('Email Thread Management Integration Tests', () => {
  beforeEach(async () => {
    // Initialize test app
    const { createTestApp } = await import('../testApp');
    app = await createTestApp();
  });

  afterEach(async () => {
    // Clean up test data
    await request(app).delete('/test/fax/clear');
  });

  describe('Thread Creation and Consistency', () => {
    it('should create thread for new email conversation', async () => {
      const testPhoneNumber = '+1555444000';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const senderEmail = 'thread-test@example.com';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send first email to create thread
      const firstEmail = {
        Type: 'Notification',
        MessageId: 'thread-msg-1',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: senderEmail,
            destination: [userEmail],
            commonHeaders: {
              from: [`Sender <${senderEmail}>`],
              subject: 'Thread Test Subject',
              date: new Date().toISOString()
            }
          },
          content: 'First email in thread'
        })
      };

      await request(app).post('/webhooks/email/sns').send(firstEmail);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Requirement 8.1: Thread should be created
      const threads = await emailThreadRepository.findByUserId(user.id);
      expect(threads.length).toBeGreaterThan(0);
      
      const thread = threads[0];
      expect(thread.subject).toBe('Thread Test Subject');
      expect(thread.participants).toContain(senderEmail);
      expect(thread.participants).toContain(userEmail);
    });

    it('should use same thread ID for emails with same subject and participants', async () => {
      const testPhoneNumber = '+1555444001';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const senderEmail = 'consistency@example.com';
      const subject = 'Consistent Thread Subject';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send first email
      const firstEmail = {
        Type: 'Notification',
        MessageId: 'consistency-msg-1',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: senderEmail,
            destination: [userEmail],
            commonHeaders: {
              from: [`Sender <${senderEmail}>`],
              subject: subject,
              date: new Date().toISOString()
            }
          },
          content: 'First email'
        })
      };

      await request(app).post('/webhooks/email/sns').send(firstEmail);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const threadsAfterFirst = await emailThreadRepository.findByUserId(user.id);
      const firstThreadId = threadsAfterFirst[0].threadId;

      // Send second email with same subject and participants
      const secondEmail = {
        Type: 'Notification',
        MessageId: 'consistency-msg-2',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: senderEmail,
            destination: [userEmail],
            commonHeaders: {
              from: [`Sender <${senderEmail}>`],
              subject: subject,
              date: new Date().toISOString()
            }
          },
          content: 'Second email'
        })
      };

      await request(app).post('/webhooks/email/sns').send(secondEmail);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Requirement 8.1: Should use same thread ID
      const threadsAfterSecond = await emailThreadRepository.findByUserId(user.id);
      const secondThreadId = threadsAfterSecond[0].threadId;
      
      expect(firstThreadId).toBe(secondThreadId);
      
      // Should still have only one thread
      expect(threadsAfterSecond.length).toBe(1);
    });

    it('should create separate threads for different subjects', async () => {
      const testPhoneNumber = '+1555444002';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const senderEmail = 'separate@example.com';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send email with first subject
      const firstEmail = {
        Type: 'Notification',
        MessageId: 'separate-msg-1',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: senderEmail,
            destination: [userEmail],
            commonHeaders: {
              from: [`Sender <${senderEmail}>`],
              subject: 'First Subject',
              date: new Date().toISOString()
            }
          },
          content: 'First thread'
        })
      };

      await request(app).post('/webhooks/email/sns').send(firstEmail);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send email with different subject
      const secondEmail = {
        Type: 'Notification',
        MessageId: 'separate-msg-2',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: senderEmail,
            destination: [userEmail],
            commonHeaders: {
              from: [`Sender <${senderEmail}>`],
              subject: 'Second Subject',
              date: new Date().toISOString()
            }
          },
          content: 'Second thread'
        })
      };

      await request(app).post('/webhooks/email/sns').send(secondEmail);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should have two separate threads
      const threads = await emailThreadRepository.findByUserId(user.id);
      expect(threads.length).toBe(2);
      
      const threadIds = threads.map(t => t.threadId);
      expect(threadIds[0]).not.toBe(threadIds[1]);
    });

    it('should create separate threads for different participants', async () => {
      const testPhoneNumber = '+1555444003';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const sender1 = 'sender1@example.com';
      const sender2 = 'sender2@example.com';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send email from first sender
      const firstEmail = {
        Type: 'Notification',
        MessageId: 'participant-msg-1',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: sender1,
            destination: [userEmail],
            commonHeaders: {
              from: [`Sender One <${sender1}>`],
              subject: 'Same Subject',
              date: new Date().toISOString()
            }
          },
          content: 'From sender 1'
        })
      };

      await request(app).post('/webhooks/email/sns').send(firstEmail);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send email from second sender with same subject
      const secondEmail = {
        Type: 'Notification',
        MessageId: 'participant-msg-2',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: sender2,
            destination: [userEmail],
            commonHeaders: {
              from: [`Sender Two <${sender2}>`],
              subject: 'Same Subject',
              date: new Date().toISOString()
            }
          },
          content: 'From sender 2'
        })
      };

      await request(app).post('/webhooks/email/sns').send(secondEmail);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should have two separate threads (different participants)
      const threads = await emailThreadRepository.findByUserId(user.id);
      expect(threads.length).toBe(2);
    });
  });

  describe('Thread Updates', () => {
    it('should increment message count when adding messages', async () => {
      const testPhoneNumber = '+1555444004';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const senderEmail = 'count@example.com';
      const subject = 'Count Test';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send first email
      const firstEmail = {
        Type: 'Notification',
        MessageId: 'count-msg-1',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: senderEmail,
            destination: [userEmail],
            commonHeaders: {
              from: [`Sender <${senderEmail}>`],
              subject: subject,
              date: new Date().toISOString()
            }
          },
          content: 'First message'
        })
      };

      await request(app).post('/webhooks/email/sns').send(firstEmail);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const threadsAfterFirst = await emailThreadRepository.findByUserId(user.id);
      const initialCount = threadsAfterFirst[0].messageCount;

      // Send second email in same thread
      const secondEmail = {
        Type: 'Notification',
        MessageId: 'count-msg-2',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: senderEmail,
            destination: [userEmail],
            commonHeaders: {
              from: [`Sender <${senderEmail}>`],
              subject: subject,
              date: new Date().toISOString()
            }
          },
          content: 'Second message'
        })
      };

      await request(app).post('/webhooks/email/sns').send(secondEmail);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Requirement 8.4: Message count should increment
      const threadsAfterSecond = await emailThreadRepository.findByUserId(user.id);
      const finalCount = threadsAfterSecond[0].messageCount;
      
      expect(finalCount).toBeGreaterThan(initialCount);
    });

    it('should update last message timestamp', async () => {
      const testPhoneNumber = '+1555444005';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const senderEmail = 'timestamp@example.com';
      const subject = 'Timestamp Test';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send first email
      const firstEmail = {
        Type: 'Notification',
        MessageId: 'timestamp-msg-1',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: senderEmail,
            destination: [userEmail],
            commonHeaders: {
              from: [`Sender <${senderEmail}>`],
              subject: subject,
              date: new Date().toISOString()
            }
          },
          content: 'First message'
        })
      };

      await request(app).post('/webhooks/email/sns').send(firstEmail);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const threadsAfterFirst = await emailThreadRepository.findByUserId(user.id);
      const firstTimestamp = threadsAfterFirst[0].lastMessageAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send second email
      const secondEmail = {
        Type: 'Notification',
        MessageId: 'timestamp-msg-2',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: senderEmail,
            destination: [userEmail],
            commonHeaders: {
              from: [`Sender <${senderEmail}>`],
              subject: subject,
              date: new Date().toISOString()
            }
          },
          content: 'Second message'
        })
      };

      await request(app).post('/webhooks/email/sns').send(secondEmail);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Requirement 8.4: Last message timestamp should be updated
      const threadsAfterSecond = await emailThreadRepository.findByUserId(user.id);
      const secondTimestamp = threadsAfterSecond[0].lastMessageAt;
      
      expect(new Date(secondTimestamp).getTime()).toBeGreaterThan(new Date(firstTimestamp).getTime());
    });
  });

  describe('Thread Retrieval and Ordering', () => {
    it('should order threads by most recent message first', async () => {
      const testPhoneNumber = '+1555444006';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send first email (older thread)
      const firstEmail = {
        Type: 'Notification',
        MessageId: 'order-msg-1',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: 'old@example.com',
            destination: [userEmail],
            commonHeaders: {
              from: ['Old Sender <old@example.com>'],
              subject: 'Old Thread',
              date: new Date().toISOString()
            }
          },
          content: 'Older message'
        })
      };

      await request(app).post('/webhooks/email/sns').send(firstEmail);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Wait to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send second email (newer thread)
      const secondEmail = {
        Type: 'Notification',
        MessageId: 'order-msg-2',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: 'new@example.com',
            destination: [userEmail],
            commonHeaders: {
              from: ['New Sender <new@example.com>'],
              subject: 'New Thread',
              date: new Date().toISOString()
            }
          },
          content: 'Newer message'
        })
      };

      await request(app).post('/webhooks/email/sns').send(secondEmail);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Requirement 8.6: Threads should be ordered by most recent first
      const threads = await emailThreadRepository.findByUserId(user.id);
      expect(threads.length).toBeGreaterThanOrEqual(2);
      
      // First thread should be the newer one
      expect(threads[0].subject).toBe('New Thread');
      expect(threads[1].subject).toBe('Old Thread');
    });

    it('should retrieve messages in chronological order', async () => {
      const testPhoneNumber = '+1555444007';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const senderEmail = 'chrono@example.com';
      const subject = 'Chronological Test';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send three emails in sequence
      for (let i = 1; i <= 3; i++) {
        const email = {
          Type: 'Notification',
          MessageId: `chrono-msg-${i}`,
          Message: JSON.stringify({
            notificationType: 'Received',
            mail: {
              timestamp: new Date().toISOString(),
              source: senderEmail,
              destination: [userEmail],
              commonHeaders: {
                from: [`Sender <${senderEmail}>`],
                subject: subject,
                date: new Date().toISOString()
              }
            },
            content: `Message ${i}`
          })
        };

        await request(app).post('/webhooks/email/sns').send(email);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Requirement 8.7: Messages should be in chronological order
      const threads = await emailThreadRepository.findByUserId(user.id);
      const thread = threads.find(t => t.subject === subject);
      expect(thread).toBeDefined();

      const messages = await emailMessageRepository.findByThreadId(thread!.threadId);
      expect(messages.length).toBeGreaterThanOrEqual(3);
      
      // Messages should be ordered oldest to newest
      for (let i = 1; i < messages.length; i++) {
        const prevTime = new Date(messages[i - 1].sentAt).getTime();
        const currTime = new Date(messages[i].sentAt).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    });
  });

  describe('Message Storage', () => {
    it('should store all message details correctly', async () => {
      const testPhoneNumber = '+1555444008';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const senderEmail = 'details@example.com';
      const subject = 'Details Test';
      const body = 'This is the email body content';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send email
      const email = {
        Type: 'Notification',
        MessageId: 'details-msg',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: senderEmail,
            destination: [userEmail],
            commonHeaders: {
              from: [`Sender <${senderEmail}>`],
              subject: subject,
              date: new Date().toISOString()
            }
          },
          content: body
        })
      };

      await request(app).post('/webhooks/email/sns').send(email);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Requirement 8.3: Message should be stored with all details
      const threads = await emailThreadRepository.findByUserId(user.id);
      const thread = threads.find(t => t.subject === subject);
      expect(thread).toBeDefined();

      const messages = await emailMessageRepository.findByThreadId(thread!.threadId);
      expect(messages.length).toBeGreaterThan(0);
      
      const message = messages[0];
      expect(message.fromAddress).toBe(senderEmail);
      expect(message.toAddresses).toContain(userEmail);
      expect(message.subject).toBe(subject);
      expect(message.body).toContain(body);
      expect(message.direction).toBe('inbound');
    });

    it('should handle multiple messages in same thread', async () => {
      const testPhoneNumber = '+1555444009';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const senderEmail = 'multiple@example.com';
      const subject = 'Multiple Messages';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send multiple emails in same thread
      const messageCount = 5;
      for (let i = 1; i <= messageCount; i++) {
        const email = {
          Type: 'Notification',
          MessageId: `multiple-msg-${i}`,
          Message: JSON.stringify({
            notificationType: 'Received',
            mail: {
              timestamp: new Date().toISOString(),
              source: senderEmail,
              destination: [userEmail],
              commonHeaders: {
                from: [`Sender <${senderEmail}>`],
                subject: subject,
                date: new Date().toISOString()
              }
            },
            content: `Message number ${i}`
          })
        };

        await request(app).post('/webhooks/email/sns').send(email);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // All messages should be in same thread
      const threads = await emailThreadRepository.findByUserId(user.id);
      const thread = threads.find(t => t.subject === subject);
      expect(thread).toBeDefined();

      const messages = await emailMessageRepository.findByThreadId(thread!.threadId);
      expect(messages.length).toBeGreaterThanOrEqual(messageCount);
    });
  });

  describe('Thread Search and Filtering', () => {
    it('should search threads by subject', async () => {
      const testPhoneNumber = '+1555444010';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send email with searchable subject
      const email = {
        Type: 'Notification',
        MessageId: 'search-msg',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: 'search@example.com',
            destination: [userEmail],
            commonHeaders: {
              from: ['Sender <search@example.com>'],
              subject: 'Unique Searchable Subject',
              date: new Date().toISOString()
            }
          },
          content: 'Searchable content'
        })
      };

      await request(app).post('/webhooks/email/sns').send(email);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Search for thread
      const searchResults = await emailThreadRepository.searchThreads(user.id, 'Searchable');
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].subject).toContain('Searchable');
    });

    it('should search threads by participant', async () => {
      const testPhoneNumber = '+1555444011';
      const userEmail = `${testPhoneNumber.replace('+', '')}@me.faxi.jp`;
      const senderEmail = 'unique-participant@example.com';
      
      // Create user
      const user = await userRepository.create({
        phoneNumber: testPhoneNumber,
        emailAddress: userEmail,
        isActive: true,
        preferences: {}
      });

      // Send email
      const email = {
        Type: 'Notification',
        MessageId: 'participant-search-msg',
        Message: JSON.stringify({
          notificationType: 'Received',
          mail: {
            timestamp: new Date().toISOString(),
            source: senderEmail,
            destination: [userEmail],
            commonHeaders: {
              from: [`Sender <${senderEmail}>`],
              subject: 'Participant Search Test',
              date: new Date().toISOString()
            }
          },
          content: 'Testing participant search'
        })
      };

      await request(app).post('/webhooks/email/sns').send(email);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Search by participant email
      const searchResults = await emailThreadRepository.searchThreads(user.id, 'unique-participant');
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].participants).toContain(senderEmail);
    });
  });
});
