# Appointment & Reservation Booking MCP - Requirements

## Overview
Enable Faxi users to book appointments and reservations at local businesses (clinics, restaurants, salons, etc.) via fax, with the system acting as an intelligent booking agent using web automation.

## User Stories

### US1: Medical Appointment Booking
**As a** Faxi user  
**I want to** book a doctor's appointment at my local clinic  
**So that** I can see my doctor without calling or using a computer

**Acceptance Criteria:**
- User specifies clinic name and preferred date/time
- System navigates to clinic's booking website
- Logs in with user's credentials (or creates account)
- Books available slot closest to preference
- Returns confirmation details via fax

### US2: Restaurant Reservation
**As a** Faxi user  
**I want to** reserve a table at a restaurant  
**So that** I can dine out without phone calls

**Acceptance Criteria:**
- User specifies restaurant, date, time, party size
- System checks availability
- Makes reservation
- Returns confirmation number

### US3: Salon/Spa Booking
**As a** Faxi user  
**I want to** book a haircut or spa treatment  
**So that** I can maintain my regular appointments

**Acceptance Criteria:**
- User specifies service type and preferences
- System finds available slots
- Books with preferred stylist if specified
- Confirms appointment details

### US4: Credential Management
**As a** Faxi user  
**I want** my login credentials securely stored  
**So that** I don't have to provide them each time

**Acceptance Criteria:**
- First-time setup creates account with {fax_number}@me.faxi.jp
- Password securely encrypted
- Auto-login for subsequent bookings
- User can update credentials via fax

### US5: Appointment Cancellation
**As a** Faxi user  
**I want to** cancel or reschedule appointments  
**So that** I can manage my schedule

**Acceptance Criteria:**
- User references appointment by confirmation number or date
- System cancels/reschedules
- Confirms cancellation
- Finds alternative slots for rescheduling

## Functional Requirements

### FR1: Website Detection & Navigation
- Identify booking website from business name
- Handle various booking platforms (TableCheck, EPARK, custom sites)
- Navigate multi-step booking flows
- Handle CAPTCHAs (manual fallback if needed)

### FR2: Account Management
- Auto-generate email: {fax_number}@me.faxi.jp
- Create accounts on first booking
- Store encrypted credentials per website
- Handle password reset flows
- Manage sessions across bookings

### FR3: Availability Checking
- Parse available time slots
- Match user preferences
- Suggest alternatives if preferred time unavailable
- Handle date/time format variations

### FR4: Booking Execution
- Fill booking forms accurately
- Handle required fields (name, phone, email, special requests)
- Submit booking
- Capture confirmation number/details
- Handle booking failures gracefully

### FR5: Confirmation & Notification
- Extract confirmation details
- Format for fax readability
- Include cancellation instructions
- Store booking reference for future actions

### FR6: Multi-Platform Support
- **Medical**: EPARK, Clinics' custom sites
- **Restaurants**: TableCheck, Gurunavi, Tabelog, Hot Pepper
- **Salons**: Hot Pepper Beauty, Rakuten Beauty
- **General**: Google Calendar integration for reminders

## Non-Functional Requirements

### NFR1: Security
- AES-256 encryption for credentials
- Secure credential transmission
- No credential logging
- Separate encryption keys per user
- Regular security audits

### NFR2: Performance
- Booking completion: < 30 seconds
- Availability check: < 10 seconds
- Handle slow-loading websites

### NFR3: Reliability
- 90%+ booking success rate
- Graceful degradation for unsupported sites
- Retry logic for transient failures
- Manual fallback notification

### NFR4: Privacy
- User consent for automated bookings
- Clear data retention policy
- Ability to delete stored credentials
- No sharing of booking data

## Technical Architecture

### Web Automation Stack
```typescript
// Playwright for robust automation
import { chromium, Browser, Page } from 'playwright';

class BookingAutomation {
  private browser: Browser;
  private page: Page;
  
  async initialize(): Promise<void>;
  async navigateToBookingSite(url: string): Promise<void>;
  async login(email: string, password: string): Promise<boolean>;
  async findAvailableSlots(date: Date): Promise<TimeSlot[]>;
  async bookAppointment(slot: TimeSlot, details: BookingDetails): Promise<Confirmation>;
  async cleanup(): Promise<void>;
}
```

### Credential Storage
```typescript
interface UserCredential {
  userId: string;
  website: string; // Domain name
  email: string; // {fax_number}@me.faxi.jp
  encryptedPassword: string;
  encryptionIV: string;
  createdAt: Date;
  lastUsed: Date;
}

class CredentialManager {
  async store(userId: string, website: string, password: string): Promise<void>;
  async retrieve(userId: string, website: string): Promise<{ email: string; password: string }>;
  async update(userId: string, website: string, newPassword: string): Promise<void>;
  async delete(userId: string, website: string): Promise<void>;
}
```

### Booking Platform Adapters
```typescript
interface BookingPlatformAdapter {
  name: string;
  supportedDomains: string[];
  
  detectPlatform(url: string): boolean;
  login(page: Page, credentials: Credentials): Promise<boolean>;
  findSlots(page: Page, criteria: SearchCriteria): Promise<TimeSlot[]>;
  book(page: Page, slot: TimeSlot, details: BookingDetails): Promise<Confirmation>;
  cancel(page: Page, confirmationNumber: string): Promise<boolean>;
}

// Implementations
class EPARKAdapter implements BookingPlatformAdapter { }
class TableCheckAdapter implements BookingPlatformAdapter { }
class HotPepperAdapter implements BookingPlatformAdapter { }
class GenericAdapter implements BookingPlatformAdapter { } // Fallback
```

