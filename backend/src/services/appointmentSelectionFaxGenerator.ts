import {
  FaxTemplate,
  FaxPage,
  FaxContent,
  AppointmentSelectionTemplateData,
  AppointmentSlot,
  CircleOption
} from '../types/fax.js';
import { FaxTemplateEngine } from './faxTemplateEngine.js';
import { FaxGenerator } from './faxGenerator.js';

/**
 * Generator for appointment selection faxes
 * Creates user-friendly appointment booking forms with clear time slots and selection markers
 */
export class AppointmentSelectionFaxGenerator {
  /**
   * Generate an appointment selection fax
   * @param data Appointment selection data including service info and time slots
   * @param referenceId Optional reference ID (will be generated if not provided)
   * @returns PDF buffer of the generated fax
   */
  static async generateAppointmentSelectionFax(
    data: AppointmentSelectionTemplateData,
    referenceId?: string
  ): Promise<Buffer> {
    const template = this.createAppointmentTemplate(data, referenceId);
    return await FaxGenerator.generatePdf(template);
  }

  /**
   * Create appointment selection template
   * @param data Appointment selection data
   * @param referenceId Optional reference ID
   * @returns Complete fax template ready for PDF generation
   */
  static createAppointmentTemplate(
    data: AppointmentSelectionTemplateData,
    referenceId?: string
  ): FaxTemplate {
    const refId = referenceId || FaxTemplateEngine.generateReferenceId();
    const pages: FaxPage[] = [];

    const content: FaxContent[] = [
      // Use FaxTemplateEngine for consistent header
      this.createHeader(),
      // Page title
      {
        type: 'text',
        text: 'APPOINTMENT BOOKING',
        fontSize: 68, // 24pt page title
        bold: true,
        alignment: 'center',
        marginBottom: 16
      },
      // Service details section
      {
        type: 'text',
        text: 'SERVICE DETAILS',
        fontSize: 57, // 20pt header
        bold: true,
        marginBottom: 8
      },
      {
        type: 'text',
        text: `Service: ${data.serviceName}`,
        fontSize: 45, // 16pt body text
        marginBottom: 4
      },
      {
        type: 'text',
        text: `Provider: ${data.provider}`,
        fontSize: 45, // 16pt body text
        marginBottom: 4
      }
    ];

    // Add location if provided
    if (data.location) {
      content.push({
        type: 'text',
        text: `Location: ${data.location}`,
        fontSize: 45, // 16pt body text
        marginBottom: 12
      });
    } else {
      content.push({
        type: 'text',
        text: '',
        marginBottom: 12
      });
    }

    // Add separator
    content.push({
      type: 'text',
      text: '─'.repeat(40),
      fontSize: 45, // 16pt body text
      marginBottom: 12
    });

    // Group slots by date
    const slotsByDate = this.groupSlotsByDate(data.slots);

    // Add available time slots section
    content.push({
      type: 'text',
      text: 'AVAILABLE TIME SLOTS',
      fontSize: 57, // 20pt header
      bold: true,
      marginBottom: 8
    });

    content.push({
      type: 'text',
      text: 'Circle your preferred time and fax back:',
      fontSize: 45, // 16pt body text
      marginBottom: 12
    });

    // Render slots grouped by date
    for (const [dateStr, slots] of Object.entries(slotsByDate)) {
      // Date header
      content.push({
        type: 'text',
        text: dateStr,
        fontSize: 51, // 18pt subheader
        bold: true,
        marginBottom: 8
      });

      // Create circle options for available slots on this date
      const availableSlots = slots.filter(slot => slot.available);
      const unavailableSlots = slots.filter(slot => !slot.available);

      if (availableSlots.length > 0) {
        const options: CircleOption[] = availableSlots.map(slot => ({
          id: slot.id,
          label: slot.selectionMarker,
          text: this.formatSlotText(slot)
        }));

        content.push({
          type: 'circle_option',
          options: options,
          marginBottom: 8
        });
      }

      // Show unavailable slots with X marker
      if (unavailableSlots.length > 0) {
        unavailableSlots.forEach(slot => {
          content.push({
            type: 'text',
            text: `✗ ${this.formatSlotText(slot)} - Unavailable`,
            fontSize: 45, // 16pt body text
            marginBottom: 4
          });
        });
      }

      // Add spacing between dates
      content.push({
        type: 'text',
        text: '',
        marginBottom: 8
      });
    }

    // Add separator
    content.push({
      type: 'text',
      text: '─'.repeat(40),
      fontSize: 45, // 16pt body text
      marginBottom: 12
    });

    // Add instructions
    content.push({
      type: 'text',
      text: 'INSTRUCTIONS',
      fontSize: 57, // 20pt header
      bold: true,
      marginBottom: 8
    });

    content.push({
      type: 'text',
      text: '1. Circle your preferred time slot above',
      fontSize: 45, // 16pt body text
      marginBottom: 4
    });

    content.push({
      type: 'text',
      text: '2. Fax this page back to confirm your appointment',
      fontSize: 45, // 16pt body text
      marginBottom: 4
    });

    content.push({
      type: 'text',
      text: '3. You will receive a confirmation fax within 1 hour',
      fontSize: 45, // 16pt body text
      marginBottom: 16
    });

    // Add extra margin before footer to prevent overlap
    content.push({
      type: 'blank_space',
      height: 40,
      marginBottom: 0
    });

    // Use FaxTemplateEngine for consistent footer
    content.push(this.createFooter(refId));

    pages.push({
      content,
      pageNumber: 1,
      totalPages: 1
    });

    return {
      type: 'appointment_selection',
      referenceId: refId,
      pages,
      contextData: {
        serviceName: data.serviceName,
        provider: data.provider,
        location: data.location,
        slots: data.slots
      }
    };
  }

  /**
   * Group appointment slots by date
   * @param slots Array of appointment slots
   * @returns Object mapping date strings to arrays of slots
   */
  private static groupSlotsByDate(slots: AppointmentSlot[]): Record<string, AppointmentSlot[]> {
    const grouped: Record<string, AppointmentSlot[]> = {};

    for (const slot of slots) {
      const dateStr = this.formatDate(slot.date);
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(slot);
    }

    // Sort slots within each date by start time
    for (const dateStr in grouped) {
      grouped[dateStr].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    return grouped;
  }

  /**
   * Format a date for display
   * @param date Date object
   * @returns Formatted date string (e.g., "Monday, January 15, 2024")
   */
  private static formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString('en-US', options);
  }

  /**
   * Format slot time and duration for display
   * @param slot Appointment slot
   * @returns Formatted slot text (e.g., "9:00 AM - 10:00 AM (60 min)")
   */
  private static formatSlotText(slot: AppointmentSlot): string {
    return `${slot.startTime} - ${slot.endTime} (${slot.duration} min)`;
  }

  /**
   * Create standard header content using FaxTemplateEngine branding
   */
  private static createHeader(): FaxContent {
    return {
      type: 'header',
      text: 'Faxi - Your Fax to Internet Bridge',
      fontSize: 34, // 12pt header/footer
      alignment: 'center',
      marginBottom: 12
    };
  }

  /**
   * Create standard footer content using FaxTemplateEngine format with prominent reference ID
   */
  private static createFooter(referenceId: string): FaxContent {
    return {
      type: 'footer',
      text: `Reply via fax. Ref: ${referenceId} | Support: help@faxi.jp | +81-3-1234-5678`,
      fontSize: 45, // Match body text size (45 pixels at 204 DPI ≈ 16pt)
      bold: true,
      alignment: 'center',
      marginTop: 16
    };
  }
}
