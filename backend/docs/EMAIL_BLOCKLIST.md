# Email Blocklist Management

This document describes the user blocklist system for managing unwanted email senders.

## Overview

The blocklist system allows users to block unwanted email senders via fax commands. Blocked emails are rejected before conversion to fax, preventing spam and unwanted communications.

## Features

- **Per-user blocklists**: Each user maintains their own blocklist
- **Fax-based management**: Block/unblock via simple fax commands
- **Case-insensitive matching**: Blocks work regardless of email case
- **Confirmation faxes**: Users receive confirmation for all blocklist operations
- **Automatic rejection**: Blocked emails are silently rejected

## Components

### BlocklistService

Service responsible for blocklist management.

**Location**: `src/services/blocklistService.ts`

**Key Methods**:
- `blockSender(userId, emailAddress)`: Adds email to user's blocklist
- `unblockSender(userId, emailAddress)`: Removes email from blocklist
- `isBlocked(userId, senderEmail)`: Checks if sender is blocked
- `getBlocklist(userId)`: Retrieves user's complete blocklist

### IntentExtractor

Parses fax content to identify block/unblock commands.

**Location**: `src/services/intentExtractor.ts`

**Recognized Commands**:
- "Block emails from {email}"
- "Block {email}"
- "Unblock emails from {email}"
- "Unblock {email}"
- "Show my blocklist"
- "List blocked senders"


## User Workflow

### Blocking a Sender

**Step 1**: User receives unwanted email as fax

**Step 2**: User sends fax with block command:
```
Block emails from spam@example.com
```

**Step 3**: System processes command:
1. Extracts email address from fax
2. Normalizes email to lowercase
3. Adds to user's blocklist in database
4. Generates confirmation fax

**Step 4**: User receives confirmation fax:
```
BLOCKLIST UPDATED

The following email address has been blocked:
spam@example.com

You will no longer receive faxes from this sender.

To unblock this sender, send a fax with:
"Unblock spam@example.com"

Current blocklist size: 3 addresses
```

### Unblocking a Sender

**Step 1**: User sends fax with unblock command:
```
Unblock spam@example.com
```

**Step 2**: System processes command:
1. Extracts email address from fax
2. Normalizes email to lowercase
3. Removes from user's blocklist
4. Generates confirmation fax

**Step 3**: User receives confirmation fax:
```
BLOCKLIST UPDATED

The following email address has been unblocked:
spam@example.com

You will now receive faxes from this sender.

Current blocklist size: 2 addresses
```

### Viewing Blocklist

**Step 1**: User sends fax with list command:
```
Show my blocklist
```

**Step 2**: System generates blocklist fax:
```
YOUR BLOCKED SENDERS

You have blocked 3 email addresses:

1. spam@example.com
   Blocked on: 2025-01-15

2. unwanted@test.com
   Blocked on: 2025-01-10

3. marketing@company.com
   Blocked on: 2025-01-05

To unblock a sender, send a fax with:
"Unblock {email_address}"
```


## Technical Implementation

### Database Schema

```sql
CREATE TABLE email_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_email VARCHAR(255) NOT NULL,
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, blocked_email)
);

CREATE INDEX idx_email_blocklist_user_id ON email_blocklist(user_id);
CREATE INDEX idx_email_blocklist_email ON email_blocklist(LOWER(blocked_email));
```

### Email Normalization

All email addresses are normalized to lowercase before storage and comparison:

```typescript
const normalizedEmail = emailAddress.toLowerCase().trim();
```

This ensures case-insensitive matching:
- `Spam@Example.com` matches `spam@example.com`
- `UNWANTED@TEST.COM` matches `unwanted@test.com`

### Blocklist Check Flow

When an inbound email is received:

1. **Extract sender email** from email headers
2. **Normalize email** to lowercase
3. **Check blocklist**:
   ```typescript
   const isBlocked = await blocklistService.isBlocked(userId, senderEmail);
   ```
4. **If blocked**: Reject email silently (no error response)
5. **If not blocked**: Continue with email-to-fax conversion

### Performance Considerations

**Database Query**:
```sql
SELECT EXISTS(
  SELECT 1 FROM email_blocklist
  WHERE user_id = $1 AND LOWER(blocked_email) = LOWER($2)
);
```

**Optimization**:
- Index on `LOWER(blocked_email)` for fast lookups
- Query returns boolean, not full record
- Cached in Redis for frequently checked addresses (optional)


## API Reference

### BlocklistService Methods

#### blockSender(userId: string, emailAddress: string): Promise<void>

Adds an email address to the user's blocklist.

**Parameters**:
- `userId`: UUID of the user
- `emailAddress`: Email address to block

**Behavior**:
- Normalizes email to lowercase
- Inserts into database (ignores if already exists)
- Logs action in audit system

**Example**:
```typescript
await blocklistService.blockSender(
  'user-uuid',
  'spam@example.com'
);
```

#### unblockSender(userId: string, emailAddress: string): Promise<void>

Removes an email address from the user's blocklist.

**Parameters**:
- `userId`: UUID of the user
- `emailAddress`: Email address to unblock

**Behavior**:
- Normalizes email to lowercase
- Deletes from database (no error if not found)
- Logs action in audit system

**Example**:
```typescript
await blocklistService.unblockSender(
  'user-uuid',
  'spam@example.com'
);
```

