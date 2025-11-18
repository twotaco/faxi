# Requirements Document

## Introduction

Faxi is a fax-to-internet bridge service that enables users with fax machines, particularly elderly users who are offline, to access online services including email, e-commerce, and AI assistance. The system receives handwritten or printed fax requests, processes them using AI to understand intent, executes the requested actions through various integrations, and returns results via fax. The service maintains a dignity-first, minimal-touch approach for users who prefer or require offline communication methods.

## Glossary

- **Faxi System**: The complete fax-to-internet bridge service including webhook processing, AI interpretation, action execution, and response delivery
- **Telnyx**: The telephony provider that receives incoming faxes and delivers outgoing faxes
- **Fax User**: An individual who sends requests to Faxi via fax machine
- **User Email Address**: A dedicated email address in the format {phone_number}@me.faxi.jp that routes emails to the user's fax machine
- **AI Vision System**: Multimodal AI system that interprets fax images including text, handwriting, drawings, checkmarks, circles, and other visual annotations
- **AI Agent**: AI system that interprets user intent from fax images and executes actions
- **Webhook Endpoint**: HTTP endpoint that receives fax data from Telnyx
- **Payment Method**: Either a registered credit card or Stripe-generated barcode for convenience store payment
- **Service Integration**: External API or system (email, e-commerce, AI chat) that fulfills user requests

## Requirements

### Requirement 1

**User Story:** As a Fax User, I want to send a handwritten or printed request via fax, so that I can access online services without using a computer or smartphone

#### Acceptance Criteria

1. WHEN a fax is received at the Faxi fax number, THE Telnyx System SHALL forward the fax data to the Faxi System webhook endpoint within 30 seconds
2. THE Faxi System SHALL accept fax data from Telnyx in the provider's standard format
3. THE Faxi System SHALL store the received fax image for processing and audit purposes
4. THE Faxi System SHALL acknowledge receipt to Telnyx with an HTTP 200 status code within 5 seconds
5. IF the webhook endpoint is unreachable, THEN THE Telnyx System SHALL retry delivery according to its retry policy

### Requirement 2

**User Story:** As a Fax User, I want my handwritten or printed requests to be understood accurately, so that the system performs the correct actions

#### Acceptance Criteria

1. WHEN a fax image is received, THE Faxi System SHALL pass the complete fax image to the AI Vision System for interpretation
2. THE AI Vision System SHALL interpret text, handwriting, drawings, checkmarks, circles, and other visual annotations from the fax image
3. THE AI Agent SHALL identify the requested action type (email, shopping, AI chat, or other service) from the visual interpretation
4. THE AI Agent SHALL extract relevant parameters from the request (recipient addresses, product names, questions, payment preferences, selected options)
5. WHERE the fax contains visual selections such as circled items or checked boxes, THE AI Vision System SHALL identify and interpret these selections
6. IF the request is ambiguous or missing critical information, THEN THE Faxi System SHALL generate a clarification request to send back via fax

### Requirement 3

**User Story:** As a Fax User, I want to send emails through the fax system, so that I can communicate with people online without using email myself

#### Acceptance Criteria

1. WHEN the AI Agent identifies an email request, THE Faxi System SHALL extract the recipient email address, subject, and message body
2. WHERE the recipient is identified by name or relationship, THE Faxi System SHALL look up the email address in the user's address book
3. THE Faxi System SHALL compose an email from the User Email Address with the extracted content
4. THE Faxi System SHALL send the email through the email service integration within 2 minutes of fax receipt
5. THE Faxi System SHALL generate a confirmation fax containing the sent email details
6. WHEN a reply is received at the User Email Address, THE Faxi System SHALL filter spam and promotional emails before faxing
7. WHEN a personal or important email is received, THE Faxi System SHALL convert the reply to fax format and deliver it to the Fax User's fax number
8. WHERE an email contains a clear question, THE Faxi System SHALL generate quick reply options for the user to circle

### Requirement 4

**User Story:** As a Fax User, I want to purchase items from online stores like Amazon, so that I can shop online without using a computer

#### Acceptance Criteria

1. WHEN the AI Agent identifies a shopping request, THE Faxi System SHALL extract the product description, quantity, and delivery preferences
2. THE Faxi System SHALL search for matching products using the e-commerce Service Integration
3. THE Faxi System SHALL present product options to the Fax User via fax including price, description, and estimated delivery time
4. WHEN the Fax User confirms a purchase, THE Faxi System SHALL process payment using the registered Payment Method or generate a convenience store barcode
5. THE Faxi System SHALL place the order through the e-commerce Service Integration and send order confirmation via fax

