import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // In Server Components, cookies can only be modified in Route Handlers or Server Actions
            // This is expected behavior - we'll let Route Handlers handle cookie updates
            // The error is harmless for read-only operations like getUser()
            // Suppress the error to prevent unhandled rejections
            if (process.env.NODE_ENV === "development") {
              // Only log in dev, don't throw
              console.debug(
                "[Supabase] Cookie modification skipped in Server Component (expected behavior). Use Route Handlers for cookie updates."
              );
            }
            // Don't rethrow - this is expected in Server Components
          }
        },
      },
    }
  );
}

