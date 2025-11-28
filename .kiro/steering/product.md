# Faxi Product Overview

Faxi is a fax-to-internet bridge service that enables offline users (primarily elderly Japanese users) to access modern online services through traditional fax machines. The system uses AI vision interpretation and MCP (Model Context Protocol) to process handwritten fax requests and execute digital actions.

## Core Functionality

- **Fax Processing Pipeline**: Receives faxes via Telnyx, interprets content using Google Gemini Vision AI, executes actions through MCP servers, and sends formatted response faxes back to users
- **Multi-Domain Support**: Email management, e-commerce shopping, payment processing, appointment scheduling, and general Q&A
- **Context Recovery**: Maintains conversation state across multiple fax exchanges using reference IDs and temporal proximity
- **Visual Annotation Detection**: Interprets handwritten marks (checkboxes, circles, arrows) on faxes for user selections

## System Components

1. **Backend API** (Express.js): Core processing engine with webhook handlers for Telnyx, Stripe, and email services
2. **Admin Dashboard** (Next.js): Real-time monitoring, job management, user administration, and system health metrics
3. **Marketing Website** (Next.js): Bilingual (Japanese/English) public-facing site with interactive demo and metrics visualization

## Key Technologies

- AI: Google Gemini 2.0 Flash for vision interpretation and natural language processing
- Fax: Telnyx API for sending/receiving faxes
- Storage: S3-compatible object storage (MinIO for dev, AWS S3 for production)
- Queue: BullMQ with Redis for asynchronous job processing
- Database: PostgreSQL for user data, fax jobs, conversation contexts, and audit logs

## Target Users

Primary: Elderly Japanese citizens without internet access or digital literacy
Secondary: Family members, caregivers, and social service organizations supporting elderly populations
