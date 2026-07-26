import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import PanelShell from "@/components/life/PanelShell";

/**
 * /panel/* — the Life Panel, inside the existing app (spec §1.1: one codebase,
 * one deploy, one session). Signed-in only; the second gate (consent, setup,
 * allowlist) lives in the `/v2/life/state` payload that PanelShell reads.
 *
 * Middleware also enforces the session; this is the server-side safeguard, the
 * same pairing the (protected) group uses.
 */
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirectTo=/panel");

  return <PanelShell>{children}</PanelShell>;
}
