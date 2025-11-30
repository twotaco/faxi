# Email Account Review Process

This document describes the account review and restriction process for managing users with excessive email complaints.

## Overview

The account review system protects Faxi's email reputation by:
- Tracking complaint rates per user
- Flagging accounts with multiple complaints
- Restricting accounts with excessive complaints
- Providing clear communication to users
- Maintaining audit trail for all actions

## Complaint Thresholds

### Warning Level: 3 Complaints in 30 Days

**Automatic Actions**:
1. Flag account for review
2. Send alert to system administrators
3. Send warning fax to user
4. Begin enhanced monitoring

**User Impact**:
- No immediate restrictions
- Receives warning about potential restrictions
- Email activity monitored more closely

### Restriction Level: 5 Complaints in 30 Days

**Automatic Actions**:
1. Restrict outbound email sending
2. Send alert to system administrators
3. Send restriction notification fax to user
4. Require manual review before lifting

**User Impact**:
- Cannot send emails via fax
- Must contact support for review
- Restriction remains until manually lifted


## Components

### AccountReviewService

Service responsible for complaint tracking and account restrictions.

**Location**: `src/services/accountReviewService.ts`

**Key Methods**:
- `recordComplaint(userId, messageId)`: Records complaint in database
- `checkAccountStatus(userId)`: Checks complaint count against thresholds
- `restrictAccount(userId, reason)`: Restricts user's outbound email
- `getComplaintHistory(userId, days)`: Retrieves complaint history

### Database Schema

```sql
-- Complaint tracking
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

-- User restriction fields
ALTER TABLE users ADD COLUMN email_restricted BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN email_restricted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN email_restriction_reason TEXT;
```

## Complaint Processing Flow

### Step 1: Complaint Received

When AWS SES sends a complaint notification:

1. **SNS webhook** receives notification
2. **SnsWebhookHandler** parses complaint data
3. **BounceComplaintHandler** processes complaint
4. **AccountReviewService** records complaint

### Step 2: Complaint Recording

```typescript
await accountReviewService.recordComplaint(userId, messageId);
```

**Actions**:
- Insert record into `user_complaints` table
- Log event in audit system
- Trigger status check

### Step 3: Status Check

```typescript
const status = await accountReviewService.checkAccountStatus(userId);
```

**Returns**:
```typescript
{
  userId: string;
  complaintCount30Days: number;
  status: 'active' | 'flagged' | 'restricted';
  restrictedAt?: Date;
  restrictionReason?: string;
}
```

### Step 4: Threshold Actions

**If 3 complaints**:
- Status changes to 'flagged'
- Administrator alert sent
- Warning fax sent to user

**If 5 complaints**:
- Status changes to 'restricted'
- Account restriction applied
- Administrator alert sent
- Restriction fax sent to user


## User Communication

### Warning Fax (3 Complaints)

```
ACCOUNT WARNING

Your account has received 3 spam complaints in the last 30 days.

WHAT THIS MEANS:
Your email sending privileges are currently active, but your account
has been flagged for review due to multiple complaints.

NEXT STEPS:
- Review our email etiquette guidelines
- Only send emails to recipients who expect to hear from you
- Keep messages relevant and professional
- Avoid sending too many emails to the same person

WARNING:
If you receive 2 more complaints within 30 days, your email sending
privileges will be temporarily restricted.

Current complaint count: 3 in last 30 days

If you have questions, please contact support.

Reference: {user_id}
```

### Restriction Fax (5 Complaints)

```
ACCOUNT RESTRICTED

Your email sending privileges have been temporarily restricted.

REASON:
Your account has received 5 spam complaints in the last 30 days.
This exceeds our acceptable threshold and indicates potential
email abuse.

WHAT THIS MEANS:
- You cannot send emails via fax until this restriction is lifted
- You can still receive emails as faxes
- This restriction requires manual review by our support team

TO REQUEST A REVIEW:
Please contact support and provide:
1. Explanation of why complaints were received
2. Steps you will take to prevent future complaints
3. Commitment to following email etiquette guidelines

We take email abuse seriously to maintain service quality for all
users and protect our email reputation.

Restriction applied: {date}
Reference: {user_id}

Support contact: support@faxi.jp
```


## Administrator Actions

### Reviewing Flagged Accounts

**Step 1: Identify flagged accounts**

Query for accounts with 3+ complaints:
```sql
SELECT 
  u.id,
  u.phone_number,
  u.email_address,
  COUNT(uc.id) as complaint_count,
  MAX(uc.complained_at) as last_complaint
FROM users u
JOIN user_complaints uc ON u.id = uc.user_id
WHERE uc.complained_at > NOW() - INTERVAL '30 days'
GROUP BY u.id
HAVING COUNT(uc.id) >= 3
ORDER BY complaint_count DESC, last_complaint DESC;
```

**Step 2: Review complaint history**

```typescript
const history = await accountReviewService.getComplaintHistory(userId, 30);
```

**Step 3: Review email content**

Check recent emails sent by user:
```sql
SELECT 
  em.id,
  em.to_addresses,
  em.subject,
  em.body,
  em.sent_at,
  em.delivery_status
FROM email_messages em
WHERE em.from_address = (SELECT email_address FROM users WHERE id = $1)
  AND em.direction = 'outbound'
  AND em.sent_at > NOW() - INTERVAL '30 days'
ORDER BY em.sent_at DESC;
```

**Step 4: Contact user if needed**

- Send fax requesting explanation
- Ask about email sending practices
- Provide education on email etiquette

**Step 5: Make decision**

- Continue monitoring (no action)
- Provide additional guidance
- Restrict account if pattern continues

