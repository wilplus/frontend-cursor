import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  Update a project's deck, inside the project (backend N257).               */
/*                                                                            */
/*  PUT /v2/projects/<id>/deck {slides:[{title, body}], presentation_ref}     */
/*  → 200 {project_id, next_take}. The Take count, the coach's history and    */
/*  the plan carry on; the next Take uses the new slides.                     */
/* -------------------------------------------------------------------------- */

export type DeckUpdate =
  | { ok: true; projectId: string; nextTake: number | null }
  | { ok: false };

export async function updateProjectDeck(
  projectId: string,
  deck: { slides: { title: string; body: string }[]; presentationRef: string | null },
): Promise<DeckUpdate> {
  const res = await bffFetch(`/api/v2/projects/${encodeURIComponent(projectId)}/deck`, {
    method: "PUT",
    credentials: "include",
    json: {
      slides: deck.slides.map((s) => ({ title: s.title, body: s.body })),
      presentation_ref: deck.presentationRef,
    },
  });
  if (res.kind !== "response" || !res.ok) return { ok: false };
  const body = (res.body ?? {}) as Record<string, unknown>;
  const nextTake =
    typeof body.next_take === "number" && Number.isInteger(body.next_take) && body.next_take > 0
      ? body.next_take
      : null;
  return {
    ok: true,
    projectId: typeof body.project_id === "string" && body.project_id ? body.project_id : projectId,
    nextTake,
  };
}
