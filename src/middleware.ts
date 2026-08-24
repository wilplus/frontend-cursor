import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// "/panel" — the Life Panel is signed-in only. The SECOND gate (feature flag,
// consent, allowlist) is server-side in `/v2/life/state`, which 404s: this
// entry only decides that an anonymous visitor goes to login, exactly like
// /dashboard does.
const PROTECTED_ROUTES = ["/dashboard", "/profile", "/recordings", "/change-password", "/audits", "/panel"];
const ADMIN_ROUTES = ["/admin"];
const AUTH_ROUTES = ["/login", "/signup", "/reset-password", "/update-password"];

/** Query param names that must never be in URLs (avoid sharing auth when link is shared). */
const AUTH_PARAMS = ["access_token", "refresh_token", "token", "api_key", "supabase_key"];

/** Per-request CSP nonce (base64 of 16 random bytes, Web Crypto — edge-safe). */
function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Exported for `csp.test.ts`. The policy is the single piece of this file
 *  that can take every route down at once, so it is worth asserting directly
 *  rather than only through a running browser. */
export function getCspDirectives(nonce: string): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isDev = process.env.NODE_ENV === "development";
  
  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    "https://*.supabase.io",
    // Supabase Realtime is a WebSocket, and `https://` does NOT authorise
    // `wss://` — CSP scheme-matching treats them as separate schemes, so the
    // wss:// origins must be named even though the https:// ones are already
    // here. Chrome is lenient about this and Safari is not.
    "wss://*.supabase.co",
    "wss://*.supabase.io",
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
  if (supabaseUrl) {
    connectSrc.push(supabaseUrl);
    // Supabase Realtime opens a WebSocket, and `https://host` does NOT
    // authorise `wss://host`: CSP scheme-matching treats them as different
    // schemes, so the wss:// origin has to be named in its own right.
    //
    // Chrome is lenient about this and Safari is not, which is how it went
    // unnoticed — realtime worked on desktop while iOS logged "Refused to
    // connect to wss://…" followed by "WebSocket not available: The operation
    // is insecure".
    try {
      connectSrc.push(`wss://${new URL(supabaseUrl).host}`);
    } catch {
      /* malformed env value → leave the policy as it was */
    }
  }

  // Escape hatch for a storage origin the defaults above don't cover: an R2
  // CUSTOM domain, or a CDN in front of the bucket. The two default hosts
  // (R2 s3 endpoint, Supabase Storage) need no configuration. Unset = the
  // policy is unchanged.
  const mediaUploadOrigin = process.env.NEXT_PUBLIC_MEDIA_UPLOAD_ORIGIN || "";
  if (mediaUploadOrigin) connectSrc.push(mediaUploadOrigin);

  // Cloudflare upload proxy (cloudflare/upload-proxy) in CROSS-origin mode
  // (workers.dev / custom subdomain): the browser posts long uploads straight
  // to the Worker, so its origin must be connectable. Route mode
  // (willpowerlab.com/cf-upload) is same-origin and already covered by
  // 'self'; a relative/malformed value is treated the same. Unset = inert.
  const uploadProxyUrl = process.env.NEXT_PUBLIC_UPLOAD_PROXY_URL || "";
  if (uploadProxyUrl) {
    try {
      connectSrc.push(new URL(uploadProxyUrl).origin);
    } catch {
      /* not an absolute URL → same-origin route mode, 'self' covers it */
    }
  }

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
    // ROLLED BACK 2026-08-04. #242 split this into `style-src-elem 'self'` +
    // `style-src-attr 'unsafe-inline'`, and it took the app down on Safari.
    //
    // Its premise was "the app ships zero <style> tags, verified across /,
    // /login, /blog, /about and /chat". That is true of the RENDERED HTML —
    // the production build emits zero <style> tags, so the check could not
    // have caught this. The blocks are injected at RUNTIME by a dependency:
    // `sonner` writes its stylesheet into a <style> element when the toaster
    // first mounts. Nothing in the markup, or in our own source, names it.
    //
    // Blocking it did not merely lose the toast styling. Safari refused the
    // stylesheet, webpack's chunk load rejected with it, and the rejection
    // surfaced as `a[e] is not a function` out of the module registry —
    // caught by the error boundary as "Something went wrong" on every route.
    // Chrome was more forgiving, which is why this read as an iOS-only fault.
    //
    // Re-landing it is worth doing, but it needs the injected block ACCOUNTED
    // FOR first: either a hash for sonner's stylesheet, or its styles imported
    // through the bundle so they arrive from /_next/static/css like everything
    // else. Shipping the directive before then just reintroduces the outage.
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

  const isProd = process.env.NODE_ENV === "production";
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // getAll/setAll (not the legacy get/set/remove): Supabase chunks a large
      // session across auth-token.0/.1/... cookies, and only getAll lets it
      // reassemble them — with get(name) a chunked session read as "no user"
      // here even while the browser held a valid one. setAll is what persists
      // the token getUser() refreshes below, so navigation renews an idle
      // tab's session instead of leaving it to expire (handoff §C2).
      //
      // NEVER add httpOnly here. @supabase/ssr's BROWSER client reads the auth
      // token from document.cookie, so writing these back httpOnly blinds the
      // client to its own session: the server still sees a valid user (no
      // redirect to /login) while the client renders as signed-out. That is
      // exactly the blank /dashboard this block shipped once already.
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set({
              name,
              value,
              ...options,
              secure: isProd,
              sameSite: "lax",
              path: "/",
            })
          );
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
