# AWS SES Setup Guide

This guide walks you through setting up AWS Simple Email Service (SES) for the Faxi email system.

## Prerequisites

- AWS Account with administrative access
- AWS CLI installed and configured (optional but recommended)
- Access to DNS management for `me.faxi.jp` domain

## Overview

The Faxi email system uses AWS SES for:
- Sending outbound emails from users (via fax requests)
- Receiving inbound emails to user email addresses
- Tracking email delivery status (delivery, bounces, complaints)

## Step 1: Create IAM User

Create a dedicated IAM user for the Faxi application with minimal required permissions.

### 1.1 Create IAM User via AWS Console

1. Go to AWS IAM Console → Users → Create User
2. User name: `faxi-ses-user`
3. Select "Programmatic access" (Access key)
4. Click "Next: Permissions"

### 1.2 Create IAM Policy

Create a custom policy with the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SESPermissions",
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:GetSendStatistics",
        "ses:GetSendQuota",
        "ses:GetAccountSendingEnabled",
        "ses:VerifyEmailIdentity",
        "ses:VerifyDomainIdentity",
        "ses:GetIdentityVerificationAttributes",
        "ses:SetIdentityNotificationTopic",
        "ses:CreateReceiptRule",
        "ses:CreateReceiptRuleSet",
        "ses:SetActiveReceiptRuleSet",
        "ses:VerifyDomainDkim"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SNSPermissions",
      "Effect": "Allow",
      "Action": [
        "sns:Publish",
        "sns:Subscribe",
        "sns:Unsubscribe",
        "sns:ListSubscriptionsByTopic",
        "sns:CreateTopic",
        "sns:GetTopicAttributes"
      ],
      "Resource": "arn:aws:sns:*:*:faxi-email-notifications"
    }
  ]
}
```

**Note**: The complete policy is also available in `backend/faxi-ses-policy.json`.

### 1.3 Attach Policy and Create Access Key

1. Attach the custom policy to the user
2. Complete user creation
3. Go to Security Credentials tab
4. Click "Create access key"
5. Select "Application running outside AWS"
6. Save the Access Key ID and Secret Access Key securely

### 1.4 Using AWS CLI (Alternative)

```bash
# Create IAM user
aws iam create-user --user-name faxi-ses-user

# Create and attach policy
aws iam put-user-policy \
  --user-name faxi-ses-user \
  --policy-name FaxiSESPolicy \
  --policy-document file://faxi-ses-policy.json

# Create access key
aws iam create-access-key --user-name faxi-ses-user
```

## Step 2: Configure Environment Variables

Add the AWS credentials to your environment files.

### 2.1 Local Development (`backend/.env`)

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
SNS_TOPIC_ARN=

# Email Configuration
EMAIL_PROVIDER=ses
EMAIL_FROM_DOMAIN=me.faxi.jp
EMAIL_WEBHOOK_SECRET=generate_random_secret_here
```

### 2.2 Test Environment (`backend/.env.test`)

```bash
# AWS Configuration (mock values for testing)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test_access_key
AWS_SECRET_ACCESS_KEY=test_secret_key
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:test-faxi-email-notifications

# Email Configuration
EMAIL_PROVIDER=ses
EMAIL_FROM_DOMAIN=me.faxi.jp
```

### 2.3 Production Environment

For production, use AWS Secrets Manager or environment variables in your deployment platform:

```bash
# Production values (use real credentials)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<production-access-key>
AWS_SECRET_ACCESS_KEY=<production-secret-key>
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:<account-id>:faxi-email-notifications
EMAIL_PROVIDER=ses
EMAIL_FROM_DOMAIN=me.faxi.jp
EMAIL_WEBHOOK_SECRET=<production-webhook-secret>
```

## Step 3: Verify Domain in AWS SES

### 3.1 Start Domain Verification

```bash
# Using AWS CLI
aws ses verify-domain-identity --domain me.faxi.jp --region us-east-1
```

