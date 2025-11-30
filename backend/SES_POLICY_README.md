# AWS SES IAM Policy Files

This directory contains two IAM policy files for AWS SES integration:

## Policy Files

### `faxi-ses-policy.json` (Recommended)

**Use this for**: Full AWS SES setup including infrastructure configuration

This is the **complete policy** with all permissions needed to:
- Send and receive emails via SES
- Configure domain verification and DKIM
- Create and manage receipt rules for inbound email
- Set up SNS topics and subscriptions for notifications
- Configure delivery tracking

**Permissions included**:
- All basic SES operations (send, verify, get stats)
- Infrastructure setup (receipt rules, DKIM, notifications)
- SNS topic creation and management

**When to use**: 
- Initial AWS SES setup
- Production deployments where you need to configure the full email infrastructure
- Automated deployment scripts that set up SES from scratch

### `ses-policy.json` (Minimal)

**Use this for**: Basic email sending only (legacy/minimal setup)

This is a **minimal policy** with only the essential permissions for:
- Sending emails via SES
- Basic domain verification
- SNS notifications (subscribe to existing topics)

**Permissions included**:
- Basic SES operations (send, verify, get stats)
- Subscribe to existing SNS topics

**When to use**:
- You've already configured SES infrastructure manually
- You only need to send emails, not manage infrastructure
- Testing or development with pre-configured SES

## Recommendation

**Use `faxi-ses-policy.json`** for most deployments. It includes all permissions needed to fully automate the AWS SES setup process as documented in `AWS_SES_SETUP.md`.

The minimal `ses-policy.json` is kept for backward compatibility and scenarios where infrastructure is managed separately.

## Applying the Policy

### Via AWS Console

1. Go to IAM Console → Policies → Create Policy
2. Choose JSON tab
3. Copy contents from `faxi-ses-policy.json`
4. Name it `FaxiSESPolicy`
5. Attach to your IAM user

### Via AWS CLI

```bash
# Using the complete policy (recommended)
aws iam put-user-policy \
  --user-name faxi-ses-user \
  --policy-name FaxiSESPolicy \
  --policy-document file://faxi-ses-policy.json

# Or using the minimal policy
aws iam put-user-policy \
  --user-name faxi-ses-user \
  --policy-name FaxiSESPolicy \
  --policy-document file://ses-policy.json
```

## Security Notes

Both policies follow the principle of least privilege:
- Permissions are scoped to only what's needed for Faxi email operations
- SNS permissions are restricted to the `faxi-email-notifications` topic
- No permissions for deleting or modifying unrelated AWS resources

For production, consider:
- Using IAM roles instead of access keys (when running on AWS infrastructure)
- Rotating credentials every 90 days
- Enabling CloudTrail logging for audit trails
- Setting up CloudWatch alarms for unusual activity
