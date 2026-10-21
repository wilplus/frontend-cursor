import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isFounderEmail } from "@/lib/founder";
import RoadmapPanel from "@/components/founder/RoadmapPanel";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*  /admin/roadmap — the founder's roadmap (founder 2026-10-21).               */
/*                                                                            */
/*  FOUNDER ONLY, the same check /admin/pace uses: anyone else gets Not Found. */
/*  The backend's @require_founder gates the read underneath regardless.      */
/* -------------------------------------------------------------------------- */

export default async function AdminRoadmapPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/admin/roadmap");
  }
  if (!isFounderEmail(user.email)) notFound();
  return <RoadmapPanel />;
}
