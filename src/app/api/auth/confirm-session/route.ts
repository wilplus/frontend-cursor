import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * This route is called after client-side login to ensure
 * server-side cookies are properly set
 */
export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true });

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

  // This will read any cookies set by the browser client
  // and ensure they're properly set as httpOnly cookies
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    return response;
  }

  return NextResponse.json({ error: "No session found" }, { status: 401 });
}
