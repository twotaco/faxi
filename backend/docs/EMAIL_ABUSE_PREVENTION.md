# Email Abuse Prevention

This document describes the bounce and complaint handling system for Faxi's email infrastructure.

## Overview

The abuse prevention system protects Faxi's email reputation and ensures compliance with AWS SES policies by:
- Monitoring bounce and complaint rates
- Notifying users of delivery issues
- Tracking complaint patterns
- Restricting accounts with excessive complaints
- Providing email etiquette guidance

## Components

### BounceComplaintHandler

Service responsible for processing bounce and complaint notifications from AWS SES.

**Location**: `src/services/bounceComplaintHandler.ts`

**Key Methods**:
- `handleBounce()`: Processes bounce notifications
- `handleComplaint()`: Processes complaint notifications
- `generateBounceNotificationFax()`: Creates user-facing bounce faxes
- `generateComplaintNotificationFax()`: Creates complaint notification faxes with etiquette guidance

### EmailDeliveryTracker

Tracks email delivery status and updates database records.

**Location**: `src/services/emailDeliveryTracker.ts`

**Key Methods**:
- `handleDelivery()`: Updates status to 'delivered'
- `handleBounce()`: Updates status to 'bounced', triggers error fax
- `handleComplaint()`: Updates status to 'complained'

### AccountReviewService

Manages complaint tracking and account restrictions.

**Location**: `src/services/accountReviewService.ts`

**Key Methods**:
- `recordComplaint()`: Records complaint in database
- `checkAccountStatus()`: Checks complaint count against thresholds
- `restrictAccount()`: Restricts user's outbound email
- `getComplaintHistory()`: Retrieves complaint history


## Bounce Handling

### Bounce Types

#### Hard Bounce
Permanent delivery failure. Email address doesn't exist or domain is invalid.

**Actions**:
1. Update email_messages status to 'bounced'
2. Record bounce event in email_metrics
3. Generate error notification fax for user
4. Log event in audit system

**User Notification**:
```
EMAIL DELIVERY FAILED

Your email to {recipient} could not be delivered.

Reason: {bounce_reason}

The email address may not exist or may be invalid.
Please verify the email address and try again.

Reference: {message_id}
```

#### Soft Bounce
Temporary delivery failure. Mailbox full, server temporarily unavailable.

**Actions**:
1. Retry sending up to 3 times with exponential backoff
2. If still failing after 3 attempts, treat as hard bounce
3. Log all retry attempts

**Retry Schedule**:
- Attempt 1: Immediate
- Attempt 2: After 5 minutes
- Attempt 3: After 15 minutes
- After 3 failures: Send error notification fax

### Bounce Rate Monitoring

**Threshold**: 5% bounce rate

**Calculation**: `(total_bounces / total_sent) * 100`

**Actions when threshold exceeded**:
1. Alert system administrators
2. Review recent email sends
3. Investigate potential issues (invalid addresses, domain problems)
4. Consider temporary sending restrictions


## Complaint Handling

### What is a Complaint?

A complaint occurs when an email recipient marks an email as spam or reports it as abuse to their email provider.

### Complaint Processing

**When a complaint is received**:
1. Update email_messages status to 'complained'
2. Record complaint in user_complaints table
3. Increment user's complaint count
4. Check complaint count against thresholds
5. Generate complaint notification fax with etiquette guidance
6. Log event in audit system

### Complaint Notification Fax

**Content includes**:
- Notification that recipient marked email as spam
- Email etiquette guidance
- Tips for avoiding future complaints
- Warning about potential account restrictions

**Example**:
```
EMAIL COMPLAINT RECEIVED

A recipient has marked your email as spam.

Recipient: {recipient}
Subject: {subject}
Date: {date}

EMAIL ETIQUETTE TIPS:
- Only send emails to people who expect to hear from you
- Keep messages relevant and concise
- Avoid sending too many emails to the same person
- Respect unsubscribe requests
- Use clear, professional language

WARNING: Multiple complaints may result in account restrictions.

Current complaint count: {count} in last 30 days

Reference: {message_id}
```

### Complaint Rate Monitoring

**Threshold**: 0.1% complaint rate

**Calculation**: `(total_complaints / total_sent) * 100`

**Actions when threshold exceeded**:
1. Alert system administrators immediately
2. Review user's recent email activity
3. Consider account restrictions
4. Investigate potential abuse patterns


## Account Restrictions

### Complaint Thresholds

#### Warning Level: 3 complaints in 30 days
**Actions**:
- Flag account for review
- Send alert to system administrators
- Send warning fax to user
- Monitor future email activity closely

**Warning Fax Content**:
```
ACCOUNT WARNING

Your account has received 3 spam complaints in the last 30 days.

This is a warning that your email sending privileges may be restricted
if additional complaints are received.

Please review our email etiquette guidelines and ensure you are only
sending emails to recipients who expect to hear from you.

If you have questions, please contact support.
```

#### Restriction Level: 5 complaints in 30 days
**Actions**:
- Restrict outbound email sending
- Send alert to system administrators
- Send restriction notification fax to user
- Require manual review before lifting restriction

