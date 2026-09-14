#!/usr/bin/env node
/**
 * The single-BFF-idiom ratchet (FE handoff 2026-08-03 §C3.4).
 *
 * Every BFF route must talk to the backend through src/app/api/_lib/backend.ts
 * (callBackend / backendFetch) — no route constructs a backend URL or fetches
 * it directly. Fragmentation is what produced the token-refresh inconsistency;
 * a single helper only stays single if something enforces it.
 *
 * The migration finished in audit Q-A8 (Phase 4): the grandfathered baseline
 * is empty and must stay empty. The gate fails on any file under src/app/api
 * that
 *   - both calls `fetch(` and names the backend base (getBackendUrl,
 *     BACKEND_URL*, NEXT_PUBLIC_API_URL), or
 *   - mentions getBackendUrl at all — a route never needs the base URL.
 * The one exception is getAuth.ts, which re-exports getBackendUrl for the
 * server-side ISR readers under src/services/api (not BFF routes).
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const API_ROOT = "src/app/api";
/** The one file allowed to construct backend URLs + Authorization headers. */
const ALLOWED = new Set([`${API_ROOT}/_lib/backend.ts`]);
/** May mention getBackendUrl (a re-export), but must not fetch. */
const MAY_NAME_BASE = new Set([`${API_ROOT}/getAuth.ts`]);

/** Grandfathered direct-fetch files (pre-rule). Emptied in Q-A8; never grow me. */
const BASELINE = new Set([]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.isFile() && p.endsWith(".ts") && !p.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

/** A direct backend fetch: the file both fetches AND names the backend base.
 *  `\bfetch(` so that `backendFetch(` — the sanctioned raw call — is not a
 *  fetch of its own. */
function isDirectBackendFetch(content) {
  return (
    /\bfetch\s*\(/.test(content) &&
    /getBackendUrl|BACKEND_URL|NEXT_PUBLIC_API_URL/.test(content)
  );
}

function namesBase(content) {
  return /\bgetBackendUrl\b/.test(content);
}

const violations = [];
const grandfathered = [];
for (const file of walk(API_ROOT)) {
  const rel = relative(".", file).replace(/\\/g, "/");
  if (ALLOWED.has(rel)) continue;
  const content = readFileSync(file, "utf8");
  const offends =
    isDirectBackendFetch(content) || (!MAY_NAME_BASE.has(rel) && namesBase(content));
  if (!offends) continue;
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
  `check-bff-single-idiom: ${grandfathered.length} grandfathered direct-fetch file(s) remain.`
);

if (violations.length > 0) {
  console.error(
    "\ncheck-bff-single-idiom: FAIL — a backend fetch or base URL outside src/app/api/_lib/backend.ts:"
  );
  for (const rel of violations) console.error(`  - ${rel}`);
  console.error(
    "\nRoute all backend calls through callBackend() (JSON proxy) or backendFetch() (streaming/upload) from @/app/api/_lib/backend."
  );
  process.exit(1);
}
console.log("check-bff-single-idiom: OK");
