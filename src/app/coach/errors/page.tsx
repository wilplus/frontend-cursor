import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import SpeakingErrorLibraryClient from "./page.client";

/**
 * /coach/errors — the speaking error library.
 *
 * COACH ONLY (N4). Signed-in is enforced here, server-side; the coach check
 * itself lives in the client component (which renders nothing for a non-coach)
 * and, authoritatively, on the backend — `require_admin_or_coach` gates both
 * endpoints behind this screen, so the FE gates are for the person who guesses
 * the URL, not for security.
 *
 * Its own route rather than a section of the CMS: the CMS is gated on the
 * shared admin password, which a coach does not have. That is the whole reason
 * this screen exists.
 */
export const dynamic = "force-dynamic";

export default async function CoachErrorLibraryPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/coach/errors");
  return <SpeakingErrorLibraryClient />;
}
