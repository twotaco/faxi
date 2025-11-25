import { z } from 'zod';
import { UserInsightsSchema } from './base.js';

/**
 * Email Response Schema
 * 
 * For email composition and sending requests with insights extraction.
 */
export const EmailResponseSchema = z.object({
  // Email intent
  intent: z.enum(['compose', 'send', 'clarify', 'lookup']).describe(
    "User's email intent: compose new email, send email, needs clarification, or lookup contact"
  ),
  
  // Recipient information
  recipient: z.object({
    identified: z.boolean().describe("Whether recipient was successfully identified"),
    name: z.string().optional().describe("Recipient name if identified"),
    email: z.string().optional().describe("Recipient email address if identified"),
    relationship: z.string().optional().describe("Relationship to user (son, doctor, friend, etc.)"),
    needsClarification: z.boolean().describe("Whether more information is needed to identify recipient")
  }),
  
  // Email content
  subject: z.string().optional().describe("Email subject line"),
  body: z.string().optional().describe("Email body content"),
  
  // Tone and style
  tone: z.enum(['formal', 'casual', 'urgent', 'friendly']).optional().describe(
    "Appropriate tone based on recipient relationship"
  ),
  
  // Main response text
  response: z.string().describe("Human-readable response for fax, including email preview and next steps"),
  
  // Confirmation requirement
  requiresConfirmation: z.boolean().describe("Whether user needs to confirm before sending"),
  
  // Next action
  nextAction: z.enum(['show_preview', 'confirm_send', 'request_clarification', 'complete']).optional().describe(
    "Next step in the email flow"
  ),
  
  // Metadata
  metadata: z.object({
    threadId: z.string().optional().describe("Thread ID if this is a reply"),
    isReply: z.boolean().optional().describe("Whether this is a reply to an existing email"),
    confidence: z.enum(['high', 'medium', 'low']).describe("Confidence in recipient identification and email composition")
  }).optional(),
  
  // User insights (strategic data)
  insights: UserInsightsSchema
});

export type EmailResponse = z.infer<typeof EmailResponseSchema>;

/**
 * Example Email responses for few-shot learning
 */