#### isBlocked(userId: string, senderEmail: string): Promise<boolean>

Checks if a sender is blocked by the user.

**Parameters**:
- `userId`: UUID of the user
- `senderEmail`: Email address to check

**Returns**: `true` if blocked, `false` otherwise

**Example**:
```typescript
const blocked = await blocklistService.isBlocked(
  'user-uuid',
  'sender@example.com'
);

if (blocked) {
  // Reject email
} else {
  // Process email
}
```

#### getBlocklist(userId: string): Promise<string[]>

Retrieves the user's complete blocklist.

**Parameters**:
- `userId`: UUID of the user

**Returns**: Array of blocked email addresses

**Example**:
```typescript
const blocklist = await blocklistService.getBlocklist('user-uuid');
// ['spam@example.com', 'unwanted@test.com']
```


## Testing

### Unit Tests

Test blocklist operations:
```typescript
describe('BlocklistService', () => {
  it('should block sender', async () => {
    await blocklistService.blockSender(userId, 'spam@example.com');
    const isBlocked = await blocklistService.isBlocked(userId, 'spam@example.com');
    expect(isBlocked).toBe(true);
  });

  it('should unblock sender', async () => {
    await blocklistService.blockSender(userId, 'spam@example.com');
    await blocklistService.unblockSender(userId, 'spam@example.com');
    const isBlocked = await blocklistService.isBlocked(userId, 'spam@example.com');
    expect(isBlocked).toBe(false);
  });

  it('should be case-insensitive', async () => {
    await blocklistService.blockSender(userId, 'Spam@Example.com');
    const isBlocked = await blocklistService.isBlocked(userId, 'spam@example.com');
    expect(isBlocked).toBe(true);
  });
});
```

### Property-Based Tests

Test blocklist enforcement across many inputs:
```typescript
// Property: Blocklist enforcement
// For any inbound email from a blocked sender, the system should reject
// the email without converting to fax
```

### Integration Tests

Test end-to-end blocklist flow:
1. User receives email from sender
2. User sends block command via fax
3. Sender sends another email
4. Email is rejected (not converted to fax)
5. User sends unblock command via fax
6. Sender sends another email
7. Email is converted to fax and delivered

## Monitoring

### Metrics to Track

- **Total blocked addresses**: Count across all users
- **Blocks per user**: Average and distribution
- **Block operations per day**: Trend over time
- **Unblock operations per day**: Trend over time
- **Rejected emails**: Count of emails rejected due to blocklist

### Queries

**Most blocked domains**:
```sql
SELECT 
  SUBSTRING(blocked_email FROM '@(.*)$') as domain,
  COUNT(*) as block_count
FROM email_blocklist
GROUP BY domain
ORDER BY block_count DESC
LIMIT 10;
```

**Users with large blocklists**:
```sql
SELECT 
  user_id,
  COUNT(*) as blocked_count
FROM email_blocklist
GROUP BY user_id
HAVING COUNT(*) > 10
ORDER BY blocked_count DESC;
```


## Troubleshooting

### Blocked Email Still Getting Through

**Check**:
1. Verify email is in blocklist:
   ```sql
   SELECT * FROM email_blocklist 
   WHERE user_id = 'user-uuid' 
   AND LOWER(blocked_email) = 'sender@example.com';
   ```
2. Check EmailWebhookController calls `isBlocked()` before processing
3. Verify email address normalization is working
4. Check audit logs for blocklist check

### Block Command Not Working

**Check**:
1. Verify IntentExtractor recognizes block command
2. Check fax content for correct format
3. Verify BlocklistService.blockSender() is called
4. Check database for new entry
5. Verify confirmation fax was sent

### Case Sensitivity Issues

**Check**:
1. Verify email normalization to lowercase
2. Check database index on `LOWER(blocked_email)`
3. Verify query uses case-insensitive comparison

### Performance Issues

**Check**:
1. Verify index exists on `email_blocklist(user_id, LOWER(blocked_email))`
2. Check query execution plan
3. Consider Redis caching for frequently checked addresses
4. Monitor database query times

## Best Practices

### For Users

1. **Block specific addresses**, not entire domains
2. **Review blocklist periodically** to remove outdated blocks
3. **Use blocklist for spam**, not for managing contacts
4. **Unblock when appropriate** to avoid missing important emails

### For Administrators

1. **Monitor blocklist growth** for unusual patterns
2. **Investigate users with very large blocklists** (may indicate spam issues)
3. **Track most blocked domains** to identify spam sources
4. **Provide clear instructions** for blocklist management
5. **Consider domain-level blocking** for known spam domains (system-wide)

## Future Enhancements

### Potential Features

1. **Domain-level blocking**: Block all emails from a domain
2. **Temporary blocks**: Auto-expire after specified time
3. **Block reasons**: Allow users to note why they blocked someone
4. **Shared blocklists**: Community-maintained spam lists
5. **Whitelist**: Always allow certain senders
6. **Pattern matching**: Block based on subject or content patterns

### Implementation Considerations

- Maintain backward compatibility
- Consider performance impact
- Provide migration path for existing blocklists
- Update documentation and user guidance

## References

- [Email Abuse Prevention](./EMAIL_ABUSE_PREVENTION.md)
- [Operations Runbook](./EMAIL_OPERATIONS_RUNBOOK.md)
- [Troubleshooting Guide](./EMAIL_TROUBLESHOOTING.md)