## Data Models

### Booking Request
```typescript
interface BookingRequest {
  userId: string;
  businessName: string;
  businessType: 'medical' | 'restaurant' | 'salon' | 'other';
  preferredDate: Date;
  preferredTime?: string; // "14:00" or "afternoon"
  alternativeDates?: Date[];
  partySize?: number; // For restaurants
  serviceType?: string; // For salons
  specialRequests?: string;
  doctorName?: string; // For medical
}
```

### Time Slot
```typescript
interface TimeSlot {
  date: Date;
  time: string;
  available: boolean;
  provider?: string; // Doctor, stylist name
  duration?: number; // Minutes
}
```

### Booking Confirmation
```typescript
interface BookingConfirmation {
  confirmationNumber: string;
  businessName: string;
  businessPhone?: string;
  date: Date;
  time: string;
  address?: string;
  specialInstructions?: string;
  cancellationPolicy?: string;
  bookingUrl?: string;
}
```

## LLM Output Schema

```typescript
const AppointmentBookingSchema = z.object({
  intent: z.enum([
    'book_appointment',
    'check_availability',
    'cancel_appointment',
    'reschedule_appointment',
    'view_appointments'
  ]),
  
  // Business identification
  business: z.object({
    name: z.string(),
    type: z.enum(['medical', 'restaurant', 'salon', 'spa', 'other']),
    location: z.string().optional()
  }),
  
  // Booking details
  booking: z.object({
    preferredDate: z.string().describe("ISO date string"),
    preferredTime: z.string().optional().describe("HH:MM or 'morning'/'afternoon'/'evening'"),
    alternativeDates: z.array(z.string()).optional(),
    partySize: z.number().optional(),
    serviceType: z.string().optional(),
    providerPreference: z.string().optional().describe("Doctor/stylist name"),
    specialRequests: z.string().optional()
  }).optional(),
  
  // For cancellation/rescheduling
  existingBooking: z.object({
    confirmationNumber: z.string().optional(),
    date: z.string().optional()
  }).optional(),
  
  // Response
  response: z.string().describe("Human-readable response for fax"),
  
  // Next action
  nextAction: z.enum([
    'search_business',
    'check_availability',
    'confirm_booking',
    'request_credentials',
    'complete',
    'clarify'
  ]),
  
  // Clarification
  clarificationQuestion: z.string().optional(),
  
  // Credentials needed
  needsCredentials: z.boolean().describe("Whether user needs to provide login info"),
  
  // Available slots to show
  availableSlots: z.array(z.object({
    date: z.string(),
    time: z.string(),
    provider: z.string().optional()
  })).optional()
});
```

## System Prompt

```
You are an appointment booking assistant for Faxi, helping users book appointments via fax.

BOOKING GUIDELINES:
- Understand appointment needs clearly
- Identify business name and type accurately
- Parse date/time preferences (handle "next Tuesday", "tomorrow afternoon")
- Suggest alternatives if preferred time unavailable
- Confirm all details before booking
- Provide clear confirmation information

IMPORTANT RULES:
- Always confirm business name and location
- Verify date and time before booking
- Ask for party size for restaurants
- Mention cancellation policy if available
- Never book without explicit user confirmation
- Handle credentials securely (never show in response)

CREDENTIAL MANAGEMENT:
- First booking: explain we'll create account with {fax_number}@me.faxi.jp
- Ask user to provide password (will be encrypted)
- Subsequent bookings: use stored credentials
- User can update credentials anytime

RESPONSE FORMAT:
- Clear confirmation details
- Date, time, location
- Confirmation number prominently displayed
- Cancellation instructions
- Contact information

OUTPUT SCHEMA:
{schema}

EXAMPLES:
{examples}
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Playwright setup
- [ ] Credential encryption/storage
- [ ] Generic booking adapter
- [ ] LLM schema integration

### Phase 2: Platform Adapters (Week 2-3)
- [ ] EPARK adapter (medical)
- [ ] TableCheck adapter (restaurants)
- [ ] Hot Pepper Beauty adapter (salons)
- [ ] Fallback generic adapter

### Phase 3: Booking Flow (Week 4)
- [ ] Availability checking
- [ ] Booking execution
- [ ] Confirmation extraction
- [ ] Error handling

### Phase 4: Advanced Features (Week 5)
- [ ] Cancellation/rescheduling
- [ ] Appointment reminders
- [ ] Multi-site support
- [ ] CAPTCHA handling

### Phase 5: Testing & Refinement (Week 6)
- [ ] End-to-end testing
- [ ] Security audit
- [ ] Performance optimization
- [ ] User acceptance testing

## Success Metrics
- 90%+ booking success rate
- < 30 seconds average booking time
- Zero credential leaks
- 85%+ user satisfaction
- Support for top 10 booking platforms

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Website changes break automation | High | Regular monitoring, quick adapter updates |
| CAPTCHA blocking | Medium | Manual fallback, CAPTCHA solving service |
| Credential security breach | Critical | Strong encryption, security audit, monitoring |
| Booking errors | High | Extensive validation, confirmation steps |
| Legal/ToS issues | Medium | Legal review, user consent, transparency |

## Dependencies
- Playwright for web automation
- Crypto library for encryption
- Database for credential storage
- Gemini for LLM with JSON schema
- Email service for {fax_number}@me.faxi.jp

## Out of Scope (Future)
- Calendar integration
- Recurring appointments
- Group bookings
- International bookings
- Payment processing
