import { Router, Request, Response } from 'express';
import { awsSesService } from '../services/awsSesService';
import { loggingService } from '../services/loggingService';
import { auditLogService } from '../services/auditLogService';
import { config } from '../config';

const router = Router();

interface ContactFormData {
  name: string;
  email: string;
  message: string;
  source?: string; // 'footer' or 'partnering'
}

interface PartnerContactFormData {
  partnerType: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  message: string;
}

// Simple contact form (for footer)
router.post('/simple', async (req: Request, res: Response) => {
  try {
    const { name, email, message, source = 'footer' } = req.body as ContactFormData;

    // Validate required fields
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Name, email, and message are required',
      });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address',
      });
    }

    // Send email via SES
    const emailBody = `
New Contact Form Submission

Source: ${source}
Name: ${name}
Email: ${email}

Message:
${message}

---
Sent from faxi.jp contact form
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #8B7355; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #666; }
    .value { margin-top: 5px; }
    .message-box { background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #8B7355; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">New Contact Form Submission</h2>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Source</div>
        <div class="value">${source}</div>
      </div>
      <div class="field">
        <div class="label">Name</div>
        <div class="value">${name}</div>
      </div>
      <div class="field">
        <div class="label">Email</div>
        <div class="value"><a href="mailto:${email}">${email}</a></div>
      </div>
      <div class="field">
        <div class="label">Message</div>
        <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Log the submission first (always) - don't fail if logging fails
    try {
      await auditLogService.log({
        eventType: 'contact.form_submitted',
        eventData: {
          source,
          name,
          email,
          messageLength: message.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (logError) {
      loggingService.warn('Failed to log contact form submission to audit log', { error: logError });
    }

    // Send email via SES (if configured)
    if (awsSesService.isConfigured()) {
      try {
        await awsSesService.sendEmail({
          from: 'contact@faxi.jp',
          to: 'contact@faxi.jp',
          subject: `[Faxi Contact] New message from ${name}`,
          body: emailBody,
          htmlBody: htmlBody,
        });
        loggingService.info('Contact form submitted and email sent', { source, email });
      } catch (emailError) {
        // If SES fails (e.g., unverified sender), log but don't fail the request
        loggingService.warn('Failed to send email via SES, but form submission logged');
        console.log('⚠️ SES email failed (sender may not be verified):', emailError);
        console.log('📧 Contact form submission (email not sent):');
        console.log(`   From: ${name} <${email}>`);
        console.log(`   Source: ${source}`);
        console.log(`   Message: ${message}`);
      }
    } else {
      // In development without SES, just log it
      loggingService.info('Contact form submitted (SES not configured, email not sent)', {
        source,
        email,
        name,
        message: message.substring(0, 100),
      });
      console.log('📧 Contact form submission (SES not configured):');
      console.log(`   From: ${name} <${email}>`);
      console.log(`   Source: ${source}`);
      console.log(`   Message: ${message}`);
    }

    res.json({
      success: true,
      message: 'Your message has been sent successfully',
    });
  } catch (error) {
    loggingService.error('Failed to process contact form', error as Error);
    res.status(500).json({
      error: 'Failed to send message',
      message: 'An error occurred while sending your message. Please try again later.',
    });
  }
});

// Partner contact form (more detailed)
router.post('/partner', async (req: Request, res: Response) => {
  try {
    const { partnerType, companyName, contactName, email, phone, message } = req.body as PartnerContactFormData;

    // Validate required fields
    if (!partnerType || !companyName?.trim() || !contactName?.trim() || !email?.trim() || !phone?.trim() || !message?.trim()) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'All fields are required',
      });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address',
      });
    }

    // Partner type labels
    const partnerTypeLabels: Record<string, string> = {
      healthcare: 'Healthcare Provider',
      ecommerce: 'E-Commerce Platform',
      government: 'Government Service',
      advertiser: 'Advertiser/Marketer',
      dataBuyer: 'Data/Insights Buyer',
      other: 'Other',
    };

    const partnerTypeLabel = partnerTypeLabels[partnerType] || partnerType;

    // Send email via SES
    const emailBody = `
New Partner Inquiry

Partner Type: ${partnerTypeLabel}
Company Name: ${companyName}
Contact Name: ${contactName}
Email: ${email}
Phone: ${phone}

Message:
${message}

---
Sent from faxi.jp partnering page
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #8B7355; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #666; }
    .value { margin-top: 5px; }
    .message-box { background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #8B7355; }
    .partner-type { display: inline-block; background: #8B7355; color: white; padding: 4px 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">New Partner Inquiry</h2>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Partner Type</div>
        <div class="value"><span class="partner-type">${partnerTypeLabel}</span></div>
      </div>
      <div class="field">
        <div class="label">Company Name</div>
        <div class="value">${companyName}</div>
      </div>
      <div class="field">
        <div class="label">Contact Name</div>
        <div class="value">${contactName}</div>
      </div>
      <div class="field">
        <div class="label">Email</div>
        <div class="value"><a href="mailto:${email}">${email}</a></div>
      </div>
      <div class="field">
        <div class="label">Phone</div>
        <div class="value"><a href="tel:${phone}">${phone}</a></div>
      </div>
      <div class="field">
        <div class="label">Message</div>
        <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Log the submission first (always) - don't fail if logging fails
    try {
      await auditLogService.log({
        eventType: 'contact.partner_inquiry',
        eventData: {
          partnerType,
          companyName,
          contactName,
          email,
          phone,
          messageLength: message.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (logError) {
      loggingService.warn('Failed to log partner inquiry to audit log', { error: logError });
    }

    // Send email via SES (if configured)
    if (awsSesService.isConfigured()) {
      try {
        await awsSesService.sendEmail({
          from: 'contact@faxi.jp',
          to: 'contact@faxi.jp',
          subject: `[Faxi Partner] ${partnerTypeLabel} inquiry from ${companyName}`,
          body: emailBody,
          htmlBody: htmlBody,
        });
        loggingService.info('Partner inquiry submitted and email sent', { partnerType, companyName, email });
      } catch (emailError) {
        // If SES fails (e.g., unverified sender), log but don't fail the request
        loggingService.warn('Failed to send email via SES, but partner inquiry logged');
        console.log('⚠️ SES email failed (sender may not be verified):', emailError);
        console.log('📧 Partner inquiry (email not sent):');
        console.log(`   Partner Type: ${partnerTypeLabel}`);
        console.log(`   Company: ${companyName}`);
        console.log(`   Contact: ${contactName} <${email}>`);
        console.log(`   Phone: ${phone}`);
        console.log(`   Message: ${message}`);
      }
    } else {
      // In development without SES, just log it
      loggingService.info('Partner inquiry submitted (SES not configured, email not sent)', {
        partnerType,
        companyName,
        contactName,
        email,
        phone,
      });
      console.log('📧 Partner inquiry (SES not configured):');
      console.log(`   Partner Type: ${partnerTypeLabel}`);
      console.log(`   Company: ${companyName}`);
      console.log(`   Contact: ${contactName} <${email}>`);
      console.log(`   Phone: ${phone}`);
      console.log(`   Message: ${message}`);
    }

    res.json({
      success: true,
      message: 'Your inquiry has been sent successfully',
    });
  } catch (error) {
    loggingService.error('Failed to process partner inquiry', error as Error);
    res.status(500).json({
      error: 'Failed to send inquiry',
      message: 'An error occurred while sending your inquiry. Please try again later.',
    });
  }
});

export const contactController = router;
