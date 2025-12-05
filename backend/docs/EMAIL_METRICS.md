# Email Quality Metrics

This document describes the email quality monitoring system and metrics calculation.

## Overview

The metrics system tracks email quality to:
- Maintain good sender reputation with AWS SES
- Identify delivery issues early
- Monitor system health
- Alert administrators to problems
- Comply with email best practices

## Key Metrics

### Bounce Rate

**Definition**: Percentage of emails that bounced (failed to deliver)

**Calculation**: `(total_bounces / total_sent) * 100`

**Thresholds**:
- **Warning**: > 3%
- **Critical**: > 5%

**Acceptable Range**: < 2%

**Why It Matters**:
- High bounce rates damage sender reputation
- AWS SES may restrict sending if bounce rate is too high
- Indicates problems with email addresses or domain configuration

### Complaint Rate

**Definition**: Percentage of emails marked as spam by recipients

**Calculation**: `(total_complaints / total_sent) * 100`

**Thresholds**:
- **Warning**: > 0.05%
- **Critical**: > 0.1%

**Acceptable Range**: < 0.01%

**Why It Matters**:
- Complaints severely damage sender reputation
- AWS SES may suspend account if complaint rate is too high
- Indicates users are sending unwanted emails

### Delivery Rate

**Definition**: Percentage of emails successfully delivered

**Calculation**: `(total_delivered / total_sent) * 100`

**Thresholds**:
- **Warning**: < 97%
- **Critical**: < 95%

**Acceptable Range**: > 98%

**Why It Matters**:
- Low delivery rate indicates systemic issues
- Affects user experience
- May indicate configuration problems


## Components

### EmailMetricsService

Service responsible for metrics calculation and monitoring.

**Location**: `src/services/emailMetricsService.ts`

**Key Methods**:
- `recordEmailEvent(event)`: Records email event in database
- `calculateMetrics(startDate, endDate)`: Calculates metrics for time period
- `checkThresholds(metrics)`: Checks if metrics exceed thresholds

### EmailQualityMonitor

Scheduled job that calculates and monitors metrics.

**Location**: `src/services/emailQualityMonitor.ts`

**Schedule**: Runs every hour

**Actions**:
1. Calculate metrics for last 24 hours
2. Check against thresholds
3. Send alerts if thresholds exceeded
4. Log metrics for historical tracking

### Database Schema

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

## Event Recording

### Event Types

1. **sent**: Email was sent via AWS SES
2. **delivered**: Email was successfully delivered to recipient
3. **bounced**: Email bounced (hard or soft)
4. **complained**: Recipient marked email as spam

### Recording Events

**When email is sent**:
```typescript
await emailMetricsService.recordEmailEvent({
  eventType: 'sent',
  userId: user.id,
  messageId: result.messageId,
  details: {
    to: emailAddress,
    subject: subject
  }
});
```

**When delivery notification received**:
```typescript
await emailMetricsService.recordEmailEvent({
  eventType: 'delivered',
  userId: user.id,
  messageId: messageId,
  details: {
    timestamp: deliveryTimestamp
  }
});
```

**When bounce notification received**:
```typescript
await emailMetricsService.recordEmailEvent({
  eventType: 'bounced',
  userId: user.id,
  messageId: messageId,
  details: {
    bounceType: 'Permanent',
    reason: bounceReason
  }
});
```

**When complaint notification received**:
```typescript
await emailMetricsService.recordEmailEvent({
  eventType: 'complained',
  userId: user.id,
  messageId: messageId,
  details: {
    complaintType: 'abuse'
  }
});
```


## Metrics Calculation

### Calculate Metrics for Time Period

```typescript
const metrics = await emailMetricsService.calculateMetrics(
  new Date('2025-01-01'),
  new Date('2025-01-31')
);
```

**Returns**:
```typescript
{
  totalSent: 1000,
  totalDelivered: 980,
  totalBounced: 15,
  totalComplaints: 5,
  bounceRate: 1.5,      // 15/1000 * 100
  complaintRate: 0.5,   // 5/1000 * 100
  deliveryRate: 98.0    // 980/1000 * 100
}
```

### SQL Query

