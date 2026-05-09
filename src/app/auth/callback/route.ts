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
    // Return HTML page that preserves hash and redirects client-side immediately
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Redirecting to Password Reset...</title>
          <script>
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
          <script>
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

  // Normal auth flow (not password reset).
  // Default to /results so authenticated users land on their snippets
  // (or the overview when no session is published yet).
  const redirectPath = next || "/results";
  const response = NextResponse.redirect(new URL(redirectPath, req.url));

  // Use the modern getAll/setAll cookie API so PKCE chunked cookies
  // (`sb-*-auth-token-code-verifier.0`, `.1`, ...) round-trip
  // correctly between the OAuth init (browser client) and this
  // callback (server). The legacy get/set/remove triplet drops
  // chunked cookies and causes exchangeCodeForSession to throw
  // "code verifier should be non-empty" — which is what was sending
  // every LinkedIn signup back to /login?error=oauth_failed.
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

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[Auth Callback] OAuth code exchange failed:", error.message);
      // Surface the actual error to /login so we can debug if this
      // fires again (PKCE / network / token expiry all surface here).
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("error", "oauth_failed");
      loginUrl.searchParams.set(
        "detail",
        encodeURIComponent(error.message || "unknown").slice(0, 200)
      );
      return NextResponse.redirect(loginUrl);
    }
  } else {
    await supabase.auth.getSession();
  }

  return response;
}
