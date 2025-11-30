# Requirements Document: Email System Architecture

## Introduction

This document specifies the requirements for Faxi's comprehensive email system architecture. The system enables bidirectional email communication for fax users through automatically assigned email addresses (format: `{phone_number}@me.faxi.jp`). The system handles automatic user registration, inbound email processing, outbound email sending, and email-to-fax conversion using AWS SES as the unified email platform.

## Glossary

- **Faxi System**: The fax-to-internet bridge service
- **Email Bridge**: The component that converts between email and fax formats
- **User Email Address**: An automatically assigned email address in the format `{phone_number}@me.faxi.jp`
- **AWS SES**: Amazon Simple Email Service, the email platform provider
- **Inbound Email**: Email sent to a Faxi user's email address from external senders
- **Outbound Email**: Email sent from a Faxi user (via fax) to external recipients
- **Welcome Fax**: Initial fax sent to new users containing their email address and instructions
- **Email-to-Fax Conversion**: Process of converting received emails into fax format for delivery
- **Fax-to-Email Conversion**: Process of converting fax requests into email messages
- **Email Thread**: A conversation consisting of multiple related email messages
- **Email Provider**: The service handling email delivery (AWS SES)
- **Webhook Handler**: Component that receives and processes email delivery notifications
- **Email Service**: Abstraction layer for sending emails through various providers
- **User Registration**: Process of creating a new user account on first fax interaction

## Requirements

### Requirement 1: Automatic User Registration

**User Story:** As a first-time fax sender, I want to be automatically registered when I send my first fax, so that I can immediately start using Faxi services without manual setup.

#### Acceptance Criteria

1. WHEN a fax is received from an unregistered phone number THEN the Faxi System SHALL create a new user account with that phone number
2. WHEN a new user account is created THEN the Faxi System SHALL generate a unique email address in the format `{phone_number}@me.faxi.jp` without any symbols (eg. +81-03-1234-1234 = 810312341234@me.faxi.jp)
3. WHEN a new user account is created THEN the Faxi System SHALL store the user record with phone number, email address, and creation timestamp
4. WHEN a new user is registered THEN the Faxi System SHALL enqueue a welcome fax job for delivery
5. WHEN the welcome fax is generated THEN the Faxi System SHALL include the user's assigned email address prominently

### Requirement 2: Welcome Fax Delivery

**User Story:** As a new Faxi user, I want to receive a welcome fax with my email address and instructions and policies, so that I understand how to use the email features.

#### Acceptance Criteria

1. WHEN a welcome fax is generated THEN the Faxi System SHALL include the user's email address in large, readable text
2. WHEN a welcome fax is generated THEN the Faxi System SHALL include instructions for sending emails via fax
3. WHEN a welcome fax is generated THEN the Faxi System SHALL include instructions for receiving emails via fax
4. WHEN a welcome fax is generated THEN the Faxi System SHALL include example email request formats
5. WHEN a welcome fax is sent THEN the Faxi System SHALL mark the user's `welcomeFaxSent` preference as true

### Requirement 3: Inbound Email Processing

**User Story:** As a Faxi user, I want to receive emails sent to my Faxi email address as faxes, so that I can read my emails without internet access.

#### Acceptance Criteria

1. WHEN an email is sent to a valid Faxi email address THEN AWS SES SHALL accept the email and trigger a webhook notification
2. WHEN the Email Bridge receives an email webhook THEN the Faxi System SHALL extract the recipient phone number from the email address
3. WHEN the Email Bridge processes an inbound email THEN the Faxi System SHALL validate that the recipient email address matches the format `{phone_number}@me.faxi.jp`
4. WHEN an inbound email is validated THEN the Faxi System SHALL find or create the user account for that phone number
5. WHEN an inbound email is processed THEN the Faxi System SHALL store the email in the email_threads and email_messages tables
6. WHEN an inbound email is stored THEN the Faxi System SHALL enqueue an email-to-fax conversion job
7. WHEN an email-to-fax conversion completes THEN the Faxi System SHALL send the converted fax to the user's phone number
8. IF an email is sent to an invalid Faxi email address THEN AWS SES SHALL reject the email with a bounce notification

### Requirement 4: Email-to-Fax Conversion

