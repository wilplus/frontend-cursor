/* -------------------------------------------------------------------------- */
/*  life/mappers — wire (snake_case) → view types, defensively                 */
/*                                                                            */
/*  Same discipline as `services/api/journal.ts`: every mapper tolerates a     */
/*  partial or reordered payload and returns null when the row cannot identify */
/*  itself, so a backend field that ships later never white-screens a view.    */
/*                                                                            */
/*  Two mappings are load-bearing rather than cosmetic:                        */
/*    · `dueLabel` is passed through VERBATIM. The label is the source of      */
/*      truth, not the parsed date (spec §3.2) — "[Jul '27]" renders as the    */
/*      user wrote it, and `dueAt` exists only to place a marker on a canvas.  */
/*    · A strategy proposal with no warrant principle is DROPPED, not rendered */
/*      warrantless. L-2 requires the user's own principle displayed as the    */
/*      warrant on every proposed change; a card that cannot show one has no   */
/*      compliant form.                                                        */
/* -------------------------------------------------------------------------- */

import {
  isMistakeCategory,
  type LifeApplication,
  type LifeBetKey,
  type LifeChatCardData,
  type LifeCheck,
  type LifeConflictProposal,
  type LifeDay,
  type LifeDiffLine,
  type LifeHorizon,
  type LifeItem,
  type LifeItemKind,
  type LifeMenuEntry,
  type LifeMistakeCategory,
  type LifePrinciple,
  type LifePrincipleDetail,
  type LifeProposal,
  type LifeRetireProposal,
  type LifeState,
  type LifeStrategy,
  type LifeStrategyDiff,
  type LifeStrategyProposal,
  type LifeTagDescriptor,
  type LifeTimelineEvent,
} from "./types";

/* ------------------------------- primitives ------------------------------- */

const rec = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v : null;
const bool = (v: unknown): boolean => v === true;
const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const ITEM_KINDS = new Set<string>([
  "principle",
  "win",
  "phrase",
  "bet",
  "goal",
  "task",
  "habit",
  "distraction",
  "event",
]);
const HORIZONS = new Set<string>([
  "now",
  "month",
  "quarter",
  "year",
  "five_year",
  "ten_year",
]);
const BET_KEYS = new Set<string>(["life", "company", "dream"]);

const betKey = (v: unknown): LifeBetKey | null =>
  typeof v === "string" && BET_KEYS.has(v) ? (v as LifeBetKey) : null;

/* --------------------------------- state ---------------------------------- */

