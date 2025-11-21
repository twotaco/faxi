#!/bin/bash

# Test script for Telnyx webhook endpoint
# This simulates a Telnyx webhook call in test mode

echo "Testing Telnyx webhook endpoint..."
echo ""

# Sample webhook payload
PAYLOAD='{
  "data": {
    "event_type": "fax.received",
    "id": "test-event-123",
    "occurred_at": "2024-01-15T10:30:00Z",
    "payload": {
      "fax_id": "test-fax-123",
      "connection_id": "test-connection",
      "direction": "inbound",
      "from": "+15551234567",
      "to": "+15559876543",
      "media_url": "https://example.com/fax.pdf",
      "page_count": 2,
      "status": "received"
    }
  }
}'

# Make the request
curl -X POST http://localhost:4000/webhooks/telnyx/fax/received \
  -H "Content-Type: application/json" \
  -H "Telnyx-Signature-Ed25519: test-signature" \
  -H "Telnyx-Timestamp: $(date +%s)" \
  -d "$PAYLOAD" \
  -v

echo ""
echo "Test complete!"
