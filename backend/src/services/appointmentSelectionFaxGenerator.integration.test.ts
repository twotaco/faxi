import { describe, it, expect } from 'vitest';
import { AppointmentSelectionFaxGenerator } from './appointmentSelectionFaxGenerator.js';
import { AppointmentSelectionTemplateData } from '../types/fax.js';

describe('AppointmentSelectionFaxGenerator - Integration Tests', () => {
  it('should generate a valid PDF for appointment selection with multiple slots', async () => {
    const data: AppointmentSelectionTemplateData = {
      serviceName: 'Medical Consultation',
      provider: 'Dr. Tanaka Clinic',
      location: '123 Main Street, Tokyo',
      slots: [
        {
          id: 'slot-1',
          date: new Date('2025-06-15'),
          startTime: '9:00 AM',
          endTime: '10:00 AM',
          duration: 60,
          available: true,
          selectionMarker: 'A'
        },
        {
          id: 'slot-2',
          date: new Date('2025-06-15'),
          startTime: '2:00 PM',
          endTime: '3:00 PM',
          duration: 60,
          available: true,
          selectionMarker: 'B'
        },
        {
          id: 'slot-3',
          date: new Date('2025-06-16'),
          startTime: '10:00 AM',
          endTime: '11:00 AM',
          duration: 60,
          available: false,
          selectionMarker: 'C'
        },
        {
          id: 'slot-4',
          date: new Date('2025-06-16'),
          startTime: '3:00 PM',
          endTime: '4:00 PM',
          duration: 60,
          available: true,
          selectionMarker: 'D'
        }
      ]
    };

    const pdfBuffer = await AppointmentSelectionFaxGenerator.generateAppointmentSelectionFax(data);

    // Verify PDF was generated
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);

    // Verify PDF header (PDF files start with %PDF)
    const pdfHeader = pdfBuffer.toString('ascii', 0, 4);
    expect(pdfHeader).toBe('%PDF');
  });

  it('should generate a valid PDF with only unavailable slots', async () => {
    const data: AppointmentSelectionTemplateData = {
      serviceName: 'Dental Checkup',
      provider: 'Smile Dental',
      location: undefined,
      slots: [
        {
          id: 'slot-1',
          date: new Date('2025-06-20'),
          startTime: '9:00 AM',
          endTime: '10:00 AM',
          duration: 60,
          available: false,
          selectionMarker: 'A'
        },
        {
          id: 'slot-2',
          date: new Date('2025-06-20'),
          startTime: '11:00 AM',
          endTime: '12:00 PM',
          duration: 60,
          available: false,
          selectionMarker: 'B'
        }
      ]
    };

    const pdfBuffer = await AppointmentSelectionFaxGenerator.generateAppointmentSelectionFax(data);

    // Verify PDF was generated
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);

    // Verify PDF header
    const pdfHeader = pdfBuffer.toString('ascii', 0, 4);
    expect(pdfHeader).toBe('%PDF');
  });

  it('should generate a valid PDF with a custom reference ID', async () => {
    const data: AppointmentSelectionTemplateData = {
      serviceName: 'Physical Therapy',
      provider: 'Recovery Center',
      location: '456 Health Ave, Osaka',
      slots: [
        {
          id: 'slot-1',
          date: new Date('2025-07-01'),
          startTime: '1:00 PM',
          endTime: '2:00 PM',
          duration: 60,
          available: true,
          selectionMarker: 'A'
        }
      ]
    };

    const customRefId = 'FX-2025-TEST01';
    const pdfBuffer = await AppointmentSelectionFaxGenerator.generateAppointmentSelectionFax(data, customRefId);

    // Verify PDF was generated
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);

    // Verify template has custom reference ID
    const template = AppointmentSelectionFaxGenerator.createAppointmentTemplate(data, customRefId);
    expect(template.referenceId).toBe(customRefId);
  });
});
