# AWS SES Production Access Request - Response

## Subject: Re: Additional Information for SES Sending Limit Increase Request

---

Dear AWS SES Team,

Thank you for reviewing our request. I'm happy to provide detailed information about our use case for Amazon SES.

## Service Overview

**Service Name:** Faxi  
**Website:** https://faxi.jp  
**Domain for Sending:** me.faxi.jp  
**Service Type:** Fax-to-Internet Bridge for Elderly Users

Faxi is a social impact service that enables elderly Japanese citizens without internet access to send and receive emails through traditional fax machines. Our service bridges the digital divide by converting faxes to emails and emails to faxes, allowing offline users to communicate with family members and access online services.

## Email Use Case Details

### 1. How We Use Amazon SES

We use SES for two primary purposes:

**A. Inbound Email Processing:**
- Users are automatically assigned email addresses in the format: `{phone_number}@me.faxi.jp`
- When someone sends an email to a user's Faxi email address, SES receives it
- We convert the email to a fax and deliver it to the user's fax machine
- This allows offline users to receive emails from family, friends, and services

**B. Outbound Email Sending:**
- When a user faxes an email request to our service, we extract the recipient and message
- We send the email on behalf of the user from their `@me.faxi.jp` address
- We send confirmation faxes back to users confirming delivery or reporting errors
- All emails are transactional and user-initiated

### 2. Sending Frequency and Volume

**Current Status:** Development/Testing Phase  
**Expected Volume:**
- Initial Launch (Month 1-3): 100-500 emails/day
- Growth Phase (Month 4-12): 2,000-5,000 emails/day
- Steady State: 5,000-10,000 emails/day

**Sending Pattern:**
- Emails are sent in response to user fax requests (event-driven)
- Peak hours: 9 AM - 6 PM JST (business hours)
- No bulk sending or marketing campaigns
- 100% transactional emails only

### 3. Recipient List Management

**How Recipients Are Determined:**
- **Inbound:** Recipients are our registered users (verified by phone number)
- **Outbound:** Recipients are specified by users in their fax requests
- We do NOT maintain marketing lists or send unsolicited emails
- Every email is either:
  - Sent TO a user (inbound email-to-fax conversion)
  - Sent FROM a user to their specified recipient (outbound user request)

**User Registration:**
- Users are automatically registered when they send their first fax
- Each user gets a unique email address based on their verified phone number
- Users opt-in by using the service

### 4. Bounce and Complaint Management

**Bounce Handling:**
- We use SNS notifications to track delivery, bounces, and complaints
- Hard bounces: We send an error notification fax to the user and log the failed address
- Soft bounces: We retry up to 3 times with exponential backoff
- Persistent bounce addresses are flagged and users are notified
- All bounce events are logged in our audit system

**Complaint Handling:**
- We monitor complaint rates via SNS notifications
- Any complaint triggers immediate investigation
- Users are notified if their outbound email generated a complaint
- We maintain a complaint rate target of < 0.1%
- Repeated complaints from a user result in account review

**Unsubscribe Requests:**
- For inbound emails: Recipients can stop emailing the user (standard email behavior)
- For outbound emails: Recipients can reply to the user requesting no further contact
- We include clear sender identification in all emails
- Users control their own email sending through fax requests

### 5. Email Content Quality

**Email Types We Send:**

**Type 1: User-Initiated Emails (Outbound)**
```
From: 09012345678@me.faxi.jp
To: family.member@example.com
Subject: Hello from Mom

Hi dear,

Thank you for your letter. I am doing well. 
The weather is nice today.

Love,
Mom

---
Sent via Faxi - Fax-to-Email Bridge
```

**Type 2: Inbound Email Notifications (Email-to-Fax)**
```
From: sender@example.com
To: 09012345678@me.faxi.jp
Subject: Checking in on you

[Email content is converted to fax and delivered to user's fax machine]
```

**Type 3: System Notifications**
```
From: notifications@me.faxi.jp
To: 09012345678@me.faxi.jp
Subject: Email Delivery Confirmation

Your email to family.member@example.com was delivered successfully.

Reference ID: FAX-2024-001234
Sent: 2024-01-15 14:30 JST
```

**Content Characteristics:**
- Personal, one-to-one communication
- No marketing or promotional content
- No attachments (converted to text descriptions)
- Plain text format for fax compatibility
- Clear sender identification
- All content is user-generated or system notifications

### 6. Domain Verification Status

**Current Status:**
- Domain `me.faxi.jp` is ready for verification
- We will complete DKIM, SPF, and MX record configuration immediately upon approval
- DNS is managed and ready for updates

**Verification Plan:**
1. Add SES verification TXT record to `me.faxi.jp`
2. Configure DKIM (3 CNAME records)
3. Configure SPF record: `v=spf1 include:amazonses.com ~all`
4. Configure MX records for inbound email
5. Set up SNS topic for delivery notifications

### 7. Technical Implementation

**Infrastructure:**
- Backend: Node.js with Express
- Email Service: AWS SES SDK v3
- Queue System: BullMQ with Redis for async processing
- Database: PostgreSQL for user and email tracking
- Monitoring: CloudWatch metrics and custom dashboards

**Best Practices We Follow:**
- Webhook signature verification for all SNS notifications
- Email address validation before sending
- HTML sanitization for security
- Rate limiting per user
- Comprehensive audit logging
- Retry logic with exponential backoff
- Circuit breaker for provider failures

### 8. Compliance and Privacy

- **User Privacy:** We do not read or store email content beyond operational needs
- **Data Retention:** Email metadata retained for 90 days, content for 7 days
- **GDPR Compliance:** Users can request data deletion
- **Japanese Privacy Laws:** Full compliance with Japan's privacy regulations
- **No Spam:** Zero tolerance policy for spam or abuse

### 9. Monitoring and Quality Assurance

**Metrics We Track:**
- Bounce rate (target: < 5%)
- Complaint rate (target: < 0.1%)
- Delivery rate (target: > 95%)
- Response time for email processing
- User satisfaction through fax feedback

**Quality Controls:**
- Manual review of first 100 emails sent
- Automated content filtering for spam indicators
- User education through welcome faxes
- Clear abuse reporting mechanism

## Summary

Faxi is a social impact service helping elderly Japanese citizens stay connected with their families through email, despite lacking internet access. Our use of SES is strictly transactional, user-initiated, and focused on bridging the digital divide for an underserved population.

We are committed to maintaining the highest standards of email deliverability and recipient satisfaction. We have implemented comprehensive bounce and complaint handling, and we will monitor all metrics closely to ensure we remain a good sender.

## Additional Information

- **Expected Launch Date:** Q1 2025
- **Target Market:** Japan (elderly population without internet)
- **Business Model:** Subscription-based service for social good
- **Support Contact:** robert.g.willson@gmail.com

We appreciate your consideration of our request and are happy to provide any additional information needed.

Thank you for your time and support.

Best regards,  
Robert Willson  
Faxi Development Team

---

**Note:** We will complete domain verification for `me.faxi.jp` immediately upon receiving guidance to proceed.
