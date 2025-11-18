# Email-to-Fax Bridge Setup

This document describes how to configure the email infrastructure for the Faxi system to receive emails at `me.faxi.jp` domain and convert them to faxes.

## DNS Configuration

### MX Records

Configure the following MX records for the `me.faxi.jp` domain:

```
me.faxi.jp.    IN MX 10 mail.faxi.jp.
me.faxi.jp.    IN MX 20 mail2.faxi.jp.
```

### A Records

Point the mail servers to your email infrastructure:

```
mail.faxi.jp.  IN A  [PRIMARY_MAIL_SERVER_IP]
mail2.faxi.jp. IN A  [BACKUP_MAIL_SERVER_IP]
```

## Email Service Configuration

### Option 1: Postfix (Self-hosted)

1. Install and configure Postfix on your mail servers
2. Configure virtual domains for `me.faxi.jp`
3. Set up catch-all forwarding to webhook endpoint
4. Configure TLS certificates for secure email delivery

Example Postfix configuration:

```
# /etc/postfix/main.cf
virtual_alias_domains = me.faxi.jp
virtual_alias_maps = hash:/etc/postfix/virtual

# /etc/postfix/virtual
@me.faxi.jp webhook-handler@internal.faxi.jp
```

### Option 2: SendGrid Inbound Parse

1. Configure SendGrid Inbound Parse webhook
2. Point to: `https://your-domain.com/webhooks/email/received`
3. Configure for domain: `me.faxi.jp`

### Option 3: AWS SES

1. Configure SES to receive emails for `me.faxi.jp`
2. Set up SES receipt rules to forward to webhook
3. Configure SNS topic to trigger webhook endpoint

## Environment Variables

Add the following environment variables:

```bash
# Email configuration
EMAIL_PROVIDER=postfix  # or 'sendgrid' or 'aws-ses'
EMAIL_DOMAIN=me.faxi.jp
EMAIL_WEBHOOK_URL=https://your-domain.com/webhooks/email/received

# SMTP configuration (if using Postfix or custom SMTP)
SMTP_HOST=mail.faxi.jp
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=webhook@faxi.jp
SMTP_PASS=your-smtp-password

# SendGrid configuration (if using SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_WEBHOOK_SECRET=your-webhook-secret

# AWS SES configuration (if using AWS SES)
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

## Security Considerations

1. **Webhook Authentication**: Verify webhook signatures from email providers
2. **Rate Limiting**: Implement rate limiting on email webhook endpoint
3. **Spam Protection**: Configure SPF, DKIM, and DMARC records
4. **TLS**: Ensure all email communication uses TLS encryption

### SPF Record

```
me.faxi.jp. IN TXT "v=spf1 mx include:_spf.google.com ~all"
```

### DKIM Configuration

Generate DKIM keys and configure DNS records for email authentication.

### DMARC Policy

```
_dmarc.me.faxi.jp. IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@faxi.jp"
```

## Testing

1. Send test email to `1234567890@me.faxi.jp`
2. Verify webhook receives email data
3. Check that fax is generated and sent
4. Monitor logs for any delivery issues

## Monitoring

Set up monitoring for:
- Email delivery rates
- Webhook response times
- Failed email-to-fax conversions
- Spam detection accuracy