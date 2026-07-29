import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/escrow',
  '/transactions',
  '/settings',
  '/profile',
  '/admin'
];

function getRoleFromToken(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // Handle base64url encoding
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    const parsed = JSON.parse(decoded);
    return parsed.role || null;
  } catch (e) {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Check if the current path is a protected route (or starts with it)
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtectedRoute) {
    const token = request.cookies.get('vaultix_token')?.value;

    if (!token) {
      // Redirect to home page with returnTo parameter
      const returnTo = encodeURIComponent(`${pathname}${search}`);
      return NextResponse.redirect(new URL(`/?returnTo=${returnTo}`, request.url));
    }

    // Admin route protection
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      const role = getRoleFromToken(token);
      // If role is accessible and user is not an admin, redirect them
      if (role && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
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
     * - favicon.ico, sitemap.xml, robots.txt (static files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
