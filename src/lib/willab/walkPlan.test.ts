/*
STORY    As a speaker, I want the walk to praise each of my shown moments that sounded sure and practise each that did not, never ask me to judge, never show a score, and give every moment a step, so that feedback is in words and always has something to show.
OUTCOME
  O1  The plan holds no number, read or score.
  O2  The steps come in order: each praise, its practise, then its helper words; each correction (clearer version, practise); others; the summary; never a judging step; two praises or two corrections are ordinary Takes (founder 2026-10-20; N122).
  O3  Every moment has a practice step, even with nothing attached.
  O4  A praised moment the server does not mark for practice, or with practice off, goes straight to its helper words (N122).
  O5  Each moment after the first opens with "let's look at your next key moment", and the first step after the last moment with "These were some real good moments of yours"; never in the coach's own walk (N285).
  O6  A Take served with slots is the One thing walk: their best (praise, nothing to practise), one fix with the tool it needs (the Clearer version first, else the AI clip on the weakest), from Take 2 one moment of another speaker, the helper words on their own, then "Lesson done."; no picker, no second moment, no summary; a Take served before them keeps praise first (N309).
  O7  With no moment to fix and the tempo step there, the Sniper is the one fix; with a moment to fix, no tempo step (N309); with neither, my best still leaves its helper words (N374). When the server names the one fix, the walk follows it: the Sniper's step is there before its stretch arrives, and a moment or none leaves it out (T, N323 item 6). A between whose Clearer version did not reach the walk is no fix, unless it is this week's level's moment (N381) or the server chose it: then it is walked with the closest exercise, saying so (N536).
  O8  The One thing walk's fix allows two tries: a second miss ends it (N309).
PROVES   O1 -> carries no number, read or score
         O2 -> praises each strong moment, practises each corrected one, and never asks the speaker to judge
         O3 -> a moment with nothing attached is the moment said again
         O4 -> a praised moment not marked for practice, or with practice off, goes straight to its helper words
         O5 -> the next moment and the end of the moments each get their line, once
         O6 -> their best, one fix with its tool, one judged moment from Take 2, the helper words, then Lesson done
         O7 -> with no moment to fix, the Sniper on this week's level is the one fix,
               the Sniper is the server's choice, and a between with no Clearer version is no fix
         O8 -> a second miss ends the fix
WHY      Never-rule 1 (no scores to speakers); founder 2026-10-23 (N122, "do we practice the confident moments? I think yes we should!"); 2026-10-30 (N285, "let's look at your next key moment we spotted"; N289, "First, show the strongest, then the weakest, and then the average"); 2026-10-31 (N309, "apply to it the one thing walk"); 2026-11-03 (N374, "go with the recommendations").
*/
import { describe, expect, it } from "vitest";
import { afterTry, buildWalkPlan, momentLead, walkMoments, type WalkMoment } from "./walkPlan";

/** The harness's four moments (walkFixtures MOMENTS): praise, clearer,
 *  praise, exercise, all on one slide. */
const HARNESS: WalkMoment[] = [
  { index: 0, slide: 0, praise: true },
  { index: 1, slide: 0, clearer: true },
  { index: 2, slide: 0, praise: true },
  { index: 3, slide: 0, exercise: true },
];

describe("buildWalkPlan", () => {

  it("carries no number, read or score", () => {
    const plan = buildWalkPlan({ moments: HARNESS, coachNote: true, practiceOn: true, guest: false });
    expect(JSON.stringify(plan)).not.toMatch(/score|read|probab|band/i);
  });
});

