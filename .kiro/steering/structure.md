# Project Structure

## Repository Organization

```
faxi/
├── backend/              # Express.js API server
├── admin-dashboard/      # Next.js admin interface
├── marketing-website/    # Next.js marketing site
├── .kiro/               # Kiro specs and steering rules
├── aws/                 # AWS CloudFormation and ECS configs
├── k8s/                 # Kubernetes deployment manifests
├── docs/                # Shared documentation
├── scripts/             # Deployment and utility scripts
└── docker-compose.yml   # Local development infrastructure
```

## Backend Structure (`backend/`)

### Core Directories

- **`src/config/`** - Configuration management (environment variables, app settings)
- **`src/database/`** - Database connection, schema, and migrations
  - `migrations/` - SQL migration files (numbered sequentially)
  - `schema.sql` - Complete database schema
  - `connection.ts` - PostgreSQL connection pool
  - `migrate.ts` - Migration runner
- **`src/queue/`** - BullMQ job queue setup
  - `connection.ts` - Redis connection
  - `faxQueue.ts` - Fax processing queue definitions
- **`src/storage/`** - S3 storage client wrapper
- **`src/types/`** - TypeScript type definitions
  - `agent.ts` - MCP agent types
  - `fax.ts` - Fax job types
  - `vision.ts` - AI vision interpretation types
  - `index.ts` - Shared types

### Service Layer (`src/services/`)

Core business logic organized by domain:

- **Fax Processing Pipeline**:
  - `faxProcessingPipeline.ts` - Main orchestration pipeline
  - `faxProcessorWorker.ts` - BullMQ worker for fax jobs
  - `faxProcessingErrorHandler.ts` - Centralized error handling
  - `aiVisionInterpreter.ts` - Gemini Vision AI integration
  - `visualAnnotationDetector.ts` - Handwritten mark detection
  - `intentExtractor.ts` - Intent classification

- **MCP Integration**:
  - `mcpControllerAgent.ts` - Main agent orchestrator
  - `agentDecisionFramework.ts` - Decision logic
  - `agentStateManager.ts` - Conversation state management

- **Response Generation**:
  - `responseGenerator.ts` - Main response coordinator
  - `faxGenerator.ts` - Base fax generation
  - `faxTemplateEngine.ts` - Template rendering
  - `confirmationFaxGenerator.ts` - Confirmation faxes
  - `clarificationFaxGenerator.ts` - Clarification requests
  - `welcomeFaxGenerator.ts` - Welcome/onboarding faxes
  - `productSelectionFaxGenerator.ts` - Shopping faxes
  - `paymentBarcodeFaxGenerator.ts` - Payment barcodes
  - `emailFaxGenerator.ts` - Email-related faxes
  - `pdfFaxGenerator.ts` - PDF utilities

- **External Services**:
  - `faxSenderService.ts` - Telnyx fax sending
  - `mockFaxSender.ts` - Test mode mock
  - `emailService.ts` - Email integration
  - `emailToFaxConverter.ts` - Email-to-fax conversion
  - `emailToFaxWorker.ts` - Email processing worker
  - `ecommerceService.ts` - Shopping integration

- **System Services**:
  - `monitoringService.ts` - Health checks and metrics
  - `loggingService.ts` - Winston logging wrapper
  - `auditLogService.ts` - Audit trail
  - `alertingService.ts` - Alert notifications
  - `backupService.ts` - Backup and disaster recovery
  - `contextRecoveryService.ts` - Conversation context recovery
  - `userInsightsService.ts` - User behavior analytics
  - `metricsCalculationService.ts` - Metrics aggregation

- **Admin Services**:
  - `adminAuthService.ts` - JWT authentication for admin users

### Repository Layer (`src/repositories/`)

Data access layer following repository pattern:

- `userRepository.ts` - User CRUD operations
- `faxJobRepository.ts` - Fax job management
- `conversationContextRepository.ts` - Context persistence
- `emailThreadRepository.ts` - Email thread tracking
- `shoppingCartRepository.ts` - Shopping cart state
- `orderRepository.ts` - Order management
- `paymentMethodRepository.ts` - Payment methods
- `addressBookRepository.ts` - Contact management
- `adminUserRepository.ts` - Admin user management
- `auditLogRepository.ts` - Audit log queries
- `userInsightsRepository.ts` - User insights data
- `productCacheRepository.ts` - Product catalog cache

### MCP Servers (`src/mcp/`)

Model Context Protocol server implementations:

- `index.ts` - MCP server registry
- `aiChatMcpServer.ts` - Q&A and general chat
- `emailMcpServer.ts` - Email operations
- `shoppingMcpServer.ts` - E-commerce operations
- `paymentMcpServer.ts` - Payment processing
- `appointmentMcpServer.ts` - Appointment scheduling
- `userProfileMcpServer.ts` - User profile management

### Prompt Management (`src/prompts/`)

Centralized LLM prompt system:

- `index.ts` - PromptManager class
- `register.ts` - Template registration
- `validation.ts` - Schema validation with retry logic
- `schemas/` - Zod schemas for each use case
  - `base.ts` - Base insights schema
  - `qa.ts`, `shopping.ts`, `email.ts`, `appointment.ts`
- `templates/` - Prompt templates by use case

### Webhooks (`src/webhooks/`)

