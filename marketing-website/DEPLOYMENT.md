# Marketing Website Deployment Guide

## Vercel Deployment

### Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. Vercel CLI installed (optional): `npm i -g vercel`
3. Backend API deployed and accessible

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Connect Repository**
   - Go to https://vercel.com/new
   - Import your Git repository
   - Select the `marketing-website` directory as the root directory

2. **Configure Build Settings**
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`
   - Root Directory: `marketing-website`

3. **Set Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add the following variable:
     ```
     NEXT_PUBLIC_API_URL=https://your-backend-domain.com
     ```
   - Make sure to set it for Production, Preview, and Development environments

4. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete
   - Your site will be live at `https://your-project.vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy from marketing-website directory**
   ```bash
   cd marketing-website
   vercel
   ```

4. **Follow the prompts**
   - Set up and deploy: Yes
   - Which scope: Select your account
   - Link to existing project: No (first time) or Yes (subsequent deploys)
   - Project name: faxi-marketing or your preferred name
   - Directory: ./
   - Override settings: No

5. **Set environment variables**
   ```bash
   vercel env add NEXT_PUBLIC_API_URL production
   ```
   Enter your backend API URL when prompted

6. **Deploy to production**
   ```bash
   vercel --prod
   ```

### Custom Domain Setup (Optional)

1. **Add Domain in Vercel Dashboard**
   - Go to Project Settings → Domains
   - Add your custom domain (e.g., faxi.jp)
   - Follow DNS configuration instructions

2. **Update DNS Records**
   - Add A record or CNAME record as instructed by Vercel
   - Wait for DNS propagation (can take up to 48 hours)

3. **SSL Certificate**
   - Vercel automatically provisions SSL certificates
   - Your site will be accessible via HTTPS

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `https://api.faxi.jp` or `http://localhost:4000` |

### Setting Environment Variables in Vercel

1. Go to your project in Vercel Dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with appropriate values
4. Select which environments (Production, Preview, Development)
5. Save changes
6. Redeploy if needed

## Post-Deployment Checklist

- [ ] Site loads successfully at Vercel URL
- [ ] All pages are accessible (home, service, partnering, demo, tech)
- [ ] Language switching works (Japanese ↔ English)
- [ ] Demo functionality works with backend API
- [ ] Metrics dashboard loads data
- [ ] All images load correctly
- [ ] Mobile responsive design works
- [ ] No console errors in browser
- [ ] Backend CORS configured for production domain

## Troubleshooting

### Build Fails

- Check build logs in Vercel dashboard
- Ensure all dependencies are in package.json
- Verify TypeScript types are correct
- Run `npm run build` locally to reproduce

### API Requests Fail

- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check backend CORS configuration includes Vercel domain
- Verify backend API is accessible from internet
- Check browser console for CORS errors

### Images Not Loading

- Ensure images are in `public/` directory
- Check image paths are correct (relative to public)
- Verify Next.js Image component is used correctly

### Language Switching Issues

- Verify next-intl configuration in `i18n.ts`
- Check translation files in `messages/` directory
- Ensure locale routing is configured in middleware

## Monitoring and Analytics

### Vercel Analytics

1. Enable Vercel Analytics in project settings
2. View real-time performance metrics
3. Monitor Core Web Vitals

### Custom Monitoring

- Add error tracking (e.g., Sentry)
- Set up uptime monitoring
- Configure performance monitoring

## Rollback

If you need to rollback to a previous deployment:

1. Go to Vercel Dashboard → Deployments
2. Find the previous successful deployment
3. Click "..." menu → Promote to Production

## Continuous Deployment

Vercel automatically deploys:
- **Production**: Commits to `main` branch
- **Preview**: Pull requests and other branches

To disable auto-deployment:
1. Go to Project Settings → Git
2. Configure deployment branches

## Performance Optimization

- Images are automatically optimized by Next.js
- Static pages are pre-rendered at build time
- API routes are serverless functions
- CDN caching is automatic

## Security

- HTTPS is enforced automatically
- Environment variables are encrypted
- Serverless functions are isolated
- DDoS protection included

## Support

- Vercel Documentation: https://vercel.com/docs
- Next.js Documentation: https://nextjs.org/docs
- Project Issues: [Your GitHub Issues URL]
