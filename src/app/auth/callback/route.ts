import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type"); // Supabase adds ?type=recovery for password reset
  const next = requestUrl.searchParams.get("next");

  // Password recovery: only treat as recovery when explicitly flagged.
  // OAuth providers (LinkedIn, etc.) return ?code=xxx with no type param —
  // those must NOT be treated as recovery.
  const isRecovery =
    type === "recovery" ||
    next === "/update-password";

  if (isRecovery) {
    // If we have a code in query params, exchange it first
    if (code) {
      const redirectUrl = new URL("/update-password", req.url);
      const response = NextResponse.redirect(redirectUrl);
      // Use the modern getAll/setAll cookie API. The legacy
      // get/set/remove triplet doesn't handle Supabase's chunked
      // PKCE cookies (`sb-*-auth-token-code-verifier.0`,
      // `.1`, ...) correctly, which is what was making
      // exchangeCodeForSession fail with "code verifier should be
      // non-empty" right after LinkedIn returned the code.
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return req.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                response.cookies.set({ name, value, ...options });
              });
            },
          },
        }
      );

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("[Auth Callback] Error exchanging code:", error);
        const isPkceError = error.message?.includes("PKCE") || error.message?.includes("code verifier");
        const errorParam = isPkceError ? "error=pkce" : "error=expired";
        const errorUrl = new URL(`/reset-password?${errorParam}`, req.url);
        return NextResponse.redirect(errorUrl);
      }
      console.log("[Auth Callback] Successfully exchanged code for session");
      return response;
    }

    // No code but type=recovery or next=/update-password - Supabase sent hash fragments
    // Return HTML page that preserves hash and redirects client-side immediately.
    // The inline scripts must carry the request's CSP nonce (middleware
    // forwards it as x-nonce) or script-src 'nonce-…' blocks them and the
    // hash — i.e. the recovery token — never reaches /update-password.
    // Charset guard so a forged header can't break out of the attribute.
    const nonce = (req.headers.get("x-nonce") || "").replace(/[^A-Za-z0-9+/=_-]/g, "");
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Redirecting to Password Reset...</title>
          <script nonce="${nonce}">
            // Immediately preserve hash and redirect to update-password
            // This must run before any other scripts
            (function() {
              try {
                const hash = window.location.hash;
                console.log('[Auth Callback] Hash detected:', hash ? 'yes' : 'no', hash);
                if (hash && hash.length > 1) {
                  // Has hash - redirect with it preserved
                  console.log('[Auth Callback] Redirecting to /update-password with hash');
                  window.location.replace('/update-password' + hash);
                } else {
                  // No hash - might have been lost, try redirecting anyway
                  console.warn('[Auth Callback] No hash found, redirecting without it');
                  window.location.replace('/update-password');
                }
              } catch (e) {
                console.error('[Auth Callback] Error in redirect:', e);
                window.location.replace('/update-password');
              }
            })();
          </script>
        </head>
        <body>
          <div style="text-align: center; padding: 2rem; font-family: system-ui;">
            <p>Redirecting to password reset page...</p>
            <p style="font-size: 0.875rem; color: #666;">If you're not redirected, <a href="/update-password">click here</a>.</p>
          </div>
          <script nonce="${nonce}">
            // Fallback redirect after a short delay
            setTimeout(function() {
              const hash = window.location.hash || '';
              if (window.location.pathname !== '/update-password') {
                window.location.href = '/update-password' + hash;
              }
            }, 500);
          </script>
        </body>
      </html>
    `;
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  // Normal OAuth flow — forward to the client-side handler.
  //
  // Doing the exchange server-side here was producing silent failures:
  // exchangeCodeForSession returned {session: null, error: null} on
  // Vercel and the only cookie that made it back to the browser was
  // the PKCE code-verifier — never the actual auth token. Multiple
  // attempts at fixing the cookie API, redirect URL allow-list, and
  // schema didn't move the needle.
  //
  // The browser supabase client handles PKCE without any of these
  // cookie-round-trip quirks (it stores the verifier in localStorage
  // during init and recovers it from the same place at exchange
  // time). So we just bounce the user to /auth/oauth-complete with
  // the code and state intact, and let the client do the work.
  if (code) {
    const target = new URL("/auth/oauth-complete", req.url);
    target.searchParams.set("code", code);
    const state = requestUrl.searchParams.get("state");
    if (state) target.searchParams.set("state", state);
    if (next) target.searchParams.set("next", next);
    return NextResponse.redirect(target);
  }

  // No code in the URL. Two very different cases share this branch:
  //   1. A genuine OAuth failure — the provider (Google, LinkedIn) or
  //      Supabase itself rejected the request before issuing a code, e.g.
  //      the provider isn't enabled/configured in the Supabase dashboard,
  //      or the user cancelled consent. Supabase appends `error` /
  //      `error_description` in this case.
  //   2. A stale callback hit with no error at all (e.g. a bookmarked or
  //      reloaded URL) — safe to just bounce to /chat.
  // Previously both cases silently redirected to /chat, so a real OAuth
  // failure looked to the user like "nothing happened, I'm back on the
  // main screen" with zero indication of what went wrong.
  const oauthError = requestUrl.searchParams.get("error");
  if (oauthError) {
    const detail = requestUrl.searchParams.get("error_description") || oauthError;
    const errorUrl = new URL("/login", req.url);
    errorUrl.searchParams.set("error", "oauth_failed");
    errorUrl.searchParams.set("detail", detail.slice(0, 200));
    console.error("[Auth Callback] OAuth provider error:", oauthError, detail);
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(new URL(next || "/chat", req.url));
}
