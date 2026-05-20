/**
 * Structural Response Probe v1 — frontend half of the BE/FE structural eval pair.
 *
 * Goal: confirm each documented BE→FE response contract is actually
 * consumed by the FE, not silently swallowed. Each case feeds a fixture
 * shape into the relevant FE consumer and asserts the observable
 * downstream of that consumption — a toolbar mode flag, a rendered
 * bubble string, a console.warn for a contract violation, an absent
 * UI surface.
 *
 * Constraint reality: the repo today has NO RTL / jsdom / happy-dom
 * dependency (every existing *.test.ts is a pure-function test against
 * vitest). C1 ("zero new dependencies") bars adding RTL, so the probe
 * is implemented at the DATA layer + SOURCE-INSPECTION layer instead
 * of the DOM layer. This is a meaningful constraint: cases that need
 * to assert a rendered element directly (FE-04 console.warn, FE-06
 * delta strings, FE-07 attribution badge, FE-10 input retention) are
 * implemented by exercising the data path the component consumes and
 * grepping the source for the validator/renderer the contract
 * requires. A failing assertion here flags a REAL contract gap; the
 * probe stays honest about what it can and can't verify.
 *
 * Cross-reference: each fixture matches the backend's actual response
 * shape today, sourced from earlier audits of the v2 routes (chat/query,
 * chat/snippet-followup, public/interview/next-question, user/results).
 *
 * Run: `npm test tests/evals/structural-response-probe.test.ts`
 * Target: <10s, deterministic, zero network.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { deriveToolbar } from "../../src/components/chat/thread/toolbar";
import { splitAiBubbleText } from "../../src/lib/chat/bubbleSplit";
import { parseStressContrast } from "../../src/lib/chat/stressContrast";
import type { ChatQueryResponse } from "../../src/services/api/chatQuery";

// ---------------------------------------------------------------------------
// C3 — zero network. Fail loud if any code path attempts a real fetch.
// ---------------------------------------------------------------------------
beforeAll(() => {
  global.fetch = vi.fn(() => {
    throw new Error("network not allowed in structural probe");
  }) as unknown as typeof fetch;
});

let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Helpers — source inspection (read-only). Used by cases where the contract
// is "no consumer of field X currently exists" or "renderer Y is absent".
// ---------------------------------------------------------------------------
const SRC_ROOT = join(__dirname, "..", "..", "src");

function fileContains(relPath: string, needle: string | RegExp): boolean {
  const abs = join(SRC_ROOT, relPath);
  const body = readFileSync(abs, "utf8");
  return typeof needle === "string" ? body.includes(needle) : needle.test(body);
}

function anyFileContains(
  relPaths: string[],
  needle: string | RegExp
): boolean {
  return relPaths.some((p) => fileContains(p, needle));
}

// ---------------------------------------------------------------------------

describe("Structural Response Probe v1", () => {
  /* --------------------------------------------------------------------- *
   *  FE-01  Chat input panel: show_upload_ui=false → mic visible,         *
   *                            paperclip absent.                          *
   *                                                                       *
   *  Data-layer assertion: deriveToolbar maps show_upload_ui=false to     *
   *  `{kind: "composer", showUpload: false}`. ChatInputBar is wired to    *
   *  render the paperclip only when its `onUploadFile` prop is set,       *
   *  which ChatPageClient sets only when `mode.showUpload === true`.      *
   * --------------------------------------------------------------------- */
  it("FE-01: show_upload_ui=false → composer.showUpload=false (paperclip omitted)", () => {
    const mode = deriveToolbar({
      phase: "q_and_a",
      bubbles: [],
      reviewLoadedForActiveSession: false,
      showUploadUi: false,
      pendingFollowUp: false,
    });
    expect(mode).toEqual({ kind: "composer", showUpload: false });
    // ChatInputBar's render path: paperclip rendered iff `onUploadFile`
    // prop is set; the parent passes `onUploadFile={mode.showUpload ? ... : undefined}`.
    // Verify the wiring is still that shape (no silent bypass added).
    expect(
      fileContains(
        "app/chat/page.client.tsx",
        /mode\.showUpload\s*\?\s*handleQAFileUpload/
      )
    ).toBe(true);
  });

  /* --------------------------------------------------------------------- *
   *  FE-02  Chat input panel: show_upload_ui=true → paperclip visible.    *
   * --------------------------------------------------------------------- */
  it("FE-02: show_upload_ui=true → composer.showUpload=true (paperclip rendered)", () => {
    const mode = deriveToolbar({
      phase: "q_and_a",
      bubbles: [],
      reviewLoadedForActiveSession: false,
      showUploadUi: true,
      pendingFollowUp: false,
    });
    expect(mode).toEqual({ kind: "composer", showUpload: true });
  });

  /* --------------------------------------------------------------------- *
   *  FE-03  Snippet labeling bubble: followup_text rendered verbatim;     *
   *         debug object NOT bled into user-facing text.                  *
   *                                                                       *
   *  Data-layer assertion: splitAiBubbleText is the only stage between    *
   *  the API response's followup_text and the bubble bodies the user      *
   *  sees. Feed the fixture's followup_text through and confirm (a) the   *
   *  text round-trips, (b) no field from `debug` ever appears.            *
   * --------------------------------------------------------------------- */
  it("FE-03: followup_text → bubbles render text exactly; debug not in DOM", () => {
    const fixture = {
      followup_text: "Why do you think that landed?",
      debug: {
        model: "gpt-4o-mini",
        user_label_interpretation: "agreement",
      },
    };
    const bubbles = splitAiBubbleText(fixture.followup_text);
    const joined = bubbles.join(" ");
    expect(joined).toBe("Why do you think that landed?");
    // The debug object is a sibling field; nothing in the rendering
    // pipeline should ever read it for user-visible output.
    expect(joined).not.toContain("gpt-4o-mini");
    expect(joined).not.toContain("user_label_interpretation");
    expect(joined).not.toContain("agreement");
  });

  /* --------------------------------------------------------------------- *
   *  FE-04  Snippet bubble + debug.user_label_interpretation: "type"      *
   *         (contract violation) MUST emit console.warn.                  *
   *                                                                       *
   *  Source-inspection assertion: every FE consumer of /v2/chat/snippet-  *
   *  followup must read `data.debug.user_label_interpretation` and warn   *
   *  when it is not "agreement". Today no consumer reads or validates    *
   *  the field → this probe FAILS, surfacing the gap.                    *
   *                                                                       *
   *  This is the "silent contract tolerance" failure mode the probe       *
   *  exists to catch. Do NOT patch in this commit — fix in a separate    *
   *  follow-up PR by adding a guard at the consumer of snippet-followup. *
   * --------------------------------------------------------------------- */
  it("FE-04: debug.user_label_interpretation: 'type' triggers console.warn (contract violation)", () => {
    // Files that consume /v2/chat/snippet-followup responses today.
    const consumers = ["app/chat/page.client.tsx"];
    const validatorPresent = anyFileContains(
      consumers,
      /user_label_interpretation/
    );
    // FAILS today: no validator exists for user_label_interpretation.
    expect.soft(validatorPresent).toBe(true);
    if (!validatorPresent) {
      // Concrete diff for the report: name the expected pattern + the file
      // where the validator should live.
      expect.fail(
        "No consumer of /v2/chat/snippet-followup validates " +
          "debug.user_label_interpretation. Expected a guard along the lines " +
          "of `if (data.debug?.user_label_interpretation !== 'agreement') " +
          "console.warn('snippet-followup contract violation: ...')` inside " +
          "app/chat/page.client.tsx's handleSnippetLabel."
      );
    }
  });

  /* --------------------------------------------------------------------- *
   *  FE-05  Results / dashboard: contrast: null → no Stress Contrast      *
   *         card in render path.                                          *
   *                                                                       *
   *  Two layers: (a) `parseStressContrast(null)` returns null, so the     *
   *  reviewing-fetch's `if (contrastData) appendBubble(...)` gate keeps   *
   *  the card out of the bubbles array entirely — never rendered, not    *
   *  just CSS-hidden (matrix C7). (b) The chat consumer wraps the gate    *
   *  in exactly that shape, so we can grep for it.                       *
   * --------------------------------------------------------------------- */
  it("FE-05: contrast: null → parseStressContrast gates the bubble append", () => {
    // Pure-function half of the assertion — null in, null out.
    const parsed = parseStressContrast(null);
    expect(parsed).toBeNull();

    // Consumer half — page.client.tsx must wrap the append in a
    // truthiness gate so contrast: null skips the bubble entirely.
    expect(
      fileContains(
        "app/chat/page.client.tsx",
        /parseStressContrast\([\s\S]*?\)/
      )
    ).toBe(true);
    expect(
      fileContains(
        "app/chat/page.client.tsx",
        /if\s*\(\s*contrastData\s*\)/
      )
    ).toBe(true);
  });

  /* --------------------------------------------------------------------- *
   *  FE-06  Results / dashboard: contrast: {samples, deltas, sign} →      *
   *         card renders, all 3 deltas visible, sign convention respected.*
   *                                                                       *
   *  Data-layer assertion: `parseStressContrast` accepts the exact BE-3   *
   *  shape, returns three rows in the order BE emits, and the renderer   *
   *  component exists with the "Stress Contrast" header copy. Sign       *
   *  convention is hard-coded in `formatStressContrastRow` — positive    *
   *  delta produces "under pressure" interpretation strings, verified    *
   *  by stressContrast.test.ts.                                          *
   * --------------------------------------------------------------------- */
  it("FE-06: contrast: {deltas} → parses 3 rows + renderer present + reviewing-fetch appends", () => {
    // (1) BE-3 shape parses cleanly to three rows.
    const parsed = parseStressContrast({
      samples: { official: 5, casual: 5 },
      deltas: {
        wpm_delta: 20,
        pause_ms_delta: 50,
        dynamic_db_delta: 2,
      },
      sign_convention: "positive_delta_means_official_greater_than_casual",
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.rows).toHaveLength(3);
    expect(parsed!.rows.map((r) => r.metric)).toEqual([
      "wpm",
      "pause_ms",
      "dynamic_db",
    ]);

    // (2) Renderer component is present in the source. Single-source
    // path now that the bubble model is unified — StressContrastBubble
    // lives in RichBubbles.tsx and is mounted by ThreadView.
    expect(
      fileContains("components/chat/RichBubbles.tsx", /Stress Contrast/i)
    ).toBe(true);
    expect(
      fileContains(
        "components/chat/RichBubbles.tsx",
        /export function StressContrastBubble/
      )
    ).toBe(true);
    expect(
      fileContains(
        "components/chat/thread/ThreadView.tsx",
        /StressContrastBubble/
      )
    ).toBe(true);

    // (3) BFF must request the optional contrast block from upstream.
    expect(
      fileContains(
        "app/api/results/[sessionId]/snippets/route.ts",
        /include_contrast=true/
      )
    ).toBe(true);
  });

  /* --------------------------------------------------------------------- *
   *  FE-07  Interview turn bubble: source: 'directives_queue',            *
   *         directive: {position, intent_tag} → attribution surfaced.     *
   *                                                                       *
   *  Two-part check:                                                       *
   *    (1) InterviewQuestion type carries the source / directive fields  *
   *        — guarantees TypeScript callers can read them without `any`.   *
   *    (2) ChatInterview imports `logQuestionAttribution` and calls it    *
   *        on every fetch, so admin-steered turns surface in the dev      *
   *        console. The helper itself owns the literal source-enum        *
   *        strings (directives_queue / admin_override / llm_generated).   *
   *                                                                       *
   *  Admin-visible attribution badge in the user's transcript view is a   *
   *  follow-up (matrix BS doc) — out of scope for the probe-close commit. *
   * --------------------------------------------------------------------- */
  it("FE-07: source: 'directives_queue' + directive → typed + logged via questionAttribution", () => {
    // (1) Public client type carries source + directive fields.
    expect(
      fileContains("lib/api/public-client.ts", /source\?:\s*["']?directives_queue/)
    ).toBe(true);
    expect(
      fileContains(
        "lib/api/public-client.ts",
        /directive\?:\s*\{[^}]*position[^}]*intent_tag/
      )
    ).toBe(true);

    // (2) ChatInterview imports + calls the attribution logger.
    expect(
      fileContains(
        "components/funnel/ChatInterview.tsx",
        /logQuestionAttribution/
      )
    ).toBe(true);

    // (3) The attribution helper owns the source-enum literal so any
    // future renderer can grep the helper for the source-string set.
    expect(
      fileContains("lib/chat/questionAttribution.ts", /directives_queue/)
    ).toBe(true);
  });

  /* --------------------------------------------------------------------- *
   *  FE-08  Interview turn bubble: source: 'admin_override', no directive *
   *         field → no crash, no console.error.                           *
   *                                                                       *
   *  Vacuously safe today (FE doesn't read either field, so absence       *
   *  can't crash anything). Verified via console.error spy.               *
   * --------------------------------------------------------------------- */
  it("FE-08: source: 'admin_override' with no directive → no crash, no console.error", () => {
    // Simulate consumption of a next-question response without `directive`.
    // FE today ignores both fields, so the only way to fail this case is
    // for some code path to console.error on import or static analysis.
    const fixture = {
      question: "How did that land?",
      source: "admin_override" as const,
      tone: "charisma" as const,
      turn_number: 3,
      // intentionally no `directive` key
    };
    expect(fixture).toHaveProperty("question");
    expect(fixture).not.toHaveProperty("directive");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  /* --------------------------------------------------------------------- *
   *  FE-09  Interview turn bubble: source: 'llm_generated' → no badge.    *
   *                                                                       *
   *  Trivially true today — no badge component exists at all, so          *
   *  there's nothing to render for any source value. Documenting as a    *
   *  passes-for-wrong-reason case: once FE-07 is implemented and a       *
   *  badge component lands, this test must continue to pass (badge       *
   *  rendered only for non-llm sources).                                  *
   * --------------------------------------------------------------------- */
  it("FE-09: source: 'llm_generated' → no attribution badge in DOM", () => {
    // Vacuously true today. Pinned so FE-07's implementation doesn't
    // accidentally add a badge that fires for every source.
    const consumers = [
      "components/funnel/ChatInterview.tsx",
      "components/chat/RichBubbles.tsx",
    ];
    const hasLlmGeneratedBadge = consumers.some((p) => {
      try {
        return fileContains(p, /llm_generated.*badge|badge.*llm_generated/i);
      } catch {
        return false;
      }
    });
    expect(hasLlmGeneratedBadge).toBe(false);
  });

  /* --------------------------------------------------------------------- *
   *  FE-10  Chat input panel: error response → input retained, mic NOT    *
   *         auto-released.                                                *
   *                                                                       *
   *  Source-inspection: ChatInputBar.send() must AWAIT onSend, branch    *
   *  on its result, and clear the composer ONLY on success. The parent  *
   *  (handleQASend) returns Promise<boolean> so the bar can tell        *
   *  "succeeded" vs "rendered error inline" apart.                      *
   * --------------------------------------------------------------------- */
  it("FE-10: error response → composer text retained (setText guarded by success)", () => {
    const body = readFileSync(
      join(SRC_ROOT, "components/chat/ChatInputBar.tsx"),
      "utf8"
    );

    // The bug pattern: synchronous `setText("")` right after onSend
    // with no await / branching. If this regex matches we're back to
    // the buggy shape.
    const clearsUnconditionally =
      /onSend\(\{[^}]*\}\);\s*setText\(""\);\s*mic\.cancel\(\)/.test(body);
    expect.soft(clearsUnconditionally).toBe(false);
    if (clearsUnconditionally) {
      expect.fail(
        "ChatInputBar.send() clears the composer's text synchronously " +
          "before the parent's async onSend resolves. On error, the user " +
          "loses their typed input."
      );
    }

    // Positive pattern: send() is async, awaits onSend, and clears
    // inside a success branch.
    expect(body).toMatch(/const\s+send\s*=\s*async/);
    expect(body).toMatch(/await\s+onSend\(/);
    expect(body).toMatch(/if\s*\(\s*ok\s*\)\s*\{[\s\S]*?setText\(""\)/);

    // Parent contract: handleQASend returns Promise<boolean> so the
    // composer can distinguish success from inline-rendered errors.
    const pageBody = readFileSync(
      join(SRC_ROOT, "app/chat/page.client.tsx"),
      "utf8"
    );
    expect(pageBody).toMatch(/handleQASend[\s\S]{0,400}Promise<boolean>/);
  });

  /* --------------------------------------------------------------------- *
   *  FE-11  Chat input panel: show_record_ui=true → mic emphasized        *
   *         (record-ready state); paperclip absent (Rule G ⊕ Rule I       *
   *         mutex on the FE side too).                                    *
   *                                                                       *
   *  Two layers:                                                          *
   *  (a) Data-layer mutex: deriveToolbar with showUploadUi=false yields   *
   *      `{composer, showUpload: false}` regardless of show_record_ui.    *
   *      show_record_ui rides on a sibling state slot (`emphasizeMic`),   *
   *      not the composer's paperclip slot, so the two flags are          *
   *      genuinely orthogonal at the FE wire — the mutex is a backend     *
   *      convention. FE just must honor each flag independently.          *
   *  (b) Source-layer wiring: page.client.tsx reads                       *
   *      `data.show_record_ui === true` off the /chat/query response,     *
   *      threads it into `showRecordUi` state, and passes that as the     *
   *      `emphasizeMic` prop on ChatInputBar; ChatInputBar gates the      *
   *      pulse/ring styling on the idle mic button by that prop.          *
   * --------------------------------------------------------------------- */
  it("FE-11: show_record_ui=true → emphasizeMic plumbed; paperclip stays absent (mutex)", () => {
    // Pin the fixture shape against the typed response so any backend
    // contract drift trips the compiler before this test runs.
    const fixture: ChatQueryResponse = {
      answer: "Sure — tap the mic to record.",
      show_upload_ui: false,
      show_record_ui: true,
    };
    expect(fixture.show_record_ui).toBe(true);
    expect(fixture.show_upload_ui).toBe(false);

    // (a) Data-layer: with show_upload_ui=false the composer doesn't
    // request a paperclip, regardless of show_record_ui's value.
    const mode = deriveToolbar({
      phase: "q_and_a",
      bubbles: [],
      reviewLoadedForActiveSession: false,
      showUploadUi: fixture.show_upload_ui === true,
      pendingFollowUp: false,
    });
    expect(mode).toEqual({ kind: "composer", showUpload: false });

    // (b) Source-layer wiring: parent reads show_record_ui and forwards
    // the value to ChatInputBar's emphasizeMic prop.
    expect(
      fileContains(
        "app/chat/page.client.tsx",
        /setShowRecordUi\(\s*data\.show_record_ui\s*===\s*true\s*\)/
      )
    ).toBe(true);
    expect(
      fileContains("app/chat/page.client.tsx", /emphasizeMic=\{showRecordUi\}/)
    ).toBe(true);

    // ChatInputBar accepts the prop and gates the idle-mic ring/pulse
    // styling on it. Two cheap source checks: the prop exists, and the
    // primary-tint ring styling is wired behind it.
    expect(
      fileContains(
        "components/chat/ChatInputBar.tsx",
        /emphasizeMic\?:\s*boolean/
      )
    ).toBe(true);
    expect(
      fileContains("components/chat/ChatInputBar.tsx", /ring-primary/)
    ).toBe(true);
  });
});
