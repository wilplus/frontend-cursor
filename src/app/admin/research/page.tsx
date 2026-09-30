import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isFounderEmail } from "@/lib/founder";
import ResearchPanel from "@/components/founder/ResearchPanel";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*  /admin/research — the research screen (founder 2026-09-30, L4 to L9;      */
/*  ML-6, ML-7).                                                              */
/*                                                                            */
/*  Signed in, then the backend decides: @require_research_read admits the    */
/*  research role (research_users) and an admin, GET only; anyone else gets   */
/*  its 403 and the panel says "Not available". The golden-set judging is    */
/*  the founder's alone (@require_founder), so the panel offers it only to   */
/*  the founder's email and the backend refuses everyone else regardless.    */
/*                                                                            */
/*  Pseudonyms only; no row here names a person. Numbers about the machine.  */
/* -------------------------------------------------------------------------- */

export default async function AdminResearchPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/admin/research");
  }
  return <ResearchPanel founder={isFounderEmail(user.email)} />;
}
