import { redirect } from "next/navigation";

/**
 * /coach/corpus — the training corpus left the coach's side (backend N416) for
 * the admin menu's Training corpus page (N511): an old link or bookmark lands
 * there. The admin gate decides who sees it. The old workbench (page.client.tsx) is kept only
 * for the dev harness (/dev/corpus) until the corpus is rebuilt.
 */
export const dynamic = "force-dynamic";

export default function CoachCorpusPage() {
  redirect("/admin/training-corpus");
}
