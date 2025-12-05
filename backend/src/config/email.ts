import { config } from './index';

export interface EmailConfig {
  domain: string;
  mxRecords: string[];
  webhookUrl: string;
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  provider: 'postfix' | 'sendgrid' | 'aws-ses';
}

export const emailConfig: EmailConfig = {
  domain: config.email.fromDomain,
  mxRecords: [
    '10 mail.faxi.jp',
    '20 mail2.faxi.jp'
  ],
  webhookUrl: `${config.baseUrl}/webhooks/email/received`,
  smtpConfig: config.email?.smtp ? {
    host: config.email.smtp.host,
    port: config.email.smtp.port,
    secure: config.email.smtp.secure,
    auth: {
      user: config.email.smtp.user,
      pass: config.email.smtp.pass,
    }
  } : undefined,
  provider: (config.email?.provider as any) || 'postfix'
};

/**
 * Extract phone number from Faxi email address
 * Format: {phone_number}@{domain}
 */
export function extractPhoneFromEmail(emailAddress: string): string | null {
  const domain = config.email.fromDomain;
  const escapedDomain = domain.replace(/\./g, '\\.');
  const match = emailAddress.match(new RegExp(`^(\\d+)@${escapedDomain}$`));
  return match ? match[1] : null;
}

/**
 * Validate if email address is a Faxi user email
 */
export function isFaxiUserEmail(emailAddress: string): boolean {
  const domain = config.email.fromDomain;
  const escapedDomain = domain.replace(/\./g, '\\.');
  return new RegExp(`^\\d+@${escapedDomain}$`).test(emailAddress);
}

/**
 * Generate Faxi email address from phone number
 */
export function generateFaxiEmail(phoneNumber: string): string {
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  return `${cleanPhone}@${config.email.fromDomain}`;
}