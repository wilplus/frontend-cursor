import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import CorpusPageClient from "./page.client";

/**
 * /coach/corpus — the training corpus workbench (import + confidence labelling).
 *
 * COACH ONLY (N4). Signed-in is enforced here, server-side; the coach check
 * itself lives in the client component (which renders nothing for a non-coach)
 * and, authoritatively, on the backend — every endpoint behind this screen is
 * role-gated by `require_admin_or_coach`, so the FE gates are for the person
 * who guesses the URL, not for security.
 *
 * Deliberately its own route rather than a Lounge overlay: this is a bulk
 * workbench — pick thirty files, wait, label a queue — not something opened
 * over a chat and dismissed with Back.
 */
export const dynamic = "force-dynamic";

export default async function CoachCorpusPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/coach/corpus");
  return <CorpusPageClient />;
}
