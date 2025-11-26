# Environment Variables Documentation

## Overview

This document describes all environment variables used by the Faxi Marketing Website.

## Required Variables

### NEXT_PUBLIC_API_URL

**Description**: Base URL for the Faxi backend API

**Required**: Yes

**Type**: String (URL)

**Examples**:
- Development: `http://localhost:4000`
- Production: `https://api.faxi.jp`
- Vercel: `https://your-backend.herokuapp.com`

**Usage**:
```typescript
// In API client
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

**Notes**:
- Must include protocol (`http://` or `https://`)
- No trailing slash
- Must be accessible from the browser (public variable)
- Backend must have CORS configured for the marketing site domain

## Optional Variables

Currently, there are no optional environment variables. All configuration is done through the required `NEXT_PUBLIC_API_URL`.

## Environment Files

### .env.local (Development)

Create this file for local development:

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
```

**Notes**:
- Not committed to Git (in `.gitignore`)
- Used for local development only
- Overrides other env files

### .env.production (Production)

This file contains production defaults:

```bash
# .env.production
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
```

**Notes**:
- Committed to Git
- Used as fallback for production builds
- Can be overridden by deployment platform

### .env.example (Template)

Template file for documentation:

```bash
# .env.example
NEXT_PUBLIC_API_URL=http://localhost:4000
```

**Notes**:
- Committed to Git
- Used as reference for required variables
- Copy to `.env.local` to get started

## Setting Environment Variables

### Local Development

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` with your values:
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:4000
   ```

3. Restart the development server:
   ```bash
   npm run dev
   ```

### Vercel Deployment

1. Go to your project in Vercel Dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://your-backend-api.com`
   - **Environments**: Select Production, Preview, Development

4. Redeploy if needed:
   ```bash
   vercel --prod
   ```

### Other Platforms

#### Netlify

1. Go to **Site settings** → **Build & deploy** → **Environment**
2. Add variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-api.com
   ```

#### Heroku

```bash
heroku config:set NEXT_PUBLIC_API_URL=https://your-backend-api.com
```

#### Docker

```bash
docker run -e NEXT_PUBLIC_API_URL=https://your-backend-api.com your-image
```

Or in `docker-compose.yml`:
```yaml
services:
  marketing-website:
    environment:
      - NEXT_PUBLIC_API_URL=https://your-backend-api.com
```

## Variable Naming Convention

### NEXT_PUBLIC_ Prefix

Variables prefixed with `NEXT_PUBLIC_` are:
- **Exposed to the browser**: Available in client-side code
- **Embedded at build time**: Value is baked into the JavaScript bundle
- **Public**: Anyone can see these values in the browser

**Use for**:
- API endpoints
- Public configuration
- Feature flags visible to users

**Do NOT use for**:
- API keys
- Secrets
- Private configuration

### Server-Only Variables

Variables without `NEXT_PUBLIC_` prefix are:
- **Server-side only**: Not exposed to the browser
- **Secure**: Cannot be accessed by client-side code

**Example** (if we had server-side variables):
```bash
API_SECRET_KEY=your-secret-key  # Server-only
NEXT_PUBLIC_API_URL=https://api.example.com  # Public
```

## Validation

The application validates environment variables at build time:

```typescript
// lib/api/client.ts
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error('NEXT_PUBLIC_API_URL is not defined');
}
```

## Troubleshooting

### Variable Not Defined

**Symptom**: `process.env.NEXT_PUBLIC_API_URL is undefined`

**Solutions**:
1. Check variable is set in `.env.local`
2. Restart development server
3. Verify variable name is correct (case-sensitive)
4. Check for typos in variable name

### Variable Not Updating

**Symptom**: Changes to environment variables not reflected

**Solutions**:
1. Restart development server: `npm run dev`
2. Clear Next.js cache: `rm -rf .next`
3. Rebuild: `npm run build`
4. For Vercel: Redeploy after changing variables

### CORS Errors

**Symptom**: API requests fail with CORS errors

**Solutions**:
1. Verify `NEXT_PUBLIC_API_URL` is correct
2. Check backend CORS configuration includes marketing site domain
3. Ensure protocol matches (http vs https)
4. See [Backend CORS Configuration](../backend/CORS_CONFIGURATION.md)

### Build Fails

**Symptom**: Build fails with environment variable errors

**Solutions**:
1. Ensure all required variables are set
2. Check variable values are valid URLs
3. Verify no trailing slashes in URLs
4. Check for special characters that need escaping

## Security Best Practices

### Do's

✅ Use `NEXT_PUBLIC_` prefix for client-side variables
✅ Validate environment variables at build time
✅ Document all required variables
✅ Use different values for development and production
✅ Keep `.env.local` in `.gitignore`

### Don'ts

❌ Don't commit `.env.local` to Git
❌ Don't put secrets in `NEXT_PUBLIC_` variables
❌ Don't hardcode API URLs in code
❌ Don't share production credentials
❌ Don't use the same values across all environments

## Examples

### Development Setup

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
```

```bash
npm run dev
# Site runs at http://localhost:4002
# API calls go to http://localhost:4000
```

### Production Setup

```bash
# Vercel Environment Variables
NEXT_PUBLIC_API_URL=https://api.faxi.jp
```

```bash
vercel --prod
# Site runs at https://faxi-marketing.vercel.app
# API calls go to https://api.faxi.jp
```

### Testing Different Backends

```bash
# Test against staging backend
NEXT_PUBLIC_API_URL=https://staging-api.faxi.jp npm run dev

# Test against production backend
NEXT_PUBLIC_API_URL=https://api.faxi.jp npm run dev
```

## Future Variables

As the application grows, we may add:

- `NEXT_PUBLIC_ANALYTICS_ID`: Google Analytics tracking ID
- `NEXT_PUBLIC_SENTRY_DSN`: Error tracking with Sentry
- `NEXT_PUBLIC_FEATURE_FLAGS`: Feature flag configuration
- `NEXT_PUBLIC_GTM_ID`: Google Tag Manager ID

These will be documented here when added.

## Related Documentation

- [Deployment Guide](./DEPLOYMENT.md)
- [Backend CORS Configuration](../backend/CORS_CONFIGURATION.md)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
