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
  "src/app/api/auth/signup/route.ts",
  "src/app/api/public/unsubscribe/route.ts",
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
]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.isFile() && p.endsWith(".ts") && !p.endsWith(".test.ts")) out.push(p);
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
