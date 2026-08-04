import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// "/panel" — the Life Panel is signed-in only. The SECOND gate (feature flag,
// consent, allowlist) is server-side in `/v2/life/state`, which 404s: this
// entry only decides that an anonymous visitor goes to login, exactly like
// /dashboard does.
const PROTECTED_ROUTES = ["/dashboard", "/profile", "/recordings", "/change-password", "/audits", "/panel"];
const ADMIN_ROUTES = ["/admin"];
const AUTH_ROUTES = ["/login", "/signup", "/reset-password", "/update-password"];
/** Routes that must always be reachable without auth (Curiosity Gate funnel). */
const PUBLIC_ROUTES = ["/"];

/** Query param names that must never be in URLs (avoid sharing auth when link is shared). */
const AUTH_PARAMS = ["access_token", "refresh_token", "token", "api_key", "supabase_key"];

/** Per-request CSP nonce (base64 of 16 random bytes, Web Crypto — edge-safe). */
function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function getCspDirectives(nonce: string): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isDev = process.env.NODE_ENV === "development";
  
  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    "https://*.supabase.io",
    // Cloudflare R2 (S3 API). Media uploads go DIRECT from the browser to
    // object storage via a presigned PUT, and the backend is dual-host:
    // R2 whenever the R2_* env vars are set, else a Supabase Storage signed
    // upload (already covered above). Allowing both means uploads work
    // whichever host the backend hands back, in any environment.
    "https://*.r2.cloudflarestorage.com",
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

  // Escape hatch for a storage origin the defaults above don't cover: an R2
  // CUSTOM domain, or a CDN in front of the bucket. The two default hosts
  // (R2 s3 endpoint, Supabase Storage) need no configuration. Unset = the
  // policy is unchanged.
  const mediaUploadOrigin = process.env.NEXT_PUBLIC_MEDIA_UPLOAD_ORIGIN || "";
  if (mediaUploadOrigin) connectSrc.push(mediaUploadOrigin);

  // Nonce-based script-src: inline scripts run only with this request's nonce
  // (Next stamps it on its own tags when the CSP rides the REQUEST headers —
  // see the middleware body; requires per-request rendering, forced in the
  // root layout). 'unsafe-eval' is dev-only: React Refresh evals; the prod
  // runtime doesn't, and pdf.js feature-detects eval and falls back cleanly.
  const scriptSrc = ["'self'", `'nonce-${nonce}'`];
  if (isDev) scriptSrc.push("'unsafe-eval'");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: data: https:",
    // Style stays 'unsafe-inline': inline style= attributes (print export,
    // email-ish markup) and Next's dev style injection need it. Script is the
    // XSS vector this policy exists to close; styles are the follow-up.
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSrc.join(" ")}`,
    // Same-origin workers only: the bundled pdf.js worker and /sw.js.
    "worker-src 'self'",
  ].join("; ");
}

/** Stamp the enforced CSP (+ legacy alias) onto an outgoing response. */
function applyCsp(res: NextResponse, csp: string): NextResponse {
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Security-Policy", csp);
  return res;
}

function isProtected(pathname: string) {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((route) => pathname === route);
}

function isPublicFunnelRoute(pathname: string) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
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

  const nonce = generateNonce();
  const cspDirectives = getCspDirectives(nonce);

  // If user landed on dashboard with auth callback params (e.g. Supabase redirect URL was set to /dashboard), send to callback then update-password
  if (pathname === "/dashboard" && (searchParams.has("code") || searchParams.get("type") === "recovery")) {
    const callbackUrl = new URL("/auth/callback", req.url);
    searchParams.forEach((value, key) => callbackUrl.searchParams.set(key, value));
    return applyCsp(NextResponse.redirect(callbackUrl), cspDirectives);
  }

  // Strip auth tokens from URL so sharing a link never passes credentials to another person
  const hasAuthParam = AUTH_PARAMS.some((p) => searchParams.has(p));
  if (hasAuthParam) {
    const cleanUrl = new URL(pathname, req.url);
    searchParams.forEach((value, key) => {
      if (!AUTH_PARAMS.includes(key)) cleanUrl.searchParams.set(key, value);
    });
    return applyCsp(NextResponse.redirect(cleanUrl), cspDirectives);
  }

  // The CSP rides the REQUEST headers too: that's how Next's App Router learns
  // the nonce and stamps it on every framework <script> tag it renders.
  // `x-nonce` lets route handlers that hand-write HTML (auth/callback) stamp
  // their own inline scripts with the same nonce.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("content-security-policy", cspDirectives);
  requestHeaders.set("x-nonce", nonce);

  let res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  applyCsp(res, cspDirectives);

  // Public funnel routes are always reachable, regardless of auth state.
  // Anonymous visitors must reach /try/shaky-voice; logged-in users are not redirected away.
  if (isPublicFunnelRoute(pathname)) {
    return res;
  }

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
      return applyCsp(NextResponse.redirect(loginUrl), cspDirectives);
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

      return applyCsp(NextResponse.redirect(loginUrl), cspDirectives);
    }
    // Allow access - AdminAuthGuard will verify admin role
    return res;
  }

  if (isProtected(pathname) && !session) {
    const loginUrl = new URL("/login", req.url);
    // Preserve full URL including query parameters
    const fullPath = pathname + (url.search ? url.search : "");
    loginUrl.searchParams.set("redirectTo", fullPath);

    return applyCsp(NextResponse.redirect(loginUrl), cspDirectives);
  }

  // Redirect logged-in users away from login/signup/reset-password, but NOT from /update-password
  // (user must set new password there after clicking the reset link)
  if (session && isAuthRoute(pathname) && pathname !== "/update-password") {
    return applyCsp(NextResponse.redirect(new URL("/chat", req.url)), cspDirectives);
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

