# Faxi Backend - Email System Architecture

The Faxi backend provides comprehensive bidirectional email communication for fax users through automatically assigned email addresses. This document provides an overview of the email system architecture and its integration with the broader Faxi platform.

## Overview

The email system enables users to:
- **Receive emails as faxes**: External emails sent to `{phone_number}@me.faxi.jp` are automatically converted to faxes
- **Send emails via fax**: Users can fax email requests that are converted to actual emails
- **Automatic user registration**: First-time fax senders are automatically assigned email addresses
- **Contact management**: Email contacts are automatically tracked in the user's address book
- **Delivery tracking**: Email delivery status is monitored with bounce and complaint handling

## Architecture Components

### Core Services

#### Email Processing Pipeline
- **AwsSesService**: AWS SES integration for sending emails
- **EmailService**: Provider-agnostic email sending abstraction (supports AWS SES, SendGrid, Postfix)
- **SnsWebhookHandler**: Processes AWS SNS notifications for inbound emails and delivery events
- **EmailDeliveryTracker**: Tracks email delivery status and handles bounces/complaints
- **EmailToFaxConverter**: Converts email content to fax-friendly format
- **EmailToFaxWorker**: BullMQ worker for asynchronous email-to-fax conversion

#### Abuse Prevention
- **BounceComplaintHandler**: Processes bounce and complaint notifications
- **BlocklistService**: Per-user email blocklist management
- **AccountReviewService**: Tracks complaint rates and manages account restrictions
- **EmailMetricsService**: Calculates email quality metrics (bounce rate, complaint rate, delivery rate)

#### User Management
- **UserRepository**: Automatic user creation with email address assignment
- **AddressBookRepository**: Automatic contact registration from inbound emails
- **WelcomeFaxGenerator**: Generates welcome faxes with email address and instructions

### Data Flow

#### Inbound Email Flow
```
External Email → AWS SES → SNS Topic → Webhook → User Lookup/Creation 
→ Contact Registration → Email Storage → Email-to-Fax Queue → Fax Generation → Fax Send
```

#### Outbound Email Flow
```
Fax Request → AI Vision Interpretation → Intent Extraction → Contact Lookup 
→ Email Composition → Email Send (AWS SES) → Email Storage → Confirmation Fax
```

#### Delivery Tracking Flow
```
Email Send → AWS SES → Delivery/Bounce/Complaint Event → SNS Topic 
→ Webhook → Status Update → Error Fax (if needed)
```

## Email Address Format

All users are automatically assigned an email address based on their phone number:

**Format**: `{phone_number}@me.faxi.jp`

**Example**: `09012345678@me.faxi.jp` (for phone number +81-90-1234-5678)

**Rules**:
- All non-digit characters are removed from the phone number
- Domain is always `me.faxi.jp`
- Unique per user (enforced by database constraint)

## Database Schema

### Core Tables

#### email_threads
Tracks email conversations:
- `id`: UUID primary key
- `user_id`: Foreign key to users
- `thread_id`: External thread identifier
- `subject`: Email subject line
- `participants`: Array of email addresses
- `last_message_at`: Timestamp of most recent message
- `message_count`: Number of messages in thread

#### email_messages
Stores individual email messages:
- `id`: UUID primary key
- `thread_id`: Foreign key to email_threads
- `message_id`: External message identifier
- `from_address`: Sender email
- `to_addresses`: Recipients array
- `subject`: Email subject
- `body`: Plain text body
- `html_body`: HTML body (optional)
- `direction`: 'inbound' or 'outbound'
- `delivery_status`: 'pending', 'delivered', 'bounced', 'complained'
- `delivery_timestamp`: When delivery status was updated
- `delivery_details`: Additional delivery information

#### email_blocklist
Per-user email blocklist:
- `id`: UUID primary key
- `user_id`: Foreign key to users
- `blocked_email`: Email address to block
- `blocked_at`: When the block was created