```sql
WITH event_counts AS (
  SELECT 
    COUNT(*) FILTER (WHERE event_type = 'sent') as total_sent,
    COUNT(*) FILTER (WHERE event_type = 'delivered') as total_delivered,
    COUNT(*) FILTER (WHERE event_type = 'bounced') as total_bounced,
    COUNT(*) FILTER (WHERE event_type = 'complained') as total_complaints
  FROM email_metrics
  WHERE occurred_at BETWEEN $1 AND $2
)
SELECT 
  total_sent,
  total_delivered,
  total_bounced,
  total_complaints,
  CASE WHEN total_sent > 0 
    THEN (total_bounced::float / total_sent * 100) 
    ELSE 0 
  END as bounce_rate,
  CASE WHEN total_sent > 0 
    THEN (total_complaints::float / total_sent * 100) 
    ELSE 0 
  END as complaint_rate,
  CASE WHEN total_sent > 0 
    THEN (total_delivered::float / total_sent * 100) 
    ELSE 0 
  END as delivery_rate
FROM event_counts;
```

## Threshold Checking

### Check Thresholds

```typescript
const alerts = await emailMetricsService.checkThresholds(metrics);
```

**Returns array of alerts**:
```typescript
[
  {
    type: 'bounce_rate',
    threshold: 5.0,
    actual: 6.2,
    severity: 'critical'
  },
  {
    type: 'complaint_rate',
    threshold: 0.05,
    actual: 0.08,
    severity: 'warning'
  }
]
```

### Alert Actions

**When alerts are generated**:
1. Log alerts in monitoring system
2. Send notifications to administrators
3. Create incident if critical
4. Update metrics dashboard


## Monitoring Dashboard

### Real-Time Metrics

**Current 24-hour metrics**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE event_type = 'sent') as sent_24h,
  COUNT(*) FILTER (WHERE event_type = 'delivered') as delivered_24h,
  COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced_24h,
  COUNT(*) FILTER (WHERE event_type = 'complained') as complained_24h,
  ROUND((COUNT(*) FILTER (WHERE event_type = 'bounced')::float / 
         NULLIF(COUNT(*) FILTER (WHERE event_type = 'sent'), 0) * 100), 2) as bounce_rate_24h,
  ROUND((COUNT(*) FILTER (WHERE event_type = 'complained')::float / 
         NULLIF(COUNT(*) FILTER (WHERE event_type = 'sent'), 0) * 100), 2) as complaint_rate_24h
FROM email_metrics
WHERE occurred_at > NOW() - INTERVAL '24 hours';
```

### Historical Trends

**Daily metrics for last 30 days**:
```sql
SELECT 
  DATE(occurred_at) as date,
  COUNT(*) FILTER (WHERE event_type = 'sent') as sent,
  COUNT(*) FILTER (WHERE event_type = 'delivered') as delivered,
  COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced,
  COUNT(*) FILTER (WHERE event_type = 'complained') as complained,
  ROUND((COUNT(*) FILTER (WHERE event_type = 'bounced')::float / 
         NULLIF(COUNT(*) FILTER (WHERE event_type = 'sent'), 0) * 100), 2) as bounce_rate,
  ROUND((COUNT(*) FILTER (WHERE event_type = 'complained')::float / 
         NULLIF(COUNT(*) FILTER (WHERE event_type = 'sent'), 0) * 100), 2) as complaint_rate
FROM email_metrics
WHERE occurred_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(occurred_at)
ORDER BY date DESC;
```

### Per-User Metrics

**Users with highest bounce rates**:
```sql
WITH user_metrics AS (
  SELECT 
    user_id,
    COUNT(*) FILTER (WHERE event_type = 'sent') as sent,
    COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced
  FROM email_metrics
  WHERE occurred_at > NOW() - INTERVAL '30 days'
    AND user_id IS NOT NULL
  GROUP BY user_id
  HAVING COUNT(*) FILTER (WHERE event_type = 'sent') >= 10
)
SELECT 
  u.phone_number,
  u.email_address,
  um.sent,
  um.bounced,
  ROUND((um.bounced::float / um.sent * 100), 2) as bounce_rate
