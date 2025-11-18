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
}

export interface TelnyxWebhookHeaders {
  'telnyx-signature-ed25519': string;
  'telnyx-timestamp': string;
}
