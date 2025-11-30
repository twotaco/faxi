# AWS Credentials Setup Checklist

This checklist helps you verify that AWS SES credentials are properly configured for the Faxi email system.

## Quick Start

1. **Create IAM User** (see [AWS_SES_SETUP.md](./AWS_SES_SETUP.md) for detailed instructions)
2. **Configure Environment Variables** (see below)
3. **Test Connection** (run `npm run test-ses-connection`)

## Environment Variables Checklist

### Local Development (`backend/.env`)

- [ ] `AWS_REGION` - Set to `us-east-1` (or your preferred region)
- [ ] `AWS_ACCESS_KEY_ID` - Your IAM user access key
- [ ] `AWS_SECRET_ACCESS_KEY` - Your IAM user secret key
- [ ] `SNS_TOPIC_ARN` - Will be populated after creating SNS topic (leave empty initially)
- [ ] `EMAIL_PROVIDER` - Set to `ses`
- [ ] `EMAIL_FROM_DOMAIN` - Set to `me.faxi.jp`
- [ ] `EMAIL_WEBHOOK_SECRET` - Generate a random secret string

### Test Environment (`backend/.env.test`)

- [x] `AWS_REGION` - Already configured with mock value
- [x] `AWS_ACCESS_KEY_ID` - Already configured with mock value
- [x] `AWS_SECRET_ACCESS_KEY` - Already configured with mock value
- [x] `SNS_TOPIC_ARN` - Already configured with mock value
- [x] `EMAIL_PROVIDER` - Already set to `ses`

### Production Environment

- [ ] Use AWS Secrets Manager or secure environment variable management
- [ ] Rotate credentials every 90 days
- [ ] Use IAM roles instead of access keys when possible (ECS, Lambda, etc.)

## IAM Permissions Required

Your IAM user must have the following permissions:

### SES Permissions
- `ses:SendEmail` - Send emails
- `ses:SendRawEmail` - Send raw email messages
- `ses:GetSendStatistics` - Get sending statistics
- `ses:GetSendQuota` - Get sending quota
- `ses:GetAccountSendingEnabled` - Check if account can send emails
- `ses:VerifyEmailIdentity` - Verify email addresses
- `ses:VerifyDomainIdentity` - Verify domains
- `ses:GetIdentityVerificationAttributes` - Check verification status
- `ses:SetIdentityNotificationTopic` - Configure SNS notifications
- `ses:CreateReceiptRule` - Create inbound email rules
- `ses:CreateReceiptRuleSet` - Create receipt rule sets
- `ses:SetActiveReceiptRuleSet` - Activate receipt rule sets
- `ses:VerifyDomainDkim` - Configure DKIM for domain

### SNS Permissions
- `sns:Publish` - Publish to SNS topics
- `sns:Subscribe` - Subscribe to SNS topics
- `sns:Unsubscribe` - Unsubscribe from SNS topics
- `sns:ListSubscriptionsByTopic` - List subscriptions
- `sns:CreateTopic` - Create SNS topics
- `sns:GetTopicAttributes` - Get topic configuration

## Testing Your Configuration

### Step 1: Test AWS SDK Connection

```bash
cd backend
npm run test-ses-connection
```

**Expected Output (Success):**
```
✅ SUCCESS: AWS SES connection successful

Connection Details:
  Region: us-east-1
  Max Send Rate: 1 emails/second
  24-Hour Quota: 200 emails
  Sent (24h): 0 emails
  Remaining: 200 emails
```

**Expected Output (Failure - Invalid Credentials):**
```
❌ FAILURE: AWS SES connection failed

Error Details:
  Error: The security token included in the request is invalid.
  Code: InvalidClientTokenId
  Region: us-east-1

💡 Hint: AWS Access Key ID is invalid. Check AWS_ACCESS_KEY_ID in .env
```

### Step 2: Verify Domain in AWS SES

After creating your IAM user, verify your domain:

```bash
# Check domain verification status
aws ses get-identity-verification-attributes \
  --identities me.faxi.jp \
  --region us-east-1
```

### Step 3: Test Sending an Email (After Domain Verification)

Once your domain is verified, you can test sending:

```bash
# Send a test email
aws ses send-email \
  --from "test@me.faxi.jp" \
  --destination "ToAddresses=your-email@example.com" \
  --message "Subject={Data=Test Email},Body={Text={Data=This is a test email from Faxi}}" \
  --region us-east-1
```

## Common Issues and Solutions

### Issue: "The security token included in the request is invalid"

**Solution:** 
- Verify `AWS_ACCESS_KEY_ID` is correct in `.env`
- Ensure no extra spaces or quotes around the value
- Regenerate access key if needed

### Issue: "SignatureDoesNotMatch"

**Solution:**
- Verify `AWS_SECRET_ACCESS_KEY` is correct in `.env`
- Ensure no extra spaces or quotes around the value
- Regenerate access key if needed

### Issue: "AccessDenied" or "AccessDeniedException"

**Solution:**
- Verify IAM user has required SES and SNS permissions
- Check IAM policy is attached to the user
- Wait a few minutes for IAM changes to propagate

### Issue: "Account is in SES Sandbox mode"

**Solution:**
- Request production access in AWS SES Console
- While in sandbox, you can only send to verified email addresses
- See [AWS_SES_SETUP.md](./AWS_SES_SETUP.md) Step 9 for details

### Issue: "Domain not verified"

**Solution:**
- Add DNS TXT record for domain verification
- Wait up to 72 hours for DNS propagation (usually minutes)
- Verify DNS record is correct using `dig` or `nslookup`

## Next Steps

After completing this checklist:

1. ✅ Verify AWS credentials work (`npm run test-ses-connection`)
2. ✅ Complete domain verification (see [AWS_SES_SETUP.md](./AWS_SES_SETUP.md))
3. ✅ Configure DKIM and SPF records
4. ✅ Set up MX records for inbound email
5. ✅ Create SNS topic and update `SNS_TOPIC_ARN`
6. ✅ Configure SES receipt rules
7. ✅ Request production access (if needed)
8. ✅ Proceed to Task 2: Set up AWS SES infrastructure

## Security Reminders

- ⚠️ Never commit `.env` files to version control
- ⚠️ Use different credentials for development, staging, and production
- ⚠️ Rotate access keys every 90 days
- ⚠️ Monitor CloudWatch for unusual activity
- ⚠️ Enable CloudTrail logging for audit trail

## Support

For detailed setup instructions, see:
- [AWS_SES_SETUP.md](./AWS_SES_SETUP.md) - Complete AWS SES setup guide
- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
