import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { AppointmentSelectionFaxGenerator } from './appointmentSelectionFaxGenerator.js';
import { AppointmentSelectionTemplateData, AppointmentSlot, FaxTemplate } from '../types/fax.js';

describe('AppointmentSelectionFaxGenerator - Property Tests', () => {
  // Feature: fax-template-system, Property 14: Appointment slot formatting
  // Validates: Requirements 5.1, 5.2, 5.3
  describe('Property 14: Appointment slot formatting', () => {
    it('should format all appointment slots with date, time, duration, availability, and selection marker', () => {
      // Arbitrary for generating time strings in HH:MM AM/PM format
      const timeArbitrary = fc.tuple(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 0, max: 59 }),
        fc.constantFrom('AM', 'PM')
      ).map(([hour, minute, period]) => 
        `${hour}:${minute.toString().padStart(2, '0')} ${period}`
      );

      // Arbitrary for generating appointment slots
      const slotArbitrary = fc.record({
        id: fc.uuid(),
        date: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
        startTime: timeArbitrary,
        endTime: timeArbitrary,
        duration: fc.integer({ min: 15, max: 240 }), // 15 min to 4 hours
        available: fc.boolean(),
        selectionMarker: fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J')
      });

      // Arbitrary for generating appointment selection data
      const appointmentDataArbitrary = fc.record({
        serviceName: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
        provider: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
        location: fc.option(fc.string({ minLength: 10, maxLength: 100 })),
        slots: fc.array(slotArbitrary, { minLength: 1, maxLength: 10 })
      });

      fc.assert(
        fc.property(appointmentDataArbitrary, (data: AppointmentSelectionTemplateData) => {
          // Create the template (not the PDF)
          const template: FaxTemplate = AppointmentSelectionFaxGenerator.createAppointmentTemplate(data);

          // Verify template structure
          expect(template.type).toBe('appointment_selection');
          expect(template.referenceId).toMatch(/^FX-\d{4}-\d{6}$/);
          expect(template.pages).toHaveLength(1);
          expect(template.pages[0].content.length).toBeGreaterThan(0);

          // Verify context data
          expect(template.contextData.serviceName).toBe(data.serviceName);
          expect(template.contextData.provider).toBe(data.provider);
          expect(template.contextData.location).toBe(data.location);
          expect(template.contextData.slots).toEqual(data.slots);

          // Verify content includes service details
          const contentTexts = template.pages[0].content
            .filter(c => c.type === 'text')
            .map(c => c.text || '')
            .join(' ');

          expect(contentTexts).toContain(data.serviceName);
          expect(contentTexts).toContain(data.provider);
          if (data.location) {
            expect(contentTexts).toContain(data.location);
          }

          // Verify all slots have their time information in content
          // Available slots are in circle options, unavailable slots are in text
          const circleOptions = template.pages[0].content.filter(c => c.type === 'circle_option');
          const allOptionTexts = circleOptions.flatMap(c => c.options || []).map(opt => opt.text || '');
          
          for (const slot of data.slots) {
            const slotText = `${slot.startTime} - ${slot.endTime} (${slot.duration} min)`;
            if (slot.available) {
              // Available slots should be in circle options
              const foundInOptions = allOptionTexts.some(text => text.includes(slotText));
              expect(foundInOptions).toBe(true);
            } else {
              // Unavailable slots should be in text content
              expect(contentTexts).toContain(slotText);
            }
          }

          // Verify circle options for available slots
          const availableSlots = data.slots.filter(s => s.available);
          
          // Should have circle options if there are available slots
          if (availableSlots.length > 0) {
            expect(circleOptions.length).toBeGreaterThan(0);
            
            // Verify each available slot has a circle option
            const allOptions = circleOptions.flatMap(c => c.options || []);
            for (const slot of availableSlots) {
              const hasOption = allOptions.some(opt => opt.label === slot.selectionMarker);
              expect(hasOption).toBe(true);
            }
          }

          // Verify unavailable slots are marked
          const unavailableSlots = data.slots.filter(s => !s.available);
          for (const slot of unavailableSlots) {
            const slotText = `${slot.startTime} - ${slot.endTime} (${slot.duration} min)`;
            // Should contain the slot text and "Unavailable"
            const hasUnavailableMarker = contentTexts.includes(slotText) && contentTexts.includes('Unavailable');
            expect(hasUnavailableMarker).toBe(true);
          }

          // Verify instructions are present
          expect(contentTexts).toContain('INSTRUCTIONS');
          expect(contentTexts).toContain('Circle your preferred time slot');
          expect(contentTexts).toContain('Fax this page back');
        }),
        { numRuns: 100 }
      );
    });

    it('should group slots by date when multiple days are present', () => {
      // Create slots across multiple dates
      const multiDateSlotsArbitrary = fc.tuple(
        fc.date({ min: new Date('2024-01-01'), max: new Date('2024-01-31') }),
        fc.date({ min: new Date('2024-02-01'), max: new Date('2024-02-28') }),
        fc.date({ min: new Date('2024-03-01'), max: new Date('2024-03-31') })
      ).chain(([date1, date2, date3]) => {
        const timeArb = fc.tuple(
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 0, max: 59 }),
          fc.constantFrom('AM', 'PM')
        ).map(([hour, minute, period]) => 
          `${hour}:${minute.toString().padStart(2, '0')} ${period}`
        );

        return fc.record({
          serviceName: fc.constant('Test Service'),
          provider: fc.constant('Test Provider'),
          location: fc.constant('Test Location'),
          slots: fc.tuple(
            // Slot on date 1
            fc.record({
              id: fc.uuid(),
              date: fc.constant(date1),
              startTime: timeArb,
              endTime: timeArb,
              duration: fc.integer({ min: 30, max: 120 }),
              available: fc.boolean(),
              selectionMarker: fc.constant('A')
            }),
            // Slot on date 2
            fc.record({
              id: fc.uuid(),
              date: fc.constant(date2),
              startTime: timeArb,
              endTime: timeArb,
              duration: fc.integer({ min: 30, max: 120 }),
              available: fc.boolean(),
              selectionMarker: fc.constant('B')
            }),
            // Slot on date 3
            fc.record({
              id: fc.uuid(),
              date: fc.constant(date3),
              startTime: timeArb,
              endTime: timeArb,
              duration: fc.integer({ min: 30, max: 120 }),
              available: fc.boolean(),
              selectionMarker: fc.constant('C')
            })
          ).map(slots => slots)
        });
      });

      fc.assert(
        fc.property(multiDateSlotsArbitrary, (data: AppointmentSelectionTemplateData) => {
          // Create the template
          const template: FaxTemplate = AppointmentSelectionFaxGenerator.createAppointmentTemplate(data);

          // Get unique dates from slots
          const uniqueDates = new Set(data.slots.map(slot => {
            const options: Intl.DateTimeFormatOptions = {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            };
            return slot.date.toLocaleDateString('en-US', options);
          }));

          // Verify that we have multiple dates
          expect(uniqueDates.size).toBeGreaterThan(1);

          // Verify all date headers are present in content
          const contentTexts = template.pages[0].content
            .filter(c => c.type === 'text')
            .map(c => c.text || '')
            .join(' ');

          for (const dateStr of uniqueDates) {
            expect(contentTexts).toContain(dateStr);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should distinguish available from unavailable slots', () => {
      // Create data with both available and unavailable slots
      const mixedAvailabilityArbitrary = fc.record({
        serviceName: fc.constant('Test Service'),
        provider: fc.constant('Test Provider'),
        location: fc.option(fc.constant('Test Location')),
        slots: fc.tuple(
          // Available slot
          fc.record({
            id: fc.uuid(),
            date: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            startTime: fc.constant('9:00 AM'),
            endTime: fc.constant('10:00 AM'),
            duration: fc.constant(60),
            available: fc.constant(true),
            selectionMarker: fc.constant('A')
          }),
          // Unavailable slot
          fc.record({
            id: fc.uuid(),
            date: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            startTime: fc.constant('10:00 AM'),
            endTime: fc.constant('11:00 AM'),
            duration: fc.constant(60),
            available: fc.constant(false),
            selectionMarker: fc.constant('B')
          })
        ).map(slots => slots)
      });

      fc.assert(
        fc.property(mixedAvailabilityArbitrary, (data: AppointmentSelectionTemplateData) => {
          // Create the template
          const template: FaxTemplate = AppointmentSelectionFaxGenerator.createAppointmentTemplate(data);

          // Find available and unavailable slots
          const availableSlot = data.slots.find(s => s.available);
          const unavailableSlot = data.slots.find(s => !s.available);

          // Verify available slot has circle option
          if (availableSlot) {
            const circleOptions = template.pages[0].content.filter(c => c.type === 'circle_option');
            const allOptions = circleOptions.flatMap(c => c.options || []);
            const hasOption = allOptions.some(opt => opt.label === availableSlot.selectionMarker);
            expect(hasOption).toBe(true);
          }

          // Verify unavailable slot is marked as unavailable in text
          if (unavailableSlot) {
            const contentTexts = template.pages[0].content
              .filter(c => c.type === 'text')
              .map(c => c.text || '')
              .join(' ');
            
            const slotText = `${unavailableSlot.startTime} - ${unavailableSlot.endTime} (${unavailableSlot.duration} min)`;
            expect(contentTexts).toContain(slotText);
            expect(contentTexts).toContain('Unavailable');
          }
        }),
        { numRuns: 50 }
      );
    });
  });
});
