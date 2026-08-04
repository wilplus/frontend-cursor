import { describe, expect, it } from "vitest";
import {
  mapChatCard,
  mapLifeDay,
  mapLifeItems,
  mapLifeState,
  mapLifeWeek,
  mapPrincipleDetail,
  mapProposal,
  mapProposals,
  mapLifeItem,
  mapTimelineEvents,
} from "./mappers";
import { isParticipating, principlesTabView } from "./types";

describe("mapLifeState", () => {
  const payload = {
    consent: { required_version: "2026-07-26", accepted_version: null },
    setup: { complete: false, resume_step: "quarterly" },
    menu: [
      { key: "principles", label: "Principles", href: "/panel/principles" },
      {
        key: "somewhere_else",
        label: "Somewhere else",
        href: "https://example.willpowerlab.com",
        external: true,
      },
    ],
  };

  it("maps the gate and keeps menu order", () => {
    const state = mapLifeState(payload)!;
    expect(state.consent.acceptedVersion).toBeNull();
    expect(state.setup.resumeStep).toBe("quarterly");
    expect(state.menu.map((m) => m.key)).toEqual([
      "principles",
      "somewhere_else",
    ]);
    expect(state.menu[1].external).toBe(true);
  });

  it("drops menu rows that cannot be linked, rather than rendering a dead entry", () => {
    // A row with no key at all, and a key this side does not know: neither
    // can be turned into a link. `{key: "wins"}` is deliberately NOT here any
    // more — a KNOWN key needs no href, because the href is looked up. See
    // the "server sends bare keys" block below.
    const state = mapLifeState({
      ...payload,
      menu: [{ href: "/panel/x" }, { key: "not_a_view" }],
    })!;
    expect(state.menu).toHaveLength(0);
  });

  /* ------------------------------------------------------------------------ */
  /*  The server sends bare KEYS (founder 2026-08-01)                          */
  /*                                                                          */
  /*  /v2/life/state sends menu: ["principles", "wins", …]. This required     */
  /*  objects carrying {key, href}, so every entry was discarded and          */
  /*  state.menu was permanently empty. Two things broke silently: the server */
  /*  could not add or pull a surface without an FE deploy, and a server-sent */
  /*  list could never take effect at all.                                    */
  /* ------------------------------------------------------------------------ */

  it("resolves the bare keys the backend actually sends", () => {
    const state = mapLifeState({
      ...payload,
      menu: ["principles", "wins", "timeline"],
    })!;
    expect(state.menu.map((m) => m.key)).toEqual([
      "principles",
      "wins",
      "timeline",
    ]);
    // The href comes from this side, so the backend never has to know routes.
    expect(state.menu[1].href).toBe("/panel/wins");
    expect(state.menu[1].label).toBe("Wins");
  });

  /* Prayer is a SEPARATE app on pompeiana.willpowerlab.com, reached through
   * the shared WillpowerLab login rather than from inside this one (founder
   * 2026-08-04). A prayer key on the wire is a key this app does not serve, so
   * it takes the unknown-key path: dropped, quietly, with nothing thrown. */
  it("drops a prayer key rather than linking another app from this one", () => {
    const state = mapLifeState({ ...payload, menu: ["principles", "prayer"] })!;
    expect(state.menu.map((m) => m.key)).toEqual(["principles"]);
  });

  it("keeps the server's own object when it sends one", () => {
    // The override still overrides: a payload that wants a different label or
    // a key pointed somewhere new says so, and this side does not argue.
    const state = mapLifeState({
      ...payload,
      menu: [{ key: "wins", label: "Victories", href: "/panel/elsewhere" }],
    })!;
    expect(state.menu[0].label).toBe("Victories");
    expect(state.menu[0].href).toBe("/panel/elsewhere");
  });

  it("fills in what a partial object leaves out", () => {
    const state = mapLifeState({ ...payload, menu: [{ key: "wins" }] })!;
    expect(state.menu[0].href).toBe("/panel/wins");
    expect(state.menu[0].label).toBe("Wins");
  });

  it("drops an unknown key that carries no href of its own", () => {
    // Rendering it would be a dead entry; guessing a route would be worse.
    const state = mapLifeState({ ...payload, menu: ["nope", 42, null] })!;
    expect(state.menu).toEqual([]);
  });

  it("returns null without a required consent version", () => {
    // No version means no gate to pass, so there is nothing safe to render.
    expect(mapLifeState({ ...payload, consent: {} })).toBeNull();
    expect(mapLifeState(null)).toBeNull();
    expect(mapLifeState("nope")).toBeNull();
  });

  it("drives the three jobs of the Principles tab", () => {
    const noConsent = mapLifeState(payload)!;
    expect(principlesTabView(noConsent)).toBe("first_run");
    expect(isParticipating(noConsent)).toBe(false);

    const consented = mapLifeState({
      ...payload,
      consent: { required_version: "2026-07-26", accepted_version: "2026-07-26" },
    })!;
    expect(principlesTabView(consented)).toBe("setup");
    expect(isParticipating(consented)).toBe(false);

    const done = mapLifeState({
      ...payload,
      consent: { required_version: "2026-07-26", accepted_version: "2026-07-26" },
      setup: { complete: true, resume_step: null },
    })!;
    expect(principlesTabView(done)).toBe("results");
    expect(isParticipating(done)).toBe(true);
  });

  it("treats a stale accepted version as not consented", () => {
    // A re-consent is required when the text changes, or the user agreed to
    // something other than what is on screen.
    const stale = mapLifeState({
      ...payload,
      consent: { required_version: "2026-09-01", accepted_version: "2026-07-26" },
      setup: { complete: true, resume_step: null },
    })!;
    expect(isParticipating(stale)).toBe(false);
    expect(principlesTabView(stale)).toBe("first_run");
  });
});

