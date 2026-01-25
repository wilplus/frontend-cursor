import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type"); // Supabase adds ?type=recovery for password reset
  const next = requestUrl.searchParams.get("next");

  // If it's a password recovery, redirect to update password page
  const redirectPath = type === "recovery" 
    ? "/update-password" 
    : (next || "/dashboard");

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
    // If no code, just refresh the session to ensure cookies are set
    await supabase.auth.getSession();
  }

  return response;
}
