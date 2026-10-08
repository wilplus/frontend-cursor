import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isFounderEmail } from "@/lib/founder";
import AdminCorpusClient from "./page.client";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*  /admin/corpus — hide, delete and restore a training import (founder       */
/*  2026-10-07, Q-B15 A: "corpus hide/delete/restore move to admin"; build     */
/*  plan D-CP-20). The coach's corpus screens inside the panel import and     */
/*  judge; tidying the list is the founder's, here, next to the pace panel.   */
/*                                                                            */
/*  FOUNDER ONLY, the same check /admin/pace uses. The backend's               */
/*  `require_admin_or_coach` still gates every endpoint behind this screen.   */
/*  Not a locked screen: no prototype draws it. Its words were signed on    */
/*  8 October 2026 (decisions log N66.1) and live in adminCorpusCopy.ts, so  */
/*  nothing hides it any more: until then it answered Not Found unless the  */
/*  coach panel's switch was on.                                            */
/* -------------------------------------------------------------------------- */

type PageProps = { searchParams?: Record<string, string | string[] | undefined> };

export default async function AdminCorpusPage(_props: PageProps) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/admin/corpus");
  }
  if (!isFounderEmail(user.email)) notFound();
  return <AdminCorpusClient />;
}