export const EmailExamples = [
  {
    input: "Send email to my son about dinner plans this Sunday",
    output: {
      intent: "compose",
      recipient: {
        identified: true,
        name: "Takeshi Yamada",
        email: "takeshi.yamada@example.com",
        relationship: "son",
        needsClarification: false
      },
      subject: "Dinner Plans - This Sunday",
      body: "Hello Takeshi,\n\nI hope you're doing well. I wanted to check if you're available for dinner this Sunday at my place. I'm planning to make your favorite curry rice.\n\nPlease let me know if you can come, and what time works best for you.\n\nLooking forward to seeing you.\n\nLove,\nMom",
      tone: "casual",
      response: "Hello, thank you for contacting Faxi.\n\nI've prepared an email to your son Takeshi about Sunday dinner:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nTo: Takeshi Yamada (takeshi.yamada@example.com)\nSubject: Dinner Plans - This Sunday\n\nHello Takeshi,\n\nI hope you're doing well. I wanted to check if you're available for dinner this Sunday at my place. I'm planning to make your favorite curry rice.\n\nPlease let me know if you can come, and what time works best for you.\n\nLooking forward to seeing you.\n\nLove,\nMom\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nTo send this email, please fax back:\n\"Confirm send\"\n\nOr if you'd like to change anything, please let me know.",
      requiresConfirmation: true,
      nextAction: "confirm_send",
      metadata: {
        isReply: false,
        confidence: "high"
      },
      insights: {
        demographics: {
          ageRangeInferred: "60-69",
          householdTypeInferred: "single"
        },
        behavioral: {
          communicationStyle: "casual",
          taskComplexity: "simple"
        },
        digitalProfile: {
          digitalExclusionScore: 4,
          aiAssistanceNeeded: ["email-composition"]
        },
        confidenceScores: {
          demographics: 0.8,
          intent: 0.95
        }
      }
    }
  },
  {
    input: "Email my doctor to reschedule my appointment next week",
    output: {
      intent: "compose",
      recipient: {
        identified: true,
        name: "Dr. Tanaka",
        email: "tanaka.clinic@example.com",
        relationship: "doctor",
        needsClarification: false
      },
      subject: "Appointment Rescheduling Request",
      body: "Dear Dr. Tanaka,\n\nI hope this email finds you well.\n\nI am writing to request a rescheduling of my appointment currently scheduled for next week. Unfortunately, I have a conflict and will not be able to attend at the scheduled time.\n\nWould it be possible to reschedule to the following week? I am flexible with the day and time.\n\nI apologize for any inconvenience this may cause.\n\nThank you for your understanding.\n\nSincerely,\nYamada Hanako",
      tone: "formal",
      response: "Hello, thank you for contacting Faxi.\n\nI've prepared a formal email to Dr. Tanaka about rescheduling your appointment:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nTo: Dr. Tanaka (tanaka.clinic@example.com)\nSubject: Appointment Rescheduling Request\n\nDear Dr. Tanaka,\n\nI hope this email finds you well.\n\nI am writing to request a rescheduling of my appointment currently scheduled for next week. Unfortunately, I have a conflict and will not be able to attend at the scheduled time.\n\nWould it be possible to reschedule to the following week? I am flexible with the day and time.\n\nI apologize for any inconvenience this may cause.\n\nThank you for your understanding.\n\nSincerely,\nYamada Hanako\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nTo send this email, please fax back:\n\"Confirm send\"\n\nOr if you'd like to change anything, please let me know.",
      requiresConfirmation: true,
      nextAction: "confirm_send",
      metadata: {
        isReply: false,
        confidence: "high"
      },
      insights: {
        demographics: {
          ageRangeInferred: "70-79"
        },
        intentSignals: {
          healthIntent: [{
            type: "appointment",
            urgency: "near-term"
          }]
        },
        behavioral: {
          communicationStyle: "polite",
          taskComplexity: "simple"
        },
        digitalProfile: {
          digitalExclusionScore: 5,
          aiAssistanceNeeded: ["email-composition", "formal-writing"]
        },
        confidenceScores: {
          demographics: 0.75,
          intent: 0.95
        }
      }
    }
  },
  {
    input: "Send a thank you email to Suzuki-san",
    output: {
      intent: "clarify",
      recipient: {
        identified: false,
        name: "Suzuki-san",
        needsClarification: true
      },
      response: "Hello, thank you for contacting Faxi.\n\nI'd be happy to help you send a thank you email to Suzuki-san.\n\nTo compose the email, I need a bit more information:\n\n1. What is Suzuki-san's email address?\n   (Or their full name if they're in your address book)\n\n2. What would you like to thank them for?\n   (This helps me write an appropriate message)\n\nPlease send a fax with:\n- Suzuki-san's email or full name\n- What you're thanking them for\n\nI'll prepare the email for you.",
      requiresConfirmation: false,
      nextAction: "request_clarification",
      metadata: {
        confidence: "low"
      },
      insights: {
        demographics: {
          ageRangeInferred: "60-69"
        },
        behavioral: {
          communicationStyle: "polite",
          taskComplexity: "simple"
        },
        digitalProfile: {
          digitalExclusionScore: 4,
          aiAssistanceNeeded: ["email-composition"]
        },
        confidenceScores: {
          demographics: 0.7,
          intent: 0.85
        }
      }
    }
  },
  {
    input: "Reply to the email from my daughter about the family gathering",
    output: {
      intent: "compose",
      recipient: {
        identified: true,
        name: "Yuki Tanaka",
        email: "yuki.tanaka@example.com",
        relationship: "daughter",
        needsClarification: false
      },
      subject: "Re: Family Gathering",
      body: "Hi Yuki,\n\nThank you for organizing the family gathering. That sounds wonderful!\n\nI'll be there on Saturday at 2 PM. I'm planning to bring my special potato salad that everyone likes.\n\nLet me know if you need me to bring anything else.\n\nLooking forward to seeing everyone!\n\nLove,\nMom",
      tone: "friendly",
      response: "Hello, thank you for contacting Faxi.\n\nI've prepared a reply to your daughter Yuki about the family gathering:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nTo: Yuki Tanaka (yuki.tanaka@example.com)\nSubject: Re: Family Gathering\n\nHi Yuki,\n\nThank you for organizing the family gathering. That sounds wonderful!\n\nI'll be there on Saturday at 2 PM. I'm planning to bring my special potato salad that everyone likes.\n\nLet me know if you need me to bring anything else.\n\nLooking forward to seeing everyone!\n\nLove,\nMom\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nTo send this reply, please fax back:\n\"Confirm send\"\n\nOr if you'd like to change anything, please let me know.",
      requiresConfirmation: true,
      nextAction: "confirm_send",
      metadata: {
        threadId: "thread-12345",
        isReply: true,
        confidence: "high"
      },
      insights: {
        demographics: {
          ageRangeInferred: "60-69",
          householdTypeInferred: "couple"
        },
        lifeEvents: {
          movingDetected: false
        },
        behavioral: {
          communicationStyle: "friendly",
          taskComplexity: "simple"
        },
        digitalProfile: {
          digitalExclusionScore: 4,
          aiAssistanceNeeded: ["email-composition", "email-reply"]
        },
        confidenceScores: {
          demographics: 0.8,
          intent: 0.95
        }
      }
    }
  }
];