describe("mapLifeItems", () => {
  it("passes the due label through verbatim", () => {
    // The label is the source of truth, not the parsed date.
    const items = mapLifeItems({
      items: [
        {
          id: "1",
          kind: "goal",
          title: "Ship it",
          due_label: "[Jul '27]",
          due_at: null,
          bet_key: "company",
        },
      ],
    });
    expect(items[0].dueLabel).toBe("[Jul '27]");
    expect(items[0].dueAt).toBeNull();
    expect(items[0].betKey).toBe("company");
  });

  it("drops rows with an unknown kind", () => {
    expect(
      mapLifeItems([{ id: "1", kind: "spending", title: "x" }])
    ).toHaveLength(0);
  });

  it("accepts a bare array as well as a wrapped one", () => {
    expect(mapLifeItems([{ id: "1", kind: "win", title: "x" }])).toHaveLength(1);
  });
});

describe("mapPrincipleDetail", () => {
  it("keeps multiple categories, which the corpus actually has", () => {
    const detail = mapPrincipleDetail({
      id: "p1",
      title: "Focus on saving your own life first",
      categories: ["wishful_thinking", "hubris", "not_a_category"],
      case_at_hand: "the scooter",
      reflections: "mine, not the model's",
      application_count: 3,
    })!;
    expect(detail.categories).toEqual(["wishful_thinking", "hubris"]);
    expect(detail.applicationCount).toBe(3);
    expect(detail.reflections).toBe("mine, not the model's");
  });

  it("defaults the citation count to zero rather than to something invented", () => {
    const detail = mapPrincipleDetail({ id: "p1", title: "x" })!;
    expect(detail.applicationCount).toBe(0);
  });
});

