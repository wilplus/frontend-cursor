import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isFounderEmail } from "@/lib/founder";
import CoachExerciseAuthoringClient from "./page.client";
import LibraryPanel from "./LibraryPanel";
import { coachPanelOnForPage } from "@/lib/willab/coachPanelSwitch";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*  /admin/library — the exercise library (founder 2026-09-29, decision 4).   */
/*                                                                            */
/*  Moved out of the coach's app by CP3 A (2026-10-06, decisions log N56.3):  */
/*  "The exercise library and the speaking errors page leave the coach's app  */
/*  and sit next to the pace panel in your admin area. Coaches keep           */
/*  everything they need inside the moment." /coach/exercises redirects here. */
/*                                                                            */
/*  FOUNDER ONLY, the same check /admin/pace uses: the signed-in email must   */
/*  be the founder's, anyone else gets Not Found. The backend's               */
/*  `require_admin_or_coach` still gates every endpoint behind this screen,   */
/*  so this page is about exposure, not authorization. Linked from the CEO    */
/*  header only.                                                              */
/* -------------------------------------------------------------------------- */

type PageProps = { searchParams?: Record<string, string | string[] | undefined> };

export default async function AdminLibraryPage({ searchParams }: PageProps = {}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/admin/library");
  }
  if (!isFounderEmail(user.email)) notFound();
  // The rebuilt screens wait behind the coach panel's switch until the
  // founder approves them from the Done list (Q-CP645 A, 2026-10-08).
  return coachPanelOnForPage(searchParams) ? <LibraryPanel /> : <CoachExerciseAuthoringClient />;
}