#### user_complaints
Tracks complaints received:
- `id`: UUID primary key
- `user_id`: Foreign key to users
- `message_id`: Email message identifier
- `complained_at`: When complaint was received
- `complaint_type`: Type of complaint
- `details`: Additional complaint information

#### email_metrics
Email quality metrics:
- `id`: UUID primary key
- `event_type`: 'sent', 'delivered', 'bounced', 'complained'
- `user_id`: Foreign key to users (optional)
- `message_id`: Email message identifier
- `occurred_at`: Event timestamp
- `details`: Additional event data (JSONB)

### User Table Extensions
- `email_restricted`: Boolean flag for restricted accounts
- `email_restricted_at`: When restriction was applied
- `email_restriction_reason`: Reason for restriction

## Configuration

### Environment Variables

See [.env.example](./.env.example) for all configuration options.

**Key Email Variables**:
```bash
# Email Provider Selection
EMAIL_PROVIDER=ses  # Options: ses, sendgrid, postfix

# AWS SES Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:ACCOUNT:faxi-email-notifications

# Email Domain
EMAIL_FROM_DOMAIN=me.faxi.jp

# Webhook Security
EMAIL_WEBHOOK_SECRET=your_webhook_secret
```

### AWS SES Setup

Complete AWS SES configuration guide: [AWS_SES_SETUP.md](./AWS_SES_SETUP.md)

**Quick Setup Checklist**:
1. ✅ Verify domain `me.faxi.jp` in AWS SES
2. ✅ Configure DKIM records (3 CNAME records)
3. ✅ Configure SPF record (TXT record)
4. ✅ Configure MX records for inbound email
5. ✅ Create SNS topic for notifications
6. ✅ Create SES receipt rule to forward to SNS
7. ✅ Request production access (move out of sandbox)

## Features

### Automatic User Registration

When a user sends their first fax:
1. System creates user account with phone number
2. Generates email address: `{phone_number}@me.faxi.jp`
3. Stores user record in database
4. Enqueues welcome fax job
5. Welcome fax includes email address and usage instructions

### Inbound Email Processing

When an email is sent to a Faxi email address:
1. AWS SES receives email and publishes to SNS topic
2. SNS webhook triggers email processing
3. System extracts recipient phone number from email address
4. Finds or creates user account
5. Registers sender as contact in address book
6. Stores email in email_threads and email_messages tables
7. Enqueues email-to-fax conversion job
8. Converts email to fax format (HTML to text, signature removal, etc.)
9. Sends fax to user's phone number

### Outbound Email Sending

When a user faxes an email request:
1. AI Vision interprets fax content
2. Intent extractor identifies "send email" intent
3. Extracts recipient (email address or contact name)
4. If contact name, looks up email in address book
5. Composes email with user's Faxi email as sender
6. Sends via configured provider (AWS SES by default)
7. Stores email in database
8. Sends confirmation fax to user

### Email-to-Fax Conversion

The conversion process:
- Extracts sender, subject, and body
- Converts HTML to plain text while preserving readability
- Removes email signatures and quoted reply text
- Limits body length to prevent excessive pages
- Includes attachment notifications with filenames and sizes
- Adds reference ID for reply tracking
- Formats content for optimal fax readability

### Delivery Tracking

The system tracks all email delivery events:
- **Delivery**: Updates status to 'delivered'
- **Bounce**: Updates status to 'bounced', sends error fax to user
- **Complaint**: Updates status to 'complained', sends notification fax with etiquette guidance

All delivery events are logged in the audit system.

### Abuse Prevention

#### Bounce and Complaint Handling
- Hard bounces: Immediate error notification fax
- Soft bounces: Retry up to 3 times before notifying user
- Complaints: Notification fax with email etiquette guidance
- All events logged in audit system

#### User Blocklist
- Users can block unwanted senders via fax command
- Blocked emails are rejected before conversion
- Case-insensitive matching
- Confirmation faxes for block/unblock operations

