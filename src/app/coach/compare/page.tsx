import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ComparePageClient from "./page.client";

/**
 * /coach/compare?arc=<id> — the blinded A/B slide comparison (founder
 * 2026-08-11).
 *
 * COACH ONLY. Signed-in is enforced here, server-side; the coach check lives
 * in the client component and, authoritatively, on the backend — every
 * endpoint behind this screen is role-gated by `require_admin_or_coach`, so
 * the FE gates are for the person who guesses the URL, not for security.
 *
 * Its own route rather than a panel tab, for the same reason the corpus
 * workbench is: this is a QUEUE — judge, next, judge, next, for as long as
 * you have patience — not something opened over a review and dismissed.
 */
export const dynamic = "force-dynamic";

export default async function CoachComparePage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/coach/compare");
  return <ComparePageClient />;
}
