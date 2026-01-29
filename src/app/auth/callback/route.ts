import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type"); // Supabase adds ?type=recovery for password reset
  const next = requestUrl.searchParams.get("next");

  // For password recovery, Supabase sends tokens in hash fragments
  // Server-side can't read hash, so we return HTML that preserves it
  // Also handle if next param indicates password reset
  if (type === "recovery" || next === "/update-password") {
    // If we have a code in query params, exchange it first
    if (code) {
      const redirectUrl = new URL("/update-password", req.url);
      const response = NextResponse.redirect(redirectUrl);
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return req.cookies.get(name)?.value;
            },
            set(name: string, value: string, options: CookieOptions) {
              response.cookies.set({
                name,
                value,
                ...options,
              });
            },
            remove(name: string, options: CookieOptions) {
              response.cookies.set({
                name,
                value: "",
                ...options,
              });
            },
          },
        }
      );

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("[Auth Callback] Error exchanging code:", error);
        const errorUrl = new URL("/reset-password?error=expired", req.url);
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

  // Normal auth flow (not password reset)
  const redirectPath = next || "/dashboard";
  const response = NextResponse.redirect(new URL(redirectPath, req.url));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else {
    await supabase.auth.getSession();
  }

  return response;
}
