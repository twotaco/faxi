# Email System Troubleshooting Guide

This document provides solutions to common email system issues.

## Quick Diagnosis

### Symptoms and Likely Causes

| Symptom | Likely Cause | Section |
|---------|--------------|---------|
| Emails not being received | Inbound email issues | [Inbound Email Problems](#inbound-email-problems) |
| Emails not being sent | Outbound email issues | [Outbound Email Problems](#outbound-email-problems) |
| High bounce rate | Invalid addresses or DNS issues | [Bounce Issues](#bounce-issues) |
| High complaint rate | User behavior issues | [Complaint Issues](#complaint-issues) |
| Faxes not generated from emails | Conversion issues | [Email-to-Fax Conversion](#email-to-fax-conversion-issues) |
| Webhooks not working | SNS or signature issues | [Webhook Issues](#webhook-issues) |
| Account restrictions not working | Database or logic issues | [Account Restriction Issues](#account-restriction-issues) |
| Metrics not updating | Metrics service issues | [Metrics Issues](#metrics-issues) |

## Inbound Email Problems

### Email Not Received by AWS SES

**Symptoms**:
- External sender reports email sent but no fax received
- No webhook notification received

**Diagnosis**:
1. Check AWS SES console for received emails
2. Verify MX records are correct:
   ```bash
   dig MX me.faxi.jp
   ```
3. Check domain verification status
4. Check SES receipt rules are active

**Solutions**:
- If MX records incorrect: Update DNS
- If domain not verified: Complete verification
- If receipt rules inactive: Activate rules
- If AWS SES not receiving: Check sender's email logs


### Webhook Not Triggered

**Symptoms**:
- AWS SES receives email but webhook not called
- No processing in application logs

**Diagnosis**:
1. Check SNS topic subscription status
2. Check webhook endpoint is accessible
3. Review SNS delivery logs
4. Check for webhook errors in application logs

**Solutions**:
- If subscription pending: Confirm subscription
- If endpoint not accessible: Check firewall/network
- If SNS delivery failing: Check endpoint URL
- If webhook errors: Review application logs and fix

**Verification**:
```bash
# Test webhook endpoint
curl -X POST https://api.faxi.jp/webhooks/email/sns \
  -H "Content-Type: application/json" \
  -d '{"Type":"SubscriptionConfirmation"}'
```

### Email Received but Not Converted to Fax

**Symptoms**:
- Webhook triggered but no fax generated
- Email stored in database but no fax job

**Diagnosis**:
1. Check if sender is blocked:
   ```sql
   SELECT * FROM email_blocklist 
   WHERE user_id = $1 AND LOWER(blocked_email) = LOWER($2);
   ```
2. Check email-to-fax queue:
   ```bash
   # Check BullMQ queue status
   ```
3. Review application logs for errors
4. Check if user exists

**Solutions**:
- If sender blocked: Unblock if appropriate
- If queue stuck: Restart queue worker
- If conversion errors: Check EmailToFaxConverter logs
- If user doesn't exist: Check user creation logic

## Outbound Email Problems

### Email Not Sent

**Symptoms**:
- User faxes email request but email not sent
- No confirmation fax received

**Diagnosis**:
1. Check if account is restricted:
   ```sql
   SELECT email_restricted, email_restriction_reason 
   FROM users WHERE id = $1;
   ```
2. Check AWS SES sending statistics
3. Review application logs for errors
4. Check email validation

**Solutions**:
- If account restricted: Review restriction, lift if appropriate
- If AWS SES error: Check error message, verify credentials
- If validation error: Fix email address format
- If rate limited: Implement backoff, request limit increase


### Email Sent but Not Delivered

**Symptoms**:
- Email sent successfully but recipient doesn't receive
- Bounce notification received

**Diagnosis**:
1. Check delivery status:
   ```sql
   SELECT delivery_status, delivery_details 
   FROM email_messages WHERE message_id = $1;
   ```
2. Check for bounce notification
3. Review bounce reason
4. Verify recipient email address

**Solutions**:
- If hard bounce: Verify email address, update if needed
- If soft bounce: Wait for retry, check if delivered later
- If spam filtered: Review email content, improve
- If domain issue: Check recipient's domain status

### Contact Lookup Failing

**Symptoms**:
- User specifies contact name but email not sent
- Clarification fax sent instead

**Diagnosis**:
1. Check if contact exists:
   ```sql
   SELECT * FROM address_book 
   WHERE user_id = $1 
   AND (LOWER(name) LIKE LOWER($2) OR LOWER(relationship) LIKE LOWER($2));
   ```
2. Check for multiple matches
3. Review contact name in fax

**Solutions**:
- If no match: Add contact to address book
- If multiple matches: User needs to be more specific
- If name misspelled: Correct in address book

## Bounce Issues

### High Bounce Rate

**Symptoms**:
- Bounce rate > 5%
- Many emails failing to deliver

**Diagnosis**:
1. Check recent bounces:
   ```sql
   SELECT 
     details->>'to' as recipient,
     details->>'bounceType' as type,
     details->>'reason' as reason,
     COUNT(*) as count
   FROM email_metrics
   WHERE event_type = 'bounced'
     AND occurred_at > NOW() - INTERVAL '24 hours'
   GROUP BY recipient, type, reason
   ORDER BY count DESC;
   ```
2. Look for patterns (same domain, same error)
3. Check DNS configuration
4. Verify AWS SES reputation

**Solutions**:
- If invalid addresses: Clean address book
- If DNS issues: Fix SPF, DKIM, DMARC records
- If domain reputation: Contact AWS support
- If specific domain: Contact domain administrator


### Specific Domain Bouncing

**Symptoms**:
- All emails to specific domain bounce
- Other domains work fine

**Diagnosis**:
1. Check bounce reason for that domain
2. Verify domain exists:
   ```bash
   dig MX example.com
   ```
3. Check if domain is blocking Faxi
4. Review email content sent to that domain

**Solutions**:
- If domain doesn't exist: Verify spelling
- If domain blocking: Contact domain administrator
- If content issue: Review and improve email content
- If temporary: Wait and retry

## Complaint Issues

### High Complaint Rate

**Symptoms**:
- Complaint rate > 0.1%
- Multiple spam reports

**Diagnosis**:
1. Check recent complaints:
   ```sql
   SELECT 
     u.phone_number,
     u.email_address,
     COUNT(*) as complaint_count
   FROM user_complaints uc
   JOIN users u ON u.id = uc.user_id
   WHERE uc.complained_at > NOW() - INTERVAL '7 days'
   GROUP BY u.id
   ORDER BY complaint_count DESC;
   ```
2. Review complained emails
3. Check if specific users responsible
4. Review email content

**Solutions**:
- If user behavior: Contact users, provide education
- If content issue: Improve email guidelines
- If spam: Restrict accounts, investigate
- If pattern: Implement additional controls

### User Receiving Complaints

**Symptoms**:
- Specific user has multiple complaints
- User may not understand why

**Diagnosis**:
1. Review user's email history
2. Check complaint details
3. Assess if complaints are legitimate
4. Review user's understanding of email etiquette

**Solutions**:
- Send educational fax to user
- Provide specific guidance
- Monitor future activity
- Restrict if pattern continues

## Email-to-Fax Conversion Issues

### Conversion Failing

**Symptoms**:
- Email received but fax not generated
- Errors in conversion logs

**Diagnosis**:
1. Check conversion logs
2. Review email content
3. Check for unsupported formats
4. Verify PDF generation working

**Solutions**:
- If HTML parsing error: Improve HTML sanitization
- If content too large: Implement better truncation
- If PDF generation error: Check PDFKit configuration
- If attachment issue: Review attachment handling


### Fax Content Garbled

**Symptoms**:
- Fax generated but content unreadable
- Formatting issues

**Diagnosis**:
1. Review original email
2. Check HTML to text conversion
3. Verify character encoding
4. Check PDF rendering

**Solutions**:
- If HTML issue: Improve conversion logic
- If encoding issue: Handle character sets properly
- If formatting issue: Adjust fax template
- If PDF issue: Check font rendering

### Queue Stuck

**Symptoms**:
- Emails received but not processed
- Queue backlog growing

**Diagnosis**:
1. Check BullMQ queue status
2. Review worker logs
3. Check Redis connection
4. Verify worker is running

**Solutions**:
- If worker stopped: Restart worker
- If Redis issue: Check Redis connection
- If jobs failing: Review error logs, fix issues
- If rate limited: Adjust concurrency

## Webhook Issues

### SNS Signature Verification Failing

**Symptoms**:
- Webhooks rejected with signature error
- No emails processed

**Diagnosis**:
1. Check signature verification logic
2. Verify certificate download working
3. Review SNS message format
4. Check timestamp validation

**Solutions**:
- If certificate issue: Check HTTPS access to AWS
- If timestamp issue: Verify server time is correct
- If format issue: Update parsing logic
- If AWS change: Update verification code

### Webhook Timeout

**Symptoms**:
- SNS retrying webhooks
- Duplicate processing

**Diagnosis**:
1. Check webhook processing time
2. Review application logs
3. Check database performance
4. Verify async processing

**Solutions**:
- If slow processing: Optimize code
- If database slow: Add indexes, optimize queries
- If not async: Move processing to background
- If timeout too short: Increase timeout (not recommended)


## Account Restriction Issues

### Restriction Not Applied

**Symptoms**:
- User has 5+ complaints but not restricted
- User can still send emails

**Diagnosis**:
1. Check complaint count:
   ```sql
   SELECT COUNT(*) FROM user_complaints 
   WHERE user_id = $1 
   AND complained_at > NOW() - INTERVAL '30 days';
   ```
2. Check restriction status:
   ```sql
   SELECT email_restricted FROM users WHERE id = $1;
   ```
3. Review AccountReviewService logs
4. Check if checkAccountStatus called

**Solutions**:
- If count correct but not restricted: Manually restrict
- If checkAccountStatus not called: Fix integration
- If database not updated: Check update logic
- If threshold wrong: Verify threshold configuration

### Restriction Not Enforced

**Symptoms**:
- User restricted but can still send emails
- No error fax sent

**Diagnosis**:
1. Verify restriction flag:
   ```sql
   SELECT email_restricted FROM users WHERE id = $1;
   ```
2. Check if EmailService checks restriction
3. Review send email logs
4. Verify error fax generation

**Solutions**:
- If flag not checked: Add check to EmailService
- If check bypassed: Fix logic
- If error fax not sent: Fix fax generation
- If database issue: Verify database connection

## Metrics Issues

### Metrics Not Updating

**Symptoms**:
- Dashboard shows stale data
- Metrics not changing

**Diagnosis**:
1. Check if events being recorded:
   ```sql
   SELECT COUNT(*), MAX(occurred_at) 
   FROM email_metrics 
   WHERE occurred_at > NOW() - INTERVAL '1 hour';
   ```
2. Review EmailMetricsService logs
3. Check if recordEmailEvent called
4. Verify database connection

**Solutions**:
- If events not recorded: Fix integration
- If database issue: Check connection
- If calculation issue: Fix calculation logic
- If caching issue: Clear cache


### Incorrect Metrics

**Symptoms**:
- Metrics don't match reality
- Calculations seem wrong

**Diagnosis**:
1. Verify event counts:
   ```sql
   SELECT 
     event_type,
     COUNT(*) as count
   FROM email_metrics
   WHERE occurred_at > NOW() - INTERVAL '24 hours'
   GROUP BY event_type;
   ```
2. Manually calculate metrics
3. Compare with AWS SES statistics
4. Check for duplicate events

**Solutions**:
- If duplicate events: Fix event recording
- If missing events: Ensure all events recorded
- If calculation wrong: Fix calculation logic
- If AWS mismatch: Investigate discrepancy

## AWS SES Issues

### Account in Sandbox Mode

**Symptoms**:
- Can only send to verified addresses
- Limited sending quota

**Diagnosis**:
1. Check AWS SES console
2. Review account status
3. Check production access request

**Solutions**:
- Request production access
- Follow AWS verification process
- Provide required information
- Wait for approval (24-48 hours)

### Rate Limiting

**Symptoms**:
- Throttling errors
- Emails failing with rate limit error

**Diagnosis**:
1. Check AWS SES sending statistics
2. Review current sending rate
3. Check sending quota
4. Review error messages

**Solutions**:
- Implement exponential backoff
- Request quota increase
- Spread sending over time
- Use multiple accounts if needed

### Domain Verification Failed

**Symptoms**:
- Cannot send from domain
- Verification pending

**Diagnosis**:
1. Check DNS records:
   ```bash
   dig TXT _amazonses.me.faxi.jp
   ```
2. Verify record value matches AWS
3. Check DNS propagation
4. Review AWS SES console

**Solutions**:
- If record missing: Add DNS record
- If value wrong: Update DNS record
- If not propagated: Wait for propagation (up to 48 hours)
- If still failing: Contact AWS support


## Database Issues

### Connection Errors

**Symptoms**:
- Database connection failures
- Timeout errors

**Diagnosis**:
1. Check database status
2. Verify connection string
3. Check connection pool
4. Review database logs

**Solutions**:
- If database down: Restart database
- If connection string wrong: Fix configuration
- If pool exhausted: Increase pool size
- If network issue: Check network connectivity

### Slow Queries

**Symptoms**:
- Slow response times
- Timeout errors

**Diagnosis**:
1. Check slow query log
2. Review query execution plans
3. Check for missing indexes
4. Monitor database load

**Solutions**:
- If missing indexes: Add indexes
- If inefficient query: Optimize query
- If high load: Scale database
- If lock contention: Optimize transactions

## General Debugging

### Enable Debug Logging

```bash
# Set log level to debug
LOG_LEVEL=debug npm run dev
```

### Check Application Logs

```bash
# View recent logs
tail -f backend/logs/app.log

# Search for errors
grep ERROR backend/logs/app.log

# Search for specific user
grep "user-uuid" backend/logs/app.log
```

### Check Audit Logs

```sql
-- Recent email-related audit logs
SELECT 
  action,
  user_id,
  details,
  created_at
FROM audit_logs
WHERE action LIKE '%email%'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 100;
```

### Test Email Flow

```bash
# Send test email to Faxi address
echo "Test email body" | mail -s "Test Subject" 09012345678@me.faxi.jp

# Check if received
# Monitor logs and database
```

## Getting Help

### Before Contacting Support

1. Check this troubleshooting guide
2. Review application logs
3. Check AWS SES console
4. Verify configuration
5. Document the issue:
   - What happened
   - When it happened
   - What you tried
   - Error messages
   - Relevant logs

### Contact Information

**Internal Support**:
- Operations Team: operations@faxi.jp
- Engineering Team: engineering@faxi.jp
- Slack: #email-support

**External Support**:
- AWS Support: https://console.aws.amazon.com/support/
- Telnyx Support: support@telnyx.com

## References

- [Email Abuse Prevention](./EMAIL_ABUSE_PREVENTION.md)
- [Blocklist Management](./EMAIL_BLOCKLIST.md)
- [Account Review Process](./EMAIL_ACCOUNT_REVIEW.md)
- [Email Metrics](./EMAIL_METRICS.md)
- [Operations Runbook](./EMAIL_OPERATIONS_RUNBOOK.md)
- [AWS SES Setup](../AWS_SES_SETUP.md)
- [AWS SES Troubleshooting](https://docs.aws.amazon.com/ses/latest/dg/troubleshoot.html)
