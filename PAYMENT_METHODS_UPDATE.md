# Payment Methods Update

## Summary
Updated Stripe payment integration to support bank transfers and temporarily disable konbini (convenience store barcode) payments.

## Changes Made

### 1. Added Bank Transfer Support

**New Payment Method Type:**
- Added `bank_transfer` to payment method types alongside `card` and `konbini`
- Updated TypeScript interfaces in:
  - `backend/src/repositories/paymentMethodRepository.ts`
  - `backend/src/mcp/paymentMcpServer.ts`

**New MCP Tool: `initiate_bank_transfer`**
- Creates Stripe payment intent with `customer_balance` payment method
- Uses `jp_bank_transfer` for Japanese bank transfers
- Returns bank account details for customer to transfer funds to:
  - Bank name
  - Branch name
  - Account number
  - Account holder name
  - Payment reference
  - Hosted instructions URL

**Bank Transfer Flow:**
1. User requests bank transfer payment
2. System creates payment intent with Stripe
3. Stripe generates unique bank account details
4. User transfers exact amount to provided account
5. Stripe automatically confirms payment when funds received
6. Webhook notifies system of payment success

### 2. Disabled Konbini (Barcode) Payments

**Changes:**
- Commented out `generate_konbini_barcode` tool from active tools list
- Updated tool description to indicate "[TEMPORARILY DISABLED]"
- Modified handler to return error message:
  ```
  "Konbini (convenience store) payments are temporarily disabled. 
   Please use credit card or bank transfer instead."
  ```

**Files Modified:**
- `backend/src/mcp/paymentMcpServer.ts`

### 3. Updated Webhook Handler

**New Event Support:**
- Added `payment_intent.processing` event handler
- This event fires when bank transfer is initiated and awaiting funds
- Logs processing status and updates order status

**Webhook Events Now Supported:**
1. `payment_intent.succeeded` - Payment completed
2. `payment_intent.payment_failed` - Payment failed
3. `payment_intent.requires_action` - Needs 3D Secure or additional action
4. `payment_intent.canceled` - Payment canceled
5. `payment_intent.processing` - **NEW** - Bank transfer awaiting funds

## Stripe Configuration Required

### Webhook Events to Add
When configuring Stripe webhooks, add this new event:
- `payment_intent.processing`

### Payment Method Types Enabled
Ensure these are enabled in your Stripe account:
- ✅ Cards (credit/debit)
- ✅ Customer Balance (bank transfers)
- ❌ Konbini (temporarily disabled)

### Japan-Specific Settings
For Japanese bank transfers, ensure:
- Account country is set to Japan
- `jp_bank_transfer` is enabled in payment method settings
- Customer balance funding is enabled

## Testing

### Local Testing with Stripe CLI
```bash
# Test bank transfer initiation
stripe trigger payment_intent.processing

# Test bank transfer completion
stripe trigger payment_intent.succeeded
```

### Test Bank Transfer Flow
1. Call `initiate_bank_transfer` MCP tool
2. Verify bank account details are returned
3. Use Stripe test mode to simulate bank transfer
4. Confirm webhook fires and payment is marked as succeeded

### Test Konbini Disabled
1. Attempt to call `generate_konbini_barcode` tool
2. Verify error message is returned
3. Confirm no payment intent is created

## Migration Notes

### Existing Konbini Payments
- Existing konbini payment intents will continue to work
- Webhook handler still processes konbini payments
- Only new konbini payment creation is disabled

### Database Schema
No database migration required - the `payment_methods` table already supports the `type` column as VARCHAR, which can store 'bank_transfer'.

If you want to add a constraint, run:
```sql
ALTER TABLE payment_methods 
DROP CONSTRAINT IF EXISTS payment_methods_type_check;

ALTER TABLE payment_methods 
ADD CONSTRAINT payment_methods_type_check 
CHECK (type IN ('card', 'konbini', 'bank_transfer'));
```

## User-Facing Changes

### Payment Options Available
- ✅ Credit/Debit Card (instant)
- ✅ Bank Transfer (1-3 business days)
- ❌ Convenience Store Payment (temporarily unavailable)

### Bank Transfer Instructions
Users will receive:
1. Unique bank account details
2. Exact amount to transfer
3. Payment reference number
4. Instructions in Japanese
5. Link to hosted instructions page

### Error Messages
If user tries to use konbini:
```
"Konbini (convenience store) payments are temporarily disabled. 
 Please use credit card or bank transfer instead."
```

## Re-enabling Konbini

To re-enable konbini payments in the future:

1. Uncomment the tool in `paymentMcpServer.ts`:
```typescript
this.tools = [
  this.createGetPaymentMethodsTool(),
  this.createRegisterPaymentMethodTool(),
  this.createProcessPaymentTool(),
  this.createInitiateBankTransferTool(),
  this.createGenerateKonbiniBarcodeToool(), // UNCOMMENT THIS
  this.createCheckPaymentStatusTool(),
];
```

2. Restore the original handler implementation (see git history)

3. Remove "[TEMPORARILY DISABLED]" from tool description

4. Test thoroughly before deploying

## Files Modified

1. `backend/src/mcp/paymentMcpServer.ts` - Added bank transfer tool, disabled konbini
2. `backend/src/repositories/paymentMethodRepository.ts` - Added bank_transfer type
3. `backend/src/webhooks/stripeWebhookController.ts` - Added processing event handler
4. `PAYMENT_METHODS_UPDATE.md` - This documentation

## Next Steps

1. ✅ Update code (completed)
2. ⏳ Configure Stripe webhook to include `payment_intent.processing`
3. ⏳ Test bank transfer flow in Stripe test mode
4. ⏳ Update user-facing documentation
5. ⏳ Deploy to staging for testing
6. ⏳ Deploy to production