**User Story:** As a Faxi user, I want received emails to be formatted clearly on fax pages, so that I can easily read the email content.

#### Acceptance Criteria

1. WHEN converting an email to fax THEN the Email Bridge SHALL extract the sender address, subject, and body text
2. WHEN converting an email with HTML content THEN the Email Bridge SHALL convert HTML to plain text while preserving readability
3. WHEN converting an email to fax THEN the Email Bridge SHALL remove email signatures and quoted reply text
4. WHEN converting an email to fax THEN the Email Bridge SHALL limit body length to prevent excessive pages
5. WHEN an email contains attachments THEN the Email Bridge SHALL include an attachment notification with filenames and sizes
6. WHEN generating an email fax THEN the Email Bridge SHALL include a reference ID for reply tracking
7. WHEN generating an email fax THEN the Email Bridge SHALL format the content for optimal fax readability

### Requirement 5: Outbound Email Sending

**User Story:** As a Faxi user, I want to send emails by faxing an email request, so that I can communicate with people who have email addresses.

#### Acceptance Criteria

1. WHEN a user faxes an email request THEN the Faxi System SHALL extract the recipient email address from the fax content
2. WHEN a user faxes an email request THEN the Faxi System SHALL extract the email subject and body from the fax content
3. WHEN sending an outbound email THEN the Email Service SHALL use the user's Faxi email address as the sender
4. WHEN sending an outbound email THEN the Email Service SHALL send the email through AWS SES
5. WHEN an outbound email is sent successfully THEN the Email Service SHALL store the email in the email_threads and email_messages tables
6. WHEN an outbound email is sent successfully THEN the Faxi System SHALL send a confirmation fax to the user
7. IF an outbound email fails to send THEN the Faxi System SHALL send an error notification fax to the user

### Requirement 6: Email Service Abstraction

**User Story:** As a system administrator, I want the email system to support multiple providers through a unified interface, so that we can switch providers or use different providers for different purposes.

#### Acceptance Criteria

1. WHEN the Email Service is initialized THEN the Faxi System SHALL load the configured email provider from environment variables
2. WHEN sending an email THEN the Email Service SHALL route the request to the configured provider (AWS SES, SendGrid, or Postfix)
3. WHEN using AWS SES THEN the Email Service SHALL use the AWS SDK to send emails
4. WHEN using SendGrid THEN the Email Service SHALL use the SendGrid API to send emails
5. WHEN using Postfix THEN the Email Service SHALL use SMTP to send emails
6. WHEN an email send operation completes THEN the Email Service SHALL return a standardized result with success status and message ID
7. WHEN an email send operation fails THEN the Email Service SHALL return a standardized error with failure reason

### Requirement 7: AWS SES Configuration

**User Story:** As a system administrator, I want to configure AWS SES for all email operations, so that we have a reliable, scalable email platform.

#### Acceptance Criteria

1. WHEN configuring AWS SES THEN the Faxi System SHALL verify the domain `me.faxi.jp` in AWS SES
2. WHEN configuring AWS SES THEN the Faxi System SHALL configure MX records to route inbound emails to AWS SES
3. WHEN configuring AWS SES THEN the Faxi System SHALL configure an SES receipt rule to forward emails to the webhook endpoint
4. WHEN configuring AWS SES THEN the Faxi System SHALL configure DKIM signing for outbound emails
5. WHEN configuring AWS SES THEN the Faxi System SHALL configure SPF records for email authentication
6. WHEN AWS SES receives an inbound email THEN AWS SES SHALL publish an SNS notification to the configured topic
7. WHEN the SNS topic receives a notification THEN AWS SES SHALL invoke the webhook endpoint with the email data

### Requirement 8: Email Thread Management

**User Story:** As a Faxi user, I want my email conversations to be tracked as threads, so that I can follow ongoing conversations.

#### Acceptance Criteria

1. WHEN an email is received or sent THEN the Faxi System SHALL generate or retrieve a thread ID based on subject and participants
2. WHEN storing an email THEN the Faxi System SHALL create or update the email thread record
3. WHEN storing an email THEN the Faxi System SHALL create an email message record linked to the thread
4. WHEN updating a thread THEN the Faxi System SHALL increment the message count and update the last message timestamp
5. WHEN a user requests email history THEN the Faxi System SHALL retrieve messages grouped by thread
6. WHEN displaying email threads THEN the Faxi System SHALL show the most recent threads first
7. WHEN converting a thread to fax THEN the Email Bridge SHALL format multiple messages in chronological order

