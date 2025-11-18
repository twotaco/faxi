# Faxi - Fax-to-Internet Bridge System

A modern fax-to-internet bridge service powered by AI, enabling offline users to access online services through fax machines.

## 🏗️ Monorepo Structure

This repository uses npm workspaces to manage two applications:

- **backend/** - Express.js API server (port 3000)
- **admin-dashboard/** - Next.js admin interface (port 3001)

See [MONOREPO.md](./MONOREPO.md) for detailed information about the monorepo structure.

## Prerequisites

- Node.js 20+ and npm
- PostgreSQL 14+
- Redis 6+
- S3-compatible object storage (AWS S3, MinIO, etc.)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs dependencies for both workspaces.

### 2. Development

Run both applications concurrently:
```bash
npm run dev:all
```

Or run individually:
```bash
npm run dev          # Backend only (port 3000)
npm run dev:admin    # Admin dashboard only (port 3001)
```

### 3. Configure Environment

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
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
curl http://localhost:3000/health
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
        {fax_id}.tiff
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

## License

MIT
