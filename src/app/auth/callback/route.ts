import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const GUEST_COOKIE_NAME = "willab_guest_session";

type ClaimOutcome =
  | { kind: "claimed"; sessionId: string }
  | { kind: "already_claimed"; sessionId: string }
  | { kind: "expired" }
  | { kind: "not_found" }
  | { kind: "error" };

function getBackendUrl(): string {
  const internal = process.env.BACKEND_URL_INTERNAL?.trim().replace(/\/+$/, "");
  const publicUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "";
  return (internal || publicUrl).replace(/\/+$/, "");
}

async function claimGuestSession(
  guestSessionId: string,
  accessToken: string
): Promise<ClaimOutcome> {
  const backend = getBackendUrl();
  if (!backend) return { kind: "error" };
  try {
    const resp = await fetch(`${backend}/v2/public/shaky-voice/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ guest_session_id: guestSessionId }),
    });
    const json = await resp.json().catch(() => null);

    if (resp.status === 200 && json && typeof json === "object") {
      const sessionId = (json as { session_id?: unknown }).session_id;
      const analysisStatus = (json as { analysis_status?: unknown }).analysis_status;
      if (typeof sessionId !== "string") return { kind: "error" };
      if (analysisStatus === "already_claimed") {
        return { kind: "already_claimed", sessionId };
      }
      return { kind: "claimed", sessionId };
    }
    if (resp.status === 409) {
      return { kind: "already_claimed", sessionId: "" };
    }
    if (resp.status === 410) return { kind: "expired" };
    if (resp.status === 404) return { kind: "not_found" };
    console.error("[Auth Callback] Claim failed:", resp.status, json);
    return { kind: "error" };
  } catch (err) {
    console.error("[Auth Callback] Claim threw:", err);
    return { kind: "error" };
  }
}

function clearGuestCookie(response: NextResponse) {
  response.cookies.set({
    name: GUEST_COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
  });
}

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next");

  const isRecovery =
    type === "recovery" ||
    next === "/update-password" ||
    (!!code && !type) ||
    (!!code && type !== "magiclink" && type !== "signup");

  if (isRecovery) {
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
              response.cookies.set({ name, value, ...options });
            },
            remove(name: string, options: CookieOptions) {
              response.cookies.set({ name, value: "", ...options });
            },
          },
        }
      );

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("[Auth Callback] Error exchanging code:", error);
        const isPkceError =
          error.message?.includes("PKCE") ||
          error.message?.includes("code verifier");
        const errorParam = isPkceError ? "error=pkce" : "error=expired";
        const errorUrl = new URL(`/reset-password?${errorParam}`, req.url);
        return NextResponse.redirect(errorUrl);
      }
      console.log("[Auth Callback] Successfully exchanged code for session");
      return response;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Redirecting to Password Reset...</title>
          <script>
            (function() {
              try {
                const hash = window.location.hash;
                console.log('[Auth Callback] Hash detected:', hash ? 'yes' : 'no', hash);
                if (hash && hash.length > 1) {
                  console.log('[Auth Callback] Redirecting to /update-password with hash');
                  window.location.replace('/update-password' + hash);
                } else {
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

  // Normal auth flow. Build a placeholder response that we'll mutate after seeing claim outcome.
  const guestSessionId = req.cookies.get(GUEST_COOKIE_NAME)?.value || null;
  const fallbackPath = next || "/dashboard";
  let redirectPath = fallbackPath;
  let response = NextResponse.redirect(new URL(redirectPath, req.url));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else {
    await supabase.auth.getSession();
  }

  if (!guestSessionId) {
    return response;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    clearGuestCookie(response);
    return response;
  }

  const outcome = await claimGuestSession(guestSessionId, accessToken);
  let nextPath = redirectPath;
  switch (outcome.kind) {
    case "claimed":
    case "already_claimed":
      nextPath = outcome.sessionId
        ? `/dashboard/session/${outcome.sessionId}`
        : "/dashboard?funnel=already_claimed";
      if (outcome.kind === "already_claimed" && !outcome.sessionId) {
        nextPath = "/dashboard?funnel=already_claimed";
      }
      break;
    case "expired":
      nextPath = "/try/shaky-voice?funnel=expired";
      break;
    case "not_found":
      nextPath = "/try/shaky-voice?funnel=expired";
      break;
    case "error":
      nextPath = "/dashboard?funnel=claim_error";
      break;
  }

  // Build a fresh redirect response and copy session cookies that Supabase set on the original response.
  const finalResponse = NextResponse.redirect(new URL(nextPath, req.url));
  response.cookies.getAll().forEach((cookie) => {
    if (cookie.name === GUEST_COOKIE_NAME) return;
    finalResponse.cookies.set(cookie.name, cookie.value, { path: "/" });
  });
  clearGuestCookie(finalResponse);
  return finalResponse;
}