### Requirement 9: Email Validation and Security

**User Story:** As a system administrator, I want email operations to be validated and secure, so that we prevent abuse and protect user data.

#### Acceptance Criteria

1. WHEN receiving an email webhook THEN the Faxi System SHALL verify the webhook signature from AWS SES
2. WHEN receiving an email webhook THEN the Faxi System SHALL validate the SNS message signature
3. WHEN processing an inbound email THEN the Faxi System SHALL validate the recipient email address format
4. WHEN sending an outbound email THEN the Email Service SHALL validate the recipient email address format
5. WHEN processing emails THEN the Faxi System SHALL sanitize HTML content to prevent XSS attacks
6. WHEN storing email content THEN the Faxi System SHALL limit body length to prevent database overflow
7. WHEN rate limiting is exceeded THEN the Faxi System SHALL reject email operations with appropriate error messages

### Requirement 10: Email Delivery Tracking

**User Story:** As a Faxi user, I want to know when my emails are delivered or fail, so that I can take appropriate action.

#### Acceptance Criteria

1. WHEN an outbound email is sent THEN the Email Service SHALL store the message ID for tracking
2. WHEN AWS SES delivers an email THEN AWS SES SHALL publish a delivery notification to the SNS topic
3. WHEN AWS SES fails to deliver an email THEN AWS SES SHALL publish a bounce notification to the SNS topic
4. WHEN a delivery notification is received THEN the Faxi System SHALL update the email message status to delivered
5. WHEN a bounce notification is received THEN the Faxi System SHALL update the email message status to failed
6. WHEN an email delivery fails THEN the Faxi System SHALL send a failure notification fax to the user
7. WHEN tracking email delivery THEN the Faxi System SHALL log all delivery events in the audit log

### Requirement 11: Email Address Assignment

**User Story:** As a Faxi user, I want my email address to be based on my phone number, so that it's easy to remember and unique.

#### Acceptance Criteria

1. WHEN generating an email address THEN the Faxi System SHALL remove all non-digit characters from the phone number
2. WHEN generating an email address THEN the Faxi System SHALL format it as `{clean_phone_number}@me.faxi.jp`
3. WHEN creating a user THEN the Faxi System SHALL ensure the email address is unique in the database
4. WHEN parsing an email address THEN the Faxi System SHALL extract the phone number from the local part
5. WHEN validating an email address THEN the Faxi System SHALL verify it matches the pattern `^\d+@me\.faxi\.jp$`

### Requirement 12: Error Handling and Recovery

**User Story:** As a system administrator, I want comprehensive error handling for email operations, so that failures are logged and users are notified.

#### Acceptance Criteria

1. WHEN an email operation fails THEN the Faxi System SHALL log the error with full context in the audit log
2. WHEN an email-to-fax conversion fails THEN the Faxi System SHALL retry the operation up to 3 times
3. WHEN an outbound email send fails THEN the Faxi System SHALL send an error notification fax to the user
4. WHEN a webhook processing fails THEN the Faxi System SHALL return an error status to trigger provider retry
5. WHEN AWS SES is unavailable THEN the Email Service SHALL fall back to an alternative provider if configured
6. WHEN email storage fails THEN the Faxi System SHALL log the error but continue with email delivery
7. WHEN critical email operations fail THEN the Faxi System SHALL alert system administrators

### Requirement 13: Contact Management Integration

**User Story:** As a Faxi user, I want my email contacts to be automatically managed, so that I can easily send emails to people I communicate with regularly.

#### Acceptance Criteria

1. WHEN an inbound email is received from a new sender THEN the Faxi System SHALL automatically create an address book entry with the sender's email address
2. WHEN a user faxes an email request with a contact name THEN the Faxi System SHALL search the address book and resolve the name to an email address
3. WHEN creating a contact from an inbound email THEN the Faxi System SHALL extract the sender's name from email headers if available
4. WHEN a contact already exists for an email address THEN the Faxi System SHALL update the contact name if a new name is provided
5. WHEN resolving a contact name THEN the Faxi System SHALL perform case-insensitive partial matching on name and relationship fields
6. WHEN multiple contacts match a search query THEN the Faxi System SHALL send a clarification fax listing the matching contacts
7. WHEN no contacts match a search query THEN the Faxi System SHALL send an error fax indicating the contact was not found

