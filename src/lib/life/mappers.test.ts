import { describe, expect, it } from "vitest";
import {
  mapChatCard,
  mapLifeDay,
  mapLifeItems,
  mapLifeState,
  mapPrincipleDetail,
  mapProposal,
  mapProposals,
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
        key: "prayer",
        label: "Prayer",
        href: "https://pompeiana.willpowerlab.com",
        external: true,
      },
    ],
  };

  it("maps the gate and keeps menu order", () => {
    const state = mapLifeState(payload)!;
    expect(state.consent.acceptedVersion).toBeNull();
    expect(state.setup.resumeStep).toBe("quarterly");
    expect(state.menu.map((m) => m.key)).toEqual(["principles", "prayer"]);
    expect(state.menu[1].external).toBe(true);
  });

  it("drops menu rows that cannot be linked, rather than rendering a dead entry", () => {
    const state = mapLifeState({
      ...payload,
      menu: [{ key: "wins", label: "Wins" }, { href: "/panel/x" }],
    })!;
    expect(state.menu).toHaveLength(0);
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
  it("maps the card and needs a date to exist at all", () => {
    expect(mapLifeDay({ one_thing: "x" })).toBeNull();
    const day = mapLifeDay({
      date: "2026-07-26",
      one_thing: "Finish the deck",
      focus_blocks: [{ text: "Deck", box: "09:00" }],
      daily_habits: [{ id: "h1", label: "Pompeiana", done: false }],
      bets: [
        { key: "company", rank: 2, label: "The Company", goals: [{ id: "g1", title: "Ship" }] },
      ],
      evening: { habits_ran: false, one_thing: true, distraction: "", line: "am I becoming him?" },
    })!;
    expect(day.oneThing).toBe("Finish the deck");
    expect(day.dailyHabits[0].label).toBe("Pompeiana");
    expect(day.bets[0].rank).toBe(2);
    expect(day.evening.oneThingDone).toBe(true);
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