describe("mapProposal", () => {
  const strategy = {
    id: "s1",
    kind: "strategy",
    contradicts: "Bet 2 short-term says Y",
    diff: [{ op: "add", text: "new line" }],
    warrant: { id: "p1", title: "Don't try to understand it all" },
    report_only: false,
  };

  it("keeps a warranted strategy proposal", () => {
    const p = mapProposal(strategy);
    expect(p?.kind).toBe("strategy");
    expect((p as any).warrant.title).toBe("Don't try to understand it all");
    expect((p as any).reportOnly).toBe(false);
  });

  it("DROPS a strategy proposal with no warrant principle", () => {
    // L-2 — every proposed change must display one of the user's own
    // principles as its warrant. There is no compliant way to render one
    // without, so it must never reach the UI.
    expect(mapProposal({ ...strategy, warrant: null })).toBeNull();
    expect(mapProposal({ ...strategy, warrant: { id: "p1" } })).toBeNull();
  });

  it("defaults an unspecified proposal to report-only", () => {
    // L-2a — the immutable core is hand-edited only. An unknown payload must
    // not be able to grow an approve button over Section I or the bets' rank.
    const { report_only, ...withoutFlag } = strategy;
    expect((mapProposal(withoutFlag) as any).reportOnly).toBe(true);
  });

  it("requires both sides of a conflict", () => {
    expect(
      mapProposal({
        id: "c1",
        kind: "conflict",
        left: { id: "a", title: "A" },
        right: null,
      })
    ).toBeNull();
    expect(
      mapProposal({
        id: "c1",
        kind: "conflict",
        left: { id: "a", title: "A", body: "" },
        right: { id: "b", title: "B", body: "" },
      })?.kind
    ).toBe("conflict");
  });

  it("skips unknown proposal kinds instead of rendering them blank", () => {
    expect(mapProposal({ id: "x", kind: "autopublish" })).toBeNull();
    expect(
      mapProposals({ proposals: [strategy, { id: "x", kind: "autopublish" }] })
    ).toHaveLength(1);
  });
});

