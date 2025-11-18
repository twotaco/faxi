import * as nacl from 'tweetnacl';
import { config } from '../config';

/**
 * Verify Telnyx webhook signature using Ed25519
 * @param signature - The signature from Telnyx-Signature-Ed25519 header
 * @param timestamp - The timestamp from Telnyx-Timestamp header
 * @param body - The raw request body as string
 * @returns true if signature is valid
 */
export function verifyTelnyxSignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  try {
    // In test mode, skip verification
    if (config.app.testMode) {
      return true;
    }

    // Check if public key is configured
    if (!config.telnyx.publicKey) {
      console.warn('Telnyx public key not configured, skipping verification');
      return true; // Allow in development
    }

    // Verify timestamp is recent (prevent replay attacks)
    const timestampSeconds = parseInt(timestamp, 10);
    const currentSeconds = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentSeconds - timestampSeconds);
    
    if (timeDiff > config.telnyx.webhookTimeoutSeconds) {
      console.error('Webhook timestamp too old', { timeDiff, threshold: config.telnyx.webhookTimeoutSeconds });
      return false;
    }

    // Construct the signed payload
    const signedPayload = `${timestamp}.${body}`;

    // Convert hex strings to Uint8Array
    const signatureBytes = hexToBytes(signature);
    const publicKeyBytes = hexToBytes(config.telnyx.publicKey);
    const messageBytes = new TextEncoder().encode(signedPayload);

    // Verify signature
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );

    if (!isValid) {
      console.error('Invalid Telnyx webhook signature');
    }

    return isValid;
  } catch (error) {
    console.error('Error verifying Telnyx signature:', error);
    return false;
  }
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}
