import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isFounderEmail } from "@/lib/founder";
import PaceCircleLab from "./PaceCircleLab";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*  /admin/pace-circle — the pace scale's bench (founder 2026-10-24 to 26;     */
/*  backend decisions log N142, SPEC §17 pace-scale-v1). Its home doc is the  */
/*  Feedback walk's page, docs/flows/feedback-walk-and-chat.md §2 "Tempo":    */
/*  the scale will become a step of the walk; until then it runs only here.   */
/*                                                                            */
/*  FOUNDER ONLY, the same check /admin/pace uses: anyone else gets Not       */
/*  Found. No speaker can reach it, nothing links to it, and it never sits    */
/*  between a Take and the Ideal Text. It listens only: no audio is           */
/*  recorded, sent or stored.                                                 */
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
