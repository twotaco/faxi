# Local Development Environment Setup

## Prerequisites

Make sure you have these installed:
- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 6+
- Docker (optional, for MinIO)

## Step-by-Step Setup

### 1. PostgreSQL Database

**Option A: Using Homebrew (macOS)**
```bash
# Install PostgreSQL
brew install postgresql@14

# Start PostgreSQL
brew services start postgresql@14

# Create database and user
psql postgres
```

Then in psql:
```sql
CREATE DATABASE faxi;
CREATE USER faxi_user WITH PASSWORD 'faxi_password';
GRANT ALL PRIVILEGES ON DATABASE faxi TO faxi_user;
\q
```

**Option B: Using Docker**
```bash
docker run -d \
  --name faxi-postgres \
  -e POSTGRES_DB=faxi \
  -e POSTGRES_USER=faxi_user \
  -e POSTGRES_PASSWORD=faxi_password \
  -p 5432:5432 \
  postgres:14
```

**Verify Connection:**
```bash
psql -h localhost -U faxi_user -d faxi
# Password: faxi_password
```

### 2. Redis

**Option A: Using Homebrew (macOS)**
```bash
# Install Redis
brew install redis

# Start Redis
brew services start redis

# Verify it's running
redis-cli ping
# Should return: PONG
```

**Option B: Using Docker**
```bash
docker run -d \
  --name faxi-redis \
  -p 6379:6379 \
  redis:7
```

### 3. MinIO (S3-compatible storage)

**Using Docker:**
```bash
docker run -d \
  --name faxi-minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  quay.io/minio/minio server /data --console-address ":9001"
```

**Create Bucket:**
1. Open http://localhost:9001 in browser
2. Login with `minioadmin` / `minioadmin`
3. Click "Buckets" → "Create Bucket"
4. Name it `faxi-fax-images`
5. Click "Create Bucket"

**Or via CLI:**
```bash
# Install MinIO client
brew install minio/stable/mc

# Configure
mc alias set local http://localhost:9000 minioadmin minioadmin

# Create bucket
mc mb local/faxi-fax-images

# Set public read policy (for testing)
mc anonymous set download local/faxi-fax-images
```

### 4. Run Database Migrations

```bash
cd backend
npm run migrate
```

This will create all necessary tables including:
- users
- fax_jobs
- orders
- payment_methods
- admin_users
- admin_refresh_tokens
- audit_logs
- etc.

### 5. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install admin dashboard dependencies
cd ../admin-dashboard
npm install
```

### 6. Stripe CLI (for webhook testing)

**Install:**
```bash
brew install stripe/stripe-cli/stripe
```

**Login:**
```bash
stripe login
```

**Forward webhooks to local backend:**
```bash
stripe listen --forward-to localhost:4000/webhooks/stripe
```

This will output a webhook signing secret like `whsec_...` - you already have one in your `.env` but if you need to update it, copy the new one.

**Keep this terminal open** - it needs to run while you're testing payments.

### 7. MailHog (optional - for email testing)

**Using Docker:**
```bash
docker run -d \
  --name faxi-mailhog \
  -p 1025:1025 \
  -p 8025:8025 \
  mailhog/mailhog
```

**Access web UI:**
Open http://localhost:8025 to see captured emails

Your `.env` is already configured to send to `localhost:1025`.

### 8. Create Test Admin User

```bash
cd backend
node -e "
const bcrypt = require('bcrypt');
const { db } = require('./dist/database/connection');

