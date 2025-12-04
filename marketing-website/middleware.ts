import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales } from './i18n';

// Policy pages that should NOT have locale prefixes (for Stripe compliance)
const policyPaths = [
  '/subscription-policy',
  '/privacy-policy',
  '/cookie-policy',
  '/disclaimer-policy',
  '/commercial-policy',
  '/refund_returns',
  '/terms-of-use',
];

const intlMiddleware = createMiddleware({
  // A list of all locales that are supported
  locales,

  // Used when no locale matches
  defaultLocale: 'ja',

  // Always use locale prefix
  localePrefix: 'always'
});

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip locale middleware for policy pages - let them resolve at root level
  if (policyPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Apply locale middleware for all other routes
  return intlMiddleware(request);
}

export const config = {
  // Match all paths except static files and api routes
  matcher: ['/((?!_next|api|images|videos|fonts|favicon.ico).*)']
};
