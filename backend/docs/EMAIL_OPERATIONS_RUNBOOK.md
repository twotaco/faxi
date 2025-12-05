# Email System Operations Runbook

This document provides day-to-day operational procedures for the Faxi email system.

## Daily Operations

### Morning Checklist

**Time**: Start of business day

1. **Check Email Metrics Dashboard**
   - Review 24-hour metrics
   - Check for alerts
   - Verify all metrics within acceptable range

2. **Review Overnight Alerts**
   - Check Slack #email-alerts channel
   - Review PagerDuty incidents
   - Address any critical issues

3. **Check AWS SES Status**
   - Visit AWS SES console
   - Check sending statistics
   - Verify account is not in sandbox mode
   - Check for any AWS service issues

4. **Review Flagged Accounts**
   - Check for newly flagged accounts (3+ complaints)
   - Review complaint details
   - Plan follow-up actions

5. **Check Queue Health**
   - Verify email-to-fax queue is processing
   - Check for stuck jobs
   - Review error rates

### End of Day Checklist

**Time**: End of business day

1. **Review Daily Metrics**
   - Compare to previous day
   - Note any trends
   - Document any issues

2. **Check Pending Reviews**
   - Review accounts awaiting manual review
   - Update status of ongoing investigations
   - Document decisions

3. **Prepare Handoff**
   - Document any ongoing issues
   - Note items for next day
   - Update on-call engineer


## Weekly Operations

### Monday Tasks

1. **Generate Weekly Report**
   - Calculate metrics for previous week
   - Compare to previous weeks
   - Identify trends
   - Share with management

2. **Review Account Restrictions**
   - Check all restricted accounts
   - Determine if any can be lifted
   - Contact users if needed
   - Document decisions

3. **Clean Up Blocklists**
   - Review users with large blocklists
   - Check for patterns
   - Provide guidance if needed

### Wednesday Tasks

1. **Mid-Week Metrics Check**
   - Review metrics for first half of week
   - Compare to targets
   - Adjust if needed

2. **Review Bounce Patterns**
   - Check for recurring bounce issues
   - Identify problematic domains
   - Plan remediation

### Friday Tasks

1. **Prepare Weekend Handoff**
   - Document any ongoing issues
   - Brief on-call engineer
   - Ensure contact information is current

2. **Review Week's Activities**
   - Summarize actions taken
   - Document lessons learned
   - Plan improvements

## Monthly Operations

### First Monday of Month

1. **Generate Monthly Report**
   - Calculate metrics for previous month
   - Compare to previous months
   - Identify long-term trends
   - Share with stakeholders

2. **Review AWS SES Costs**
   - Check AWS billing
   - Verify costs are within budget
   - Identify optimization opportunities

3. **Audit Account Restrictions**
   - Review all restricted accounts
   - Check restriction durations
   - Plan follow-ups

### Mid-Month

1. **Review Documentation**
   - Update runbooks if needed
   - Document new procedures
   - Share updates with team

2. **Test Disaster Recovery**
   - Verify backups are working
   - Test restoration procedures
   - Document any issues


## Common Procedures

### Handling High Bounce Rate Alert

**Trigger**: Bounce rate > 5%

**Steps**:
1. **Acknowledge alert** in monitoring system
2. **Check recent bounces**:
   ```sql
   SELECT 
     message_id,
     details->>'to' as recipient,
     details->>'reason' as reason,
     occurred_at
   FROM email_metrics
   WHERE event_type = 'bounced'
     AND occurred_at > NOW() - INTERVAL '24 hours'
   ORDER BY occurred_at DESC
   LIMIT 50;
   ```
3. **Identify patterns**:
   - Same domain bouncing?
   - Same user sending to invalid addresses?
   - Specific error codes?
4. **Take action**:
   - If domain issue: Check DNS configuration
   - If user issue: Contact user, provide guidance
   - If AWS issue: Contact AWS support
5. **Monitor for improvement**
6. **Document resolution**

### Handling High Complaint Rate Alert

**Trigger**: Complaint rate > 0.1%

**Steps**:
1. **Acknowledge alert** (URGENT - high priority)
2. **Check recent complaints**:
   ```sql
   SELECT 
     user_id,
     message_id,
     details,
     occurred_at
   FROM email_metrics
   WHERE event_type = 'complained'
     AND occurred_at > NOW() - INTERVAL '24 hours'
   ORDER BY occurred_at DESC;
   ```
3. **Identify affected users**
4. **Review email content** from complained messages
5. **Take immediate action**:
   - Contact users immediately
   - Consider temporary restrictions
   - Provide email etiquette education
6. **Monitor closely** for next 24-48 hours
7. **Escalate to management** if pattern continues
8. **Document all actions**

### Reviewing Flagged Account

**Trigger**: Account reaches 3 complaints in 30 days

