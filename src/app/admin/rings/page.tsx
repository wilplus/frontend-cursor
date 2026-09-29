import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import RingsPanel from "@/components/rings/RingsPanel";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*  /admin/rings — the founder's rollout panel (rings design, 2026-09-29).     */
/*                                                                            */
/*  FOUNDER ONLY, the same check /coach/corpus/summary uses: the signed-in     */
/*  email must be the founder's, anyone else gets Not Found. The backend's     */
/*  @require_admin gates every call underneath regardless, so this page is     */
/*  about exposure, not authorization. Not linked from any navigation.        */
/*                                                                            */
/*  AC-9: this panel shows rings, rules and kill switches — operator state,   */
/*  never a read on a speaker. Nothing here renders on a student surface.     */
/* -------------------------------------------------------------------------- */

const FOUNDER_EMAIL = "artur@willonski.com";

export default async function AdminRingsPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirectTo=/admin/rings");
  }
  if (user.email?.trim().toLowerCase() !== FOUNDER_EMAIL) notFound();
  return <RingsPanel />;
}
