import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isFounderEmail } from "@/lib/founder";
import PaceCircleLab from "./PaceCircleLab";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*  /admin/pace-circle — the Pace Circle's microphone test page (founder      */
/*  2026-10-24; backend decisions log N130, N131).                            */
/*                                                                            */
/*  FOUNDER ONLY, the same check /admin/pace uses: anyone else gets Not       */
/*  Found. It is a test bench for tuning the starting values on a real voice, */
/*  not the speaker's screen: no speaker can reach it, nothing links to it,   */
/*  and it never sits between a Take and the Ideal Text. It listens only:     */
/*  no audio is recorded, sent or stored; the founder's own running baseline  */
/*  stays in this browser.                                                    */
/* -------------------------------------------------------------------------- */

export default async function AdminPaceCirclePage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/admin/pace-circle");
  }
  if (!isFounderEmail(user.email)) notFound();
  return <PaceCircleLab />;
}
