import { GoogleGenerativeAI } from '@google/generative-ai';
import { MCPServer, MCPTool } from '../types/agent';
import { userRepository } from '../repositories/userRepository';
import { auditLogService } from '../services/auditLogService';
import { config } from '../config';

/**
 * Appointment Booking MCP Server - Provides appointment booking tools to the MCP Controller Agent
 * 
 * This server handles:
 * - Booking appointments at medical clinics, salons, restaurants, etc.
 * - Rescheduling and canceling appointments
 * - Checking appointment status
 * - Managing appointment reminders
 */
export class AppointmentBookingMCPServer implements MCPServer {
  name = 'appointment';
  description = 'Appointment and reservation booking tools';
  tools: MCPTool[] = [];
  private genAI: GoogleGenerativeAI;

  constructor() {
    // Initialize Google Gemini AI
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    
    this.initializeTools();
  }

  private initializeTools(): void {
    this.tools = [
      this.createAppointmentRequestTool(),
    ];
  }

  /**
   * Appointment request tool - High-level appointment assistant with structured outputs
   */
  private createAppointmentRequestTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        message: {
          type: 'string',
          description: 'User appointment request or message'
        },
        conversationHistory: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string' },
              content: { type: 'string' }
            }
          },
          description: 'Optional conversation history for context'
        }
      },
      required: ['userId', 'message']
    };

    return {
      name: 'appointment_request',
      description: 'Process appointment booking request with AI assistance and structured outputs',
      inputSchema,
      handler: this.handleAppointmentRequest.bind(this)
    };
  }

  /**
   * Handle appointment request with AI assistance and structured outputs
   */
  async handleAppointmentRequest(params: any): Promise<any> {
    const { userId, message, conversationHistory = [] } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Build system prompt with appointment guidelines
      const systemPrompt = this.buildAppointmentSystemPrompt(user);
      
      // Create Gemini model with JSON schema
      const model = this.genAI.getGenerativeModel({ 
        model: config.gemini.model,
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: this.getAppointmentResponseSchema()
        }
      });
      
      // Build conversation history for Gemini
      const chatHistory = conversationHistory.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      // Start chat session with history
      const chat = model.startChat({
        history: chatHistory
      });

      // Send message and get response
      const result = await chat.sendMessage(message);
      const response = result.response;
      const aiResponseText = response.text();

      // Parse JSON response
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(aiResponseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response from Gemini:', parseError);
        return {
          success: false,
          error: 'Failed to parse AI response'
        };
      }

      // Execute appointment actions based on intent
      const executionResult = await this.executeAppointmentIntent(userId, parsedResponse);

      // Extract insights for processing
      const insights = parsedResponse.insights;

      // Process insights (async, don't block response)
      if (insights) {
        const { userInsightsService } = await import('../services/userInsightsService.js');
        userInsightsService.processInsights(userId, insights, `appointment-${Date.now()}`).catch(error => {
          console.error('Failed to process appointment insights:', error);
        });
      }

      // Log the appointment interaction
      await auditLogService.logMCPToolCall({
        userId,
        faxJobId: `appointment-${Date.now()}`,
        toolName: 'appointment_request',
        toolServer: 'appointment',
        input: { message },
        output: parsedResponse,
        success: true
      });

      return {
        success: true,
        intent: parsedResponse.intent,
        response: parsedResponse.response,
        business: parsedResponse.business,
        dateTime: parsedResponse.dateTime,
        partySize: parsedResponse.partySize,
        specialRequests: parsedResponse.specialRequests,
        requiresConfirmation: parsedResponse.requiresConfirmation,
        nextAction: parsedResponse.nextAction,
        metadata: parsedResponse.metadata,
        executionResult,
        insights: insights || null
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process appointment request'
      };
    }
  }

  /**
   * Execute appointment intent (book, reschedule, cancel, etc.)
   */
  private async executeAppointmentIntent(userId: string, appointmentResponse: any): Promise<any> {
    const { intent, business, dateTime } = appointmentResponse;
    
    try {
      switch (intent) {
        case 'book':
          // Appointment booking request identified
          // In a real implementation, this would integrate with booking APIs or automation
          return { 
            action: 'booking_identified', 
            businessIdentified: business.identified,
            dateTimeIdentified: dateTime.identified,
            needsClarification: business.needsClarification || dateTime.needsClarification
          };

        case 'reschedule':
          // Reschedule request identified
          return { 
            action: 'reschedule_identified',
            needsClarification: business.needsClarification || dateTime.needsClarification
          };

        case 'cancel':
          // Cancellation request identified
          return { 
            action: 'cancel_identified',
            businessIdentified: business.identified
          };

        case 'check':
          // Status check request
          return { 
            action: 'status_check',
            businessIdentified: business.identified
          };

        case 'clarify':
          // Need more information from user
          return { action: 'clarification_needed' };

        default:
          return { action: 'unknown_intent' };
      }
    } catch (error) {
      console.error('Failed to execute appointment intent:', error);
      return { 
        action: 'execution_failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Build appointment system prompt with context
   */
  private buildAppointmentSystemPrompt(user: any): string {
    return `You are an AI appointment assistant for Faxi, helping elderly users in Japan book and manage appointments via fax.

CRITICAL: You must respond with valid JSON matching the AppointmentResponseSchema.

FAX FORMATTING RULES:
- Keep responses concise (500-800 words max)
- Use short paragraphs (2-3 sentences each)
- Use bullet points for lists
- Simple, respectful language appropriate for all ages
- Clear, actionable information
- Your response will be printed and faxed to the user

APPOINTMENT GUIDELINES:
- Identify business name and type (medical, dental, salon, restaurant, government)
- Parse date/time expressions ("next Tuesday", "tomorrow afternoon")
- Verify all details before booking
- Never book without explicit user confirmation
- Provide business contact info for user reference
- Mention cancellation policy if known

USER INFORMATION:
- Name: ${user.name || 'User'}
- Phone: ${user.phoneNumber || 'Not provided'}

DATE/TIME PARSING:
- "tomorrow" → next day
- "next Tuesday" → upcoming Tuesday
- "next week" → 7-14 days from now
- "morning" → 9:00-12:00
- "afternoon" → 13:00-17:00
- "evening" → 17:00-20:00

BUSINESS TYPES:
- medical: Clinics, hospitals, doctors
- dental: Dentists, dental clinics
- salon: Hair salons, barbers, beauty services
- restaurant: Dining reservations
- government: City hall, ward office, government services
- other: Any other service requiring appointments

INSIGHTS EXTRACTION:
Extract healthcare patterns and lifestyle insights from every interaction:

HEALTHCARE PATTERNS (Medical/Dental):
- Visit frequency: regular, one-time, urgent
- Appointment types: general, specialist, dental, therapy
- Support needs: transportation, translation, mobility

LIFESTYLE PATTERNS (Non-medical):
- Salon/Beauty: regular maintenance, special occasions
- Dining: occasion, party size, cuisine preferences
- Government: certificate requests, pension inquiries

LIFE EVENTS:
- Moving: new area, finding services
- Health changes: new conditions, mobility issues
- Retirement: daytime availability, new activities

BEHAVIORAL PATTERNS:
- Planning style: advance planner, short-term, urgent
- Communication style: detailed, brief, polite, direct
- Task complexity: simple, moderate, complex

DIGITAL PROFILE:
- Booking literacy: 5=needs full assistance, 1=digitally savvy
- Assistance needs: appointment-booking, phone-calls, form-filling, account-creation

PRIVACY RULES:
- NO medical diagnoses (use "appointment" not "diabetes checkup")
- NO specific business names in insights (use types: "medical", "dental")
- NO addresses or personal details
- Only include insights with confidence > 0.6

Your response must be valid JSON matching the AppointmentResponseSchema.`;
  }

  /**
   * Get Appointment response JSON schema for Gemini
   */
  private getAppointmentResponseSchema(): any {
    return {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: ['book', 'reschedule', 'cancel', 'check', 'clarify'],
          description: "User's appointment intent"
        },
        business: {
          type: 'object',
          properties: {
            identified: { type: 'boolean' },
            name: { type: 'string' },
            type: { 
              type: 'string', 
              enum: ['medical', 'dental', 'salon', 'restaurant', 'government', 'other'] 
            },
            location: { type: 'string' },
            needsClarification: { type: 'boolean' }
          },
          required: ['identified', 'needsClarification']
        },
        dateTime: {
          type: 'object',
          properties: {
            identified: { type: 'boolean' },
            date: { type: 'string' },
            time: { type: 'string' },
            flexibility: { type: 'string', enum: ['specific', 'flexible', 'any'] },
            originalRequest: { type: 'string' },
            needsClarification: { type: 'boolean' }
          },
          required: ['identified', 'needsClarification']
        },
        partySize: {
          type: 'number',
          description: 'Number of people (for restaurants or group appointments)'
        },
        specialRequests: {
          type: 'array',
          items: { type: 'string' },
          description: 'Special requests: accessibility, dietary restrictions, etc.'
        },
        response: {
          type: 'string',
          description: 'Human-readable response for fax'
        },
        requiresConfirmation: {
          type: 'boolean',
          description: 'Whether user needs to confirm before booking'
        },
        nextAction: {
          type: 'string',
          enum: ['show_options', 'confirm_booking', 'request_clarification', 'complete']
        },
        metadata: {
          type: 'object',
          properties: {
            appointmentId: { type: 'string' },
            confirmationNumber: { type: 'string' },
            estimatedDuration: { type: 'string' },
            cancellationPolicy: { type: 'string' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
          }
        },
        insights: {
          type: 'object',
          description: 'Strategic user insights',
          properties: {
            demographics: {
              type: 'object',
              properties: {
                ageRangeInferred: { type: 'string', enum: ['60-69', '70-79', '80+', 'unknown'] },
                genderInferred: { type: 'string', enum: ['male', 'female', 'unknown'] },
                regionInferred: { type: 'string' },
                householdTypeInferred: { type: 'string', enum: ['single', 'couple', 'multi-gen', 'unknown'] }
              }
            },
            lifeEvents: {
              type: 'object',
              properties: {
                movingDetected: { type: 'boolean' },
                newCaregiverDetected: { type: 'boolean' },
                deathInFamilyDetected: { type: 'boolean' },
                hospitalizationDetected: { type: 'boolean' },
                retirementDetected: { type: 'boolean' }
              }
            },
            intentSignals: {
              type: 'object',
              properties: {
                commercialIntent: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      category: { type: 'string' },
                      product: { type: 'string' },
                      priceRange: {
                        type: 'object',
                        properties: {
                          min: { type: 'number' },
                          max: { type: 'number' }
                        }
                      },
                      urgency: { type: 'string', enum: ['immediate', 'near-term', 'long-term'] }
                    },
                    required: ['category', 'urgency']
                  }
                },
                healthIntent: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['appointment', 'medication', 'consultation', 'emergency'] },
                      urgency: { type: 'string', enum: ['immediate', 'near-term', 'long-term'] }
                    },
                    required: ['type', 'urgency']
                  }
                },
                govIntent: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      serviceType: { type: 'string' },
                      urgency: { type: 'string', enum: ['immediate', 'near-term', 'long-term'] }
                    },
                    required: ['serviceType', 'urgency']
                  }
                }
              }
            },
            behavioral: {
              type: 'object',
              properties: {
                communicationStyle: { type: 'string', enum: ['short', 'long', 'polite', 'direct', 'detailed'] },
                taskComplexity: { type: 'string', enum: ['simple', 'moderate', 'complex'] }
              }
            },
            consumerProfile: {
              type: 'object',
              properties: {
                spendSensitivity: { type: 'string', enum: ['value', 'normal', 'premium'] },
                brandMentions: { type: 'array', items: { type: 'string' } },
                categoryPreference: { type: 'string' }
              }
            },
            digitalProfile: {
              type: 'object',
              properties: {
                digitalExclusionScore: { type: 'number', minimum: 1, maximum: 5 },
                aiAssistanceNeeded: { type: 'array', items: { type: 'string' } }
              }
            },
            confidenceScores: {
              type: 'object',
              properties: {
                demographics: { type: 'number', minimum: 0, maximum: 1 },
                lifeEvents: { type: 'number', minimum: 0, maximum: 1 },
                intent: { type: 'number', minimum: 0, maximum: 1 }
              }
            }
          }
        }
      },
      required: ['intent', 'business', 'dateTime', 'response', 'requiresConfirmation']
    };
  }
}

// Export singleton instance
export const appointmentBookingMCPServer = new AppointmentBookingMCPServer();