#### Account Review
- Tracks complaint count per user
- Flags accounts at 3 complaints in 30 days
- Restricts accounts at 5 complaints in 30 days
- Sends alerts to administrators
- Sends warning faxes to users

#### Email Quality Monitoring
- Tracks bounce rate, complaint rate, delivery rate
- Alerts when thresholds exceeded:
  - Bounce rate > 5%
  - Complaint rate > 0.1%
  - Delivery rate < 95%

## API Endpoints

### Webhooks

#### POST /webhooks/email/sns
Receives AWS SNS notifications for:
- Inbound emails
- Delivery confirmations
- Bounce notifications
- Complaint notifications

**Authentication**: SNS signature verification

#### POST /webhooks/email/sendgrid
Receives SendGrid inbound email webhooks (fallback provider)

**Authentication**: Webhook secret verification

#### POST /webhooks/email/postfix
Receives Postfix inbound email webhooks (self-hosted option)

**Authentication**: Webhook secret verification

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Property-Based Tests
All property tests use fast-check with 100+ iterations:
```bash
npm test -- emailProviderRouting.property.test.ts
```

### Test Mode
Set `TEST_MODE=true` to bypass external APIs:
```bash
TEST_MODE=true npm test
```

## Monitoring

### Metrics
- Email send rate
- Bounce rate
- Complaint rate
- Delivery rate
- Queue processing time
- Error rates

### Alerts
- High bounce rate (> 5%)
- High complaint rate (> 0.1%)
- Low delivery rate (< 95%)
- Account restrictions
- System errors

### Logs
All email operations are logged with:
- Audit logs for security events
- Application logs for debugging
- Error logs for failures

## Operational Documentation

- **[Email Abuse Prevention](./docs/EMAIL_ABUSE_PREVENTION.md)**: Bounce and complaint handling
- **[Blocklist Management](./docs/EMAIL_BLOCKLIST.md)**: User blocklist operations
- **[Account Review Process](./docs/EMAIL_ACCOUNT_REVIEW.md)**: Complaint tracking and restrictions
- **[Email Metrics](./docs/EMAIL_METRICS.md)**: Quality monitoring and alerting
- **[Operations Runbook](./docs/EMAIL_OPERATIONS_RUNBOOK.md)**: Day-to-day operations
- **[Troubleshooting Guide](./docs/EMAIL_TROUBLESHOOTING.md)**: Common issues and solutions

## Development

### Running Locally
```bash
# Start infrastructure
docker-compose up -d postgres redis minio

# Install dependencies
npm install

# Run migrations
npm run migrate

# Start development server
npm run dev
```

### Adding New Email Providers
1. Implement provider service in `src/services/`
2. Add provider case to `EmailService.sendEmail()`
3. Add environment variables to `.env.example`
4. Update provider routing tests
5. Document configuration

### Database Migrations
```bash
# Create new migration
touch src/database/migrations/XXX_description.sql

# Run migrations
npm run migrate
```

## Security

### Email Validation
- All email addresses validated before processing
- HTML content sanitized to prevent XSS
- Body length limits enforced

### Webhook Security
- SNS signature verification required
- Webhook secrets for other providers
- Rate limiting on webhook endpoints

### Access Control
- AWS credentials restricted to minimum permissions
- Database credentials rotated regularly
- Audit logging for all operations

## Performance

### Asynchronous Processing
- Email-to-fax conversion via BullMQ queues
- Webhook processing returns 200 OK immediately
- Background workers handle actual processing

### Database Optimization
- Indexes on frequently queried fields
- Connection pooling for PostgreSQL
- Query optimization for thread retrieval

### Caching
- Redis for queue management
- In-memory caching for frequently accessed data

## Support

For issues or questions:
1. Check [Troubleshooting Guide](./docs/EMAIL_TROUBLESHOOTING.md)
2. Review [Operations Runbook](./docs/EMAIL_OPERATIONS_RUNBOOK.md)
3. Check application logs
4. Contact system administrators

## License

MIT