### Requirement 5

**User Story:** As a Fax User, I want to register and manage my payment methods, so that I can complete purchases through the fax system

#### Acceptance Criteria

1. THE Faxi System SHALL store registered credit card information securely using the Stripe payment platform
2. WHEN a purchase requires payment, THE Faxi System SHALL charge the registered Payment Method if one exists
3. WHERE no Payment Method is registered, THE Faxi System SHALL generate a Stripe barcode for convenience store payment
4. THE Faxi System SHALL send the payment barcode via fax with instructions for in-store payment
5. THE Faxi System SHALL confirm payment completion before finalizing any purchase order

### Requirement 6

**User Story:** As a Fax User, I want to interact with AI assistants, so that I can get information and answers to questions without going online

#### Acceptance Criteria

1. WHEN the AI Agent identifies a general question or chat request, THE Faxi System SHALL process the query using the AI Agent
2. THE AI Agent SHALL generate a response appropriate for the Fax User's question
3. THE Faxi System SHALL format the AI response for fax delivery with clear, readable text
4. THE Faxi System SHALL send the response fax within 3 minutes of receiving the original request
5. THE Faxi System SHALL maintain conversation context for follow-up questions from the same Fax User within a 24-hour period

### Requirement 7

**User Story:** As a Fax User, I want to receive responses and confirmations via fax, so that I can see the results of my requests without using digital devices

#### Acceptance Criteria

1. WHEN the Faxi System completes processing a request, THE Faxi System SHALL generate a response document in fax-compatible format
2. THE Faxi System SHALL send the response to the User Email Address
3. WHEN an email is sent to a User Email Address, THE Faxi System SHALL convert the email content to fax format within 1 minute
4. THE Faxi System SHALL transmit the fax data to Telnyx for delivery to the Fax User's fax number
5. THE Faxi System SHALL retry fax delivery up to 3 times if the initial transmission fails

### Requirement 8

**User Story:** As a Fax User, I want each fax machine to have a dedicated email address, so that I can receive email-to-fax communications reliably

#### Acceptance Criteria

1. THE Faxi System SHALL assign a unique User Email Address in the format {phone_number}@me.faxi.jp for each registered fax number
2. THE Faxi System SHALL route all emails sent to a User Email Address to the corresponding fax number
3. THE Faxi System SHALL process incoming emails to User Email Addresses within 2 minutes of receipt
4. THE Faxi System SHALL convert email content (text and basic formatting) to fax-compatible format
5. THE Faxi System SHALL handle email attachments by including a notification in the fax with instructions for alternative access

### Requirement 11

**User Story:** As a Fax User, I want to manage an address book of contacts, so that I can send emails by name without remembering email addresses

#### Acceptance Criteria

1. THE Faxi System SHALL maintain an address book for each user with contact names and email addresses
2. WHEN the Faxi System receives an email, THE Faxi System SHALL automatically add the sender to the user's address book if not already present
3. WHERE a user sends an email using a contact name, THE Faxi System SHALL look up the email address from the address book
4. WHERE a contact name is not found in the address book, THE Faxi System SHALL extract the email address from the fax message text
5. THE Faxi System SHALL allow users to view and manage their address book via fax requests

### Requirement 9

**User Story:** As the Faxi System operator, I want to track all fax transactions and system operations, so that I can ensure service quality and troubleshoot issues

#### Acceptance Criteria

1. THE Faxi System SHALL log all incoming fax receipts with timestamp, source number, and processing status
2. THE Faxi System SHALL log all outgoing fax transmissions with timestamp, destination number, and delivery status
3. THE Faxi System SHALL log all AI Agent interpretations including extracted intent and confidence scores
4. THE Faxi System SHALL log all Service Integration calls with request and response details
5. THE Faxi System SHALL retain logs for a minimum of 90 days for audit and troubleshooting purposes

### Requirement 10

**User Story:** As the Faxi System operator, I want to handle errors gracefully, so that Fax Users receive helpful feedback when issues occur

#### Acceptance Criteria

1. IF OCR extraction fails or produces low-confidence results, THEN THE Faxi System SHALL send a fax requesting the user to resend with clearer writing
2. IF a Service Integration is unavailable, THEN THE Faxi System SHALL send a fax notifying the user of temporary service unavailability
3. IF payment processing fails, THEN THE Faxi System SHALL send a fax with error details and alternative payment options
4. IF fax delivery fails after all retry attempts, THEN THE Faxi System SHALL log the failure and alert system operators
5. THE Faxi System SHALL include a support contact method in all error notification faxes
