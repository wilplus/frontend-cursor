import ExerciseGapsPage from "./ExerciseGaps";

/**
 * /cms/gaps — which patterns most need an exercise filmed (backend
 * 2026-09-28, step 5). Password-gated in the request body like the rest of
 * the CMS; the client bounces to /cms when the tab has no password.
 */
export const dynamic = "force-dynamic";

export default function ExerciseGapsRoute() {
  return <ExerciseGapsPage />;
}
