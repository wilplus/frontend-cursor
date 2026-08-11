import { getAuthToken } from "@/lib/api/auth-client";

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
  const token = await getAuthToken();
  if (!token) return { ok: false, error: null };
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/snippets/${encodeURIComponent(snippetId)}/slide`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slide_index: slideIndex }),
        cache: "no-store",
      }
    );
  } catch {
    return { ok: false, error: null };
  }
  if (res.ok) return { ok: true, error: null };
  const data = (await res.json().catch(() => null)) as {
    error?: unknown;
  } | null;
  return {
    ok: false,
    error: typeof data?.error === "string" ? data.error : null,
  };
}
