import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const PROTECTED_ROUTES = ["/dashboard", "/profile", "/recordings", "/change-password"];
const ADMIN_ROUTES = ["/admin"]; // Admin routes require admin role (backend will verify)
const ADMIN_FEEDBACK_ROUTES = ["/recordings"]; // Admin feedback routes (backend will verify admin role)
const AUTH_ROUTES = ["/login", "/signup", "/reset-password", "/update-password"];

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

  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const cspDirectives = getCspDirectives();
  res.headers.set("Content-Security-Policy", cspDirectives);
  res.headers.set("X-Content-Security-Policy", cspDirectives);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Use getUser() so Supabase refreshes the session if needed and sets new cookies on the response.
  // getSession() can return cached; getUser() validates/refreshes.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const session = user ? { user } : null;

  // Admin routes: Allow access but backend will verify admin role
  if (ADMIN_ROUTES.some((route) => pathname.startsWith(route))) {
    // Allow access - backend will verify admin role via JWT
    return res;
  }

  // Admin feedback routes: Allow access but backend will verify admin role
  // This allows /recordings/[recordingId]/feedback to be accessible
  // The AdminAuthGuard component will check admin status on the page
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