### Requirement 14: Bounce and Complaint Notification Handling

**User Story:** As a Faxi user, I want to be notified via fax when my emails bounce or generate complaints, so that I can understand delivery issues and adjust my behavior.

#### Acceptance Criteria

1. WHEN AWS SES generates a bounce notification THEN the Faxi System SHALL receive the notification via SNS webhook
2. WHEN a hard bounce occurs THEN the Faxi System SHALL send an error notification fax to the user explaining the email couldn't be delivered
3. WHEN a soft bounce occurs THEN the Faxi System SHALL retry sending up to 3 times with exponential backoff before notifying the user
4. WHEN a bounce notification is processed THEN the Faxi System SHALL log the bounce event in the audit system
5. WHEN AWS SES generates a complaint notification THEN the Faxi System SHALL receive the notification via SNS webhook
6. WHEN a complaint occurs THEN the Faxi System SHALL send a notification fax to the user explaining the complaint
7. WHEN a complaint notification fax is sent THEN the Faxi System SHALL include email etiquette guidance
8. WHEN a complaint is processed THEN the Faxi System SHALL log the complaint event in the audit system

### Requirement 15: User Blocklist Management

**User Story:** As a Faxi user, I want to block unwanted email senders, so that I don't receive faxes from spammers or unwanted contacts.

#### Acceptance Criteria

1. WHEN a user faxes a block request with an email address THEN the Faxi System SHALL add that email address to the user's blocklist
2. WHEN an inbound email is received THEN the Faxi System SHALL check if the sender is on the user's blocklist before processing
3. WHEN an email is from a blocked sender THEN the Faxi System SHALL reject the email and not convert it to fax
4. WHEN a user faxes an unblock request THEN the Faxi System SHALL remove the email address from the user's blocklist
5. WHEN a block or unblock operation completes THEN the Faxi System SHALL send a confirmation fax to the user
6. WHEN storing a blocked email address THEN the Faxi System SHALL normalize the email address to lowercase
7. WHEN checking blocklist THEN the Faxi System SHALL perform case-insensitive matching

### Requirement 16: Account Review and Complaint Tracking

**User Story:** As a system administrator, I want to track user complaint rates and review accounts with repeated complaints, so that we can prevent abuse and maintain good sender reputation.

#### Acceptance Criteria

1. WHEN a complaint is received for a user THEN the Faxi System SHALL increment the user's complaint count
2. WHEN a user's complaint count exceeds 3 within 30 days THEN the Faxi System SHALL flag the account for review
3. WHEN an account is flagged for review THEN the Faxi System SHALL send an alert to system administrators
4. WHEN an account is flagged for review THEN the Faxi System SHALL send a warning fax to the user
5. WHEN a user's complaint count exceeds 5 within 30 days THEN the Faxi System SHALL restrict the user's outbound email sending
6. WHEN a user's account is restricted THEN the Faxi System SHALL send a notification fax explaining the restriction
7. WHEN reviewing an account THEN administrators SHALL be able to view complaint history and email content

### Requirement 17: Email Quality Monitoring

**User Story:** As a system administrator, I want to monitor email quality metrics, so that we can maintain good sender reputation with AWS SES.

#### Acceptance Criteria

1. WHEN emails are sent THEN the Faxi System SHALL track the total number of emails sent per day
2. WHEN bounces occur THEN the Faxi System SHALL calculate the bounce rate (bounces / total sent)
3. WHEN complaints occur THEN the Faxi System SHALL calculate the complaint rate (complaints / total sent)
4. WHEN emails are delivered THEN the Faxi System SHALL calculate the delivery rate (delivered / total sent)
5. WHEN bounce rate exceeds 5% THEN the Faxi System SHALL alert system administrators
6. WHEN complaint rate exceeds 0.1% THEN the Faxi System SHALL alert system administrators
7. WHEN delivery rate falls below 95% THEN the Faxi System SHALL alert system administrators
