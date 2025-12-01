# Faxi - Fax-to-Internet Bridge System

A modern fax-to-internet bridge service powered by AI, enabling offline users to access online services through fax machines.

## 🏗️ Monorepo Structure

This repository uses npm workspaces to manage three applications:

- **backend/** - Express.js API server (port 4000)
- **admin-dashboard/** - Next.js admin interface (port 4001)
- **marketing-website/** - Next.js marketing website (port 4003)

See [MONOREPO.md](./MONOREPO.md) for detailed information about the monorepo structure.

## Prerequisites

- Node.js 20+ and npm
- Docker Desktop (for Postgres, Redis, MinIO)

## 🚀 Quick Start

### Option 1: Automated Startup (Recommended)

```bash
./start-dev.sh
```

This script will:
1. Check if Docker is running
2. Start Postgres, Redis, and MinIO
3. Wait for all services to be healthy
4. Optionally start the backend server

### Option 2: Manual Startup

**Step 1: Check what's running**
```bash
./scripts/check-services.sh
```

**Step 2: Start infrastructure services**
```bash
docker-compose up -d postgres redis minio
```

**Step 3: Install dependencies (first time only)**
```bash
npm install
```

**Step 4: Start the backend**
```bash
cd backend && npm run dev
```

**Step 5: Start the admin dashboard (in another terminal)**
```bash
cd admin-dashboard && npm run dev
```

**Step 6: Start the marketing website (in another terminal)**
```bash
cd marketing-website && npm run dev
```

### Service URLs

Once running, you can access:
- **Backend API**: http://localhost:4000
- **Admin Dashboard**: http://localhost:4001
- **Marketing Website**: http://localhost:4003
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)
- **Postgres**: localhost:5432
- **Redis**: localhost:6379

### Troubleshooting

**Backend won't start?**
```bash
# Check if all services are running
./scripts/check-services.sh

# Restart infrastructure
docker-compose restart postgres redis minio
```

**Port already in use?**
```bash
# Check what's using port 4000
lsof -i :4000

# Kill the process if needed
kill -9 <PID>
```

Edit `.env` with your database, Redis, and S3 credentials.

### 3. Set Up Database

Create the PostgreSQL database:

```bash
createdb faxi
```

Run migrations to create tables:

```bash
npm run migrate
```

Or manually:

```bash
npx tsx src/database/migrate.ts
```

### 4. Start the Application

Development mode with auto-reload:

```bash
npm run dev
```

Production mode:

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── config/          # Configuration management
├── database/        # Database connection and schema
├── queue/           # Job queue setup (BullMQ + Redis)
├── storage/         # S3 storage client
└── index.ts         # Application entry point
```

## Health Check

Once running, check the health endpoint:

```bash
curl http://localhost:4000/health
```

## Configuration

All configuration is managed through environment variables. See `.env.example` for available options.

Key configurations:
- **Database**: PostgreSQL connection with connection pooling
- **Redis**: Job queue backend
- **S3**: Object storage for fax images
- **Test Mode**: Set `TEST_MODE=true` to bypass Telnyx integration

## Database Schema

The system uses PostgreSQL with the following main tables:
- `users`: Fax machine users
- `fax_jobs`: Incoming and outgoing fax tracking
- `conversation_contexts`: Multi-step interaction context
- `payment_methods`: Stripe payment integration
- `orders`: E-commerce order tracking
- `address_book`: Contact management
- `audit_logs`: System operation logging

## Job Queues

Two main queues powered by BullMQ:
- `fax-processing`: Process incoming faxes
- `email-to-fax`: Convert emails to faxes

## Storage

Fax images are stored in S3 with the following structure:
```
faxes/
  YYYY/
    MM/
      DD/
        {fax_id}.pdf
```

## Development

Type checking:
```bash
npm run typecheck
```

Build:
```bash
npm run build
```

## Marketing Website

The marketing website showcases Faxi's capabilities with:
- Interactive demo with real fax processing
- AI accuracy metrics dashboard
- Bilingual support (Japanese/English)
- Use case demonstrations
- Technical architecture details

See [marketing-website/README.md](./marketing-website/README.md) for detailed documentation.

### Deployment

The marketing website is deployed to Vercel. See [marketing-website/DEPLOYMENT.md](./marketing-website/DEPLOYMENT.md) for deployment instructions.

## MCP Servers

Faxi includes several Model Context Protocol (MCP) servers for advanced automation:

### Deployment MCP
Intelligent deployment automation with multi-tier health checks, AI-powered log analysis, and automatic rollback capabilities.

**Features:**
- Full and partial deployment orchestration
- Multi-tier health checks (system, smoke tests, E2E)
- AI-powered log analysis and error diagnosis
- Intelligent rollback management
- Secrets verification and drift detection
- Integration testing and dependency analysis

**Configuration:** See `.kiro/settings/mcp.json`

**Documentation:** [Deployment MCP Guide](./backend/src/mcp/deployment/README.md)

### Spec Validator MCP
Validates Kiro spec structure, finds incomplete tasks, and checks test coverage.

**Documentation:** [Spec Validator Guide](./backend/src/mcp/kiro/README.md)

### Auto-Docs MCP
Autonomously generates documentation by discovering routes, navigating UI, and capturing screenshots.

**Documentation:** [Auto-Docs Guide](./backend/src/mcp/kiro/README.md)

## Documentation

- [Monorepo Structure](./MONOREPO.md)
- [AWS SES Setup Guide](./backend/AWS_SES_SETUP.md)
- [Marketing Website](./marketing-website/README.md)
- [Marketing Website Deployment](./marketing-website/DEPLOYMENT.md)
- [Backend CORS Configuration](./backend/CORS_CONFIGURATION.md)
- [E2E Testing Checklist](./marketing-website/E2E_TESTING_CHECKLIST.md)
- [Deployment MCP](./backend/src/mcp/deployment/README.md)

## License

MIT
