import { z } from 'zod';
import { UserInsightsSchema } from './base.js';

/**
 * Appointment Booking Response Schema
 * 
 * For appointment and reservation booking requests with insights extraction.
 */
export const AppointmentResponseSchema = z.object({
  // Appointment intent
  intent: z.enum(['book', 'reschedule', 'cancel', 'check', 'clarify']).describe(
    "User's appointment intent: book new appointment, reschedule existing, cancel, check status, or needs clarification"
  ),
  
  // Business information
  business: z.object({
    identified: z.boolean().describe("Whether business was successfully identified"),
    name: z.string().optional().describe("Business name if identified"),
    type: z.enum(['medical', 'dental', 'salon', 'restaurant', 'government', 'other']).optional().describe(
      "Type of business or service"
    ),
    location: z.string().optional().describe("Business location or address"),
    needsClarification: z.boolean().describe("Whether more information is needed to identify business")
  }),
  
  // Date and time
  dateTime: z.object({
    identified: z.boolean().describe("Whether date/time was successfully parsed"),
    date: z.string().optional().describe("Appointment date (YYYY-MM-DD format)"),
    time: z.string().optional().describe("Appointment time (HH:MM format)"),
    flexibility: z.enum(['specific', 'flexible', 'any']).optional().describe("User's time flexibility"),
    originalRequest: z.string().optional().describe("Original date/time request from user"),
    needsClarification: z.boolean().describe("Whether more information is needed for date/time")
  }),
  
  // Party size (for restaurants, group appointments)
  partySize: z.number().optional().describe("Number of people (for restaurants or group appointments)"),
  
  // Special requests
  specialRequests: z.array(z.string()).optional().describe(
    "Special requests: accessibility needs, dietary restrictions, specific doctor, etc."
  ),
  
  // Main response text
  response: z.string().describe("Human-readable response for fax, including appointment details and next steps"),
  
  // Confirmation requirement
  requiresConfirmation: z.boolean().describe("Whether user needs to confirm before booking"),
  
  // Next action
  nextAction: z.enum(['show_options', 'confirm_booking', 'request_clarification', 'complete']).optional().describe(
    "Next step in the appointment flow"
  ),
  
  // Metadata
  metadata: z.object({
    appointmentId: z.string().optional().describe("Appointment ID if booking confirmed"),
    confirmationNumber: z.string().optional().describe("Confirmation number from business"),
    estimatedDuration: z.string().optional().describe("Estimated appointment duration"),
    cancellationPolicy: z.string().optional().describe("Cancellation policy if applicable"),
    confidence: z.enum(['high', 'medium', 'low']).describe("Confidence in business identification and booking details")
  }).optional(),
  
  // User insights (strategic data)
  insights: UserInsightsSchema
});

export type AppointmentResponse = z.infer<typeof AppointmentResponseSchema>;

/**
 * Example Appointment responses for few-shot learning
 */
