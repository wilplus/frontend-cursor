import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  snippetSlide — the coach's word→slide ground truth (founder 2026-08-11)     */
/*                                                                            */
/*  One call: "the slide ON SCREEN while this snippet was spoken was N", or    */
/*  null to withdraw a correction and hand the take back to the pipeline.      */
/*                                                                            */
/*  This is the only ground truth the slide pipeline will ever be measured     */
/*  against — services/slide_boundary_metrics.py can report exposure and       */
/*  impact but never accuracy without it — so the index goes over the wire as  */
/*  a real number and the backend validates it against the session's own deck. */
/*  Nothing is coerced on the way; an invented row is worse than no row.       */
/*                                                                            */
/*  Never throws: the coach's review must survive a labelling hiccup. `ok`     */
/*  false with a verbatim `error` is a refusal the UI shows; a null error is   */
/*  "no session / transport died", which is not the same thing.                */
/* -------------------------------------------------------------------------- */

export interface SaveSlideResult {
  ok: boolean;
  error: string | null;
}

export async function saveSnippetSlide(
  snippetId: string,
  slideIndex: number | null
): Promise<SaveSlideResult> {
  const result = await bffFetch(
    `/api/v2/coach/snippets/${encodeURIComponent(snippetId)}/slide`,
    { method: "PUT", json: { slide_index: slideIndex }, cache: "no-store" }
  );
  if (result.kind !== "response") return { ok: false, error: null };
  if (result.ok) return { ok: true, error: null };
  const data = result.body as { error?: unknown } | null;
  return {
    ok: false,
    error: typeof data?.error === "string" ? data.error : null,
  };
}
