import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Check for auth token in cookies (set by login)
  const hasRefreshToken = request.cookies.has('admin_refresh_token');

  // If trying to access protected route without token, redirect to login
  if (!isPublicRoute && !hasRefreshToken && pathname !== '/') {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If trying to access login while authenticated, redirect to dashboard
  if (isPublicRoute && hasRefreshToken) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