**Restriction Fax Content**:
```
ACCOUNT RESTRICTED

Your email sending privileges have been temporarily restricted due to
multiple spam complaints (5 in the last 30 days).

You will not be able to send emails via fax until this restriction is
lifted by our support team.

To request a review, please contact support and explain:
- Why you believe the complaints were received
- What steps you will take to prevent future complaints

We take email abuse seriously to maintain service quality for all users.
```

### Database Fields

**users table**:
- `email_restricted`: Boolean flag (true when restricted)
- `email_restricted_at`: Timestamp when restriction was applied
- `email_restriction_reason`: Text description of restriction reason

### Lifting Restrictions

**Process**:
1. Administrator reviews complaint history
2. Administrator reviews user's email content
3. Administrator contacts user if needed
4. If appropriate, administrator lifts restriction
5. System sends confirmation fax to user

**Criteria for lifting**:
- User demonstrates understanding of email etiquette
- Sufficient time has passed (typically 30+ days)
- No pattern of intentional abuse
- User commits to following guidelines


## Database Schema

### user_complaints table
```sql
CREATE TABLE user_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id VARCHAR(255) NOT NULL,
  complained_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  complaint_type VARCHAR(50),
  details TEXT
);

CREATE INDEX idx_user_complaints_user_id ON user_complaints(user_id);
CREATE INDEX idx_user_complaints_date ON user_complaints(complained_at);
```

### email_metrics table
```sql
CREATE TABLE email_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(20) NOT NULL, -- 'sent', 'delivered', 'bounced', 'complained'
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message_id VARCHAR(255),
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  details JSONB
);

CREATE INDEX idx_email_metrics_event_type ON email_metrics(event_type);
CREATE INDEX idx_email_metrics_occurred_at ON email_metrics(occurred_at);
CREATE INDEX idx_email_metrics_user_id ON email_metrics(user_id);
```

## AWS SES Integration

### SNS Notification Format

**Bounce Notification**:
```json
{
  "notificationType": "Bounce",
  "bounce": {
    "bounceType": "Permanent",
    "bouncedRecipients": [
      {
        "emailAddress": "recipient@example.com",
        "status": "5.1.1",
        "diagnosticCode": "smtp; 550 5.1.1 user unknown"
      }
    ],
    "timestamp": "2025-01-15T10:30:00.000Z"
  },
  "mail": {
    "messageId": "0000000000000000-00000000-0000-0000-0000-000000000000-000000"
  }
}
```

**Complaint Notification**:
```json
{
  "notificationType": "Complaint",
  "complaint": {
    "complainedRecipients": [
      {
        "emailAddress": "recipient@example.com"
      }
    ],
    "timestamp": "2025-01-15T10:30:00.000Z",
    "feedbackType": "abuse"
  },
  "mail": {
    "messageId": "0000000000000000-00000000-0000-0000-0000-000000000000-000000"
  }
}
```


## Monitoring and Alerts

### Metrics to Monitor

1. **Bounce Rate**: Total bounces / Total sent
2. **Complaint Rate**: Total complaints / Total sent
3. **Hard Bounce Rate**: Hard bounces / Total sent
4. **Soft Bounce Rate**: Soft bounces / Total sent
5. **Accounts Flagged**: Count of accounts with 3+ complaints
6. **Accounts Restricted**: Count of restricted accounts

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Bounce Rate | > 3% | > 5% |
| Complaint Rate | > 0.05% | > 0.1% |
| Hard Bounce Rate | > 2% | > 4% |
| Accounts Flagged | > 5 | > 10 |
| Accounts Restricted | > 2 | > 5 |

### Alert Actions

**Warning Level**:
- Log alert in monitoring system
- Send notification to operations team
- Review metrics dashboard

**Critical Level**:
- Immediate notification to administrators
- Review recent email activity
- Consider temporary sending restrictions
- Investigate root cause

## Best Practices

### For Users

1. **Only send emails to known contacts**
2. **Keep messages relevant and concise**
3. **Avoid sending too many emails**
4. **Use clear, professional language**
5. **Respect recipient preferences**

### For Administrators

1. **Monitor bounce and complaint rates daily**
2. **Review flagged accounts promptly**
3. **Investigate patterns in complaints**
4. **Maintain AWS SES reputation**
5. **Document restriction decisions**
6. **Provide clear guidance to users**

## Troubleshooting

### High Bounce Rate

**Possible Causes**:
- Invalid email addresses in address book
- Typos in email addresses
- Outdated contact information
- Domain configuration issues

**Actions**:
1. Review recent bounced emails
2. Check for patterns (same domain, similar addresses)
3. Verify DNS configuration
4. Clean up invalid addresses from address book

### High Complaint Rate

**Possible Causes**:
- Users sending unsolicited emails
- Poor email content quality
- Too frequent emails
- Misunderstanding of email etiquette

**Actions**:
1. Review complained emails for patterns
2. Contact affected users for education
3. Improve email etiquette guidance
4. Consider additional user training

### Account Restrictions Not Working

**Check**:
1. Database field `email_restricted` is set correctly
2. EmailService checks restriction before sending
3. Restriction fax was sent to user
4. Audit logs show restriction event

## References

- [AWS SES Bounce and Complaint Handling](https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity.html)
- [Email Metrics Documentation](./EMAIL_METRICS.md)
- [Operations Runbook](./EMAIL_OPERATIONS_RUNBOOK.md)
