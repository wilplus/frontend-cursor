import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isFounderEmail } from "@/lib/founder";
import PacePanel from "@/components/founder/PacePanel";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*  /admin/pace — the founder's pace panel (founder 2026-09-30, C9; ML-4).     */
/*                                                                            */
/*  FOUNDER ONLY, the same check /admin/rings uses: the signed-in email must   */
/*  be the founder's, anyone else gets Not Found. The backend's               */
/*  @require_founder gates every call underneath regardless, so this page is  */
/*  about exposure, not authorization. Linked from the CEO header only.       */
/*                                                                            */
/*  AC-9: this panel shows how the machine's jars fill and the four doors —   */
/*  counts about the system, never a read on a speaker.                       */
/* -------------------------------------------------------------------------- */

export default async function AdminPacePage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/admin/pace");
  }
  if (!isFounderEmail(user.email)) notFound();
  return <PacePanel />;
}
