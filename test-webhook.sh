#!/bin/bash

# Test script for Telnyx webhook endpoint
# This simulates various Telnyx webhook calls in test mode

echo "Testing Telnyx webhook endpoint..."
echo ""

# Function to make a webhook request
test_webhook() {
  local event_type=$1
  local description=$2
  local extra_payload=$3

  echo "=== Testing: $description ==="

  PAYLOAD=$(cat <<EOF
{
  "data": {
    "event_type": "$event_type",
    "id": "test-event-$(date +%s)",
    "occurred_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "payload": {
      "fax_id": "test-fax-$(date +%s)",
      "connection_id": "test-connection",
      "direction": "inbound",
      "from": "+15551234567",
      "to": "+15559876543",
      "media_url": "https://example.com/fax.pdf",
      "page_count": 2,
      "status": "received"$extra_payload
    }
  }
}
EOF
)

  # Make the request to the single endpoint
  curl -s -X POST http://localhost:4000/webhooks/telnyx/fax \
    -H "Content-Type: application/json" \
    -H "Telnyx-Signature-Ed25519: test-signature" \
    -H "Telnyx-Timestamp: $(date +%s)" \
    -d "$PAYLOAD"

  echo ""
  echo ""
}

# Test various event types
test_webhook "fax.received" "Inbound fax received"
test_webhook "fax.queued" "Fax queued for sending"
test_webhook "fax.sending.started" "Fax sending started"
test_webhook "fax.sent" "Fax sent successfully"
test_webhook "fax.failed" "Fax failed" ',
      "failure_reason": "busy_signal",
      "call_duration_secs": 30'
test_webhook "fax.receiving.started" "Fax receiving started"
test_webhook "fax.media.processed" "Media processed"

echo "=== All tests complete! ==="
