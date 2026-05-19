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
import type {
  ChatQueryContrast,
  ChatQueryResponse,
} from "../../src/services/api/chatQuery";

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
   *  Two layers: (a) the ChatQueryResponse type accepts contrast: null    *
   *  (TypeScript verifies at compile-time); (b) no contrast renderer is   *
   *  ever invoked when the field is null. Today contrast UI is DEFERRED   *
   *  per FE Prompt 3's optional deliverable 5 — no renderer exists, so    *
   *  the card is trivially absent. The test passes BUT for an absence-    *
   *  by-default reason; once the contrast UI lands, this case should     *
   *  re-verify the conditional render.                                    *
   * --------------------------------------------------------------------- */
  it("FE-05: contrast: null → no Stress Contrast renderer triggered (absent by default today)", () => {
    const response: ChatQueryResponse = { answer: "ok", contrast: null };
    expect(response.contrast).toBeNull();

    // Confirm no production component currently renders "Stress Contrast"
    // copy when contrast is null. Since the renderer doesn't exist at all,
    // we assert its absence from the source — the "absent in DOM" guarantee
    // today is trivial.
    const hasStressContrastCopy =
      fileContains("app/chat/page.client.tsx", /Stress Contrast/i) ||
      fileContains("services/api/chatQuery.ts", /Stress Contrast/i);
    expect(hasStressContrastCopy).toBe(false);
  });

  /* --------------------------------------------------------------------- *
   *  FE-06  Results / dashboard: contrast: {samples, deltas, sign} →      *
   *         card renders, all 3 deltas visible, sign convention respected.*
   *                                                                       *
   *  Source-inspection assertion: a contrast renderer exists and is       *
   *  wired into the chat surface. Today the contrast UI is deferred per   *
   *  FE Prompt 3 — no renderer exists → probe FAILS, surfacing the gap.   *
   * --------------------------------------------------------------------- */
  it("FE-06: contrast: {deltas} → all 3 deltas rendered in a Stress Contrast card", () => {
    // Fixture matches the BE-3 contract.
    const contrast: ChatQueryContrast = {
      samples: {
        official: { wpm: 100, pitch_hz: 150 },
        casual: { wpm: 80, pitch_hz: 145 },
      },
      deltas: [
        { metric: "wpm", delta: 20, direction: "up" },
        { metric: "pause_ms", delta: 50, direction: "up" },
        { metric: "dynamic_db", delta: 2, direction: "up" },
      ],
    };
    expect(contrast.deltas).toHaveLength(3);

    // Renderer expected to exist in one of these paths. Update the list
    // when the contrast UI lands.
    const candidatePaths = [
      "components/chat/StressContrastCard.tsx",
      "components/results/StressContrastCard.tsx",
      "components/chat/RichBubbles.tsx",
    ];
    let rendererPresent = false;
    for (const p of candidatePaths) {
      try {
        if (fileContains(p, /Stress Contrast/i)) {
          rendererPresent = true;
          break;
        }
      } catch {
        // file doesn't exist — keep looking
      }
    }
    expect.soft(rendererPresent).toBe(true);
    if (!rendererPresent) {
      expect.fail(
        "No Stress Contrast renderer present. Expected a component that " +
          "renders `deltas[].metric + delta + direction` rows when " +
          "ChatQueryResponse.contrast is non-null. FE Prompt 3 deferred " +
          "this; ship when BE-3 starts returning the contrast block."
      );
    }
  });

  /* --------------------------------------------------------------------- *
   *  FE-07  Interview turn bubble: source: 'directives_queue',            *
   *         directive: {position, intent_tag} → attribution badge.        *
   *                                                                       *
   *  Source-inspection: ChatInterview (or any next-question consumer)     *
   *  reads `source` and renders an attribution badge for the              *
   *  `directives_queue` value. Today next-question responses don't        *
   *  carry these fields in the FE typing and no badge component exists.  *
   *  Probe FAILS.                                                         *
   * --------------------------------------------------------------------- */
  it("FE-07: source: 'directives_queue' + directive → attribution badge present", () => {
    // Either ChatInterview reads `source`, OR a separate badge component
    // exists. Either way, the literal "directives_queue" must appear
    // somewhere in the next-question rendering path.
    const consumers = [
      "components/funnel/ChatInterview.tsx",
      "components/chat/RichBubbles.tsx",
      "app/chat/page.client.tsx",
    ];
    let consumerPresent = false;
    for (const p of consumers) {
      try {
        if (fileContains(p, /directives_queue/)) {
          consumerPresent = true;
          break;
        }
      } catch {
        // file doesn't exist (worktree variance) — keep looking
      }
    }
    expect.soft(consumerPresent).toBe(true);
    if (!consumerPresent) {
      expect.fail(
        "No next-question consumer reads `source` or `directive` from the " +
          "BE response. Expected an attribution badge (e.g. " +
          "`<DirectiveAttributionBadge source={response.source} />`) when " +
          "source === 'directives_queue'. ChatInterview currently ignores " +
          "these fields entirely."
      );
    }
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
   *  Source-inspection assertion: ChatInputBar's `send()` calls           *
   *  `setText("")` SYNCHRONOUSLY before awaiting the parent's onSend.    *
   *  This clears the composer's value regardless of whether the parent's *
   *  request succeeds — on error the user loses their typed input.       *
   *  Probe FAILS today: clearing must move INSIDE the parent's success   *
   *  branch (e.g. parent calls a `clearInput` prop on 2xx only).         *
   * --------------------------------------------------------------------- */
  it("FE-10: error response → composer input retained, mic not auto-released", () => {
    // The current ChatInputBar send() clears unconditionally — find the
    // exact line and assert against the pattern that should be there.
    const body = readFileSync(
      join(SRC_ROOT, "components/chat/ChatInputBar.tsx"),
      "utf8"
    );
    // The bug pattern: `setText("")` immediately followed by `mic.cancel()`
    // within the synchronous `send()` body, no await between them and the
    // onSend call.
    const clearsUnconditionally =
      /onSend\(\{[^}]*\}\);\s*setText\(""\);\s*mic\.cancel\(\)/.test(body);
    expect.soft(clearsUnconditionally).toBe(false);
    if (clearsUnconditionally) {
      expect.fail(
        "ChatInputBar.send() clears the composer's text synchronously " +
          "before the parent's async onSend resolves. On error, the user " +
          "loses their typed input. Move setText('') into the success " +
          "branch — either expose a `clearInput` callback the parent calls " +
          "on 2xx, or have ChatInputBar own the request lifecycle and " +
          "clear only after a resolved promise."
      );
    }
  });
});
