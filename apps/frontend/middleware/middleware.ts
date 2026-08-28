import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('vaultix_jwt')?.value || request.cookies.get('vaultix_wallet')?.value;

  // Protect routes starting with /profile or /dashboard
  const isProtectedPath = pathname.startsWith('/profile') || pathname.startsWith('/dashboard') || pathname.startsWith('/escrows/new');
  const isAdminPath = pathname.startsWith('/admin');

  if ((isProtectedPath || isAdminPath) && !token) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('connect', 'true');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/profile/:path*', '/dashboard/:path*', '/escrows/new', '/admin/:path*'],
};