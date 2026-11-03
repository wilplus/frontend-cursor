import { redirect } from "next/navigation";

/**
 * /coach/corpus — the training corpus left the coach's side for the CEO panel
 * (backend N416): an old link or bookmark lands there. The CEO panel's own
 * gate decides who sees it. The old workbench (page.client.tsx) is kept only
 * for the dev harness (/dev/corpus) until the corpus is rebuilt.
 */
export const dynamic = "force-dynamic";

export default function CoachCorpusPage() {
  redirect("/admin/ceo");
}
