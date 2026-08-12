import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/* -------------------------------------------------------------------------- */
/*  THE DOUBLE TAKE (founder 2026-08-12)                                       */
/*                                                                            */
/*  "It really is double analysing the text — this even shows in the chat      */
/*  history that it jumps from 2.0 to 4.0 and there are two recordings there." */
/*                                                                            */
/*  One recording, two takes. The backend has had a collapse guard for this    */
/*  since 2026-08-10 — same `upload_idempotency_key` means same take, echo the */
/*  first session and store nothing twice — and it could never fire, because   */
/*  the key was minted INSIDE the API helper with crypto.randomUUID(). The two */
/*  lanes of one call shared it (they share the form), but a caller-level      */
/*  RETRY built a fresh form, drew a fresh uuid, and the backend correctly     */
/*  minted take N+1 for audio it already had.                                  */
/*                                                                            */
/*  A key generated per attempt is not an idempotency key. It has to be a      */
/*  property of the RECORDING, and the two rules below are what make it one.   */
/* -------------------------------------------------------------------------- */

const API = readFileSync("src/services/api/labRecording.ts", "utf8");
const HOST = readFileSync("src/components/willab/LabOverlay.tsx", "utf8");

describe("the upload key is one per recording, not one per attempt", () => {
  it("the helper prefers the CALLER's key over a fresh uuid", () => {
    expect(API).toMatch(
      /input\.uploadIdempotencyKey \|\| crypto\.randomUUID\(\)/
    );
    // The bare mint must not survive anywhere else in the form builder — it
    // is the exact line that made the backend's guard unreachable.
    const forms = API.match(/form\.append\(\s*"upload_idempotency_key"/g) ?? [];
    expect(forms).toHaveLength(1);
  });

  it("the host keys it on the BLOB, which is the unit that must share one", () => {
    // A retry re-runs the upload effect with the same Blob and must reuse the
    // key; a new recording is a new Blob and must NOT collapse onto the old
    // take. Anything coarser (a per-mount ref) would merge two real takes,
    // which is worse than the bug being fixed.
    expect(HOST).toMatch(/uploadKeyRef = useRef<\{ blob: Blob; key: string \}/);
    expect(HOST).toMatch(/uploadKeyRef\.current\?\.blob !== b/);
    expect(HOST).toMatch(/uploadIdempotencyKey: uploadKeyFor\(blob\)/);
  });

  it("an ancient WebView with no randomUUID still uploads", () => {
    // Degrades to exactly the old behaviour rather than blocking the take:
    // no key, no collapse, one upload.
    expect(HOST).toMatch(/return undefined;/);
    expect(API).toMatch(/catch \{/);
  });
});