async function createAdmin() {
  const passwordHash = await bcrypt.hash('admin123', 12);
  await db.query(\`
    INSERT INTO admin_users (email, password_hash, name, role, is_active)
    VALUES ('admin@faxi.jp', \$1, 'Admin User', 'super_admin', true)
    ON CONFLICT (email) DO NOTHING
  \`, [passwordHash]);
  console.log('Admin user created: admin@faxi.jp / admin123');
  process.exit(0);
}

createAdmin();
"
```

Or manually in psql:
```sql
-- Password is 'admin123' hashed with bcrypt
INSERT INTO admin_users (email, password_hash, name, role, is_active)
VALUES (
  'admin@faxi.jp',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU7qvQqNQ/Ky',
  'Admin User',
  'super_admin',
  true
);
```

## Running the Application

### Start Everything

**Terminal 1 - Backend:**
```bash
npm run dev
# Backend runs on http://localhost:4000
```

**Terminal 2 - Admin Dashboard:**
```bash
npm run dev:admin
# Admin dashboard runs on http://localhost:4001
```

**Terminal 3 - Stripe Webhooks:**
```bash
stripe listen --forward-to localhost:4000/webhooks/stripe
```

**Or run backend + admin together:**
```bash
npm run dev:all
```

### Verify Everything is Running

**Check Backend:**
```bash
curl http://localhost:4000/health
```

Should return health status with all services.

**Check Admin Dashboard:**
Open http://localhost:4001 in browser - should see login page.

**Check Database:**
```bash
psql -h localhost -U faxi_user -d faxi -c "SELECT COUNT(*) FROM admin_users;"
```

**Check Redis:**
```bash
redis-cli ping
```

**Check MinIO:**
Open http://localhost:9001 - should see MinIO console.

## Testing the Setup

### 1. Test Admin Login

1. Go to http://localhost:4001
2. Login with `admin@faxi.jp` / `admin123`
3. Should see the dashboard

### 2. Test Stripe Payment (Bank Transfer)

```bash
# In a new terminal
curl -X POST http://localhost:4000/api/test-bank-transfer \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-id",
    "amount": 1000,
    "description": "Test bank transfer"
  }'
```

Check the Stripe CLI terminal - you should see webhook events.

### 3. Test Database Connection

```bash
cd backend
npm run test:db
```

Or manually:
```bash
psql -h localhost -U faxi_user -d faxi -c "SELECT version();"
```

## Environment Variables Checklist

Your `backend/.env` needs these filled in:

- ✅ Database (already configured)
- ✅ Redis (already configured)
- ✅ MinIO/S3 (already configured)
- ✅ Stripe keys (already configured)
- ⚠️ **GEMINI_API_KEY** - Need to add your Google Gemini API key
- ⚠️ **SENDGRID_API_KEY** - Optional, only if testing emails
- ⚠️ **TELNYX_API_KEY** - Optional, TEST_MODE=true bypasses this

### Get Missing API Keys

**Google Gemini:**
1. Go to https://makersuite.google.com/app/apikey
2. Create API key
3. Copy to `GEMINI_API_KEY` in `.env`

**SendGrid (optional):**
1. Go to https://app.sendgrid.com/settings/api_keys
2. Create API key
3. Copy to `SENDGRID_API_KEY` in `.env`

## Troubleshooting

### Port Already in Use

```bash
# Find what's using port 4000
lsof -i :4000

# Kill the process
kill -9 <PID>
```

### Database Connection Failed

```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Restart PostgreSQL
brew services restart postgresql@14
```

### Redis Connection Failed

```bash
# Check if Redis is running
brew services list | grep redis

# Restart Redis
brew services restart redis
```

### MinIO Not Accessible

```bash
# Check if container is running
docker ps | grep minio

# Restart MinIO
docker restart faxi-minio
```

### Migrations Failed

```bash
# Drop and recreate database
psql postgres -c "DROP DATABASE IF EXISTS faxi;"
psql postgres -c "CREATE DATABASE faxi;"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE faxi TO faxi_user;"

# Run migrations again
cd backend
npm run migrate
```

### Stripe Webhooks Not Working

```bash
# Make sure Stripe CLI is running
stripe listen --forward-to localhost:4000/webhooks/stripe

# Test webhook manually
stripe trigger payment_intent.succeeded
```

## Quick Start Script

Save this as `start-dev.sh`:

```bash
#!/bin/bash

echo "🚀 Starting Faxi Development Environment..."

# Start services
echo "📦 Starting PostgreSQL..."
brew services start postgresql@14

echo "📦 Starting Redis..."
brew services start redis

echo "📦 Starting MinIO..."
docker start faxi-minio 2>/dev/null || docker run -d \
  --name faxi-minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  quay.io/minio/minio server /data --console-address ":9001"

echo "✅ All services started!"
echo ""
echo "📝 Next steps:"
echo "1. Terminal 1: npm run dev (backend)"
echo "2. Terminal 2: npm run dev:admin (admin dashboard)"
echo "3. Terminal 3: stripe listen --forward-to localhost:4000/webhooks/stripe"
echo ""
echo "🌐 URLs:"
echo "  Backend:        http://localhost:4000"
echo "  Admin Dashboard: http://localhost:4001"
echo "  MinIO Console:   http://localhost:9001"
echo "  MailHog:         http://localhost:8025"
```

Make it executable:
```bash
chmod +x start-dev.sh
./start-dev.sh
```

## Next Steps

Once everything is running:

1. ✅ Test admin login at http://localhost:4001
2. ✅ Check health endpoint: http://localhost:4000/health
3. ✅ Test Stripe webhooks with `stripe trigger payment_intent.succeeded`
4. ✅ Add your Gemini API key to `.env`
5. ✅ Create test users and test fax processing

## Useful Commands

```bash
# View backend logs
npm run dev --workspace=backend

# View admin dashboard logs
npm run dev --workspace=admin-dashboard

# Run tests
npm run test --workspace=backend

# Check database
psql -h localhost -U faxi_user -d faxi

# Check Redis
redis-cli

# View Stripe events
stripe events list

# Trigger test webhook
stripe trigger payment_intent.succeeded
```

## Need Help?

Check the logs:
- Backend: Console output from `npm run dev`
- PostgreSQL: `tail -f /usr/local/var/log/postgresql@14.log`
- Redis: `redis-cli monitor`
- MinIO: `docker logs faxi-minio`
