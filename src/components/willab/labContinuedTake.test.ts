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
    expect(body).toMatch(
      /if \(cached\?\.deck \|\| !cached\?\.arcId \|\| signedIn !== true\) \{\s*setSetupArriving\(false\);/,
    );
  });

  it("can never hold the button forever", () => {
    expect(HOST).toMatch(/setTimeout\(\(\) => setSetupArriving\(false\), 6000\)/);
  });
});
