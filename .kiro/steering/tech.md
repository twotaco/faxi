# Technology Stack

## Monorepo Structure

This is an npm workspaces monorepo with three applications:

- `backend/` - Express.js API server (port 4000)
- `admin-dashboard/` - Next.js admin interface (port 4001)
- `marketing-website/` - Next.js marketing site (port 4003)

## Backend Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL 15 with pg driver
- **Cache/Queue**: Redis 7 with ioredis and BullMQ
- **Storage**: AWS S3 SDK (MinIO for local dev)
- **AI/ML**: Google Generative AI (Gemini 2.0 Flash), LangChain
- **Fax Service**: Telnyx API
- **Payment**: Stripe
- **PDF Generation**: PDFKit, Canvas, Sharp
- **Testing**: Vitest with fast-check for property-based testing
- **Build**: TypeScript compiler (tsc), tsx for development

## Frontend Stack (Both Next.js Apps)

- **Framework**: Next.js 14+ (App Router)
- **UI**: React 18+, Tailwind CSS 4, Radix UI primitives
- **State Management**: TanStack Query (React Query)
- **Internationalization**: next-intl (marketing site)
- **Charts**: Recharts
- **Animation**: Framer Motion
- **Testing**: Vitest, Testing Library, fast-check

## Infrastructure

- **Containerization**: Docker, Docker Compose
- **Orchestration**: Kubernetes (k8s configs provided)
- **Cloud**: AWS (ECS, S3, RDS, ElastiCache)
- **Reverse Proxy**: Nginx
- **Monitoring**: Custom monitoring service with Prometheus metrics

## Common Commands

### Root Level (Monorepo)

```bash
# Install all dependencies
npm install

# Start backend only
npm run dev

# Start admin dashboard
npm run dev:admin

# Start marketing website
npm run dev:marketing

# Start all three apps
npm run dev:all

# Build all workspaces
npm run build

# Run tests across all workspaces
npm test

# Run database migrations
npm run migrate
```

### Backend

```bash
cd backend

# Development with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production build
npm start

# Type checking
npm run typecheck

# Run migrations
npm run migrate

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run integration tests only
npm run test:integration

# Generate test fixtures
npm run generate-fixtures
```

### Admin Dashboard

```bash
cd admin-dashboard

# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint

# Type checking
npm run typecheck
```

### Marketing Website

```bash
cd marketing-website

# Development server (port 4003)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch
```

### Docker & Infrastructure

```bash
# Quick start (automated)
./start-dev.sh

# Check service status
./scripts/check-services.sh

# Start infrastructure only
docker-compose up -d postgres redis minio

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Production deployment
./scripts/docker-prod.sh
```

## Development Environment Setup

1. **Prerequisites**: Node.js 20+, Docker Desktop
2. **Quick Start**: Run `./start-dev.sh` to start all services
3. **Manual Setup**: 
   - Start Docker services: `docker-compose up -d postgres redis minio`
   - Install dependencies: `npm install`
   - Run migrations: `npm run migrate`
   - Start backend: `cd backend && npm run dev`

## Environment Variables

- Backend: `.env` (see `backend/.env.example`)
- Admin Dashboard: `.env.local` (see `admin-dashboard/.env.example`)
- Marketing Website: `.env.local` (see `marketing-website/.env.example`)

## TypeScript Configuration

- **Target**: ES2022
- **Module**: CommonJS (backend), ESNext (frontends)
- **Strict Mode**: Enabled across all projects
- **Source Maps**: Enabled for debugging
- **Declaration Files**: Generated for backend

## Testing Strategy

- **Unit Tests**: Vitest with mocking
- **Integration Tests**: Full pipeline tests with test database
- **Property-Based Tests**: fast-check for edge cases
- **E2E Tests**: Testing Library for React components
- **Test Mode**: Set `TEST_MODE=true` to bypass external APIs
