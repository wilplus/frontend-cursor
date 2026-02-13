import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Protects all routes under (protected): dashboard, profile, recordings, change-password.
 * Validates session on every request so that shared links open in another browser/device
 * do not show another user's session — user is redirected to login.
 * (Middleware also enforces this; this is a server-side safeguard.)
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/dashboard");
  }

  return <>{children}</>;
}
