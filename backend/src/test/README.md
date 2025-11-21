# Faxi Test Harness

The Faxi Test Harness allows you to test the complete fax processing pipeline without incurring Telnyx costs or needing real fax machines.

## Features

- **Test Webhook Endpoint**: Upload fax images directly via HTTP
- **Mock Fax Sender**: Saves outbound faxes locally instead of sending via Telnyx
- **Test UI**: Web interface for easy testing and monitoring
- **Test Fixtures**: Pre-generated sample fax images for common scenarios
- **Real-time Monitoring**: Track processing status and view results

## Getting Started

### 1. Enable Test Mode

Set the `TEST_MODE` environment variable to `true`:

```bash
export TEST_MODE=true
```

Or add to your `.env` file:
```
TEST_MODE=true
```

### 2. Start the Server

```bash
npm run dev
```

### 3. Access the Test UI

Open your browser to: http://localhost:4000/test

### 4. Generate Test Fixtures (Optional)

```bash
npm run generate-fixtures
```

## Test Endpoints

### Upload Test Fax
```
POST /test/fax/receive
Content-Type: multipart/form-data

Form fields:
- fax_file: File (PDF, PNG, JPEG)
- from_number: Phone number (default: +1234567890)
- to_number: Phone number (default: +0987654321)
- test_user_phone: Phone number (default: from_number)
```

### Get Processing Status
```
GET /test/fax/status/:fax_id
```

### List Test Faxes
```
GET /test/fax/list
```

### Get Mock Sent Faxes (Responses)
```
GET /test/fax/responses
```

### Download Response Fax
```
GET /test/fax/download/:fax_id?format=pdf
```

### Test Fixtures
```
GET /test/fax/fixtures              # List available fixtures
GET /test/fax/fixtures/:filename    # Download fixture
POST /test/fax/fixtures/generate    # Generate new fixtures
```

### Clear Test Data
```
DELETE /test/fax/clear
```

## Test Fixtures

The test harness includes pre-generated sample fax images for common scenarios:

### Email Scenarios
- `email_request.png` - Simple email request
- `email_reply_with_circles.png` - Email reply with circled options
- `poor_handwriting.png` - Email with poor handwriting

### Shopping Scenarios
- `shopping_request.png` - Product purchase request
- `product_selection_with_checkmarks.png` - Product selection form with checkmarks
- `blank_reply_with_reference.png` - Handwritten reply with reference ID

### AI Chat Scenarios
- `ai_chat_request.png` - Questions for AI assistant

### Payment Scenarios
- `payment_registration.png` - Credit card registration

### Edge Cases
- `ambiguous_request.png` - Unclear request requiring clarification
- `multi_action_request.png` - Multiple actions in one fax

## Using the Test UI

### 1. Upload Test Fax

1. Click "Load Test Fixtures" to see available sample faxes
2. Click "Use This Fixture" to load a sample, or upload your own file
3. Adjust phone numbers if needed
4. Click "Send Test Fax"

### 2. Monitor Processing

- View real-time processing status in the "Recent Test Faxes" section
- Click "View Details" to see processing steps and logs
- Processing updates automatically every 5 seconds

### 3. View Response Faxes

- Generated response faxes appear in the "Response Faxes" section
- Download responses as PDF files
- View mock delivery status and statistics

### 4. Conversation History

- Enter a phone number to view conversation history
- See context recovery and multi-step interactions

## Mock Fax Sender

When `TEST_MODE=true`, the system uses a mock fax sender that:

- Saves outbound faxes to local storage instead of calling Telnyx
- Simulates delivery delays (configurable, default 2 seconds)
- Simulates random failures (configurable, default 5% failure rate)
- Tracks delivery statistics
- Provides downloadable response faxes

### Mock Sender Configuration

The mock sender can be configured in `src/services/mockFaxSender.ts`:

```typescript
const mockFaxSender = new MockFaxSender({
  deliveryDelay: 1000,    // 1 second delay
  failureRate: 0.1,       // 10% failure rate
  storageDir: './test-faxes'
});
```

## Testing Scenarios

### Basic Email Flow
1. Upload `email_request.png`
2. Verify AI extracts recipient, subject, and message
3. Check that email is "sent" (logged in audit)
4. Verify confirmation fax is generated

### Shopping Flow
1. Upload `shopping_request.png`
2. Verify AI extracts product requests
3. Check that product search is performed
4. Verify product selection fax is generated
5. Upload `product_selection_with_checkmarks.png`
6. Verify selected products are processed
7. Check order confirmation fax

### Context Recovery
1. Upload initial request fax
2. Note the reference ID in the response
3. Upload `blank_reply_with_reference.png`
4. Verify system matches the reference and continues conversation

### Error Handling
1. Upload `ambiguous_request.png`
2. Verify clarification fax is generated
3. Upload malformed file
4. Verify error handling and user feedback

## Troubleshooting

### Test Mode Not Working
- Verify `TEST_MODE=true` in environment
- Check server logs for test mode confirmation
- Ensure test endpoints return 404 if test mode is disabled

### Fixtures Not Loading
- Run `npm run generate-fixtures` to create fixtures
- Check `src/test/fixtures/fax-images/` directory exists
- Verify Canvas dependencies are installed

### Processing Stuck
- Check Redis connection (queue system)
- Verify database connection
- Check worker logs for errors
- Use `/test/fax/status/:fax_id` to debug processing steps

### Mock Faxes Not Saving
- Check file permissions in test-faxes directory
- Verify mock sender is enabled in test mode
- Check audit logs for mock transmission records

## Development

### Adding New Test Fixtures

1. Edit `src/test/fixtures/createTestFaxes.ts`
2. Add new fixture generation method
3. Update `generateAllFixtures()` to include it
4. Run `npm run generate-fixtures`

### Customizing Mock Behavior

Edit `src/services/mockFaxSender.ts` to:
- Change failure rates
- Modify delivery delays
- Add custom delivery logic
- Implement different storage backends

### Extending Test UI

The test UI is a single HTML file at `src/test/testUI.html`. You can:
- Add new monitoring sections
- Implement additional test controls
- Customize the styling and layout
- Add real-time WebSocket updates

## Production Considerations

⚠️ **Important**: The test harness should only be used in development/testing environments.

- Test endpoints are only available when `TEST_MODE=true`
- Mock fax sender bypasses real Telnyx API calls
- Test data is stored in memory and local files
- No authentication/authorization on test endpoints

Make sure to set `TEST_MODE=false` in production environments.