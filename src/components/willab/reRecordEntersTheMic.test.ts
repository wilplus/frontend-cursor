import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/* -------------------------------------------------------------------------- */
/*  "IT YET AGAIN OPENS UP THE WAITING SCREEN" (founder 2026-08-12)             */
/*                                                                            */
/*  "And after clicking the record button - it yet again opens up the waiting   */
/*  screen instead of just bringing me to the recording page!"                 */
/*                                                                            */
/*  THE MECHANISM. `useDualCaptureMic` parks on {status:"stopped",             */
/*  audioBlob:<that take>} once a take ends, and NOTHING on the stop →         */
/*  processing → readout path moves it off that state. LabOverlay's transition  */
/*  effect fires "stopped && state === lab_recording → goTo(lab_processing)",   */
/*  which is correct for the take that just ended and catastrophic for every    */
/*  entry after it: tapping Record put the student back into lab_recording,     */
/*  the effect ran on its first render, saw the PREVIOUS take's blob still      */
/*  sitting there, and bounced them straight into the waiting screen — before   */
/*  getUserMedia had even resolved. The record button never got a chance to be  */
/*  a record button.                                                          */
/*                                                                            */
/*  TWO GUARDS, deliberately. Cancelling the mic before entering fixes the two  */
/*  entries we know about; the once-per-blob ref makes the hazard unreachable   */
/*  for the third one somebody adds later. A source scan because this screen    */
/*  needs a live mic and a submitted setup form — nothing in jsdom can render   */
/*  it, which is exactly how the hazard survived this long.                    */
/* -------------------------------------------------------------------------- */

const LAB = readFileSync("src/components/willab/LabOverlay.tsx", "utf8");

/** The transition effect that drives the flow off the mic state machine. */
const EFFECT = LAB.slice(
  LAB.indexOf("// Drive flow transitions off the mic state machine."),
  LAB.indexOf("// FE-2 GUARD (founder 2026-07-22)")
);

describe("re-record enters the MICROPHONE, never the waiting screen", () => {
  it("the stop→processing branch acts once per BLOB, not once per render", () => {
    expect(EFFECT).toMatch(/s\.audioBlob !== consumedBlobRef\.current/);
    expect(EFFECT).toMatch(/consumedBlobRef\.current = s\.audioBlob;/);
    // The ref is CLAIMED before the transition, not after it — the effect can
    // re-run before goTo lands.
    expect(EFFECT.indexOf("consumedBlobRef.current = s.audioBlob"))
      .toBeLessThan(EFFECT.indexOf('goTo("lab_processing")'));
  });

  it("it is a ref, not state — claiming the blob must not re-run the effect", () => {
    expect(LAB).toMatch(/const consumedBlobRef = useRef<Blob \| null>\(null\);/);
  });

  it("EVERY entry into lab_recording resets the mic first", () => {
    // A stale "stopped" is the input the branch above trips on, so the entries
    // must not hand it one. Each `goTo("lab_recording")` that then starts the
    // mic has to cancel it first — cancel() puts the mic back to "idle", which
    // is the state RecordingPhase's "Getting your mic ready…" covers while
    // getUserMedia resolves.
    const entries = [...LAB.matchAll(/goTo\("lab_recording"\);\n\s*void mic\.start\(\);/g)];
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const m of entries) {
      const before = LAB.slice(Math.max(0, m.index! - 700), m.index!);
      expect(before).toMatch(/cancelMic\(\);/);
    }
  });

  it("the record button goes to the recorder, never to a waiting screen", () => {
    // The literal shape of the bug: an entry that routes to lab_processing
    // instead of lab_recording, or one that starts the mic and never enters.
    expect(LAB).not.toMatch(/goTo\("lab_processing"\);\n\s*void mic\.start\(\);/);
  });
});