export function mapLifeState(raw: unknown): LifeState | null {
  const r = rec(raw);
  if (!r) return null;
  const consent = rec(r.consent);
  const setup = rec(r.setup);
  // Without a required consent version there is no gate to pass, so the payload
  // is unusable — treat it as "no panel" rather than guessing a version.
  const requiredVersion = strOrNull(consent?.required_version);
  if (!requiredVersion) return null;

  const menu: LifeMenuEntry[] = [];
  for (const item of arr(r.menu)) {
    const m = rec(item);
    if (!m) continue;
    const key = strOrNull(m.key);
    const href = strOrNull(m.href);
    if (!key || !href) continue;
    menu.push({
      key,
      label: strOrNull(m.label) ?? key,
      href,
      external: bool(m.external),
    });
  }

  let tags: LifeTagDescriptor[] | undefined;
  if (Array.isArray(r.tags)) {
    tags = arr(r.tags).flatMap((t) => {
      const d = rec(t);
      const tag = strOrNull(d?.tag);
      if (!tag) return [];
      return [
        {
          tag: tag.replace(/^#/, ""),
          label: strOrNull(d?.label) ?? "",
          hidden: bool(d?.hidden),
        },
      ];
    });
  }

  return {
    consent: {
      requiredVersion,
      acceptedVersion: strOrNull(consent?.accepted_version),
    },
    setup: {
      complete: bool(setup?.complete),
      resumeStep: strOrNull(setup?.resume_step),
    },
    menu,
    tags,
  };
}

/* --------------------------------- items ---------------------------------- */

export function mapLifeItem(raw: unknown): LifeItem | null {
  const r = rec(raw);
  if (!r) return null;
  const id = strOrNull(r.id);
  const kind = str(r.kind);
  if (!id || !ITEM_KINDS.has(kind)) return null;
  const horizon = str(r.horizon);
  return {
    id,
    kind: kind as LifeItemKind,
    title: str(r.title),
    body: str(r.body),
    status: strOrNull(r.status),
    horizon: HORIZONS.has(horizon) ? (horizon as LifeHorizon) : null,
    dueLabel: strOrNull(r.due_label),
    dueAt: strOrNull(r.due_at),
    betKey: betKey(r.bet_key ?? r.bet_id),
    parentId: strOrNull(r.parent_id),
    collection: strOrNull(r.collection),
    originCaseId: strOrNull(r.origin_case_id),
    createdAt: strOrNull(r.created_at),
  };
}

export function mapLifeItems(raw: unknown): LifeItem[] {
  const r = rec(raw);
  const list = Array.isArray(raw) ? raw : arr(r?.items);
  return list.flatMap((row) => {
    const item = mapLifeItem(row);
    return item ? [item] : [];
  });
}

/* ------------------------------- principles ------------------------------- */

export function mapPrinciple(raw: unknown): LifePrinciple | null {
  const r = rec(raw);
  if (!r) return null;
  const id = strOrNull(r.id);
  if (!id) return null;
  return {
    id,
    title: str(r.title),
    body: str(r.body),
    createdAt: strOrNull(r.created_at),
    // L-5 — a count of citations. Not a rank, not a score (N4).
    applicationCount: Math.max(0, num(r.application_count, 0)),
    retired: bool(r.retired),
  };
}

export function mapPrinciples(raw: unknown): LifePrinciple[] {
  const r = rec(raw);
  const list = Array.isArray(raw) ? raw : arr(r?.principles ?? r?.items);
  return list.flatMap((row) => {
    const p = mapPrinciple(row);
    return p ? [p] : [];
  });
}

function mapApplication(raw: unknown): LifeApplication | null {
  const r = rec(raw);
  if (!r) return null;
  const id = strOrNull(r.id);
  if (!id) return null;
  const context = str(r.context);
  return {
    id,
    context:
      context === "comparison" || context === "conflict" || context === "lookup"
        ? context
        : "case",
    summary: str(r.summary),
    href: strOrNull(r.href),
    at: strOrNull(r.at ?? r.created_at),
  };
}

export function mapPrincipleDetail(raw: unknown): LifePrincipleDetail | null {
  const base = mapPrinciple(raw);
  if (!base) return null;
  const r = rec(raw)!;
  const categories: LifeMistakeCategory[] = arr(r.categories ?? r.category)
    .filter(isMistakeCategory)
    .filter((c, i, all) => all.indexOf(c) === i);
  return {
    ...base,
    caseAtHand: str(r.case_at_hand),
    categories,
    principlesApplied: arr(r.principles_applied).flatMap((row) => {
      const a = rec(row);
      const id = strOrNull(a?.id);
      if (!id) return [];
      return [
        { id, title: str(a?.title), note: strOrNull(a?.note) },
      ];
    }),
    // Slot 4 — user-written. The FE never drafts it and never offers to (L-1).
    reflections: str(r.reflections),
    occurredOn: strOrNull(r.occurred_on),
    applications: arr(r.applications).flatMap((row) => {
      const a = mapApplication(row);
      return a ? [a] : [];
    }),
  };
}

/* --------------------------------- the day -------------------------------- */

function mapChecks(raw: unknown): LifeCheck[] {
  return arr(raw).flatMap((row, i) => {
    const r = rec(row);
    if (!r) return [];
    const label = str(r.label);
    if (!label) return [];
    return [{ id: strOrNull(r.id) ?? `check-${i}`, label, done: bool(r.done) }];
  });
}

export function mapLifeDay(raw: unknown): LifeDay | null {
  const r = rec(raw);
  if (!r) return null;
  const date = strOrNull(r.date);
  if (!date) return null;

  // The 05:00 fields may arrive nested under `morning` (the two-pass shape) or
  // flat on the row (the shape `life_days` actually stores). Both read the
  // same, so the backend can send either without an FE deploy.
  const m = rec(r.morning) ?? r;
  const evening = rec(r.evening) ?? {};

  return {
    date,
    morning: {
      generatedAt: strOrNull(m.generated_at ?? r.morning_generated_at),
      checks: mapChecks(m.checks ?? m.morning_checks),
      oneThing: str(m.one_thing),
      focusBlocks: arr(m.focus_blocks).flatMap((row) => {
        const b = rec(row);
        if (!b) return [];
        return [{ text: str(b.text), box: strOrNull(b.box) }];
      }),
      distractionFlagged: strOrNull(m.distraction_flagged),
      bets: arr(m.bets).flatMap((row) => {
        const b = rec(row);
        const key = betKey(b?.key);
        if (!key) return [];
        return [
          {
            key,
            rank: num(b?.rank, 0),
            label: str(b?.label),
            goals: arr(b?.goals).flatMap((g) => {
              const gr = rec(g);
              const id = strOrNull(gr?.id);
              if (!id) return [];
              return [
                {
                  id,
                  title: str(gr?.title),
                  dueLabel: strOrNull(gr?.due_label),
                },
              ];
            }),
          },
        ];
      }),
      habits: mapChecks(m.habits ?? m.daily_habits),
    },
    evening: {
      // Null until the 23:00 pass has run. The view reads this, not the length
      // of `summary`, so a pass that legitimately produced no lines still
      // renders as written rather than as pending.
      generatedAt: strOrNull(evening.generated_at),
      summary: arr(evening.summary).flatMap((line) =>
        typeof line === "string" && line.trim() ? [line] : []
      ),
      habitsRan: bool(evening.habits_ran),
      oneThingDone: bool(evening.one_thing),
      distraction: str(evening.distraction),
      question: str(evening.question),
      // `line` is the legacy column name for the user's own answer.
      answer: str(evening.answer ?? evening.line),
    },
  };
}

/* ------------------------------- proposals -------------------------------- */

function mapDiff(raw: unknown): LifeDiffLine[] {
  return arr(raw).flatMap((row) => {
    const r = rec(row);
    if (!r) return [];
    const op = str(r.op);
    if (op !== "keep" && op !== "add" && op !== "remove") return [];
    return [{ op, text: str(r.text) }];
  });
}

export function mapProposal(raw: unknown): LifeProposal | null {
  const r = rec(raw);
  if (!r) return null;
  const id = strOrNull(r.id);
  const kind = str(r.kind);
  if (!id) return null;
  const base = {
    id,
    createdAt: strOrNull(r.created_at),
    expiresAt: strOrNull(r.expires_at),
  };

  if (kind === "strategy") {
    const w = rec(r.warrant);
    const warrantId = strOrNull(w?.id);
    const warrantTitle = strOrNull(w?.title);
    // L-2 — no warrant, no card. A proposed change that cannot display one of
    // the user's own principles as its warrant has no compliant rendering, so
    // it is dropped rather than shown bare.
    if (!warrantId || !warrantTitle) return null;
    const proposal: LifeStrategyProposal = {
      ...base,
      kind: "strategy",
      contradicts: str(r.contradicts),
      diff: mapDiff(r.diff),
      warrant: { id: warrantId, title: warrantTitle },
      section: strOrNull(r.section),
      // L-2a — the immutable core is report-only. Default to report-only when
      // the backend does not say, so an unknown payload can never grow an
      // approve button over Section I or the bets' rank.
      reportOnly: r.report_only === undefined ? true : bool(r.report_only),
    };
    return proposal;
  }

  if (kind === "conflict") {
    const l = rec(r.left);
    const rt = rec(r.right);
    const leftId = strOrNull(l?.id);
    const rightId = strOrNull(rt?.id);
    if (!leftId || !rightId) return null;
    const proposal: LifeConflictProposal = {
      ...base,
      kind: "conflict",
      left: { id: leftId, title: str(l?.title), body: str(l?.body) },
      right: { id: rightId, title: str(rt?.title), body: str(rt?.body) },
      occasion: strOrNull(r.occasion),
    };
    return proposal;
  }

  if (kind === "retire") {
    const inc = rec(r.incoming);
    const ex = rec(r.existing);
    const incId = strOrNull(inc?.id);
    const exId = strOrNull(ex?.id);
    if (!incId || !exId) return null;
    const proposal: LifeRetireProposal = {
      ...base,
      kind: "retire",
      incoming: { id: incId, title: str(inc?.title) },
      existing: {
        id: exId,
        title: str(ex?.title),
        ordinal: numOrNull(ex?.ordinal),
      },
    };
    return proposal;
  }

  return null;
}

export function mapProposals(raw: unknown): LifeProposal[] {
  const r = rec(raw);
  const list = Array.isArray(raw) ? raw : arr(r?.proposals);
  return list.flatMap((row) => {
    const p = mapProposal(row);
    return p ? [p] : [];
  });
}

/* -------------------------------- strategy -------------------------------- */

export function mapStrategy(raw: unknown): LifeStrategy | null {
  const r = rec(raw);
  if (!r) return null;
  if (typeof r.body !== "string") return null;
  return {
    version: num(r.version, 1),
    body: r.body,
    reviewedOn: strOrNull(r.reviewed_on),
    createdAt: strOrNull(r.created_at),
  };
}

export function mapStrategyDiff(raw: unknown): LifeStrategyDiff | null {
  const r = rec(raw);
  if (!r) return null;
  return {
    version: num(r.version, 0),
    lines: mapDiff(r.lines ?? r.diff),
    blockedSections: arr(r.blocked_sections).flatMap((s) =>
      typeof s === "string" && s.trim() ? [s] : []
    ),
  };
}

/* -------------------------------- timeline -------------------------------- */

export function mapTimelineEvents(raw: unknown): LifeTimelineEvent[] {
  const r = rec(raw);
  const list = Array.isArray(raw) ? raw : arr(r?.events);
  return list.flatMap((row) => {
    const e = rec(row);
    if (!e) return [];
    const id = strOrNull(e.id);
    const at = strOrNull(e.at ?? e.due_at ?? e.date);
    // An entry with no parseable date cannot be placed on a calendar canvas.
    // Dropping it is honest; guessing "today" would put a 2035 goal on 2026.
    if (!id || !at || Number.isNaN(new Date(at).getTime())) return [];
    const kind = str(e.kind);
    return [
      {
        id,
        title: str(e.title),
        at,
        endAt: strOrNull(e.end_at),
        betKey: betKey(e.bet_key ?? e.category),
        body: strOrNull(e.body),
        kind: kind === "goal" || kind === "bet" ? kind : "event",
        dueLabel: strOrNull(e.due_label),
      },
    ];
  });
}

/* ------------------------------- chat cards ------------------------------- */

/** Read the life card out of a bot message's metadata. Absent → null, and the
 *  bubble renders exactly as it does today. */
export function mapChatCard(raw: unknown): LifeChatCardData | null {
  const r = rec(raw);
  if (!r) return null;
  const view = strOrNull(r.view);
  if (!view) return null;
  return {
    view,
    title: str(r.title),
    lines: arr(r.lines).flatMap((l) => (typeof l === "string" ? [l] : [])),
    // A relevance floor lives on the backend: when nothing clears the bar it
    // attaches no phrase, and we render none. Never a placeholder (FE-5).
    phrase: strOrNull(r.phrase),
    awaitingApproval: bool(r.awaiting_approval),
  };
}