Or via AWS Console:
1. Go to SES Console → Verified Identities → Create Identity
2. Select "Domain"
3. Enter: `me.faxi.jp`
4. Click "Create Identity"

### 3.2 Add DNS TXT Record

AWS will provide a verification token. Add this TXT record to your DNS:

```
Name: _amazonses.me.faxi.jp
Type: TXT
Value: <verification-token-from-aws>
TTL: 1800
```

### 3.3 Verify Domain Status

```bash
# Check verification status
aws ses get-identity-verification-attributes \
  --identities me.faxi.jp \
  --region us-east-1
```

Wait for status to change to "Success" (can take up to 72 hours, usually within minutes).

## Step 4: Configure DKIM

DKIM (DomainKeys Identified Mail) helps prevent email spoofing.

### 4.1 Enable DKIM

```bash
# Generate DKIM tokens
aws ses verify-domain-dkim --domain me.faxi.jp --region us-east-1
```

This returns 3 DKIM tokens.

### 4.2 Add DKIM CNAME Records

Add three CNAME records to your DNS:

```
Name: <token1>._domainkey.me.faxi.jp
Type: CNAME
Value: <token1>.dkim.amazonses.com
TTL: 1800

Name: <token2>._domainkey.me.faxi.jp
Type: CNAME
Value: <token2>.dkim.amazonses.com
TTL: 1800

Name: <token3>._domainkey.me.faxi.jp
Type: CNAME
Value: <token3>.dkim.amazonses.com
TTL: 1800
```

## Step 5: Configure SPF

SPF (Sender Policy Framework) specifies which mail servers can send email for your domain.

### 5.1 Add SPF TXT Record

Add or update the SPF record for your domain:

```
Name: me.faxi.jp
Type: TXT
Value: v=spf1 include:amazonses.com ~all
TTL: 1800
```

If you already have an SPF record, add `include:amazonses.com` to it:

```
v=spf1 include:_spf.google.com include:amazonses.com ~all
```

## Step 6: Configure MX Records for Inbound Email

To receive emails at `*@me.faxi.jp`, configure MX records.

### 6.1 Add MX Record

```
Name: me.faxi.jp
Type: MX
Priority: 10
Value: inbound-smtp.us-east-1.amazonaws.com
TTL: 1800
```

## Step 7: Create SNS Topic

SNS (Simple Notification Service) delivers email notifications to your webhook.

### 7.1 Create SNS Topic

```bash
# Create topic
aws sns create-topic \
  --name faxi-email-notifications \
  --region us-east-1
```

Save the returned Topic ARN (e.g., `arn:aws:sns:us-east-1:123456789012:faxi-email-notifications`).

### 7.2 Update Environment Variable

Add the SNS Topic ARN to your `.env` file:

```bash
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:faxi-email-notifications
```

### 7.3 Subscribe Webhook Endpoint

```bash
# Subscribe your webhook endpoint
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:faxi-email-notifications \
  --protocol https \
  --notification-endpoint https://api.faxi.jp/webhooks/email/sns \
  --region us-east-1
```

**Note**: For local development, you'll need to use a tool like ngrok to expose your local server:

```bash
# Start ngrok
ngrok http 4000

# Use the ngrok URL for subscription
aws sns subscribe \
  --topic-arn <your-topic-arn> \
  --protocol https \
  --notification-endpoint https://<your-ngrok-id>.ngrok.io/webhooks/email/sns \
  --region us-east-1

aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:223882168768:faxi-email-notifications \
  --protocol https \
  --notification-endpoint https://volitant-delightsome-myrtie.ngrok-free.dev/webhooks/email/sns \
  --region us-east-1
```
  
The webhook endpoint will automatically confirm the subscription when it receives the confirmation request.

### 7.4 SNS Webhook Security

The Faxi backend automatically handles SNS webhook security:

**Signature Verification**:
- All SNS messages are verified using AWS certificate signatures
- Certificate URL is validated to ensure it's from amazonaws.com
- Signature is verified using SHA1 with the downloaded certificate
- Invalid signatures are rejected with 401 Unauthorized

