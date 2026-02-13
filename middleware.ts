import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const PROTECTED_ROUTES = ["/dashboard", "/profile", "/recordings", "/change-password"];
const ADMIN_ROUTES = ["/admin"];
const AUTH_ROUTES = ["/login", "/signup", "/reset-password", "/update-password"];

/** Query param names that must never be in URLs (avoid sharing auth when link is shared). */
const AUTH_PARAMS = ["access_token", "refresh_token", "token", "api_key", "supabase_key"];

function getCspDirectives(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isDev = process.env.NODE_ENV === "development";
  
  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    "https://*.supabase.io",
  ];
  
  // In development, allow localhost for Fast Refresh and HMR
  if (isDev) {
    connectSrc.push(
      "http://localhost:*",
      "ws://localhost:*",
      "ws://127.0.0.1:*"
    );
  }
  
  if (apiUrl) connectSrc.push(apiUrl);
  if (supabaseUrl) connectSrc.push(supabaseUrl);
  
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `connect-src ${connectSrc.join(" ")}`,
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: data: https:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  ].join("; ");
}

function isProtected(pathname: string) {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((route) => pathname === route);
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  // Skip middleware for Next.js internal routes, API routes, Fast Refresh, and RSC requests
  const searchParams = url.searchParams;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes("__nextjs") ||
    pathname.includes("webpack") ||
    pathname.includes(".hot-update") ||
    searchParams.has("_rsc") || // React Server Component requests
    searchParams.has("__nextjs_original-stack-frames") // Next.js error overlay
  ) {
    return NextResponse.next();
  }

  // If user landed on dashboard with auth callback params (e.g. Supabase redirect URL was set to /dashboard), send to callback then update-password
  if (pathname === "/dashboard" && (searchParams.has("code") || searchParams.get("type") === "recovery")) {
    const callbackUrl = new URL("/auth/callback", req.url);
    searchParams.forEach((value, key) => callbackUrl.searchParams.set(key, value));
    const redirect = NextResponse.redirect(callbackUrl);
    const redirectCsp = getCspDirectives();
    redirect.headers.set("Content-Security-Policy", redirectCsp);
    redirect.headers.set("X-Content-Security-Policy", redirectCsp);
    return redirect;
  }

  // Strip auth tokens from URL so sharing a link never passes credentials to another person
  const hasAuthParam = AUTH_PARAMS.some((p) => searchParams.has(p));
  if (hasAuthParam) {
    const cleanUrl = new URL(pathname, req.url);
    searchParams.forEach((value, key) => {
      if (!AUTH_PARAMS.includes(key)) cleanUrl.searchParams.set(key, value);
    });
    const redirect = NextResponse.redirect(cleanUrl);
    const redirectCsp = getCspDirectives();
    redirect.headers.set("Content-Security-Policy", redirectCsp);
    redirect.headers.set("X-Content-Security-Policy", redirectCsp);
    return redirect;
  }

  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const cspDirectives = getCspDirectives();
  res.headers.set("Content-Security-Policy", cspDirectives);
  res.headers.set("X-Content-Security-Policy", cspDirectives);

  const isProd = process.env.NODE_ENV === "production";
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({
            name,
            value,
            ...options,
            secure: isProd,
            sameSite: "lax",
            httpOnly: true,
            path: "/",
          });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({
            name,
            value: "",
            ...options,
            secure: isProd,
            sameSite: "lax",
            path: "/",
          });
        },
      },
    }
  );

  // Use getUser() so Supabase refreshes the session if needed and sets new cookies on the response.
  // If refresh token is invalid (e.g. "Refresh Token Not Found"), treat as no session so user can log in again.
  let session: { user: unknown } | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    session = user ? { user } : null;
  } catch {
    // Invalid/expired refresh token: treat as unauthenticated (user will be redirected to login)
    session = null;
  }

  // Admin routes: require valid session (same as protected); backend will verify admin role
  if (ADMIN_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirectTo", pathname + (url.search || ""));
      const redirect = NextResponse.redirect(loginUrl);
      const redirectCsp = getCspDirectives();
      redirect.headers.set("Content-Security-Policy", redirectCsp);
      redirect.headers.set("X-Content-Security-Policy", redirectCsp);
      return redirect;
    }
    return res;
  }

  if (pathname.includes("/recordings/") && pathname.includes("/feedback")) {
    // If not logged in, redirect to login with full URL (including query params)
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      // Preserve full URL including query parameters
      const fullPath = pathname + (url.search ? url.search : "");
      loginUrl.searchParams.set("redirectTo", fullPath);
      
      const redirect = NextResponse.redirect(loginUrl);
      const redirectCsp = getCspDirectives();
      redirect.headers.set("Content-Security-Policy", redirectCsp);
      redirect.headers.set("X-Content-Security-Policy", redirectCsp);
      return redirect;
    }
    // Allow access - AdminAuthGuard will verify admin role
    return res;
  }

  if (isProtected(pathname) && !session) {
    const loginUrl = new URL("/login", req.url);
    // Preserve full URL including query parameters
    const fullPath = pathname + (url.search ? url.search : "");
    loginUrl.searchParams.set("redirectTo", fullPath);

    const redirect = NextResponse.redirect(loginUrl);
    const redirectCsp = getCspDirectives();
    redirect.headers.set("Content-Security-Policy", redirectCsp);
    redirect.headers.set("X-Content-Security-Policy", redirectCsp);
    return redirect;
  }

  // Redirect logged-in users away from login/signup/reset-password, but NOT from /update-password
  // (user must set new password there after clicking the reset link)
  if (session && isAuthRoute(pathname) && pathname !== "/update-password") {
    const redirect = NextResponse.redirect(new URL("/dashboard", req.url));
    const redirectCsp = getCspDirectives();
    redirect.headers.set("Content-Security-Policy", redirectCsp);
    redirect.headers.set("X-Content-Security-Policy", redirectCsp);
    return redirect;
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _next/webpack (webpack HMR)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    "/((?!api|_next/static|_next/image|_next/webpack|favicon.ico|.*\\.(?:png|jpg|jpeg|webm|svg|ico)).*)",
  ],
};

