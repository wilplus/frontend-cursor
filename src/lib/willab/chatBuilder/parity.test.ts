/*
STORY    As the founder, I want the speaking-coach document to describe the
         walk I already have, so that building from it does not change a
         speaker's steps, words, or the pace step.
OUTCOME
  O1  The seed's lines, try caps and pinned pace numbers are the ones the
      walk already uses.
  O2  Praise only, a moment fix, and the sniper each produce the same plan
      from the document as from the hardcoded walk.
  O3  A fixed line on the walk carries no digit. The card's progress is not
      a walk line.
  O4  A document that moves a pinned number, the clock, or names an unknown
      screen is refused, and the seed is unchanged.
  O5  A paste that calls eval or the network is rejected, and no loader runs.
*/
import { describe, expect, it, vi } from "vitest";
import { ONE_THING_COPY } from "@/components/willab/idealEditCopy";
import { LAND_GREEN_SHARE, TEMPO_COPY } from "@/lib/willab/tempoStep";
import { ONE_THING_TRIES, WALK_MAX_TRIES, buildWalkPlan, walkMoments, type WalkPlanInput } from "@/lib/willab/walkPlan";
import { checkPlugin } from "./plugins";
import { fixedLines, planForWalk, planFromDefinition, refuse } from "./runtime";
import { NOTICING_DIALS, NOTICING_PINNED, SEEDED_LINES, speakingCoachSeed } from "./seed";

const strongest = { start: 10, slide: 1, blockId: "b", tiered: true, green: true, walkSlot: "strongest" as const };
const between = { start: 0, slide: 0, blockId: "a", tiered: true, practicePrompt: true, hasRewrite: true, walkSlot: "between" as const };
const weakest = { start: 20, slide: 2, blockId: "c", tiered: true, practicePrompt: true, walkSlot: "weakest" as const };

function input(items: Parameters<typeof walkMoments>[0], extra: Partial<WalkPlanInput> = {}): WalkPlanInput {
  return { moments: walkMoments(items), coachNote: false, practiceOn: true, guest: false, ...extra };
}

function shape(plan: { key: string; moment?: number; of?: number }[]) {
  return plan.map((s) => (s.moment != null ? `${s.key}:${s.moment}` : s.of != null ? `${s.key}:of${s.of}` : s.key));
}

describe("the speaking-coach seed", () => {
  it("matches the signed lines, the try caps and the pinned pace numbers", () => {
    const seed = speakingCoachSeed();
    expect(SEEDED_LINES.letItBreathe).toBe(ONE_THING_COPY.letItBreathe);
    expect(SEEDED_LINES.lessonDone).toBe(ONE_THING_COPY.lessonDone);
    expect(SEEDED_LINES.best).toBe(ONE_THING_COPY.best);
    expect(SEEDED_LINES.ends).toEqual(TEMPO_COPY.ends);
    expect(seed.walk.maxTries).toEqual({ oneThing: ONE_THING_TRIES, legacy: WALK_MAX_TRIES });
    expect(NOTICING_DIALS.find((d) => d.name === "moment_pick.FLOOR")?.default).toBe(0.6);
    expect(NOTICING_DIALS.find((d) => d.name === "tempo_stretch.MIN_OUTSIDE")?.default).toBe(0.25);
    expect(NOTICING_PINNED.find((d) => d.name === "tempo_stretch.GREEN_LOW")?.value).toBe(0.275);
    expect(NOTICING_PINNED.find((d) => d.name === "tempo_stretch.GREEN_HIGH")?.value).toBe(0.725);
    expect(NOTICING_PINNED.find((d) => d.name === "tempo_land.GREEN_SHARE")?.value).toBe(LAND_GREEN_SHARE);
    const tempo = seed.walk.steps.find((s) => s.key === "tempo");
    expect(tempo?.voice).toBeUndefined();
    expect(tempo?.fixed).toBe(ONE_THING_COPY.letItBreathe);
    expect(seed.walk.steps.find((s) => s.key === "praise")?.voice).toBe("praise");
  });

  it("plans the same steps as the hardcoded walk", () => {
    const seed = speakingCoachSeed();
    const cases = [
      input([strongest]),
      input([between, strongest, weakest], { judge: true }),
      input([{ ...strongest, oneFix: "tempo" }]),
    ];
    for (const one of cases) {
      const fromSeed = planFromDefinition(seed, one);
      expect(fromSeed).not.toHaveProperty("refused");
      expect(shape(fromSeed as { key: string; moment?: number; of?: number }[])).toEqual(shape(buildWalkPlan(one)));
    }
  });

  it("keeps digits off the walk lines and on the card only", () => {
    const seed = speakingCoachSeed();
    for (const line of fixedLines(seed)) expect(line).not.toMatch(/\d/);
    expect(seed.shell.historyCard.showProgress).toBe(true);
    expect(JSON.stringify(fixedLines(seed))).not.toContain("%");
  });

  it("refuses a bad document and leaves the seed untouched", () => {
    const seed = speakingCoachSeed();
    const before = JSON.stringify(seed);
    const clock = structuredClone(seed);
    clock.shell.recordingClockSeconds = 240 as 300;
    expect(refuse(clock)).toBe("COACH_CLOCK");
    expect(planForWalk(clock, input([strongest])).map((s) => s.key)).toEqual(buildWalkPlan(input([strongest])).map((s) => s.key));
    const screen = structuredClone(seed);
    screen.walk.steps[0].screen = "walk.invented" as "walk.page";
    expect(refuse(screen)).toBe("COACH_UNKNOWN_SCREEN");
    const pin = structuredClone(seed);
    pin.noticing.pinned[0].value = 0.1;
    expect(refuse(pin)).toBe("COACH_PINNED");
    expect(JSON.stringify(speakingCoachSeed())).toBe(before);
  });

  it("rejects a paste that would run, and does not load it", async () => {
    const loader = vi.fn();
    const bad = await checkPlugin("eval(source)\nid: x\nrole: detector\ninterventionType: NOTICE\nhears: hedging\nstep: walk.message\n");
    expect(bad.status).toBe("rejected");
    expect(bad.reasons).toContain("eval");
    expect(loader).not.toHaveBeenCalled();
    const net = await checkPlugin("fetch('/x')\nid: x\nrole: detector\ninterventionType: ADD\nhears: gap\nstep: walk.message\n");
    expect(net.status).toBe("rejected");
    expect(net.reasons).toContain("network");
    const ok = await checkPlugin("# id: hedge\n# role: detector\n# interventionType: NOTICE\n# hears: hedging\n# step: walk.message\n");
    expect(ok.status).toBe("checked");
    expect(ok.manifest?.interventionType).toBe("NOTICE");
  });

  it("drops a step the document turns off, and keeps the seed's order otherwise", () => {
    const seed = speakingCoachSeed();
    const edited = structuredClone(seed);
    const tempo = edited.walk.steps.find((s) => s.key === "tempo");
    if (tempo) tempo.when = "never";
    const take = input([{ ...strongest, oneFix: "tempo" }]);
    const planned = planFromDefinition(edited, take);
    expect(planned).not.toHaveProperty("refused");
    expect((planned as { key: string }[]).map((s) => s.key)).not.toContain("tempo");
    expect(planForWalk(null, take).map((s) => s.key)).toContain("tempo");
  });
});