describe("mapLifeDay", () => {
  it("needs a date to exist at all", () => {
    expect(mapLifeDay({ one_thing: "x" })).toBeNull();
  });

  it("reads the 05:00 fields flat on the row", () => {
    // The shape life_days actually stores.
    const day = mapLifeDay({
      date: "2026-07-26",
      one_thing: "Finish the deck",
      focus_blocks: [{ text: "Deck", box: "09:00" }],
      daily_habits: [{ id: "h1", label: "Pompeiana", done: false }],
      bets: [
        {
          key: "company",
          rank: 2,
          label: "The Company",
          goals: [{ id: "g1", title: "Ship" }],
        },
      ],
    })!;
    expect(day.morning.oneThing).toBe("Finish the deck");
    expect(day.morning.habits[0].label).toBe("Pompeiana");
    expect(day.morning.bets[0].rank).toBe(2);
  });

  it("reads the wire shape GET /v2/life/day actually sends", () => {
    // The backend wraps the row and keys the date as `day`; morning_checks is
    // a record of {"habit title": bool}; the bet is a TITLE string; the goal,
    // its id and its measure ride flat (BE serialize_day, pieces 1-3).
    const day = mapLifeDay({
      day: {
        id: "d1",
        day: "2026-08-03",
        morning_checks: { Pompeiana: true, "Cold shower": false },
        one_thing: "Send the deck to two investors",
        one_thing_bet: "🔵 The Company",
        one_thing_goal: "Raise the round",
        one_thing_goal_id: "g7",
        one_thing_measure: "two replies by Friday",
        focus_blocks: [{ text: "Deck", box: false, bet: "🟢 The Life" }],
        evening_habits_ran: true,
        evening_one_thing: false,
        evening_distraction: "phone",
        evening_measure: "one reply landed",
        evening: { generated_at: "2026-08-03T23:00:00Z", summary: {} },
      },
    })!;
    expect(day.id).toBe("d1");
    expect(day.date).toBe("2026-08-03");
    expect(day.morning.checks).toEqual([
      { id: "Pompeiana", label: "Pompeiana", done: true },
      { id: "Cold shower", label: "Cold shower", done: false },
    ]);
    expect(day.morning.oneThingBet).toBe("company");
    expect(day.morning.oneThingBetLabel).toBe("🔵 The Company");
    expect(day.morning.oneThingGoal).toBe("Raise the round");
    expect(day.morning.oneThingGoalId).toBe("g7");
    expect(day.morning.oneThingMeasure).toBe("two replies by Friday");
    expect(day.morning.focusBlocks[0].betKey).toBe("life");
    expect(day.evening.habitsRan).toBe(true);
    expect(day.evening.oneThingDone).toBe(false);
    expect(day.evening.distraction).toBe("phone");
    expect(day.evening.measure).toBe("one reply landed");
    // The recap object is not a list of lines; it must read as an empty
    // summary rather than crash or invent prose (L-1).
    expect(day.evening.summary).toEqual([]);
  });

  it("never reads the seeded question as the user's answer", () => {
    // build_daily_card seeds evening_line with the question itself. Until the
    // user writes, that value is FRAME: it renders as the question and the
    // answer stays empty, so a blur cannot save the system's own sentence
    // back as the user's reflection (L-1 / N6).
    const seeded = mapLifeDay({
      day: {
        id: "d1",
        day: "2026-08-03",
        evening_line: "am I becoming the man I described?",
      },
    })!;
    expect(seeded.evening.answer).toBe("");
    expect(seeded.evening.question).toBe(
      "am I becoming the man I described?"
    );

    const answered = mapLifeDay({
      day: { id: "d1", day: "2026-08-03", evening_line: "closer than in June" },
    })!;
    expect(answered.evening.answer).toBe("closer than in June");
  });

  it("reads the same fields nested under `morning`", () => {
    // The two-pass shape. Both must work so the backend can send either.
    const day = mapLifeDay({
      date: "2026-07-26",
      morning: {
        generated_at: "2026-07-26T05:00:00Z",
        one_thing: "Finish the deck",
        habits: [{ id: "h1", label: "Pompeiana", done: true }],
      },
    })!;
    expect(day.morning.generatedAt).toBe("2026-07-26T05:00:00Z");
    expect(day.morning.oneThing).toBe("Finish the deck");
    expect(day.morning.habits[0].done).toBe(true);
  });

  it("marks the evening summary as unwritten until the 23:00 pass has run", () => {
    // The view branches on generatedAt, not on the summary being non-empty, so
    // a pass that produced no lines still reads as written.
    const pending = mapLifeDay({ date: "2026-07-26" })!;
    expect(pending.evening.generatedAt).toBeNull();
    expect(pending.evening.summary).toEqual([]);

    const written = mapLifeDay({
      date: "2026-07-26",
      evening: { generated_at: "2026-07-26T23:00:00Z", summary: [] },
    })!;
    expect(written.evening.generatedAt).toBe("2026-07-26T23:00:00Z");
  });

  it("keeps the system recap and the user's answer apart", () => {
    // L-1 — the summary lines are the system's and are factual. The answer is
    // the user's, and nothing here may write it.
    const day = mapLifeDay({
      date: "2026-07-26",
      evening: {
        generated_at: "2026-07-26T23:00:00Z",
        summary: ["The one thing was: finish the deck.", "", "Two habits ran."],
        habits_ran: false,
        one_thing: true,
        distraction: "phone",
        question: "Am I becoming the man I described?",
        answer: "closer than in June",
      },
    })!;
    expect(day.evening.summary).toEqual([
      "The one thing was: finish the deck.",
      "Two habits ran.",
    ]);
    expect(day.evening.oneThingDone).toBe(true);
    expect(day.evening.question).toBe("Am I becoming the man I described?");
    expect(day.evening.answer).toBe("closer than in June");
  });

  it("accepts the legacy `line` column as the user's answer", () => {
    const day = mapLifeDay({
      date: "2026-07-26",
      evening: { line: "am I becoming him?" },
    })!;
    expect(day.evening.answer).toBe("am I becoming him?");
  });

  it("carries the bet on the one thing and on every focus block", () => {
    // Load-bearing since Bet 3 became eligible for daily tasks: with all three
    // in play, an unlabelled card makes the rank invisible on the surface the
    // rank governs.
    const day = mapLifeDay({
      date: "2026-07-26",
      one_thing: "Finish the deck",
      one_thing_bet: "company",
      focus_blocks: [
        { text: "Deck", box: "09:00", bet: "company" },
        { text: "7T reading", box: "20:00", bet: "dream" },
        { text: "Unassigned", box: null },
      ],
    })!;
    expect(day.morning.oneThingBet).toBe("company");
    expect(day.morning.focusBlocks.map((b) => b.betKey)).toEqual([
      "company",
      "dream",
      null,
    ]);
  });

  it("never invents a bet the payload did not name", () => {
    const day = mapLifeDay({
      date: "2026-07-26",
      one_thing: "x",
      one_thing_bet: "spendings",
    })!;
    expect(day.morning.oneThingBet).toBeNull();
  });
});

