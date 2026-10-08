/* -------------------------------------------------------------------------- */
/*  A CONTINUED TAKE GOES STRAIGHT TO RECORDING (founder 2026-09-28)          */
/*                                                                            */
/*  A later Take opens the Lab and starts by itself: there is no "Start      */
/*  recording" screen to approve (founder 2026-10-07: "delete the screen      */
/*  before second and next take"). The project's setup is fetched after the  */
/*  overlay opens; the start waits for that answer, and never forever, so it  */
/*  never falls into the setup form by racing it. Pinned against the source,  */
/*  like the rest of LabOverlay's host logic, because the overlay needs a     */
/*  live microphone to render.                                                */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const HOST = readFileSync("src/components/willab/LabOverlay.tsx", "utf8");

describe("a later Take starts by itself once the project's setup has arrived", () => {
  it("has no screen to approve: it starts on its own when the setup is in", () => {
    const prerecord = HOST.slice(HOST.indexOf('{state === "lab_prerecord" && ('));
    const block = prerecord.slice(0, prerecord.indexOf("</TrainingAskGate>"));
    expect(block).toMatch(/<ContinuedTakeAutoStart/);
    expect(block).toMatch(/ready=\{!setupArriving\}/);
    expect(block).toMatch(/onStart=\{startContinuedTake\}/);
    expect(block).not.toMatch(/Start recording/);
    expect(block).not.toMatch(/anchors are ready/);
  });

  it("starts exactly once", () => {
    const auto = HOST.slice(HOST.indexOf("function ContinuedTakeAutoStart("));
    const body = auto.slice(0, auto.indexOf("\n}\n"));
    expect(body).toMatch(/if \(!ready \|\| started\.current\) return;/);
    expect(body).toMatch(/started\.current = true;/);
  });

  it("is released when the arc setup read settles, whatever it answered", () => {
    const read = HOST.slice(HOST.indexOf("void fetchArcSetup(aid)"));
    const settle = read.slice(0, read.indexOf("return () =>"));
    expect(settle).toMatch(/\.finally\(\(\) => \{\s*if \(active\) setSetupArriving\(false\);/);
  });

  it("is released at once when no read will run", () => {
    const hydrate = HOST.slice(HOST.indexOf("const cached = readExploreArc(userId);"));
    const body = hydrate.slice(0, hydrate.indexOf("}, [signedIn, userId]);"));
    expect(body).toMatch(/const start = continuedTakeDeck\(cached, signedIn\);/);
    expect(body).toMatch(
      /if \(start\.deck \|\| !cached\?\.arcId \|\| signedIn !== true\) \{\s*setSetupArriving\(false\);/,
    );
  });

  it("starts on a setup the page handed over, and still reads it again behind (P2)", () => {
    const hydrate = HOST.slice(HOST.indexOf("const cached = readExploreArc(userId);"));
    const body = hydrate.slice(0, hydrate.indexOf("}, [signedIn, userId]);"));
    expect(body).toMatch(/revalidateSetupRef\.current = start\.primed;/);
    expect(body).toMatch(/setPreloadDeck\(start\.deck\);/);
    const read = HOST.slice(HOST.lastIndexOf("const aid = initArc?.arcId;"), HOST.indexOf("void fetchArcSetup(aid)"));
    expect(read).toMatch(/\(preloadDeck && !revalidateSetupRef\.current\)/);
  });

  it("can never hold the button forever", () => {
    expect(HOST).toMatch(/setTimeout\(\(\) => setSetupArriving\(false\), 6000\)/);
  });
});

describe("one loader for the whole later-Take wait (build plan D-RC-1)", () => {
  const overlay = HOST.slice(
    HOST.indexOf("export default function LabOverlay"),
    HOST.indexOf("export function RecordingPhase"),
  );

  it("draws Getting your mic ready once, in one place of the column", () => {
    expect(overlay.match(/label=\{RECORDING_COPY\.micReady\}/g)?.length).toBe(1);
    const column = overlay.slice(overlay.indexOf("<div className={`${labColumnClass(state, mic.state.status)}"));
    const slot = column.slice(0, column.indexOf('{state === "lab_feelings"'));
    expect(slot).toMatch(
      /showsMicWait\(state, trainingAsked, mic\.state\.status, mic\.armed, rejectedMsg\) \? \(\s*<LoadingState placement="surface" label=\{RECORDING_COPY\.micReady\} labelVisible \/>/,
    );
  });

  it("leaves the auto-start and the recording phase drawing no loader of their own", () => {
    const auto = HOST.slice(HOST.indexOf("function ContinuedTakeAutoStart("));
    const body = auto.slice(0, auto.indexOf("\n}\n"));
    expect(body).toMatch(/return null;\s*$/);
    expect(body).not.toMatch(/LoadingState/);
    const recording = overlay.slice(overlay.indexOf('{state === "lab_recording" && ('));
    expect(recording.slice(0, recording.indexOf("/>"))).toMatch(/micWaitShownByHost/);
  });
});