**Steps**:
1. **Gather information**:
   ```sql
   SELECT 
     uc.complained_at,
     uc.message_id,
     uc.complaint_type,
     uc.details
   FROM user_complaints uc
   WHERE uc.user_id = $1
     AND uc.complained_at > NOW() - INTERVAL '30 days'
   ORDER BY uc.complained_at DESC;
   ```
2. **Review email history**:
   ```sql
   SELECT 
     to_addresses,
     subject,
     body,
     sent_at
   FROM email_messages
   WHERE from_address = (SELECT email_address FROM users WHERE id = $1)
     AND direction = 'outbound'
     AND sent_at > NOW() - INTERVAL '30 days'
   ORDER BY sent_at DESC;
   ```
3. **Assess situation**:
   - Are complaints legitimate?
   - Is user aware of email etiquette?
   - Is this a pattern or isolated incidents?
4. **Contact user**:
   - Send educational fax
   - Explain complaints
   - Provide guidance
5. **Monitor closely**
6. **Document review** in audit log


### Restricting Account

**Trigger**: Account reaches 5 complaints in 30 days OR manual decision

**Steps**:
1. **Verify complaint count**:
   ```sql
   SELECT COUNT(*) as complaint_count
   FROM user_complaints
   WHERE user_id = $1
     AND complained_at > NOW() - INTERVAL '30 days';
   ```
2. **Update database**:
   ```sql
   UPDATE users
   SET 
     email_restricted = true,
     email_restricted_at = NOW(),
     email_restriction_reason = 'Exceeded complaint threshold (5 in 30 days)'
   WHERE id = $1;
   ```
3. **Log action**:
   ```typescript
   await auditLogService.log({
     action: 'email_account_restricted',
     userId: userId,
     performedBy: adminId,
     details: {
       reason: 'Exceeded complaint threshold',
       complaintCount: 5
     }
   });
   ```
4. **Send restriction fax** to user
5. **Send alert** to administrators
6. **Document in ticket system**
7. **Schedule follow-up review** (30 days)

### Lifting Account Restriction

**Trigger**: Manual review determines restriction can be lifted

**Steps**:
1. **Verify criteria met**:
   - Sufficient time passed (30+ days)
   - User demonstrated understanding
   - No new complaints
   - User committed to guidelines
2. **Update database**:
   ```sql
   UPDATE users
   SET 
     email_restricted = false,
     email_restricted_at = NULL,
     email_restriction_reason = NULL
   WHERE id = $1;
   ```
3. **Log action**:
   ```typescript
   await auditLogService.log({
     action: 'email_restriction_lifted',
     userId: userId,
     performedBy: adminId,
     details: {
       reason: 'User demonstrated understanding',
       reviewDate: new Date()
     }
   });
   ```
4. **Send confirmation fax** to user
5. **Document decision**
6. **Continue monitoring** for 30 days

### Handling AWS SES Issues

**Trigger**: AWS SES errors, rate limiting, or service issues

**Steps**:
1. **Check AWS Service Health Dashboard**
   - Visit https://status.aws.amazon.com/
   - Check SES service status
2. **Check AWS SES Console**
   - Review sending statistics
   - Check for account issues
   - Verify configuration
3. **Check rate limits**:
   - Verify not exceeding sending quota
   - Check for throttling errors
4. **If rate limited**:
   - Implement backoff strategy
   - Consider requesting limit increase
5. **If service issue**:
   - Monitor AWS status page
   - Consider fallback provider if critical
   - Communicate with users if needed
6. **Contact AWS Support** if needed
7. **Document issue and resolution**


## Monitoring and Alerts

### Alert Response Times

| Alert Type | Severity | Response Time | Action |
|------------|----------|---------------|--------|
| Complaint Rate > 0.1% | Critical | 15 minutes | Immediate investigation |
| Bounce Rate > 5% | Critical | 30 minutes | Investigate and remediate |
| Delivery Rate < 95% | Critical | 30 minutes | Investigate and remediate |
| Account Restricted | High | 1 hour | Review and document |
| Complaint Rate > 0.05% | Warning | 4 hours | Monitor and investigate |
| Bounce Rate > 3% | Warning | 4 hours | Monitor and investigate |
| Queue Backlog | Warning | 1 hour | Check queue health |

### Escalation Path

**Level 1**: Operations Team
- Handle routine alerts
- Perform standard procedures
- Monitor metrics

**Level 2**: Engineering Team
- Handle technical issues
- Investigate system problems
- Implement fixes

**Level 3**: Management
- Handle policy decisions
- Approve account restrictions
- Communicate with stakeholders

**Level 4**: AWS Support
- Handle AWS-specific issues
- Request limit increases
- Report service problems

### On-Call Responsibilities

**Primary On-Call**:
- Respond to critical alerts within 15 minutes
- Investigate and resolve issues
- Escalate if needed
- Document all actions

**Secondary On-Call**:
- Backup for primary
- Assist with complex issues
- Provide second opinion
- Take over if primary unavailable

## Maintenance Windows

### Scheduled Maintenance

**Frequency**: Monthly (first Sunday, 2:00 AM - 4:00 AM local time)

