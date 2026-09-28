/* -------------------------------------------------------------------------- */
/*  A CONTINUED TAKE GOES STRAIGHT TO RECORDING (founder 2026-09-28)          */
/*                                                                            */
/*  "Record Take 2" opens the Lab on one "Start recording" tap. The project's */
/*  setup is fetched after the overlay opens, and a tap that beat it found no */
/*  setup and fell into the whole setup form, already filled in by the answer */
/*  that landed a moment later. The tap now waits for that answer, and never  */
/*  forever. Pinned against the source, like the rest of LabOverlay's host    */
/*  logic, because the overlay needs a live microphone to render.             */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const HOST = readFileSync("src/components/willab/LabOverlay.tsx", "utf8");

describe("Start recording waits for the project's setup", () => {
  it("is disabled while the setup is still arriving", () => {
    const prerecord = HOST.slice(HOST.indexOf('{state === "lab_prerecord" && ('));
    const button = prerecord.slice(0, prerecord.indexOf("Start recording"));
    expect(button).toMatch(/onClick=\{startContinuedTake\}/);
    expect(button).toMatch(/disabled=\{setupArriving\}/);
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