**Subscription Confirmation**:
- When SNS sends a SubscriptionConfirmation message, the webhook automatically visits the SubscribeURL
- This confirms the subscription without manual intervention
- Confirmation is logged in the audit system

**Message Processing**:
- Webhook returns 200 OK immediately (within 2 seconds) to prevent retries
- Messages are processed asynchronously after response is sent
- All events are logged in the audit system

**Implementation**: See `backend/src/services/snsWebhookHandler.ts` for the complete implementation.

## Step 8: Configure SES Receipt Rules

Receipt rules determine what happens when SES receives an email.

### 8.1 Create Receipt Rule Set

```bash
# Create rule set
aws ses create-receipt-rule-set \
  --rule-set-name faxi-inbound \
  --region us-east-1

# Set as active
aws ses set-active-receipt-rule-set \
  --rule-set-name faxi-inbound \
  --region us-east-1
```

### 8.2 Create Receipt Rule

```bash
# Create rule to forward emails to SNS
aws ses create-receipt-rule \
  --rule-set-name faxi-inbound \
  --rule '{
    "Name": "faxi-email-rule",
    "Enabled": true,
    "Recipients": ["me.faxi.jp"],
    "Actions": [
      {
        "SNSAction": {
          "TopicArn": "arn:aws:sns:us-east-1:223882168768:faxi-email-notifications",
          "Encoding": "UTF-8"
        }
      }
    ],
    "ScanEnabled": true
  }' \
  --region us-east-1
```

### 8.3 Configure Delivery Notifications

Configure SNS to send delivery, bounce, and complaint notifications:

```bash
# Set notification topic for bounces and complaints
aws ses set-identity-notification-topic \
  --identity me.faxi.jp \
  --notification-type Bounce \
  --sns-topic arn:aws:sns:us-east-1:223882168768:faxi-email-notifications \
  --region us-east-1

aws ses set-identity-notification-topic \
  --identity me.faxi.jp \
  --notification-type Complaint \
  --sns-topic arn:aws:sns:us-east-1:223882168768:faxi-email-notifications \
  --region us-east-1

aws ses set-identity-notification-topic \
  --identity me.faxi.jp \
  --notification-type Delivery \
  --sns-topic arn:aws:sns:us-east-1:223882168768:faxi-email-notifications \
  --region us-east-1
```

## Step 9: Move Out of SES Sandbox

By default, AWS SES accounts start in "sandbox mode" with limitations:
- Can only send to verified email addresses
- Limited sending quota (200 emails/day, 1 email/second)

### 9.1 Request Production Access

1. Go to SES Console → Account Dashboard
2. Click "Request production access"
3. Fill out the form:
   - **Mail Type**: Transactional
   - **Website URL**: https://faxi.jp
   - **Use Case Description**: 
     ```
     Faxi is a fax-to-internet bridge service that enables elderly users 
     without internet access to send and receive emails via fax machines. 
     We use SES to:
     1. Send emails on behalf of users who submit email requests via fax
     2. Receive emails sent to user email addresses and convert them to faxes
     3. Send delivery notifications and error messages
     
     Expected volume: 1,000-5,000 emails/day
     Users opt-in by sending faxes to our service
     We handle bounces and complaints appropriately
     ```
   - **Compliance**: Describe your bounce/complaint handling
4. Submit request

Approval typically takes 24-48 hours.

## Step 10: Test AWS SDK Connection

A comprehensive test script is provided to verify your AWS credentials work correctly.

Run the test:

```bash
cd backend
npm run test-ses-connection
```

The script will:
- Validate all required environment variables are set
- Test connection to AWS SES
- Retrieve your account sending quota
- Detect if you're in sandbox mode
- Provide detailed error messages with hints if something is wrong