**Activities**:
- Database maintenance
- Index optimization
- Log rotation
- Backup verification
- Configuration updates

**Procedure**:
1. Announce maintenance window (48 hours advance)
2. Put system in maintenance mode
3. Perform maintenance tasks
4. Verify system health
5. Resume normal operations
6. Send completion notification

### Emergency Maintenance

**Trigger**: Critical issue requiring immediate action

**Procedure**:
1. Assess urgency and impact
2. Get approval from management
3. Announce emergency maintenance
4. Perform necessary actions
5. Verify system health
6. Document incident
7. Conduct post-mortem


## Useful Queries

### Current System Status

```sql
-- Overall metrics for last 24 hours
SELECT 
  COUNT(*) FILTER (WHERE event_type = 'sent') as sent_24h,
  COUNT(*) FILTER (WHERE event_type = 'delivered') as delivered_24h,
  COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced_24h,
  COUNT(*) FILTER (WHERE event_type = 'complained') as complained_24h,
  ROUND((COUNT(*) FILTER (WHERE event_type = 'bounced')::float / 
         NULLIF(COUNT(*) FILTER (WHERE event_type = 'sent'), 0) * 100), 2) as bounce_rate,
  ROUND((COUNT(*) FILTER (WHERE event_type = 'complained')::float / 
         NULLIF(COUNT(*) FILTER (WHERE event_type = 'sent'), 0) * 100), 2) as complaint_rate
FROM email_metrics
WHERE occurred_at > NOW() - INTERVAL '24 hours';
```

### Accounts Requiring Attention

```sql
-- Flagged accounts (3+ complaints)
SELECT 
  u.id,
  u.phone_number,
  u.email_address,
  COUNT(uc.id) as complaint_count,
  MAX(uc.complained_at) as last_complaint,
  u.email_restricted
FROM users u
JOIN user_complaints uc ON u.id = uc.user_id
WHERE uc.complained_at > NOW() - INTERVAL '30 days'
GROUP BY u.id
HAVING COUNT(uc.id) >= 3
ORDER BY complaint_count DESC, last_complaint DESC;
```

### Recent Bounces

```sql
-- Bounces in last 24 hours
SELECT 
  em.occurred_at,
  u.phone_number,
  em.details->>'to' as recipient,
  em.details->>'bounceType' as bounce_type,
  em.details->>'reason' as reason
FROM email_metrics em
LEFT JOIN users u ON u.id = em.user_id
WHERE em.event_type = 'bounced'
  AND em.occurred_at > NOW() - INTERVAL '24 hours'
ORDER BY em.occurred_at DESC;
```

### Recent Complaints

```sql
-- Complaints in last 7 days
SELECT 
  uc.complained_at,
  u.phone_number,
  u.email_address,
  uc.complaint_type,
  uc.message_id
FROM user_complaints uc
JOIN users u ON u.id = uc.user_id
WHERE uc.complained_at > NOW() - INTERVAL '7 days'
ORDER BY uc.complained_at DESC;
```

### Queue Health

```sql
-- Check email-to-fax queue status
-- (This would query BullMQ/Redis, example shown)
-- Use BullMQ API or Redis commands to check:
-- - Active jobs
-- - Waiting jobs
-- - Failed jobs
-- - Completed jobs
```

### User Email Activity

```sql
-- Email activity for specific user
SELECT 
  em.event_type,
  em.occurred_at,
  em.details
FROM email_metrics em
WHERE em.user_id = $1
  AND em.occurred_at > NOW() - INTERVAL '30 days'
ORDER BY em.occurred_at DESC
LIMIT 100;
```


## Contact Information

### Internal Contacts

**Operations Team**:
- Email: operations@faxi.jp
- Slack: #email-operations
- Phone: [REDACTED]

**Engineering Team**:
- Email: engineering@faxi.jp
- Slack: #engineering
- Phone: [REDACTED]

**Management**:
- Email: management@faxi.jp
- Phone: [REDACTED]

### External Contacts

**AWS Support**:
- Console: https://console.aws.amazon.com/support/
- Phone: [AWS Support Number]
- Account ID: [REDACTED]

**Telnyx Support**:
- Email: support@telnyx.com
- Phone: [Telnyx Support Number]

## Documentation Links

- [Email Abuse Prevention](./EMAIL_ABUSE_PREVENTION.md)
- [Blocklist Management](./EMAIL_BLOCKLIST.md)
- [Account Review Process](./EMAIL_ACCOUNT_REVIEW.md)
- [Email Metrics](./EMAIL_METRICS.md)
- [Troubleshooting Guide](./EMAIL_TROUBLESHOOTING.md)
- [AWS SES Setup](../AWS_SES_SETUP.md)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-01-15 | Initial version | Operations Team |

## Feedback

For feedback or suggestions on this runbook:
- Create ticket in issue tracker
- Email operations@faxi.jp
- Discuss in #email-operations Slack channel
