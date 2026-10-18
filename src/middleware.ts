import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  CEO_ROOT_PATH,
  ceoCanonicalUrl,
  decideCeoHostRoute,
} from "@/lib/ceo/hostRouting";
import { strayAuthCallbackUrl } from "@/lib/auth/strayCallback";

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
    // Cloudflare R2 (PUBLIC read domain) — the other half of the same story,
    // and it was missing. The line above is the S3 API host, which serves
    // WRITES; files come BACK from `https://pub-<hash>.r2.dev`, the bucket's
    // public domain, which matches neither `*.r2.cloudflarestorage.com` nor
    // any origin listed here.
    //
    // The symptom was invisible in the obvious test: the deck PDF opens
    // perfectly when pasted into a browser tab, because `connect-src` governs
    // FETCHES and not navigation. Only the in-app load was refused — pdf.js
    // calls `getDocument({ url })`, which fetches — so the recording stage
    // showed "Slide preview unavailable" over a file that was stored, served
    // and valid. Two of us checked the bucket, the object and the URL before
    // anyone checked the policy.
    //
    // Named as the wildcard rather than the one bucket because the FE cannot
    // see which bucket it is: R2_PUBLIC_BASE_URL is a backend variable and is
    // never exposed to the browser bundle, so the host arrives inside data
    // (a presentation_ref) rather than configuration. `*.r2.dev` is
    // Cloudflare's public-development namespace, and a custom domain (which
    // the bucket settings recommend for production) would be covered by the
    // apiUrl/explicit-origin lines instead.
    "https://*.r2.dev",
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

  // Stripe's card form on the booking page (Embedded Checkout, founder
  // 2026-10-13): its script, its iframes and its API, and nothing else.
  scriptSrc.push(...STRIPE_ORIGINS);
  connectSrc.push(...STRIPE_ORIGINS, "https://api.stripe.com");

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
    `frame-src 'self' ${STRIPE_ORIGINS.join(" ")} https://hooks.stripe.com`,
    // Same-origin workers only: the bundled pdf.js worker and /sw.js.
    "worker-src 'self'",
  ].join("; ");
}

const STRIPE_ORIGINS = ["https://js.stripe.com", "https://checkout.stripe.com"];

/** Stamp the enforced CSP (+ legacy alias) onto an outgoing response. */
function applyCsp(res: NextResponse, csp: string): NextResponse {
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Security-Policy", csp);
  return res;
}