describe("mapLifeWeek", () => {
  const payload = {
    week_of: "2026-07-26",
    habits_failed: [{ id: "h1", label: "Pompeiana", why: "travelling" }],
    goals_moved: [{ id: "g1", title: "Ship the panel", next_action: "wire BE" }],
    main_distraction: "phone in the morning",
    environmental_change: "charger moved out of the bedroom",
    becoming_sentence: "closer than in June",
    untagged: [{ id: "n1", body: "a thought", created_at: "2026-07-24" }],
  };

  it("needs a week to key off", () => {
    expect(mapLifeWeek({ main_distraction: "x" })).toBeNull();
    expect(mapLifeWeek(null)).toBeNull();
  });

  it("maps the five review fields plus the untagged read", () => {
    const week = mapLifeWeek(payload)!;
    expect(week.habitsFailed[0]).toEqual({
      id: "h1",
      label: "Pompeiana",
      why: "travelling",
    });
    expect(week.goalsMoved[0].nextAction).toBe("wire BE");
    expect(week.environmentalChange).toBe("charger moved out of the bedroom");
    expect(week.becomingSentence).toBe("closer than in June");
    expect(week.untagged[0].body).toBe("a thought");
  });

  it("accepts a bare string where an object was expected", () => {
    const week = mapLifeWeek({
      week_of: "2026-07-26",
      habits_failed: ["Pompeiana", "  "],
      goals_moved: ["Ship the panel"],
    })!;
    expect(week.habitsFailed).toHaveLength(1);
    expect(week.habitsFailed[0].label).toBe("Pompeiana");
    expect(week.habitsFailed[0].why).toBe("");
    expect(week.goalsMoved[0].title).toBe("Ship the panel");
  });

  it("reads the wire shape GET /v2/life/week actually sends", () => {
    // The review row rides under `week` (keyed by week_start), with the
    // displaced goal, the ranked batch and the untagged notes as SIBLINGS.
    const week = mapLifeWeek({
      week: { week_start: "2026-08-02", main_distraction: "phone" },
      displaced_goals: [
        { id: "g7", title: "Raise the round", due_label: "this month" },
      ],
      untagged_notes: [{ id: "n1", body: "a thought", created_at: "2026-08-01" }],
      proposals: [],
      queued_held_back: 0,
    })!;
    expect(week.weekOf).toBe("2026-08-02");
    expect(week.mainDistraction).toBe("phone");
    expect(week.untagged[0].body).toBe("a thought");
    expect(week.displacedGoals).toEqual([
      { id: "g7", title: "Raise the round", dueLabel: "this month" },
    ]);
  });

  it("keeps the displaced goal to its name and due wording only", () => {
    // The gate's read is the goal's own words, nothing else. A backend that
    // ever grew a count or a streak here must find it dropped at the border
    // (AC-9 / N3), and a row with no name has nothing compliant to render.
    const week = mapLifeWeek({
      week: { week_start: "2026-08-02" },
      displaced_goals: [
        { id: "g7", title: "Raise the round", displaced_count: 3 },
        { id: "g8", title: "   " },
      ],
    })!;
    expect(week.displacedGoals).toEqual([
      { id: "g7", title: "Raise the round", dueLabel: null },
    ]);
  });

  it("CAPS the batch at three, whatever the backend queued", () => {
    // L-2b — scarcity is what keeps "approve" meaningful. A longer batch is a
    // rubber stamp, and the FE is the surface where that would happen, so the
    // cap is enforced here as well as server-side.
    const many = Array.from({ length: 7 }, (_, i) => ({
      id: `p${i}`,
      kind: "strategy",
      contradicts: "x",
      diff: [],
      warrant: { id: "w", title: "a principle" },
      report_only: false,
    }));
    const week = mapLifeWeek({ ...payload, proposals: many })!;
    expect(week.proposals).toHaveLength(3);
    expect(week.proposals.map((p) => p.id)).toEqual(["p0", "p1", "p2"]);
  });

  it("still drops a warrantless proposal inside the weekly batch", () => {
    const week = mapLifeWeek({
      ...payload,
      proposals: [
        { id: "p1", kind: "strategy", contradicts: "x", diff: [], warrant: null },
        {
          id: "p2",
          kind: "strategy",
          contradicts: "x",
          diff: [],
          warrant: { id: "w", title: "a principle" },
          report_only: false,
        },
      ],
    })!;
    expect(week.proposals.map((p) => p.id)).toEqual(["p2"]);
  });

  it("tolerates a week with nothing in it", () => {
    const week = mapLifeWeek({ week_of: "2026-07-26" })!;
    expect(week.habitsFailed).toEqual([]);
    expect(week.proposals).toEqual([]);
    expect(week.untagged).toEqual([]);
    expect(week.becomingSentence).toBe("");
  });
});