External webhook handlers:

- `telnyxWebhookController.ts` - Telnyx fax events
- `stripeWebhookController.ts` - Stripe payment events
- `emailWebhookController.ts` - Inbound email webhooks
- `demoController.ts` - Demo/testing endpoints
- `metricsController.ts` - Metrics API
- `monitoringController.ts` - Monitoring endpoints
- `testWebhookController.ts` - Test harness

### Middleware (`src/middleware/`)

- `adminAuth.ts` - JWT authentication and authorization
- `rateLimiter.ts` - Rate limiting for sensitive endpoints

### Testing (`src/test/`)

- `setup.ts` - Test environment configuration
- `testApp.ts` - Test Express app instance
- `integration/` - Integration test suites
  - Pipeline tests, workflow tests, property-based tests
- `fixtures/` - Test data and sample fax images
  - `fax-images/` - PNG samples for various scenarios

## Admin Dashboard Structure (`admin-dashboard/`)

Next.js App Router structure:

```
app/
├── (auth)/              # Authentication routes (no dashboard layout)
│   └── login/
├── (dashboard)/         # Dashboard routes (with sidebar layout)
│   ├── dashboard/       # Main dashboard
│   ├── jobs/            # Fax job management
│   │   └── [id]/       # Job detail page
│   └── users/           # User management
│       └── [id]/       # User detail page
├── api/
│   └── auth/           # Auth API routes
├── layout.tsx          # Root layout
└── page.tsx            # Root redirect

components/
├── dashboard/          # Dashboard-specific components
│   ├── ActiveJobs.tsx
│   ├── SystemHealth.tsx
│   ├── QueueMetrics.tsx
│   └── ...
└── layout/             # Layout components (Sidebar, Header)

lib/
├── api/                # API client
│   └── client.ts
├── auth/               # Auth context
│   └── AuthContext.tsx
├── hooks/              # Custom React hooks
│   ├── useDashboardMetrics.ts
│   ├── useDashboardStream.ts (SSE)
│   ├── useJobs.ts
│   └── useUsers.ts
└── providers/          # React Query provider
```

## Marketing Website Structure (`marketing-website/`)

Next.js with internationalization:

```
app/
└── [locale]/           # Locale-based routing (en, ja)
    ├── page.tsx        # Home page
    ├── demo/           # Interactive demo
    ├── service/        # Service details
    ├── tech/           # Technical architecture
    ├── partnering/     # Partner information
    ├── about/          # About page
    ├── privacy/        # Privacy policy
    └── terms/          # Terms of service

components/
├── home/               # Home page sections
│   ├── HeroSection.tsx
│   ├── UseCaseSection.tsx
│   ├── TestimonialsSection.tsx
│   └── ...
├── demo/               # Demo components
│   ├── FileUpload.tsx
│   ├── FixtureSelection.tsx
│   ├── ProcessingStatus.tsx
│   └── ResultsDisplay.tsx
├── metrics/            # Metrics dashboard
│   ├── MetricsDashboard.tsx
│   ├── AccuracyMetrics.tsx
│   └── charts/
├── service/            # Service page components
├── tech/               # Tech page components
├── partnering/         # Partner page components
├── layout/             # Layout components (Header, Footer)
└── ui/                 # Reusable UI components (shadcn/ui)

lib/
├── api/                # Backend API client
│   ├── client.ts
│   └── types.ts
└── hooks/              # Custom hooks
    ├── useDemo.ts
    └── useMetrics.ts

messages/               # i18n translations
├── en.json
└── ja.json
```

## Key Architectural Patterns

### Backend Patterns

1. **Repository Pattern**: Data access abstracted through repositories
2. **Service Layer**: Business logic in services, not controllers
3. **Pipeline Pattern**: Fax processing as sequential stages with error handling
4. **Worker Pattern**: BullMQ workers for async processing
5. **MCP Servers**: Modular tool servers for different domains
6. **Prompt Management**: Centralized prompt templates with schema validation

### Frontend Patterns

1. **App Router**: Next.js 14+ file-based routing
2. **Server Components**: Default to server components, use client components sparingly
3. **Custom Hooks**: Encapsulate data fetching and state logic
4. **Component Composition**: Small, focused components
5. **Route Groups**: Organize routes with shared layouts using `(groupName)`

### Naming Conventions

- **Files**: camelCase for TypeScript/JavaScript files
- **Components**: PascalCase for React components
- **Database**: snake_case for tables and columns
- **API Routes**: kebab-case for URL paths
- **Types**: PascalCase for interfaces and types
- **Constants**: UPPER_SNAKE_CASE for constants

### Import Patterns

- Use relative imports within the same module
- Use absolute imports from `src/` for cross-module imports
- Group imports: external libraries, internal modules, types
- Prefer named exports over default exports (except Next.js pages)

### Error Handling

- Services throw errors, controllers catch and format responses
- Use custom error classes for specific error types
- Centralized error handler for fax processing pipeline
- Audit log all errors with context

### Testing Organization

- Co-locate unit tests with source files: `*.test.ts`
- Integration tests in `src/test/integration/`
- Property-based tests use `*.property.test.ts` suffix
- Test fixtures in `src/test/fixtures/`
- Use `TEST_MODE=true` to bypass external API calls
