import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import CoachExerciseAuthoringClient from "./page.client";

/**
 * /coach/exercises — exercise authoring in the coach panel (founder
 * 2026-09-29, decision 4).
 *
 * COACH ONLY (N4). Signed-in is enforced here, server-side; the coach check
 * itself lives in the client component (which renders nothing for a
 * non-coach) and, authoritatively, on the backend — `require_admin_or_coach`
 * gates every endpoint behind this screen, so the FE gates are for the person
 * who guesses the URL, not for security.
 *
 * Its own route rather than a section of the CMS: the CMS is gated on the
 * shared admin password, which a coach does not have. That is the whole
 * reason this screen exists.
 */
export const dynamic = "force-dynamic";

export default async function CoachExercisesPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/coach/exercises");
  return <CoachExerciseAuthoringClient />;
}