function isProtected(pathname: string) {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

/** A file served from public/ or a metadata route (robots.txt, sitemap.xml):
 *  its last segment has a file extension. Anything under a signed-in-only or
 *  admin prefix never counts, so the gates below keep every page they have. */
function isPublicFile(pathname: string) {
  if (isProtected(pathname) || ADMIN_ROUTES.some((route) => pathname.startsWith(route))) {
    return false;
  }
  // /icon is the app icon (src/app/icon.tsx): no extension, same for everyone.
  if (pathname === "/icon") return true;
  return /\.[a-z0-9]+$/i.test(pathname.slice(pathname.lastIndexOf("/") + 1));
}

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((route) => pathname === route);
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const pathname = url.pathname;
  const ceoHostRoute = decideCeoHostRoute({
    hostHeader: req.headers.get("host"),
    forwardedHostHeader: req.headers.get("x-forwarded-host"),
    pathname,
  });

  if (ceoHostRoute.action === "redirect-to-ceo") {
    const destination = new URL(CEO_ROOT_PATH, req.url);
    return NextResponse.redirect(destination);
  }
  if (ceoHostRoute.action === "redirect-to-ceo-host") {
    return NextResponse.redirect(ceoCanonicalUrl(req.url));
  }
  if (ceoHostRoute.action === "not-found") {
    return NextResponse.json(
      { error: "not_found" },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      }
    );
  }

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

  // An OAuth / recovery answer that Supabase sent to its Site URL (or
  // /dashboard, /chat) instead of the redirectTo it was given — see
  // strayCallback.ts. Without this a LinkedIn sign-up lands signed out.
  const callbackUrl = strayAuthCallbackUrl(req.url);
  if (callbackUrl) {
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
  if (ceoHostRoute.isCeoHost) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  // A file from public/ (the pdf.js worker, sw.js, a deck PDF, a video) is
  // the same for everyone and never gated, so it skips the Supabase check
  // below. That check is a round trip to the auth server: on /chat it held
  // /pdf.worker.min.mjs for ~2.4 s before the slides could draw. The CSP
  // still rides the response (the pdf worker and sw.js run under it).
  if (isPublicFile(pathname)) {
    return res;
  }

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

  /* THE SIGN-IN CHECK ONLY WHERE IT DECIDES SOMETHING (2026-10-18).
   *
   * getUser() is a round trip to the Supabase auth server, and the HTML
   * waits for it. On /chat — the app itself, and not a gated route — the
   * answer decided nothing: no redirect reads it there, yet every /chat open
   * waited on that round trip before the first byte.
   *
   * Where a redirect depends on it (signed-in-only, admin, the landing and
   * the auth pages) it is still getUser(). Everywhere else getSession() keeps
   * what this block is also for: an expired access token is refreshed and the
   * new cookies ride the response (handoff §C2). A token that is still valid
   * costs no network at all. Nothing is authorised here either way — the
   * backend verifies every token itself.
   *
   * If the refresh token is invalid (e.g. "Refresh Token Not Found"), treat
   * as no session so the user can log in again. */
  const authStartedAt = Date.now();
  const session = await readSession(supabase, pathname);
  // Shown in DevTools → Network → Timing → Server Timing.
  res.headers.set("Server-Timing", `auth;dur=${Date.now() - authStartedAt};desc="sign-in check"`);

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

  // Signed in already: away from the landing and the auth pages. The
  // refreshed session cookies ride the redirect.
  const signedInTo = session ? signedInDestination(pathname, searchParams, ceoHostRoute.isCeoHost) : null;
  if (signedInTo) {
    const redirect = NextResponse.redirect(new URL(signedInTo, req.url));
    res.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return applyCsp(redirect, cspDirectives);
  }

  return res;
}

/** The verified user where a redirect needs one; elsewhere only the token
 *  refresh, and null. Never throws: a bad refresh token reads as signed out. */
async function readSession(
  supabase: ReturnType<typeof createServerClient>,
  pathname: string,
): Promise<{ user: unknown } | null> {
  try {
    if (!sessionDecidesRoute(pathname)) {
      await supabase.auth.getSession();
      return null;
    }
    const { data: { user } } = await supabase.auth.getUser();
    return user ? { user } : null;
  } catch {
    return null;
  }
}

/** Whether a redirect below reads the session for this path. Keep in step
 *  with the gates in `middleware` and with `signedInDestination`. */
function sessionDecidesRoute(pathname: string): boolean {
  return (
    isProtected(pathname) ||
    ADMIN_ROUTES.some((route) => pathname.startsWith(route)) ||
    (pathname.includes("/recordings/") && pathname.includes("/feedback")) ||
    pathname === "/" ||
    isAuthRoute(pathname)
  );
}

/** Where a signed-in visitor goes instead of this page, or null to stay.
 *  The landing "/" goes to the app (page.client.tsx keeps the client
 *  fallback). Login, signup and reset-password go where the link asked (e.g.
 *  the booking page), but NOT /update-password: the user must set the new
 *  password there after clicking the reset link. */
function signedInDestination(
  pathname: string,
  searchParams: URLSearchParams,
  isCeoHost: boolean,
): string | null {
  if (pathname === "/") return isCeoHost ? null : "/chat";
  if (isAuthRoute(pathname) && pathname !== "/update-password") {
    return sameSitePath(searchParams.get("redirectTo"));
  }
  return null;
}

/** A same-site path to go to after sign-in, else /chat. */
function sameSitePath(back: string | null): string {
  return back && back.startsWith("/") && !back.startsWith("//") ? back : "/chat";
}

export const config = {
  matcher: [
    // API requests normally skip auth middleware, but they must still cross
    // the hostname boundary so the CEO subdomain cannot expose the rest of
    // the application's BFF surface.
    "/api/:path*",
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
