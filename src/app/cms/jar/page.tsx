import ExerciseJarPage from "./ExerciseJar";

/**
 * /cms/jar — how full the exercise learning jar is (founder 2026-09-29,
 * decision 5). Counts only, never an outcome. Password-gated in the request
 * body like the rest of the CMS; the client bounces to /cms when the tab has
 * no password.
 */
export const dynamic = "force-dynamic";

export default function ExerciseJarRoute() {
  return <ExerciseJarPage />;
}
