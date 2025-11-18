# Testing Admin Authentication Locally

This guide will help you test the admin authentication system locally.

## Prerequisites

1. Docker Desktop installed and running
2. Node.js 20+ installed
3. Dependencies installed (`npm install`)

## Quick Start

### 1. Start Docker Services

```bash
docker-compose up -d
```

This will start:
- PostgreSQL (port 5432)
- Redis (port 6379)
- MinIO (ports 9000, 9001)

### 2. Run Database Migrations

```bash
npm run migrate
```

This will create all tables including the new admin tables and insert a default admin user.

### 3. Start the Backend

```bash
npm run dev
```

The backend will start on `http://localhost:3000`

### 4. Test Authentication

Run the test script:

```bash
./test-admin-auth.sh
```

Or test manually with curl:

#### Login
```bash
curl -X POST http://localhost:3000/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@faxi.jp",
    "password": "admin123"
  }' \
  -c cookies.txt
```

Expected response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "user": {
    "id": "...",
    "email": "admin@faxi.jp",
    "name": "System Administrator",
    "role": "super_admin"
  }
}
```

#### Refresh Token
```bash
curl -X POST http://localhost:3000/admin/auth/refresh \
  -b cookies.txt \
  -c cookies.txt
```

#### Logout
```bash
curl -X POST http://localhost:3000/admin/auth/logout \
  -b cookies.txt
```

## Default Admin Credentials

**⚠️ CHANGE THESE IN PRODUCTION!**

- **Email:** `admin@faxi.jp`
- **Password:** `admin123`

## Testing with Postman/Insomnia

1. **Login:**
   - Method: POST
   - URL: `http://localhost:3000/admin/auth/login`
   - Body (JSON):
     ```json
     {
       "email": "admin@faxi.jp",
       "password": "admin123"
     }
     ```
   - Save the `accessToken` from the response

2. **Use Protected Endpoints:**
   - Add header: `Authorization: Bearer <accessToken>`
   - The token expires in 15 minutes

3. **Refresh Token:**
   - Method: POST
   - URL: `http://localhost:3000/admin/auth/refresh`
   - Cookies are automatically handled by Postman/Insomnia

## Troubleshooting

### "Cannot connect to database"
- Make sure Docker is running: `docker ps`
- Check if PostgreSQL is up: `docker-compose ps postgres`
- Restart services: `docker-compose restart`

### "Migration failed"
- Check migration logs: `npm run migrate`
- Verify database connection in `.env`

### "Invalid credentials"
- Make sure migrations ran successfully
- Check if the default admin user was created:
  ```bash
  docker-compose exec postgres psql -U faxi_user -d faxi -c "SELECT email, role FROM admin_users;"
  ```

### "Token expired"
- Access tokens expire after 15 minutes
- Use the refresh endpoint to get a new token
- Or login again

## Security Notes

1. **JWT Secret:** Set `JWT_SECRET` environment variable in production
2. **HTTPS:** Always use HTTPS in production
3. **Cookie Security:** Cookies are set with `httpOnly`, `secure` (in prod), and `sameSite: strict`
4. **Rate Limiting:** Login attempts are limited to 5 per 15 minutes per IP
5. **Password Requirements:** 
   - Minimum 12 characters
   - Must include uppercase, lowercase, number, and special character

## Next Steps

Once authentication is working:
1. Test the admin dashboard frontend (Task 2.x)
2. Add more admin endpoints (Tasks 1.6-1.8)
3. Create additional admin users with different roles
4. Test role-based permissions

## Creating Additional Admin Users

You can create additional admin users by inserting into the database:

```sql
-- Connect to database
docker-compose exec postgres psql -U faxi_user -d faxi

-- Create a new admin user (password: newpassword123)
INSERT INTO admin_users (email, password_hash, name, role, is_active)
VALUES (
  'newadmin@faxi.jp',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIxKzJN.S6',
  'New Admin',
  'admin',
  true
);
```

Or use the admin dashboard UI once it's built!
