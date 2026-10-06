import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isFounderEmail } from "@/lib/founder";
import SpeakingErrorLibraryClient from "./page.client";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*  /admin/errors — the speaking error library (founder 2026-09-16).          */
/*                                                                            */
/*  Moved out of the coach's app by CP3 A (2026-10-06, decisions log N56.3);  */
/*  /coach/errors redirects here.                                             */
/*                                                                            */
/*  FOUNDER ONLY, the same check /admin/pace uses: the signed-in email must   */
/*  be the founder's, anyone else gets Not Found. The backend's               */
/*  `require_admin_or_coach` still gates both endpoints behind this screen,   */
/*  so this page is about exposure, not authorization. Linked from the CEO    */
/*  header only.                                                              */
/*                                                                            */
/*  Only the founder gets past the check, so the readiness line under a       */
/*  pattern being tested (founder 2026-09-30, P2-15) is always on: counts     */
/*  about the machine, never a coach's surface (AC-9). The backend gates that */
/*  read again by email.                                                      */
/* -------------------------------------------------------------------------- */

export default async function AdminErrorsPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/admin/errors");
  }
  if (!isFounderEmail(user.email)) notFound();
  return <SpeakingErrorLibraryClient founder />;
}