describe("the 2026-10-12 lock", () => {
  const keys = (items: Parameters<typeof walkMoments>[0]) =>
    buildWalkPlan({ moments: walkMoments(items), coachNote: false, practiceOn: true, guest: false }).map((s) => s.key);

  it("praises each strong moment, practises each corrected one, and never asks the speaker to judge", () => {
    // One strong, one weak (a rewrite rides it): praise, then the correction.
    expect(keys([
      { start: 0, slide: 0, blockId: "a", tiered: true, green: true },
      { start: 10, slide: 1, blockId: "b", tiered: true, practicePrompt: true, hasRewrite: true },
      { start: 20, slide: 2, blockId: "c", tiered: true },
    ])).toEqual(["page", "praise", "helpers", "clearer", "practise", "others", "summary", "end"]);
    // Both strong: two praises, each practised with its AI clip, then its
    // helper words (founder 2026-10-23, N122).
    expect(keys([
      { start: 0, slide: 0, blockId: "a", tiered: true, green: true, confidentPractice: true },
      { start: 10, slide: 1, blockId: "b", tiered: true, green: true, confidentPractice: true },
    ])).toEqual([
      "page", "praise", "exVideo", "practise", "helpers", "praise", "exVideo", "practise", "helpers",
      "others", "summary", "end",
    ]);
    // Both weak: two corrections, each its own practise (the second, with
    // nothing attached, is the Exercise screen with Line A, then the mic).
    expect(keys([
      { start: 0, slide: 0, blockId: "a", tiered: true, practicePrompt: true, hasRewrite: true },
      { start: 10, slide: 1, blockId: "b", tiered: true, practicePrompt: true },
    ])).toEqual(["page", "clearer", "practise", "exVideo", "practise", "others", "summary", "end"]);
  });
});

describe("a served moment always has a step (founder 2026-10-17)", () => {
  it("a moment with nothing attached is the moment said again, so the lens never has nothing to show", () => {
    const moments = walkMoments([
      { start: 0, slide: 0, blockId: "b1", feedbackFamily: "confident_voice", openCard: null },
      { start: 90, slide: 1, blockId: "b2", feedbackFamily: "confident_voice", openCard: null },
    ]);
    expect(moments.map((m) => m.practise)).toEqual([true, true]);
  });
});

describe("a praised moment not marked for practice (founder 2026-10-23, N122)", () => {
  it("a praised moment not marked for practice, or with practice off, goes straight to its helper words", () => {
    const keys = (items: Parameters<typeof walkMoments>[0], practiceOn = true) =>
      buildWalkPlan({ moments: walkMoments(items), coachNote: false, practiceOn, guest: false }).map((s) => s.key);
    const strong = { start: 0, slide: 0, blockId: "a", tiered: true, green: true };
    expect(keys([strong])).toEqual(["page", "praise", "helpers", "others", "summary", "end"]);
    expect(keys([{ ...strong, confidentPractice: true }], false)).toEqual(["page", "praise", "helpers", "others", "summary", "end"]);
  });
});

describe("the lines between moments (founder 2026-10-30, N285)", () => {
  it("the next moment and the end of the moments each get their line, once", () => {
    const plan = buildWalkPlan({
      moments: walkMoments([
        { start: 0, slide: 0, blockId: "a", tiered: true, green: true, confidentPractice: true },
        { start: 10, slide: 1, blockId: "b", tiered: true, practicePrompt: true },
      ]),
      interventions: ["tempo"],
      coachNote: true,
      practiceOn: true,
      guest: false,
    });
    const leads = plan.map((s, i) => [s.key, momentLead(plan, i)]).filter(([, lead]) => lead);
    // The second moment opens on its Exercise; the tempo step follows the last.
    expect(leads).toEqual([["exVideo", "next"], ["tempo", "done"]]);
    expect(plan.map((_, i) => momentLead(plan, i)).filter(Boolean)).toHaveLength(2);
    // The coach's own walk has neither.
    const coach = buildWalkPlan({ moments: [{ index: 0, slide: 0, coach: true }, { index: 1, slide: 0, coach: true }], coachNote: true, coachOnly: true, practiceOn: true, guest: false });
    expect(coach.map((_, i) => momentLead(coach, i)).filter(Boolean)).toEqual([]);
  });
});

