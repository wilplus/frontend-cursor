#!/usr/bin/env node
/**
 * The single-BFF-idiom ratchet (FE handoff 2026-08-03 §C3.4).
 *
 * Every BFF route must talk to the backend through src/app/api/_lib/backend.ts
 * (callBackend / backendFetch) — no route constructs a backend URL or fetches
 * it directly. Fragmentation is what produced the token-refresh inconsistency;
 * a single helper only stays single if something enforces it.
 *
 * This is a RATCHET, not a big bang: the files below predate the rule and are
 * grandfathered until their batch migrates. The gate fails only on
 *   - a NEW file under src/app/api that fetches the backend directly, or
 *   - a grandfathered file that was touched into a new path (renames count).
 * When you migrate a file to callBackend/backendFetch, delete its baseline
 * entry — the script tells you which entries are stale.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const API_ROOT = "src/app/api";
/** The one file allowed to construct backend URLs + Authorization headers. */
const ALLOWED = new Set([`${API_ROOT}/_lib/backend.ts`]);

/** Grandfathered direct-fetch files (pre-rule). Shrink me, never grow me. */
const BASELINE = new Set([
  "src/app/api/auth/merge-session/route.ts",
  "src/app/api/auth/signup/route.ts",
  "src/app/api/coaching/[coachingId]/route.ts",
  "src/app/api/coaching/start/route.ts",
  "src/app/api/coaching/trial-recording/route.ts",
  "src/app/api/coaching/turn/route.ts",
  "src/app/api/public/shaky-voice/claim/route.ts",
  "src/app/api/public/unsubscribe/route.ts",
  "src/app/api/results/state/route.ts",
  "src/app/api/user/sessions/current/route.ts",
  "src/app/api/v2/admin/learning/proxy.ts",
  "src/app/api/v2/arc/[arcId]/game/answers/route.ts",
  "src/app/api/v2/arc/[arcId]/game/route.ts",
  "src/app/api/v2/arc/[arcId]/game/save/route.ts",
  "src/app/api/v2/auth/merge-session/route.ts",
  "src/app/api/v2/chat/query/route.ts",
  "src/app/api/v2/chat/session-state/route.ts",
  "src/app/api/v2/chat/snippet-followup/route.ts",
  "src/app/api/v2/coach/arc/[arcId]/ideal-text/approve/route.ts",
  "src/app/api/v2/coach/arc/[arcId]/ideal-text/route.ts",
  "src/app/api/v2/coach/arc/[arcId]/publish/route.ts",
  "src/app/api/v2/coach/arc/[arcId]/review-state/route.ts",
  "src/app/api/v2/coach/arc/[arcId]/stars/route.ts",
  "src/app/api/v2/coach/queue/route.ts",
  "src/app/api/v2/coach/sessions/[sessionId]/confidence-queue/route.ts",
  "src/app/api/v2/coach/sessions/[sessionId]/recut/route.ts",
  "src/app/api/v2/coach/sessions/[sessionId]/route.ts",
  "src/app/api/v2/coach/sessions/[sessionId]/save-feedback/route.ts",
  "src/app/api/v2/coach/sessions/[sessionId]/snippets/[snippetId]/breakthrough-video/route.ts",
  "src/app/api/v2/coach/sessions/[sessionId]/snippets/[snippetId]/route.ts",
  "src/app/api/v2/coach/sessions/[sessionId]/video/route.ts",
  "src/app/api/v2/coach/snippets/[snippetId]/confidence-label/route.ts",
  "src/app/api/v2/coach/snippets/[snippetId]/star-verdict/route.ts",
  "src/app/api/v2/coach/students/[userId]/audit-data/route.ts",
  "src/app/api/v2/coach/students/[userId]/route.ts",
  "src/app/api/v2/coach/students/route.ts",
  "src/app/api/v2/coach/training-imports/[sessionId]/route.ts",
  "src/app/api/v2/coach/training-imports/route.ts",
  "src/app/api/v2/coaching/intro-bubble/route.ts",
  "src/app/api/v2/coaching/state-machine/turn/route.ts",
  "src/app/api/v2/config/recording/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/best-presentation/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/blocks/[blockKey]/decide/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/blocks/[blockKey]/select/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/blocks/variants/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/breakthroughs/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/context-document/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/feedback/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/ideal-text/notes/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/ideal-text/revisions/[revision]/restore/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/ideal-text/revisions/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/ideal-text/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/ideal-text/save/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/ideal-text/user-edit/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/pieces/[pieceKey]/swap/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/prior-take/decide/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/progress/route.ts",
  "src/app/api/v2/explore/arc/[arcId]/setup/route.ts",
  "src/app/api/v2/internal/journal/community/delete/route.ts",
  "src/app/api/v2/internal/journal/community/generate/route.ts",
  "src/app/api/v2/internal/journal/community/list/route.ts",
  "src/app/api/v2/internal/journal/community/update/route.ts",
  "src/app/api/v2/internal/journal/image/delete/route.ts",
  "src/app/api/v2/internal/journal/image/generate/route.ts",
  "src/app/api/v2/internal/journal/image/list/route.ts",
  "src/app/api/v2/internal/journal/image/select/route.ts",
  "src/app/api/v2/internal/journal/media/presign/route.ts",
  "src/app/api/v2/internal/journal/posts/create/route.ts",
  "src/app/api/v2/internal/journal/posts/delete/route.ts",
  "src/app/api/v2/internal/journal/posts/get/route.ts",
  "src/app/api/v2/internal/journal/posts/list/route.ts",
  "src/app/api/v2/internal/journal/posts/publish/route.ts",
  "src/app/api/v2/internal/journal/posts/unpublish/route.ts",
  "src/app/api/v2/internal/journal/posts/update/route.ts",
  "src/app/api/v2/internal/journal/reorder/route.ts",
  "src/app/api/v2/internal/journal/revalidate/route.ts",
  "src/app/api/v2/journal/posts/route.ts",
  "src/app/api/v2/lab/recordings/[sessionId]/events/route.ts",
  "src/app/api/v2/life/[...path]/route.ts",
  "src/app/api/v2/tokens/checkout/route.ts",
  "src/app/api/v2/tokens/proxy.ts",
  "src/app/api/v2/user/audits/route.ts",
  "src/app/api/v2/user/game-sessions/route.ts",
  "src/app/api/v2/user/last-setup/route.ts",
  "src/app/api/v2/user/lounge/messages/route.ts",
  "src/app/api/v2/user/presentations/[presentationId]/route.ts",
  "src/app/api/v2/user/presentations/[presentationId]/takes/[takeNumber]/route.ts",
  "src/app/api/v2/user/recording-progress/route.ts",
  "src/app/api/v2/user/sessions/[sessionId]/transcript-edits/route.ts",
  "src/app/api/v2/user/snippets/[snippetId]/confidence-review/route.ts",
  "src/app/api/v2/user/snippets/[snippetId]/suggestion-feedback/route.ts",
  "src/app/api/v2/user/strengths/route.ts",
  "src/app/api/v2/user/trainings/route.ts",
]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.isFile() && p.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** A direct backend fetch: the file both fetches AND names the backend base. */
function isDirectBackendFetch(content) {
  return /fetch\s*\(/.test(content) && /getBackendUrl|BACKEND_URL/.test(content);
}

const violations = [];
const grandfathered = [];
for (const file of walk(API_ROOT)) {
  const rel = relative(".", file).replace(/\\/g, "/");
  if (ALLOWED.has(rel)) continue;
  if (!isDirectBackendFetch(readFileSync(file, "utf8"))) continue;
  (BASELINE.has(rel) ? grandfathered : violations).push(rel);
}

const stale = [...BASELINE].filter(
  (rel) => !existsSync(rel) || !grandfathered.includes(rel)
);

if (stale.length > 0) {
  console.log(
    `check-bff-single-idiom: ${stale.length} baseline entr${stale.length === 1 ? "y is" : "ies are"} clean now — tighten the ratchet by deleting from BASELINE:`
  );
  for (const rel of stale) console.log(`  - ${rel}`);
}
console.log(
  `check-bff-single-idiom: ${grandfathered.length} grandfathered direct-fetch file(s) remain (migrate in batches, handoff §C3).`
);

if (violations.length > 0) {
  console.error(
    "\ncheck-bff-single-idiom: FAIL — new direct backend fetch outside src/app/api/_lib/backend.ts:"
  );
  for (const rel of violations) console.error(`  - ${rel}`);
  console.error(
    "\nRoute all backend calls through callBackend() (JSON proxy) or backendFetch() (streaming/upload) from @/app/api/_lib/backend."
  );
  process.exit(1);
}
console.log("check-bff-single-idiom: OK");
