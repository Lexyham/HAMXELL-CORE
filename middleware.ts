import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hardenCookie } from '@/lib/supabase/cookies';

/** First line of defence for /admin/*. Every admin page and action re-checks via requireAdmin(). */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const toLogin = () => NextResponse.redirect(new URL('/admin/login', request.url));
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;

  if (!url || !anon) return pathname === '/admin/login' ? NextResponse.next() : toLogin();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list: Parameters<SetAllCookies>[0]) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, hardenCookie(options)));
      },
    },
  });

  const { data } = await supabase.auth.getUser(); // also refreshes the session cookie
  if (pathname === '/admin/login') return response;
  if (!data.user) return toLogin();

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') return toLogin();
  return response;
}

export const config = { matcher: ['/admin/:path*'] };
