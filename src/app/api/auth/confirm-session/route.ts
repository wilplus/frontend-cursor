import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Sync the client-side Supabase session into httpOnly server cookies.
 *
 * Called after any client-side auth event (password login, OAuth
 * exchange on /auth/oauth-complete, etc.) so subsequent BFF routes can
 * read the session from cookies.
 *
 * Uses the modern getAll/setAll cookie API — the legacy
 * get/set/remove triplet drops Supabase's chunked auth-token cookies
 * (`sb-…-auth-token.0`, `.1`, ...) and was returning 401 even when
 * the browser client had a valid session.
 */
export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true });

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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    return response;
  }

  return NextResponse.json({ error: "No session found" }, { status: 401 });
}