describe("mapTimelineEvents", () => {
  it("drops entries with no usable date rather than guessing today", () => {
    const events = mapTimelineEvents({
      events: [
        { id: "1", title: "Talk", at: "2027-08-01", kind: "goal" },
        { id: "2", title: "Undated", at: null },
        { id: "3", title: "Nonsense", at: "not a date" },
      ],
    });
    expect(events.map((e) => e.id)).toEqual(["1"]);
    expect(events[0].kind).toBe("goal");
  });

  /* ------------------------------------------------------------------------ */
  /*  The endpoint answers with FOUR lists (founder 2026-08-01)                */
  /*                                                                          */
  /*  {events, goals, undated, bets}. This read took `events` alone, so a      */
  /*  panel holding goals and no event rows — everyone who filled setup from   */
  /*  a document — drew an empty canvas from a payload that was not empty.     */
  /* ------------------------------------------------------------------------ */

  const payload = {
    events: [{ id: "e1", title: "Talk", due_at: "2027-08-01", kind: "event" }],
    goals: [
      {
        id: "g1",
        title: "A marriage with years on it",
        due_at: "2031-07-01",
        kind: "goal",
        collection: "life",
        due_label: "to July 2031",
      },
      {
        id: "g2",
        title: "Profitable",
        due_at: "2026-12-31",
        kind: "goal",
        collection: "company",
      },
    ],
    undated: [{ id: "u1", title: "Someday", due_at: null, kind: "goal" }],
    bets: [{ id: "b1", title: "The Life", kind: "bet", collection: "life" }],
  };

  it("reads the goals, not only the events", () => {
    const ids = mapTimelineEvents(payload).map((e) => e.id);
    expect(ids).toContain("g1");
    expect(ids).toContain("g2");
    expect(ids).toContain("e1");
  });

  it("puts a goal in its bet's lane instead of the orphan row", () => {
    // The canvas lanes are keyed by betKey. `collection` is the field that
    // carries it; bet_key and category are never sent, so this used to
    // resolve to null for every row and pile all of them under the three.
    const byId = new Map(mapTimelineEvents(payload).map((e) => [e.id, e]));
    expect(byId.get("g1")!.betKey).toBe("life");
    expect(byId.get("g2")!.betKey).toBe("company");
  });

  it("keeps the goal's own due label for the read-out", () => {
    const g1 = mapTimelineEvents(payload).find((e) => e.id === "g1")!;
    expect(g1.dueLabel).toBe("to July 2031");
    expect(g1.kind).toBe("goal");
  });

  it("leaves the undated list off the canvas", () => {
    // Not an oversight: a goal whose label did not parse cannot be placed on
    // a calendar, and guessing a date would render a fact nobody wrote.
    expect(mapTimelineEvents(payload).map((e) => e.id)).not.toContain("u1");
  });

  it("carries a bet only when it has a date to be a band between", () => {
    // Bets are READ, so the moment one carries dates it draws as a band. As
    // serialized today they have none, so they fall to the same guard as
    // anything else undateable — read, not silently special-cased.
    expect(mapTimelineEvents(payload).map((e) => e.id)).not.toContain("b1");
    const dated = mapTimelineEvents({
      bets: [
        {
          id: "b2",
          title: "The Company",
          kind: "bet",
          collection: "company",
          due_at: "2026-01-01",
          end_at: "2031-01-01",
        },
      ],
    });
    expect(dated).toHaveLength(1);
    expect(dated[0].kind).toBe("bet");
    expect(dated[0].betKey).toBe("company");
    expect(dated[0].endAt).toBe("2031-01-01");
  });

  it("still accepts a bare array, and the older field names", () => {
    const out = mapTimelineEvents([
      { id: "x", title: "Old shape", at: "2027-01-01", bet_key: "dream" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].betKey).toBe("dream");
  });

  it("is empty for a payload holding none of the four", () => {
    expect(mapTimelineEvents({})).toEqual([]);
    expect(mapTimelineEvents(null)).toEqual([]);
  });
});

describe("mapChatCard", () => {
  it("returns null for a turn that carried no card", () => {
    // Every turn for a user who is not on the panel.
    expect(mapChatCard(undefined)).toBeNull();
    expect(mapChatCard(null)).toBeNull();
    expect(mapChatCard({ title: "no view" })).toBeNull();
  });

  it("renders no phrase when the backend attached none", () => {
    // A mismatched aphorism is worse than silence, so an absent phrase stays
    // absent and never becomes a placeholder.
    const card = mapChatCard({ view: "principles", title: "Logged", phrase: "" })!;
    expect(card.phrase).toBeNull();
    expect(card.awaitingApproval).toBe(false);
  });

  it("keeps a phrase and the awaiting-approval flag when present", () => {
    const card = mapChatCard({
      view: "principles",
      lines: ["a", "b"],
      phrase: "Focus on saving your own life first",
      awaiting_approval: true,
    })!;
    expect(card.lines).toEqual(["a", "b"]);
    expect(card.awaitingApproval).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  mapLifeItem — the bet a row belongs to (founder 2026-08-01)                */
/*                                                                            */
/*  betKey read `bet_key ?? bet_id`. serialize_item emits neither in a usable  */
/*  form — bet_id is a uuid, which betKey() rejects — so this resolved to null */
/*  for every row the backend has ever sent. The field that carries the bet is */
/*  `collection`.                                                             */
/* -------------------------------------------------------------------------- */

describe("mapLifeItem — betKey", () => {
  const base = { id: "i1", kind: "goal", title: "Ship it" };

  it("reads the bet from collection, which is what the backend sends", () => {
    expect(mapLifeItem({ ...base, collection: "company" })!.betKey).toBe(
      "company"
    );
  });

  it("leaves collection itself alone", () => {
    // Both fields are on the item: one is the lane, one is the raw column.
    const item = mapLifeItem({ ...base, collection: "life" })!;
    expect(item.betKey).toBe("life");
    expect(item.collection).toBe("life");
  });

  it("ignores a uuid bet_id rather than reading it as a bet", () => {
    // The old expression's first usable-looking candidate. A uuid is not one
    // of the three keys, so it must not become a lane.
    const item = mapLifeItem({
      ...base,
      bet_id: "3f1a5c8e-0000-4000-8000-000000000000",
    })!;
    expect(item.betKey).toBeNull();
  });

  it("still honours the older names when a payload uses them", () => {
    expect(mapLifeItem({ ...base, bet_key: "dream" })!.betKey).toBe("dream");
  });

  it("is null for a collection that is not a bet", () => {
    // Phrases carry collection "wall". That is a shelf, not a bet.
    expect(mapLifeItem({ ...base, collection: "wall" })!.betKey).toBeNull();
  });
});
