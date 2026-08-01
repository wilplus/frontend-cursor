import PanelShell from "@/components/life/PanelShell";

/**
 * /panel/* — the Life Panel, inside the existing app (spec §1.1: one codebase,
 * one deploy, one session).
 *
 * DELIBERATELY NO SERVER CODE, and that absence is load-bearing (founder
 * 2026-08-02, "make it ultra fast"). This layout used to call
 * `supabase.auth.getUser()` per request, which reads cookies and therefore
 * forced every /panel route to build DYNAMIC — so every pill tap paid a server
 * round trip for the route payload and flashed `loading.tsx` while it flew,
 * which is exactly the delay the founder was feeling. With no dynamic API in
 * the segment, every panel page builds STATIC, the pill row's links prefetch
 * them fully, and a tap is a pure client-side swap: the route is already here,
 * and the data is already warm (lib/life/panelCache). A state change, not a
 * navigation.
 *
 * Auth is not weakened, it is just not duplicated a third time:
 *   · middleware.ts lists /panel in PROTECTED_ROUTES, so a signed-out request
 *     never reaches this layout — it is redirected to /login at the edge;
 *   · every byte of panel DATA comes through /api/v2/life/*, which answers
 *     401/404 on its own and renders nothing (N1) — the static shell holds no
 *     content of anyone's.
 * The removed check was the same pairing the (protected) group uses, but that
 * group's pages render user data on the SERVER; these pages render nothing
 * until the client's own authed reads come back, so the server-side half had
 * no job here beyond slowing every tap.
 */
export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PanelShell>{children}</PanelShell>;
}
