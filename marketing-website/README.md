# Faxi Marketing Website

This is the marketing website for Faxi, built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- **Bilingual Support**: Japanese and English with next-intl
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Modern UI**: shadcn/ui components
- **Data Visualization**: Recharts for metrics and charts
- **Animations**: Framer Motion for smooth transitions
- **API Integration**: Hooks for demo processing and metrics fetching

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

The site will automatically redirect to a locale-specific URL:
- Japanese: [http://localhost:3000/ja](http://localhost:3000/ja)
- English: [http://localhost:3000/en](http://localhost:3000/en)

### Build

```bash
npm run build
npm start
```

## Project Structure

```
marketing-website/
├── app/
│   ├── [locale]/          # Locale-specific pages
│   │   ├── page.tsx       # Home page
│   │   ├── service/       # Service page (for families)
│   │   ├── partnering/    # Partnering page (for B2B)
│   │   ├── demo/          # Interactive demo
│   │   ├── tech/          # Technical details
│   │   ├── about/         # About page
│   │   ├── privacy/       # Privacy policy
│   │   └── terms/         # Terms of service
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/
│   ├── layout/            # Layout components (Header, Footer)
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── api/               # API client and types
│   ├── hooks/             # Custom React hooks
│   └── utils.ts           # Utility functions
├── messages/              # Translation files
│   ├── en.json            # English translations
│   └── ja.json            # Japanese translations
├── i18n/
│   └── request.ts         # next-intl configuration
└── middleware.ts          # Locale routing middleware
```

## Pages

- **Home** (`/`): Landing page with hero section and overview
- **Service** (`/service`): Information for families about using Faxi
- **Partnering** (`/partnering`): B2B partnership opportunities
- **Demo** (`/demo`): Interactive demo of fax processing
- **Tech** (`/tech`): Technical architecture and details
- **About** (`/about`): Company information
- **Privacy** (`/privacy`): Privacy policy
- **Terms** (`/terms`): Terms of service

## API Integration

The website integrates with the Faxi backend API for:

- **Demo Processing**: Upload or select sample faxes for processing
- **Metrics**: Display accuracy and processing statistics

See `lib/api/client.ts` and `lib/hooks/` for implementation details.

## Internationalization

The site supports Japanese and English using next-intl:

- Translations are stored in `messages/en.json` and `messages/ja.json`
- Language toggle in the header
- URL structure: `/ja/page` and `/en/page`
- Default locale: Japanese

## Styling

- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Pre-built accessible components
- **CSS Variables**: Theme customization in `globals.css`

## Testing

### Unit Tests

Run unit tests with Vitest:

```bash
npm test
```

### Property-Based Tests

The project includes property-based tests using fast-check for:
- Image accessibility compliance
- Interactive element accessibility
- Typography accessibility
- Demo result display completeness
- Use case completeness
- Statistics source attribution

### Integration Tests

Integration tests verify:
- Demo flow (fixture selection → processing → results)
- API integration with backend
- Component interactions

## Deployment

### Vercel Deployment (Recommended)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

**Quick Start:**

1. **Connect to Vercel**
   - Import your Git repository
   - Select `marketing-website` as root directory

2. **Configure Environment Variables**
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-api.com
   ```

3. **Deploy**
   - Vercel will automatically build and deploy
   - Your site will be live at `https://your-project.vercel.app`

### Custom Domain

To use a custom domain (e.g., `faxi.jp`):

1. Add domain in Vercel dashboard
2. Configure DNS records as instructed
3. SSL certificate is automatically provisioned

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `https://api.faxi.jp` |

## Performance

The site is optimized for performance:

- **Lighthouse Score**: Target ≥ 85
- **Image Optimization**: Next.js automatic image optimization
- **Code Splitting**: Automatic route-based code splitting
- **Lazy Loading**: Images and components lazy loaded
- **Caching**: Static pages cached at CDN edge

## Accessibility

The site meets WCAG 2.1 AA standards:

- Semantic HTML throughout
- ARIA labels where needed
- Keyboard navigation support
- Screen reader compatible
- Color contrast ratios ≥ 4.5:1
- Minimum text size 16px
- Focus indicators visible

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `npm test`
4. Build: `npm run build`
5. Submit a pull request

## Troubleshooting

### Build Fails

- Check TypeScript errors: `npm run typecheck`
- Verify all dependencies are installed: `npm install`
- Clear Next.js cache: `rm -rf .next`

### API Requests Fail

- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check backend CORS configuration
- Verify backend is accessible from your network

### Images Not Loading

- Ensure images are in `public/` directory
- Check image paths are correct
- Verify Next.js Image component is used

## Documentation

- [Deployment Guide](./DEPLOYMENT.md)
- [E2E Testing Checklist](./E2E_TESTING_CHECKLIST.md)
- [Backend CORS Configuration](../backend/CORS_CONFIGURATION.md)

## Support

For issues or questions:
- GitHub Issues: [Your Repository URL]
- Email: support@faxi.jp

## License

Copyright © 2024 Faxi. All rights reserved.