FROM user_metrics um
JOIN users u ON u.id = um.user_id
WHERE um.bounced > 0
ORDER BY bounce_rate DESC
LIMIT 10;
```

## Alerting

### Alert Configuration

**Bounce Rate Alerts**:
- Warning: > 3% (email to operations team)
- Critical: > 5% (page on-call engineer)

**Complaint Rate Alerts**:
- Warning: > 0.05% (email to operations team)
- Critical: > 0.1% (page on-call engineer, escalate to management)

**Delivery Rate Alerts**:
- Warning: < 97% (email to operations team)
- Critical: < 95% (page on-call engineer)

### Alert Channels

1. **Email**: operations@faxi.jp
2. **Slack**: #email-alerts channel
3. **PagerDuty**: For critical alerts
4. **Dashboard**: Visual indicators


## Troubleshooting

### High Bounce Rate

**Possible Causes**:
1. Invalid email addresses in address book
2. Typos in email addresses
3. Outdated contact information
4. Domain configuration issues
5. Temporary server issues

**Investigation Steps**:
1. Check recent bounced emails:
   ```sql
   SELECT 
     message_id,
     details->>'to' as recipient,
     details->>'reason' as reason
   FROM email_metrics
   WHERE event_type = 'bounced'
     AND occurred_at > NOW() - INTERVAL '24 hours'
   ORDER BY occurred_at DESC;
   ```

2. Look for patterns (same domain, similar addresses)
3. Verify DNS configuration (MX, SPF, DKIM)
4. Check AWS SES sending statistics
5. Review user's address book for invalid entries

**Actions**:
- Clean up invalid addresses
- Educate users on verifying email addresses
- Improve email validation
- Monitor for improvement

### High Complaint Rate

**Possible Causes**:
1. Users sending unsolicited emails
2. Poor email content quality
3. Too frequent emails
4. Misunderstanding of email etiquette
5. Compromised accounts

**Investigation Steps**:
1. Check recent complaints:
   ```sql
   SELECT 
     user_id,
     message_id,
     details->>'complaintType' as type
   FROM email_metrics
   WHERE event_type = 'complained'
     AND occurred_at > NOW() - INTERVAL '7 days'
   ORDER BY occurred_at DESC;
   ```

2. Review complained emails for patterns
3. Check if specific users are responsible
4. Review email content
5. Check for account compromise

**Actions**:
- Contact affected users for education
- Review and improve email etiquette guidance
- Consider account restrictions
- Enhance user onboarding

### Low Delivery Rate

**Possible Causes**:
1. High bounce rate
2. AWS SES issues
3. Network problems
4. Configuration errors
5. Rate limiting

**Investigation Steps**:
1. Check AWS SES status
2. Review bounce reasons
3. Check network connectivity
4. Verify AWS credentials
5. Check rate limits

**Actions**:
- Address bounce issues
- Contact AWS support if needed
- Verify configuration
- Monitor AWS SES dashboard


## Best Practices

### Maintaining Good Metrics

1. **Monitor daily**: Check metrics every day
2. **Act quickly**: Address issues as soon as they appear
3. **Educate users**: Provide clear email etiquette guidelines
4. **Validate addresses**: Implement strong email validation
5. **Clean data**: Regularly remove invalid addresses
6. **Track trends**: Look for patterns over time
7. **Set alerts**: Configure appropriate alert thresholds

### AWS SES Best Practices

1. **Warm up sending**: Gradually increase sending volume
2. **Monitor reputation**: Check AWS SES reputation dashboard
3. **Handle bounces**: Process bounce notifications promptly
4. **Handle complaints**: Take complaints seriously
5. **Maintain lists**: Keep email lists clean and up-to-date
6. **Use authentication**: Ensure SPF, DKIM, DMARC are configured
7. **Follow policies**: Comply with AWS SES policies

## Reporting

### Daily Report

**Email to operations team**:
```
Email Metrics - Daily Report
Date: 2025-01-15

24-Hour Metrics:
- Emails Sent: 1,234
- Delivered: 1,210 (98.1%)
- Bounced: 18 (1.5%)
- Complaints: 6 (0.5%)

Status: ⚠️ WARNING - Complaint rate above threshold (0.5% > 0.1%)

Action Required:
- Review complained emails
- Contact affected users
- Monitor for improvement

Trends (vs. yesterday):
- Sent: +5%
- Bounce Rate: -0.2%
- Complaint Rate: +0.3% ⚠️
```

### Weekly Report

**Email to management**:
```
Email Metrics - Weekly Report
Week of: 2025-01-08 to 2025-01-14

Weekly Summary:
- Total Sent: 8,456
- Delivery Rate: 98.3%
- Bounce Rate: 1.4%
- Complaint Rate: 0.08%

Status: ✅ All metrics within acceptable range

Highlights:
- Delivery rate improved by 0.5%
- Bounce rate decreased by 0.3%
- 2 accounts flagged for review
- 0 accounts restricted

Actions Taken:
- Educated 3 users on email etiquette
- Cleaned 45 invalid addresses from address books
- Updated email validation rules
```

## References

- [AWS SES Sending Statistics](https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity.html)
- [Email Abuse Prevention](./EMAIL_ABUSE_PREVENTION.md)
- [Account Review Process](./EMAIL_ACCOUNT_REVIEW.md)
- [Operations Runbook](./EMAIL_OPERATIONS_RUNBOOK.md)