### Reviewing Restricted Accounts

**Step 1: Identify restricted accounts**

```sql
SELECT 
  id,
  phone_number,
  email_address,
  email_restricted_at,
  email_restriction_reason
FROM users
WHERE email_restricted = true
ORDER BY email_restricted_at DESC;
```

**Step 2: Review restriction reason**

Check why account was restricted:
- Complaint count
- Type of complaints
- Pattern of behavior
- User response

**Step 3: Review complaint history since restriction**

```sql
SELECT COUNT(*) as new_complaints
FROM user_complaints
WHERE user_id = $1
  AND complained_at > (SELECT email_restricted_at FROM users WHERE id = $1);
```

**Step 4: Make decision**

**Criteria for lifting restriction**:
- Sufficient time passed (typically 30+ days)
- User demonstrates understanding
- No new complaints since restriction
- User commits to guidelines

**Criteria for maintaining restriction**:
- Recent restriction (< 30 days)
- New complaints since restriction
- Pattern of intentional abuse
- User unresponsive or uncooperative


### Lifting Restrictions

**Step 1: Update database**

```sql
UPDATE users
SET 
  email_restricted = false,
  email_restricted_at = NULL,
  email_restriction_reason = NULL
WHERE id = $1;
```

**Step 2: Log action**

```typescript
await auditLogService.log({
  action: 'email_restriction_lifted',
  userId: userId,
  performedBy: adminId,
  details: {
    reason: 'User demonstrated understanding of guidelines',
    reviewDate: new Date()
  }
});
```

**Step 3: Send confirmation fax**

```
RESTRICTION LIFTED

Your email sending privileges have been restored.

WHAT THIS MEANS:
You can now send emails via fax again.

IMPORTANT REMINDERS:
- Only send emails to recipients who expect to hear from you
- Keep messages relevant and professional
- Follow email etiquette guidelines
- Avoid sending too many emails

Your account will continue to be monitored. Additional complaints
may result in permanent restrictions.

Thank you for your cooperation.

Reference: {user_id}
```

## Monitoring and Reporting

### Daily Metrics

**Accounts by status**:
```sql
SELECT 
  CASE 
    WHEN email_restricted THEN 'restricted'
    WHEN (SELECT COUNT(*) FROM user_complaints uc 
          WHERE uc.user_id = u.id 
          AND uc.complained_at > NOW() - INTERVAL '30 days') >= 3 
    THEN 'flagged'
    ELSE 'active'
  END as status,
  COUNT(*) as count
FROM users u
WHERE email_address IS NOT NULL
GROUP BY status;
```

**New complaints today**:
```sql
SELECT COUNT(*) as new_complaints
FROM user_complaints
WHERE complained_at >= CURRENT_DATE;
```

**Accounts flagged today**:
```sql
SELECT 
  u.id,
  u.phone_number,
  u.email_address,
  COUNT(uc.id) as complaint_count
FROM users u
JOIN user_complaints uc ON u.id = uc.user_id
WHERE uc.complained_at > NOW() - INTERVAL '30 days'
GROUP BY u.id
HAVING COUNT(uc.id) = 3
  AND MAX(uc.complained_at) >= CURRENT_DATE;
```


### Weekly Reports

**Complaint trends**:
```sql
SELECT 
  DATE_TRUNC('week', complained_at) as week,
  COUNT(*) as complaints,
  COUNT(DISTINCT user_id) as affected_users
FROM user_complaints
WHERE complained_at > NOW() - INTERVAL '90 days'
GROUP BY week
ORDER BY week DESC;
```

**Top complained users**:
```sql
SELECT 
  u.phone_number,
  u.email_address,
  COUNT(uc.id) as complaint_count,
  u.email_restricted
FROM users u
JOIN user_complaints uc ON u.id = uc.user_id
WHERE uc.complained_at > NOW() - INTERVAL '30 days'
GROUP BY u.id
ORDER BY complaint_count DESC
LIMIT 10;
```

## Best Practices

### For Administrators

1. **Review flagged accounts promptly** (within 24 hours)
2. **Document all decisions** in audit logs
3. **Communicate clearly** with users
4. **Be consistent** in applying policies
5. **Provide education** not just punishment
6. **Monitor trends** to identify systemic issues
7. **Update guidelines** based on patterns

### For Users

1. **Understand email etiquette** before sending
2. **Only email known contacts** or those expecting communication
3. **Keep messages relevant** and professional
4. **Respond to warnings** promptly
5. **Contact support** if you have questions
6. **Learn from mistakes** to avoid future issues

## Troubleshooting

### Account Not Restricted Despite 5 Complaints

**Check**:
1. Verify complaint count in last 30 days
2. Check `checkAccountStatus()` is called after recording complaint
3. Verify `restrictAccount()` is called when threshold reached
4. Check database fields are updated
5. Verify restriction fax was sent

### Restriction Not Enforced

**Check**:
1. Verify `email_restricted` field is true
2. Check EmailService checks restriction before sending
3. Verify error fax is sent when restricted user tries to send
4. Check audit logs for restriction check

### False Positives

**Investigate**:
1. Review complaint details
2. Check if complaints are legitimate
3. Consider if threshold is too low
4. Review user's email content
5. Contact user for explanation

## References

- [Email Abuse Prevention](./EMAIL_ABUSE_PREVENTION.md)
- [Email Metrics](./EMAIL_METRICS.md)
- [Operations Runbook](./EMAIL_OPERATIONS_RUNBOOK.md)
- [Troubleshooting Guide](./EMAIL_TROUBLESHOOTING.md)
