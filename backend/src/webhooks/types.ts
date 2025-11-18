// Telnyx webhook types

export interface TelnyxWebhookPayload {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: TelnyxFaxPayload;
  };
}

export interface TelnyxFaxPayload {
  fax_id: string;
  connection_id: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  media_url: string;
  page_count: number;
  status: string;
  quality?: string;
  duration?: number;
  // Test mode fields
  test_mode?: boolean;
  test_user_phone?: string;
  original_filename?: string;
  file_size?: number;
  mime_type?: string;
}

export interface TelnyxWebhookHeaders {
  'telnyx-signature-ed25519': string;
  'telnyx-timestamp': string;
}

// Email webhook types

export interface EmailWebhookPayload {
  to: string;
  from: string;
  subject?: string;
  body?: string;
  html?: string;
  attachments?: EmailAttachment[];
  receivedAt?: string;
}

export interface EmailAttachment {
  filename: string;
  size: number;
  contentType: string;
  content?: string; // Base64 encoded content
}

export interface ParsedEmailData {
  to: string;
  from: string;
  subject: string;
  body: string;
  html?: string;
  attachments: Array<{
    filename: string;
    size: number;
    contentType: string;
  }>;
  receivedAt: string;
  provider: 'sendgrid' | 'ses' | 'postfix';
}