**Expected Output (Success):**
```
✅ SUCCESS: AWS SES connection successful

Connection Details:
  Region: us-east-1
  Max Send Rate: 1 emails/second
  24-Hour Quota: 200 emails
  Sent (24h): 0 emails
  Remaining: 200 emails

⚠️  WARNING: Account is in SES Sandbox mode
   - Can only send to verified email addresses
   - Limited to 200 emails/day
   - Request production access in AWS SES Console
```

**Expected Output (Failure):**
```
❌ FAILURE: AWS SES connection failed

Error Details:
  Error: The security token included in the request is invalid.
  Code: InvalidClientTokenId
  Region: us-east-1

💡 Hint: AWS Access Key ID is invalid. Check AWS_ACCESS_KEY_ID in .env
```

The test script source is available at `backend/scripts/test-ses-connection.ts`.

## Monitoring and Alerts

### CloudWatch Metrics

Monitor these key metrics in CloudWatch:
- **Send**: Number of emails sent
- **Bounce**: Bounce rate (should be < 5%)
- **Complaint**: Complaint rate (should be < 0.1%)
- **Delivery**: Successful deliveries
- **Reject**: Rejected emails

### Set Up Alarms

```bash
# Create alarm for high bounce rate
aws cloudwatch put-metric-alarm \
  --alarm-name faxi-ses-high-bounce-rate \
  --alarm-description "Alert when bounce rate exceeds 5%" \
  --metric-name Reputation.BounceRate \
  --namespace AWS/SES \
  --statistic Average \
  --period 3600 \
  --evaluation-periods 1 \
  --threshold 0.05 \
  --comparison-operator GreaterThanThreshold \
  --region us-east-1
```

## Troubleshooting

### Domain Verification Fails

- Check DNS records are correctly configured
- Wait up to 72 hours for DNS propagation
- Verify no typos in TXT record value

### Emails Not Being Received

- Verify MX records are correct
- Check receipt rule is enabled and active
- Verify SNS subscription is confirmed
- Check webhook endpoint is accessible

### Emails Not Being Sent

- Verify domain is verified in SES
- Check you're out of sandbox mode (or sending to verified addresses)
- Verify IAM permissions are correct
- Check CloudWatch logs for errors

### Webhook Not Receiving Notifications

- Verify SNS subscription is confirmed
- Check webhook endpoint returns 200 OK
- Verify webhook signature validation is working
- Check application logs for errors

## Security Best Practices

1. **Rotate Access Keys**: Rotate AWS access keys every 90 days
2. **Use IAM Roles**: In production, use IAM roles instead of access keys when possible
3. **Verify Signatures**: Always verify SNS message signatures
4. **Rate Limiting**: Implement rate limiting on webhook endpoints
5. **Monitor Metrics**: Set up CloudWatch alarms for unusual activity
6. **Audit Logs**: Enable CloudTrail logging for SES API calls

## Cost Estimation

AWS SES pricing (as of 2024):
- **Outbound emails**: $0.10 per 1,000 emails
- **Inbound emails**: $0.10 per 1,000 emails
- **Data transfer**: $0.12 per GB (after first 1 GB free)
- **SNS notifications**: $0.50 per 1 million requests

Example monthly cost for 10,000 emails:
- Outbound: 10,000 × $0.10/1,000 = $1.00
- Inbound: 10,000 × $0.10/1,000 = $1.00
- SNS: 20,000 × $0.50/1M = $0.01
- **Total**: ~$2.01/month

## Next Steps

After completing this setup:

1. ✅ Verify all DNS records are propagated
2. ✅ Test sending an email via SES
3. ✅ Test receiving an email to your domain
4. ✅ Verify webhook receives notifications
5. ✅ Request production access (if needed)
6. ✅ Set up CloudWatch alarms
7. ✅ Document credentials in your secrets manager

## References

- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
- [AWS SES API Reference](https://docs.aws.amazon.com/ses/latest/APIReference/)
- [AWS SNS Documentation](https://docs.aws.amazon.com/sns/)
- [SPF Record Syntax](https://www.rfc-editor.org/rfc/rfc7208.html)
- [DKIM Specification](https://www.rfc-editor.org/rfc/rfc6376.html)
