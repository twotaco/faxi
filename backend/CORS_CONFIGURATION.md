# CORS Configuration Guide

## Overview

The backend API is configured to accept requests from the admin dashboard and marketing website. CORS (Cross-Origin Resource Sharing) is configured to allow specific origins based on the environment.

## Allowed Origins

### Development Environment

In development (`NODE_ENV=development`), the following origins are allowed:
- `http://localhost:4001` - Admin Dashboard
- `http://localhost:4002` - Marketing Website
- Any `localhost` origin (for flexibility during development)

### Production Environment

In production (`NODE_ENV=production`), the following origins are allowed:
- `https://admin.faxi.jp` - Admin Dashboard
- `https://app.faxi.jp` - Application
- `https://faxi.jp` - Main Website
- `https://www.faxi.jp` - WWW subdomain
- Marketing site URL from `MARKETING_SITE_URL` environment variable
- Any `.vercel.app` domain (for Vercel preview deployments)

## Environment Variables

### MARKETING_SITE_URL

Set this environment variable to your marketing website's production URL.

**Example:**
```bash
MARKETING_SITE_URL=https://faxi-marketing.vercel.app
```

**For custom domains:**
```bash
MARKETING_SITE_URL=https://marketing.faxi.jp
```

### VERCEL_URL

This is automatically set by Vercel for preview deployments. No manual configuration needed.

## Configuration Steps

### 1. Update Backend Environment Variables

Add the marketing site URL to your backend environment:

**For local development:**
```bash
# backend/.env
MARKETING_SITE_URL=http://localhost:4002
```

**For production:**
```bash
# backend/.env.production or in your hosting platform
MARKETING_SITE_URL=https://your-marketing-site.vercel.app
```

### 2. Deploy Backend

After updating the environment variables, redeploy your backend:

```bash
# If using Docker
docker-compose up -d --build

# If using direct deployment
npm run build
npm start
```

### 3. Verify CORS Configuration

Test that CORS is working correctly:

```bash
# Test from marketing site domain
curl -H "Origin: https://your-marketing-site.vercel.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://your-backend-api.com/api/demo/fixtures \
     -v
```

Expected response should include:
```
Access-Control-Allow-Origin: https://your-marketing-site.vercel.app
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
```

## Troubleshooting

### CORS Error: "Not allowed by CORS"

**Symptoms:**
- Browser console shows CORS error
- Network tab shows failed preflight request

**Solutions:**

1. **Check environment variable is set:**
   ```bash
   echo $MARKETING_SITE_URL
   ```

2. **Verify the origin matches exactly:**
   - Include protocol (`https://`)
   - No trailing slash
   - Correct subdomain

3. **Check backend logs:**
   ```bash
   # Look for CORS-related errors
   docker logs faxi-backend | grep CORS
   ```

4. **Restart backend after env changes:**
   ```bash
   docker-compose restart backend
   ```

### Vercel Preview Deployments Not Working

**Symptoms:**
- Production deployment works
- Preview deployments fail with CORS errors

**Solution:**

The backend automatically allows all `.vercel.app` domains in production. Ensure:
1. Backend is running in production mode
2. Preview deployment URL ends with `.vercel.app`

### Custom Domain CORS Issues

**Symptoms:**
- Vercel URL works
- Custom domain fails with CORS errors

**Solution:**

Add your custom domain to the allowed origins:

```bash
# In backend environment
MARKETING_SITE_URL=https://marketing.faxi.jp
```

Or update the CORS configuration in `backend/src/index.ts` to include your custom domain.

## Security Considerations

### Production

- Only specific domains are allowed
- Credentials (cookies) are enabled for authenticated requests
- Vercel preview deployments are allowed for testing

### Development

- All localhost origins are allowed for flexibility
- This is automatically restricted in production

## Testing CORS

### From Browser Console

```javascript
// Test API endpoint from marketing site
fetch('https://your-backend-api.com/api/demo/fixtures', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log('Success:', data))
.catch(error => console.error('CORS Error:', error));
```

### Expected Behavior

✅ **Success:** Response data is returned
❌ **Failure:** CORS error in console

## Additional Resources

- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Express CORS Middleware](https://expressjs.com/en/resources/middleware/cors.html)
