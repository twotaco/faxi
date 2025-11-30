# Implementation Plan: Email System Architecture

## Overview

This implementation plan focuses on completing the email system architecture by adding AWS SES integration, SNS webhook handling, delivery tracking, bounce/complaint handling, blocklist management, account review, and email quality monitoring. The plan maximizes code reuse of existing components (EmailService, EmailToFaxConverter, EmailToFaxWorker, AddressBookRepository, EmailMcpServer, WelcomeFaxGenerator) and only implements the minimal new components required.

**Status**: Task 1 completed. AWS SDK dependencies already installed. EmailService, AddressBookRepository, and WelcomeFaxGenerator already have required functionality.

## Task List

- [x] 1. Configure AWS credentials and email provider settings
  - Create AWS IAM user with SES and SNS permissions (SES:SendEmail, SES:SendRawEmail, SNS:Publish, SNS:Subscribe)
  - Generate access key and secret key
  - Add AWS credentials to backend/.env.test (AWS_REGION=us-east-1, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
  - Add AWS credentials to backend/.env for local development
  - Update EMAIL_PROVIDER=ses in both .env and .env.test
  - Add SNS_TOPIC_ARN to environment files (will be populated after task 2)
  - Document credential setup and IAM permissions in README
  - Test AWS SDK connection with credentials
  - _Requirements: 6.3, 7.1_

- [x] 2. Set up AWS SES infrastructure and configuration
- [x] 2.1 Create SNS topic for email notifications
  - SNS topic created: arn:aws:sns:us-east-1:223882168768:faxi-email-notifications
  - SNS_TOPIC_ARN added to backend/.env
  - Webhook subscription configured
  - _Requirements: 7.6, 7.7_

- [x] 2.2 Configure AWS SES domain verification for me.faxi.jp
  - Domain verified successfully (VerificationStatus: Success)
  - TXT record added to DNS
  - _Requirements: 7.1_

- [x] 2.3 Set up DKIM records
  - DKIM tokens generated and CNAME records added to DNS
  - _Requirements: 7.4_

- [x] 2.4 Set up SPF record
  - SPF TXT record added to DNS
  - _Requirements: 7.5_

- [x] 2.5 Set up MX records for inbound email
  - MX record configured for inbound email
  - _Requirements: 7.2_

- [x] 2.6 Create SES receipt rules for inbound email
  - Receipt rule set created: faxi-inbound (active)
  - Receipt rule created: faxi-email-rule (enabled)
  - Configured to forward to SNS topic
  - Delivery/bounce/complaint notifications configured
  - _Requirements: 7.3, 7.7_

- [x] 2.7 Request production access (move out of sandbox)
  - ✅ Production access request submitted to AWS
  - ⏳ Waiting for AWS approval (typically 24-48 hours)
  - ⚠️ Account currently in SES Sandbox mode (200 emails/day limit) until approved
  - Request details documented in backend/AWS_SES_PRODUCTION_ACCESS_RESPONSE.md
  - _Requirements: 7.1_

- [x] 2.8 Verify complete setup
  - ✅ test-ses-connection script passes
  - ✅ Domain verification confirmed
  - ✅ Receipt rules active and configured
  - ✅ SNS topic and subscriptions configured
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 3. Implement AWS SES service integration
- [x] 3.1 Create AwsSesService for email sending
  - ✅ Created backend/src/services/awsSesService.ts with full implementation
  - ✅ Implemented AWS SDK v3 integration using @aws-sdk/client-ses
  - ✅ Added sendEmail method with 3-attempt retry logic and exponential backoff
  - ✅ Added email identity verification methods (verifyEmailIdentity)
  - ✅ Added sending statistics retrieval (getSendingStatistics with quota info)
  - ✅ Handles rate limiting and throttling with intelligent retry detection
  - ✅ Supports both text and HTML email bodies
  - ✅ Comprehensive audit logging for all operations
  - ✅ Configuration validation on initialization
  - ✅ Singleton pattern with exported instance
  - _Requirements: 6.3, 7.1_

- [x] 3.2 Write property test for email provider routing
  - ✅ Created backend/src/test/integration/emailProviderRouting.property.test.ts
  - ✅ Tests routing to AWS SES when provider is "ses" (50 iterations)
  - ✅ Tests routing to SendGrid when provider is "sendgrid" (50 iterations)
  - ✅ Tests error handling for Postfix (not yet implemented) (30 iterations)
  - ✅ Tests error handling for unsupported providers (30 iterations)
  - ✅ Tests error when AWS SES not configured (30 iterations)
  - ✅ Tests error when SendGrid API key missing (30 iterations)
  - ✅ Tests AWS SES throttling error handling (30 iterations)
  - ✅ Tests AWS SES invalid parameter error handling (30 iterations)
  - ✅ Tests standardized result structure across all providers (100 iterations)
  - ✅ Uses fast-check to generate arbitrary email messages
  - ✅ Mocks AWS SES service and SendGrid API calls
  - ✅ Verifies correct provider method called based on configuration
  - ✅ Verifies standardized EmailSendResult structure (success + messageId/error)
  - **Property 15: Email provider routing**
  - **Validates: Requirements 6.2, 6.3, 6.4, 6.5**

- [x] 3.3 Implement EmailService.sendViaSES method
  - Update backend/src/services/emailService.ts
  - Replace placeholder implementation with AwsSesService call
  - Handle AWS-specific error codes (throttling, rate limits, invalid addresses)
  - Return standardized EmailSendResult
  - _Requirements: 5.4, 6.3, 6.6_

- [x] 3.4 Write property test for email send result standardization
  - **Property 16: Email send result standardization**
  - **Validates: Requirements 6.6, 6.7**

- [x] 4. Implement SNS webhook handling for inbound emails
- [x] 4.1 Create SnsWebhookHandler service
  - ✅ Created backend/src/services/snsWebhookHandler.ts with full implementation
  - ✅ Implemented SNS signature verification using AWS certificate download and crypto verification
  - ✅ Validates certificate URL is from amazonaws.com (HTTPS, sns subdomain)
  - ✅ Downloads certificate from AWS and verifies signature using SHA1
  - ✅ Handles subscription confirmation automatically by visiting SubscribeURL
  - ✅ Parses SNS notification messages (inbound email, delivery, bounce, complaint)
  - ✅ Routes to appropriate handlers based on notificationType
  - ✅ Returns 200 OK immediately to prevent retries
  - ✅ Processes notifications asynchronously
  - ✅ Comprehensive audit logging for all operations
  - ✅ Singleton pattern with exported instance
  - _Requirements: 9.1, 9.2_

- [x] 4.2 Write property test for webhook signature verification
  - **Property 21: Webhook signature verification**
  - **Validates: Requirements 9.1, 9.2**

- [x] 4.3 Add SNS webhook endpoint to webhooks controller
  - Update backend/src/webhooks/emailWebhookController.ts
  - Create handleSnsWebhook method for POST /webhooks/email/sns endpoint
  - Integrate SnsWebhookHandler
  - Return 200 OK within 2 seconds
  - Process messages asynchronously
  - _Requirements: 3.1, 7.7_

- [x] 4.4 Enhance EmailWebhookController for AWS SES
  - Update parseAwsSesWebhook method in EmailWebhookController
  - Extract sender name from email headers (commonHeaders.from)
  - Support SNS notification format properly
  - Handle both inbound email and delivery notifications
  - _Requirements: 3.2, 3.3_

- [x] 4.5 Write property test for email address parsing
  - **Property 5: Email address parsing and validation**
  - **Validates: Requirements 3.2, 3.3, 11.4, 11.5**

- [x] 5. Implement contact management integration
- [x] 5.1 Add automatic contact registration for inbound emails
  - Update EmailWebhookController.processEmailAsync
  - Call AddressBookRepository.addFromEmail after user lookup
  - Extract sender name from email headers (fromName field)
  - Handle duplicate contacts gracefully (already handled by addFromEmail)
  - _Requirements: 13.1, 13.3, 13.4_

- [x] 5.2 Write property test for automatic contact registration
  - **Property 31: Automatic contact registration from inbound email**
  - **Validates: Requirements 13.1**

- [x] 5.3 Verify contact lookup in EmailMcpServer
  - Review existing lookup_contact tool implementation
  - Verify case-insensitive partial matching
  - Verify multiple match handling
  - No code changes needed (already implemented via AddressBookRepository.searchByNameOrRelationship)
  - _Requirements: 13.2, 13.5, 13.6, 13.7_

- [x] 5.4 Write property test for contact lookup
  - **Property 32: Contact lookup for outbound email**
  - **Validates: Requirements 13.2**

- [x] 6. Implement email delivery tracking
- [x] 6.1 Add delivery tracking fields to database
  - Create migration backend/src/database/migrations/010_add_email_delivery_tracking.sql
  - Add delivery_status, delivery_timestamp, delivery_details columns to email_messages
  - Create index on delivery_status
  - Run migration
  - _Requirements: 10.1_

- [x] 6.2 Create EmailDeliveryTracker service
  - Create backend/src/services/emailDeliveryTracker.ts
  - Implement handleDelivery method (update status to 'delivered')
  - Implement handleBounce method (update status to 'bounced', generate error fax)
  - Implement handleComplaint method (update status to 'complained')
  - Update email_messages table with delivery status
  - Generate error notification faxes for bounces using FaxGenerator
  - Log all delivery events in audit log
  - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 6.3 Write property test for delivery status tracking
  - **Property 25: Delivery status tracking**
  - **Validates: Requirements 10.4, 10.5**

- [x] 6.4 Integrate delivery tracking with SNS webhook
  - Update SnsWebhookHandler to route delivery/bounce/complaint events
  - Call EmailDeliveryTracker methods based on notification type
  - _Requirements: 10.2, 10.3_

- [x] 6.5 Write property test for delivery event logging
  - **Property 26: Delivery event logging**
  - **Validates: Requirements 10.7**

- [x] 7. Enhance welcome fax with email address
- [x] 7.1 Update WelcomeFaxGenerator to display email address
  - Email address already displayed prominently in welcome fax
  - Instructions for sending emails via fax already included
  - Instructions for receiving emails via fax already included
  - Example email request formats already included
  - No changes needed
  - _Requirements: 1.5, 2.2, 2.3, 2.4_

- [x] 7.2 Write property test for welcome fax content
  - **Property 3: Welcome fax content completeness**
  - **Validates: Requirements 1.5, 2.2, 2.3, 2.4**

- [x] 7.3 Update welcome fax preference tracking
  - welcomeFaxSent preference already tracked in user preferences system
  - No changes needed
  - _Requirements: 2.5_

- [x] 7.4 Write property test for welcome fax preference
  - **Property 4: Welcome fax preference update**
  - **Validates: Requirements 2.5**

- [x] 8. Implement comprehensive error handling
- [x] 8.1 Add error notification fax generation
  - Update EmailDeliveryTracker to generate error faxes for bounces
  - Create contact not found fax template in ClarificationFaxGenerator
  - Create multiple contacts found clarification fax in ClarificationFaxGenerator
  - _Requirements: 5.7, 13.6, 13.7_

- [x] 8.2 Write property test for error handling
  - **Property 28: Comprehensive error handling**
  - **Validates: Requirements 12.1, 12.3, 12.7**

- [x] 8.3 Verify retry logic for email-to-fax conversion
  - BullMQ retry settings already configured in faxQueue
  - 3 retry attempts with exponential backoff already implemented
  - No changes needed
  - _Requirements: 12.2_

- [ ] 8.4 Write property test for retry logic
  - **Property 29: Email-to-fax retry logic**
  - **Validates: Requirements 12.2**

- [ ] 8.5 Implement provider fallback logic
  - Update EmailService to add fallback provider configuration
  - Implement circuit breaker pattern for AWS SES
  - Fall back to SendGrid/Postfix if AWS SES unavailable
  - _Requirements: 12.5_

- [ ] 8.6 Write property test for provider fallback
  - **Property 30: Provider fallback**
  - **Validates: Requirements 12.5**

- [x] 9. Add email content processing and validation
- [x] 9.1 Verify HTML to text conversion (already implemented)
  - EmailToFaxConverter.convertHtmlToText already implemented
  - No changes needed
  - _Requirements: 4.2_

- [x] 9.2 Write property test for HTML conversion
  - **Property 8: HTML to text conversion**
  - **Validates: Requirements 4.2**

- [x] 9.3 Verify email content cleaning (already implemented)
  - EmailToFaxConverter signature and quote removal already implemented
  - No changes needed
  - _Requirements: 4.3_

- [x] 9.4 Write property test for content cleaning
  - **Property 9: Email content cleaning**
  - **Validates: Requirements 4.3**

- [x] 9.5 Verify body length limiting (already implemented)
  - EmailToFaxConverter body truncation already implemented
  - No changes needed
  - _Requirements: 4.4, 9.6_

- [x] 9.6 Write property test for body length limiting
  - **Property 10: Email body length limiting**
  - **Validates: Requirements 4.4**

- [x] 9.7 Add HTML sanitization for security
  - Update EmailToFaxConverter to add HTML sanitization
  - Remove script tags, dangerous attributes, and XSS vectors
  - Use a sanitization library or implement basic sanitization
  - _Requirements: 9.5_

- [x] 9.8 Write property test for HTML sanitization
  - **Property 23: HTML sanitization**
  - **Validates: Requirements 9.5**

- [ ] 10. Checkpoint - Ensure all tests pass
  - Run all unit tests: npm test
  - Run all property tests
  - Run integration tests: npm run test:integration
  - Fix any failing tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Integration testing and end-to-end validation
- [x] 11.1 Create integration test for inbound email flow
  - Create backend/src/test/integration/inboundEmailFlow.test.ts
  - Test: External email → SNS webhook → User creation → Contact registration → Email-to-fax → Fax send
  - Verify all database records created correctly
  - Verify fax is generated and sent
  - _Requirements: 3.1-3.8, 13.1_

- [x] 11.2 Create integration test for outbound email flow
  - Create backend/src/test/integration/outboundEmailFlow.test.ts
  - Test: Fax request → Email extraction → Contact lookup → Email send → Confirmation fax
  - Test both email address and contact name paths
  - Verify email is sent via AWS SES (mock in test mode)
  - _Requirements: 5.1-5.7, 13.2_

- [x] 11.3 Create integration test for first-time user registration
  - Create backend/src/test/integration/userRegistrationWithEmail.test.ts
  - Test: First fax → User creation → Email assignment → Welcome fax
  - Verify email address format (phone@me.faxi.jp)
  - Verify welcome fax content includes email address
  - _Requirements: 1.1-1.5, 2.1-2.5_

- [x] 11.4 Create integration test for delivery tracking
  - Create backend/src/test/integration/emailDeliveryTracking.test.ts
  - Test: Email send → Delivery notification → Status update
  - Test: Email send → Bounce notification → Error fax
  - Verify database updates to email_messages table
  - _Requirements: 10.1-10.7_

- [x] 11.5 Create integration test for email thread management
  - Create backend/src/test/integration/emailThreadManagement.test.ts
  - Test: Multiple emails → Thread creation → Thread retrieval
  - Verify thread ID consistency
  - Verify message ordering
  - _Requirements: 8.1-8.7_

- [x] 12. Final checkpoint - Complete system validation
  - Run all tests (unit, property, integration)
  - Verify AWS SES configuration in staging
  - Test with real email delivery (staging environment)
  - Monitor CloudWatch metrics
  - Review audit logs
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement bounce and complaint notification handling
- [x] 13.1 Create database migration for new tables
  - Create backend/src/database/migrations/011_add_email_abuse_prevention.sql
  - Add email_blocklist table (user_id, blocked_email, blocked_at)
  - Add user_complaints table (user_id, message_id, complained_at, complaint_type, details)
  - Add email_metrics table (event_type, user_id, message_id, occurred_at, details)
  - Add email restriction fields to users table (email_restricted, email_restricted_at, email_restriction_reason)
  - Run migration
  - _Requirements: 15.1, 16.1, 17.1_

- [x] 13.2 Create BounceComplaintHandler service
  - Create backend/src/services/bounceComplaintHandler.ts
  - Implement handleBounce method (hard vs soft bounce logic)
  - Implement handleComplaint method
  - Implement bounce notification fax generation using FaxGenerator
  - Implement complaint notification fax with etiquette guidance
  - _Requirements: 14.1, 14.2, 14.3, 14.5, 14.6, 14.7_

- [x] 13.3 Write property test for bounce notification fax
  - **Property 34: Bounce notification fax generation**
  - **Validates: Requirements 14.2, 14.3**

- [x] 13.4 Write property test for complaint notification fax
  - **Property 35: Complaint notification fax with etiquette guidance**
  - **Validates: Requirements 14.6, 14.7**

- [x] 13.5 Integrate bounce/complaint handling with SNS webhook
  - Update SnsWebhookHandler to route bounce/complaint events
  - Call BounceComplaintHandler methods
  - Log all events in audit system
  - _Requirements: 14.4, 14.8_

- [x] 14. Implement user blocklist management
- [x] 14.1 Create BlocklistService
  - Create backend/src/services/blocklistService.ts
  - Implement blockSender method (insert into email_blocklist)
  - Implement unblockSender method (delete from email_blocklist)
  - Implement isBlocked method (case-insensitive check)
  - Implement getBlocklist method (retrieve user's blocklist)
  - _Requirements: 15.1, 15.4, 15.6, 15.7_

- [x] 14.2 Write property test for blocklist enforcement
  - **Property 36: Blocklist enforcement**
  - **Validates: Requirements 15.2, 15.3**

- [x] 14.3 Write property test for case-insensitive matching
  - **Property 37: Blocklist case-insensitive matching**
  - **Validates: Requirements 15.6, 15.7**

- [x] 14.4 Add blocklist check to inbound email processing
  - Update EmailWebhookController.processEmailAsync
  - Check BlocklistService.isBlocked before converting email to fax
  - Reject blocked emails silently (no error response)
  - _Requirements: 15.2, 15.3_

- [x] 14.5 Add block/unblock fax command parsing
  - Update IntentExtractor to recognize block/unblock commands
  - Parse "Block emails from X" and "Unblock emails from X"
  - Call BlocklistService methods
  - Send confirmation faxes
  - _Requirements: 15.1, 15.4, 15.5_

- [-] 15. Implement account review and complaint tracking
- [x] 15.1 Create AccountReviewService
  - Create backend/src/services/accountReviewService.ts
  - Implement recordComplaint method (insert into user_complaints)
  - Implement checkAccountStatus method (count complaints in 30-day window)
  - Implement restrictAccount method (update users table)
  - Implement getComplaintHistory method
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_

- [x] 15.2 Write property test for complaint tracking
  - **Property 38: Complaint count tracking**
  - **Validates: Requirements 16.1, 16.2, 16.5**

- [ ] 15.3 Write property test for account restriction
  - **Property 39: Account restriction enforcement**
  - **Validates: Requirements 16.5**

- [ ] 15.4 Integrate complaint tracking with bounce/complaint handler
  - Update BounceComplaintHandler to call AccountReviewService.recordComplaint
  - Check account status after recording complaint
  - Send alerts to administrators at 3 complaints
  - Send warning faxes to users
  - _Requirements: 16.3, 16.4_

- [ ] 15.5 Add account restriction check to outbound email
  - Update EmailService.sendEmail to check user restriction status
  - Query users table for email_restricted flag
  - Reject email send with error fax if restricted
  - _Requirements: 16.5, 16.6_

- [x] 16. Implement email quality monitoring
- [x] 16.1 Create EmailMetricsService
  - Create backend/src/services/emailMetricsService.ts
  - Implement recordEmailEvent method (insert into email_metrics)
  - Implement calculateMetrics method (aggregate by time period)
  - Implement checkThresholds method (bounce > 5%, complaint > 0.1%, delivery < 95%)
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

- [x] 16.2 Write property test for metrics calculation
  - **Property 40: Email quality metrics calculation**
  - **Validates: Requirements 17.2, 17.3, 17.4**

- [x] 16.3 Integrate metrics tracking with email events
  - Update EmailService to record 'sent' events
  - Update EmailDeliveryTracker to record 'delivered', 'bounced', 'complained' events
  - Call EmailMetricsService.recordEmailEvent
  - _Requirements: 17.1_

- [x] 16.4 Add metrics monitoring and alerting
  - Create scheduled job to calculate daily metrics
  - Call EmailMetricsService.checkThresholds
  - Send alerts to administrators via AlertingService when thresholds exceeded
  - _Requirements: 17.5, 17.6, 17.7_

- [x] 17. Final checkpoint - Complete system validation with new features
  - Run all tests (unit, property, integration)
  - Test bounce notification flow end-to-end
  - Test complaint notification flow end-to-end
  - Test blocklist functionality (block, unblock, enforcement)
  - Test account restriction (flag, restrict, enforcement)
  - Test metrics calculation and alerting
  - Verify all alerts working
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Documentation and deployment preparation
  - Update backend/README.md with email system architecture overview
  - Document AWS SES configuration steps in backend/AWS_SES_SETUP.md
  - Document bounce/complaint handling in backend/docs/EMAIL_ABUSE_PREVENTION.md
  - Document blocklist management in backend/docs/EMAIL_BLOCKLIST.md
  - Document account review process in backend/docs/ACCOUNT_REVIEW.md
  - Document metrics monitoring in backend/docs/EMAIL_METRICS.md
  - Document all environment variables in backend/.env.example
  - Create operational runbook in backend/docs/EMAIL_OPERATIONS_RUNBOOK.md
  - Document troubleshooting procedures in backend/docs/EMAIL_TROUBLESHOOTING.md
  - _All requirements_