export const AppointmentExamples = [
  {
    input: "Make an appointment at Tanaka Clinic for next Tuesday",
    output: {
      intent: "book",
      business: {
        identified: true,
        name: "Tanaka Clinic",
        type: "medical",
        location: "Shibuya-ku, Tokyo",
        needsClarification: false
      },
      dateTime: {
        identified: true,
        date: "2025-12-03",
        time: undefined,
        flexibility: "flexible",
        originalRequest: "next Tuesday",
        needsClarification: true
      },
      response: "Hello, thank you for contacting Faxi.\n\nI'll help you book an appointment at Tanaka Clinic for next Tuesday, December 3rd.\n\nTo complete the booking, I need to know:\n1. What time would you prefer?\n   - Morning (9:00-12:00)\n   - Afternoon (14:00-17:00)\n   - Any time is fine\n\n2. What is the reason for your visit?\n   (This helps the clinic prepare)\n\nPlease send a fax with:\n- Your preferred time\n- Reason for visit\n\nI'll contact the clinic and confirm your appointment.\n\nTanaka Clinic contact: 03-1234-5678",
      requiresConfirmation: false,
      nextAction: "request_clarification",
      metadata: {
        confidence: "medium"
      },
      insights: {
        demographics: {
          ageRangeInferred: "70-79",
          regionInferred: "Tokyo"
        },
        intentSignals: {
          healthIntent: [{
            type: "appointment",
            urgency: "near-term"
          }]
        },
        behavioral: {
          communicationStyle: "short",
          taskComplexity: "simple"
        },
        digitalProfile: {
          digitalExclusionScore: 5,
          aiAssistanceNeeded: ["appointment-booking", "phone-calls"]
        },
        confidenceScores: {
          demographics: 0.8,
          intent: 0.95
        }
      }
    }
  },
  {
    input: "Reserve a table at Sushi Dai for 2 people tomorrow at 7pm",
    output: {
      intent: "book",
      business: {
        identified: true,
        name: "Sushi Dai",
        type: "restaurant",
        location: "Tsukiji, Tokyo",
        needsClarification: false
      },
      dateTime: {
        identified: true,
        date: "2025-11-26",
        time: "19:00",
        flexibility: "specific",
        originalRequest: "tomorrow at 7pm",
        needsClarification: false
      },
      partySize: 2,
      response: "Hello, thank you for contacting Faxi.\n\nI'll help you reserve a table at Sushi Dai:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nRestaurant: Sushi Dai (Tsukiji)\nDate: Tomorrow, November 26th\nTime: 7:00 PM\nParty size: 2 people\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nPlease note:\n• Sushi Dai is very popular and may be fully booked\n• I'll contact them to check availability\n• If 7 PM is not available, would you like:\n  - Earlier time (6:00 PM or 6:30 PM)?\n  - Later time (7:30 PM or 8:00 PM)?\n\nTo confirm this reservation request, please fax back:\n\"Confirm reservation\"\n\nOr let me know if you'd like to try alternative times.\n\nI'll contact the restaurant and send you a confirmation fax.",
      requiresConfirmation: true,
      nextAction: "confirm_booking",
      metadata: {
        estimatedDuration: "90 minutes",
        confidence: "high"
      },
      insights: {
        demographics: {
          ageRangeInferred: "60-69",
          householdTypeInferred: "couple",
          regionInferred: "Tokyo"
        },
        intentSignals: {
          commercialIntent: [{
            category: "dining",
            product: "restaurant reservation",
            urgency: "immediate"
          }]
        },
        behavioral: {
          communicationStyle: "direct",
          taskComplexity: "simple"
        },
        consumerProfile: {
          spendSensitivity: "premium",
          categoryPreference: "dining"
        },
        digitalProfile: {
          digitalExclusionScore: 4,
          aiAssistanceNeeded: ["reservation-booking", "phone-calls"]
        },
        confidenceScores: {
          demographics: 0.85,
          intent: 0.95
        }
      }
    }
  },
  {
    input: "Book a haircut at my usual salon",
    output: {
      intent: "book",
      business: {
        identified: true,
        name: "Hair Salon Sakura",
        type: "salon",
        location: "Meguro-ku, Tokyo",
        needsClarification: false
      },
      dateTime: {
        identified: false,
        flexibility: "flexible",
        needsClarification: true
      },
      response: "Hello, thank you for contacting Faxi.\n\nI'll help you book a haircut at Hair Salon Sakura (your usual salon).\n\nTo complete the booking, I need to know:\n1. When would you like your appointment?\n   - This week\n   - Next week\n   - Specific date\n\n2. What time works best?\n   - Morning\n   - Afternoon\n   - Any time\n\n3. Do you want your regular stylist (Yamamoto-san)?\n\nPlease send a fax with:\n- Your preferred date and time\n- Stylist preference (if any)\n\nI'll contact the salon and confirm your appointment.\n\nSalon contact: 03-5678-1234",
      requiresConfirmation: false,
      nextAction: "request_clarification",
      metadata: {
        estimatedDuration: "60 minutes",
        confidence: "medium"
      },
      insights: {
        demographics: {
          ageRangeInferred: "70-79",
          regionInferred: "Tokyo"
        },
        behavioral: {
          communicationStyle: "short",
          taskComplexity: "simple"
        },
        consumerProfile: {
          spendSensitivity: "normal",
          categoryPreference: "personal-care"
        },
        digitalProfile: {
          digitalExclusionScore: 5,
          aiAssistanceNeeded: ["appointment-booking", "phone-calls"]
        },
        confidenceScores: {
          demographics: 0.75,
          intent: 0.9
        }
      }
    }
  },
  {
    input: "I need to see a dentist urgently, I have tooth pain",
    output: {
      intent: "book",
      business: {
        identified: false,
        type: "dental",
        needsClarification: true
      },
      dateTime: {
        identified: true,
        flexibility: "any",
        originalRequest: "urgently",
        needsClarification: false
      },
      specialRequests: ["urgent care", "tooth pain"],
      response: "Hello, thank you for contacting Faxi.\n\nI understand you need urgent dental care for tooth pain. I'll help you find an appointment as soon as possible.\n\nTo help you quickly:\n1. Do you have a regular dentist?\n   - If yes, what is their name?\n   - If no, I can find nearby dentists with urgent care\n\n2. What area are you in?\n   (This helps me find nearby dentists)\n\n3. Can you describe the pain?\n   - Sharp pain\n   - Dull ache\n   - Swelling\n\nFor urgent dental care, you can also call:\n• Tokyo Dental Emergency: 03-3333-4444 (24 hours)\n\nPlease send a fax with:\n- Your dentist's name (or your area if you need a new dentist)\n- Description of pain\n\nI'll find you the earliest available appointment.",
      requiresConfirmation: false,
      nextAction: "request_clarification",
      metadata: {
        confidence: "medium"
      },
      insights: {
        demographics: {
          ageRangeInferred: "70-79"
        },
        intentSignals: {
          healthIntent: [{
            type: "emergency",
            urgency: "immediate"
          }]
        },
        behavioral: {
          communicationStyle: "direct",
          taskComplexity: "moderate"
        },
        digitalProfile: {
          digitalExclusionScore: 5,
          aiAssistanceNeeded: ["appointment-booking", "emergency-assistance", "phone-calls"]
        },
        confidenceScores: {
          demographics: 0.7,
          intent: 0.95
        }
      }
    }
  },
  {
    input: "Reschedule my appointment at City Hall next Monday to the following week",
    output: {
      intent: "reschedule",
      business: {
        identified: true,
        name: "City Hall",
        type: "government",
        location: "Shibuya City Office",
        needsClarification: false
      },
      dateTime: {
        identified: true,
        date: "2025-12-09",
        flexibility: "flexible",
        originalRequest: "following week",
        needsClarification: true
      },
      response: "Hello, thank you for contacting Faxi.\n\nI'll help you reschedule your City Hall appointment from Monday, December 2nd to the following week (December 9-13).\n\nTo complete the rescheduling:\n1. What day next week works best?\n   - Monday, December 9th\n   - Tuesday, December 10th\n   - Wednesday, December 11th\n   - Thursday, December 12th\n   - Friday, December 13th\n\n2. What time would you prefer?\n   - Morning (9:00-12:00)\n   - Afternoon (13:00-16:00)\n\n3. What is your appointment for?\n   (This helps me contact the right department)\n\nPlease send a fax with:\n- Preferred day and time\n- Purpose of appointment\n- Your appointment reference number (if you have it)\n\nI'll contact City Hall and confirm the new appointment time.\n\nCity Hall contact: 03-1111-2222",
      requiresConfirmation: false,
      nextAction: "request_clarification",
      metadata: {
        confidence: "medium"
      },
      insights: {
        demographics: {
          ageRangeInferred: "70-79",
          regionInferred: "Tokyo"
        },
        intentSignals: {
          govIntent: [{
            serviceType: "city-hall-appointment",
            urgency: "near-term"
          }]
        },
        behavioral: {
          communicationStyle: "polite",
          taskComplexity: "moderate"
        },
        digitalProfile: {
          digitalExclusionScore: 5,
          aiAssistanceNeeded: ["appointment-booking", "government-services", "phone-calls"]
        },
        confidenceScores: {
          demographics: 0.8,
          intent: 0.9
        }
      }
    }
  }
];