describe("the One thing walk (founder 2026-10-31, N309)", () => {
  type Items = Parameters<typeof walkMoments>[0];
  const plan = (items: Items, opts: { judge?: boolean; interventions?: readonly "tempo"[] } = {}) =>
    buildWalkPlan({ moments: walkMoments(items), coachNote: false, practiceOn: true, guest: false, ...opts }).map((s) =>
      s.moment != null ? `${s.key}:${s.moment}` : s.of != null ? `${s.key}:of${s.of}` : s.key,
    );
  const between = { start: 0, slide: 0, blockId: "a", tiered: true, practicePrompt: true, hasRewrite: true, walkSlot: "between" as const };
  const strongest = { start: 10, slide: 1, blockId: "b", tiered: true, green: true, walkSlot: "strongest" as const };
  const weakest = { start: 20, slide: 2, blockId: "c", tiered: true, practicePrompt: true, walkSlot: "weakest" as const };

  it("their best, one fix with its tool, one judged moment from Take 2, the helper words, then Lesson done", () => {
    // Words come first: the Clearer version is the one fix; the weakest is
    // not walked. Take 2 and on: one moment of another speaker.
    expect(plan([between, strongest, weakest], { judge: true })).toEqual([
      "page", "praise:1", "clearer:0", "practise:0", "others", "words:of0", "done", "end",
    ]);
    // No words to help: the AI clip on the weakest. Take 1 judges no one.
    // No helper-word picker, no second moment, no summary.
    expect(plan([strongest, weakest])).toEqual(["page", "praise:0", "exVideo:1", "practise:1", "words:of1", "done", "end"]);
    expect(buildWalkPlan({ moments: walkMoments([strongest, weakest]), coachNote: false, practiceOn: true, guest: false }).every((s) => s.overlay === false || s.one)).toBe(true);
  });

  it("with no moment to fix, the Sniper on this week's level is the one fix", () => {
    expect(plan([strongest], { interventions: ["tempo"], judge: true })).toEqual([
      "page", "praise:0", "tempo", "others", "words", "done", "end",
    ]);
    // A moment to fix: the tempo step is not walked.
    expect(plan([strongest, weakest], { interventions: ["tempo"] })).not.toContain("tempo");
    // Neither: their best, then its own words as the helper words (N374).
    expect(plan([strongest])).toEqual(["page", "praise:0", "words:of0", "done", "end"]);
  });

  it("the Sniper is the server's choice, and a between with no Clearer version is no fix", () => {
    // The server chose the Sniper: its step is there before the stretch has
    // arrived, and no moment is fixed.
    expect(plan([{ ...strongest, oneFix: "tempo" as const }])).toEqual(["page", "praise:0", "tempo", "words", "done", "end"]);
    // It chose a moment, or none: no Sniper, whatever the stretch.
    expect(plan([{ ...strongest, oneFix: "moment" as const }, weakest], { interventions: ["tempo"] })).toEqual([
      "page", "praise:0", "exVideo:1", "practise:1", "words:of1", "done", "end",
    ]);
    expect(plan([{ ...strongest, oneFix: "none" as const }], { interventions: ["tempo"] })).not.toContain("tempo");
    // A between whose rewrite did not reach the page is never the AI clip's
    // (N381): their best, and its own words.
    const bare = { ...between, hasRewrite: false };
    expect(plan([bare, strongest])).toEqual(["page", "praise:1", "words:of1", "done", "end"]);
    // This week's level's moment keeps its fix (G7).
    expect(plan([{ ...bare, planLevel: "Say it once" }, strongest])).toContain("exVideo:0");
    // The server chose it, and its Clearer version was lost on the way: it
    // is still the fix, the closest exercise, and says so (N536).
    const chosen = buildWalkPlan({
      moments: walkMoments([bare, { ...strongest, oneFix: "moment" as const }]),
      coachNote: false, practiceOn: true, guest: false,
    });
    expect(chosen.filter((s) => s.moment === 0).map((s) => s.key)).toEqual(["exVideo", "practise"]);
    expect(chosen.find((s) => s.key === "exVideo")?.closest).toBe(true);
    expect(chosen.find((s) => s.key === "words")?.of).toBe(0);
  });

  it("a second miss ends the fix", () => {
    const second = { key: "practise" as const, moment: 0, attempt: 2, one: true };
    expect(afterTry(second, "again").map((s) => s.key)).toEqual(["processing", "thanks"]);
    expect(afterTry({ ...second, attempt: 1 }, "again").map((s) => s.key)).toEqual(["processing", "encourage", "practise"]);
  });
});
