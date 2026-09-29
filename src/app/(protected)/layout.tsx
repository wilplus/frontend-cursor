import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import RingAnnouncementSheet from "@/components/rings/RingAnnouncementSheet";

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

  // Rings (the backend rings migration): a feature the person's ring has reached that
  // announces itself shows its sheet on their next login. Placeholder copy;
  // it renders nothing when nothing is pending or the read fails.
  return (
    <>
      {children}
      <RingAnnouncementSheet />
    </>
  );
}
