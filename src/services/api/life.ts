/* -------------------------------------------------------------------------- */
/*  life — client for the Life Panel BFF (/api/v2/life/*)                      */
/*                                                                            */
/*  THE CONTRACT THIS FILE ASSUMES. The backend pair is PROMPT-BE-life-panel;  */
/*  where the two disagree, the backend wins and this file changes.            */
/*                                                                            */
/*    GET    /v2/life/state                 the gate + menu (§1.4)             */
/*    POST   /v2/life/consent               { version }                        */
/*    GET    /v2/life/setup                 saved answers + resume step        */
/*    PUT    /v2/life/setup                 { step, answers }  (every step)    */
/*    POST   /v2/life/setup/complete        generates the docs, replays notes  */
/*    GET    /v2/life/principles            derived list                       */
/*    GET    /v2/life/principles/:id        the five slots + application log   */
/*    GET    /v2/life/items?kind=           wins / phrases / distractions      */
/*    GET    /v2/life/goals                 bets in rank order, goals beneath  */
/*    GET    /v2/life/day                   the day: 05:00 plan + 23:00 summary*/
/*    PATCH  /v2/life/day                   habit ticks + the evening review   */
/*    GET    /v2/life/week                  the Sunday review (BE #262)        */
/*    POST   /v2/life/week                  the user's half of it              */
/*    GET    /v2/life/timeline              events + dated goals               */
/*    GET    /v2/life/proposals             proposal / conflict / retire       */
/*    POST   /v2/life/proposals/:id/decide  { decision }                       */
/*    GET    /v2/life/strategy              current version                    */
/*    POST   /v2/life/strategy/upload       { body } → a diff to approve       */
/*    POST   /v2/life/strategy/apply        { version, lines }                 */
/*    POST   /v2/life/export                everything, as a file              */
/*    DELETE /v2/life/data                  { confirm } irreversible           */
/*                                                                            */
/*  THREE STATUSES ARE NOT ERRORS TO SWALLOW:                                  */
/*    404 → LifeUnavailableError. The feature does not exist for this caller.  */
/*          Callers render NOTHING. Never a "coming soon" (N1).                */
/*    409 → LifeConsentRequiredError. Signed in, has not consented. Route to   */
/*          the Principles tab; the backend has still stored the note.         */
/*    401 → LifeUnavailableError too, from the panel's point of view: there is */
/*          no session, so there is no panel.                                  */
/* -------------------------------------------------------------------------- */

import {
  mapLifeDay,
  mapLifeItems,
  mapLifeState,
  mapPrincipleDetail,
  mapPrinciples,
  mapProposals,
  mapStrategy,
  mapLifeWeek,
  mapStrategyDiff,
  mapTimelineEvents,
} from "@/lib/life/mappers";
import type {
  LifeBetKey,
  LifeDay,
  LifeItem,
  LifeItemKind,
  LifePrinciple,
  LifePrincipleDetail,
  LifeProposal,
  LifeState,
  LifeStrategy,
  LifeStrategyDiff,
  LifeTimelineEvent,
  LifeWeek,
} from "@/lib/life/types";

const BASE = "/api/v2/life";

/** The feature is not there for this caller. Render nothing. */
export class LifeUnavailableError extends Error {
  constructor() {
    super("life panel unavailable");
    this.name = "LifeUnavailableError";
  }
}

/** Consent has not been given yet (L-6). */
export class LifeConsentRequiredError extends Error {
  constructor() {
    super("life panel consent required");
    this.name = "LifeConsentRequiredError";
  }
}

export class LifeRequestError extends Error {
  readonly status: number;
  constructor(status: number, message?: string) {
    super(message ?? `life request failed: HTTP ${status}`);
    this.name = "LifeRequestError";
    this.status = status;
  }
}

async function call(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<unknown> {
  const method = init?.method ?? "GET";
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers:
      init?.body === undefined
        ? undefined
        : { "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });

  if (res.status === 404 || res.status === 401) throw new LifeUnavailableError();
  if (res.status === 409) throw new LifeConsentRequiredError();

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data && typeof data === "object" && typeof (data as any).error === "string"
        ? (data as any).error
        : undefined;
    throw new LifeRequestError(res.status, message);
  }
  return data;
}

/* --------------------------------- gate ----------------------------------- */

/** The one call every panel surface starts from. Returns null when the panel
 *  does not exist for this user, which is the normal case for most users and
 *  must stay silent: no toast, no console noise, no DOM. */
export async function fetchLifeState(): Promise<LifeState | null> {
  try {
    return mapLifeState(await call("/state"));
  } catch (err) {
    if (err instanceof LifeUnavailableError) return null;
    throw err;
  }
}

export async function postConsent(version: string): Promise<void> {
  await call("/consent", { method: "POST", body: { version } });
}

/* --------------------------------- setup ---------------------------------- */

export interface LifeSetupDraft {
  step: string | null;
  answers: Record<string, unknown>;
  complete: boolean;
}

export async function fetchSetup(): Promise<LifeSetupDraft> {
  const raw = (await call("/setup")) as Record<string, unknown> | null;
  return {
    step: typeof raw?.step === "string" ? raw.step : null,
    answers:
      raw?.answers && typeof raw.answers === "object"
        ? (raw.answers as Record<string, unknown>)
        : {},
    complete: raw?.complete === true,
  };
}

/** Save-and-resume is load-bearing, not a nicety: eight horizons is long enough
 *  that people are interrupted, and setup is the only entrance to the feature
 *  (FE-3). Every step writes. */
export async function putSetup(
  step: string,
  answers: Record<string, unknown>
): Promise<void> {
  await call("/setup", { method: "PUT", body: { step, answers } });
}

/**
 * Finish setup: generates the document set.
 *
 * There is NO replay step (BE, 2026-07-26, superseding §6.2). A `#` typed
 * before onboarding is finished falls through as ordinary chat and stores
 * nothing, so there is nothing held back to run through the engine afterwards.
 * The reader that used to unpack a `replayed` list is gone rather than left
 * tolerating a field that can no longer arrive.
 */
export async function completeSetup(): Promise<void> {
  await call("/setup/complete", { method: "POST", body: {} });
}

/* -------------------- setup strategy document (item 9) -------------------- */
/* Founder 2026-07-30: an OPTIONAL upload in setup, plus OPTIONAL drafting
 * from it. Nothing here is automatic: the upload stores extracted text and
 * stops, the draft returns rows and stops, and only rows the user TICKED are
 * ever sent to apply. */

export interface LifeSetupDocument {
  id: string;
  fileName: string;
  status: "processed" | "extraction_failed";
  charCount: number;
}

function mapSetupDocument(raw: unknown): LifeSetupDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    id: typeof r.id === "string" ? r.id : "",
    fileName: typeof r.file_name === "string" ? r.file_name : "",
    status: r.status === "processed" ? "processed" : "extraction_failed",
    charCount: typeof r.char_count === "number" ? r.char_count : 0,
  };
}

export async function fetchSetupDocuments(): Promise<LifeSetupDocument[]> {
  const raw = (await call("/setup/documents")) as Record<string, unknown> | null;
  const list = Array.isArray(raw?.documents) ? raw.documents : [];
  return (list as unknown[]).flatMap((row) => {
    const doc = mapSetupDocument(row);
    return doc ? [doc] : [];
  });
}

/** Multipart, not JSON — the one call in this file that cannot go through
 *  `call`. The BFF forwards multipart bodies byte-for-byte. */
export async function uploadSetupDocument(
  file: File
): Promise<LifeSetupDocument> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(`${BASE}/setup/document`, {
    method: "POST",
    credentials: "include",
    body: form,
    cache: "no-store",
  });
  if (res.status === 404 || res.status === 401) throw new LifeUnavailableError();
  if (res.status === 409) throw new LifeConsentRequiredError();
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new LifeRequestError(
      res.status,
      typeof data.error === "string" ? data.error : undefined
    );
  }
  const doc = mapSetupDocument(data.document);
  if (!doc) throw new LifeRequestError(res.status);
  return doc;
}

/** One drafted row from the uploaded document. `checked` is FE state: the
 *  tick IS the approve (N5) — only checked rows are ever sent to apply, and
 *  an unchecked row is simply never created.
 *
 *  `kind` is the ITEM kind, widened from the original four (2026-07-31) so a
 *  drafter pointed at the Phrases or Principles view can hand those back. The
 *  FE renders whatever kind it is given; it does not decide which kinds a
 *  document can produce. */
export interface LifeDraftItem {
  kind: LifeItemKind;
  title: string;
  body: string;
  /** FE-only. Set when this row arrived as a TRUNCATION PAIR: the backend cuts
   *  a line longer than its limit into `title` (the first N characters) and
   *  `body` (the whole thing), so a 600-character phrase keeps every character
   *  and a normal row does not render twice.
   *
   *  It holds N, and it exists because the review row must edit ONE text. Show
   *  only `title` and the user ticks a row they cannot fully read; let them
   *  edit `title` while `body` still carries the original, and the row that
   *  lands is not the row they approved. Neither is N5.
   *
   *  null for every ordinary row, where `body` is a genuine description rather
   *  than a longer copy of the title. The cut is READ from the payload, never
   *  assumed: the limit is the backend's to move. */
  titleCut: number | null;
  horizon: string | null;
  dueLabel: string | null;
  bet: string | null;
  externalId: string | null;
  orderKey: number;
  checked: boolean;
}

const DRAFT_KINDS: ReadonlySet<string> = new Set<LifeItemKind>([
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

function isDraftKind(value: unknown): value is LifeItemKind {
  return typeof value === "string" && DRAFT_KINDS.has(value);
}

/** A drafting pass: the rows, and WHICH document they were read out of.
 *
 *  The id is carried because `apply` stamps it as the created rows'
 *  provenance (BE 2026-07-31), and the un-hinted "draft from my document"
 *  call does not name a document — the backend picks the newest readable one.
 *  Reading the id back off the response is the only way that path can say
 *  where its rows came from. */
export interface LifeDraft {
  /** null when the backend served no document object (an older deploy). The
   *  rows are still created; they are simply created unstamped. */
  documentId: string | null;
  items: LifeDraftItem[];
}

/**
 * Draft rows out of the stored document text.
 *
 * `kind` is a HINT, not an instruction: the panel dock passes the kind the
 * view the user is standing on holds, so a document opened from Phrases is
 * read for phrases, and the backend leads its answer with those rows without
 * dropping everything else the document holds.
 *
 * The retry-without-the-field below is now belt and braces: the backend
 * honours `kind` and 400s only on a kind outside the nine, which this module
 * cannot produce (`LifeItemKind` is the same closed set on both sides). It
 * stays because an older deploy is a thing that exists, and losing an upload
 * to a field a server has not heard of would be the worst kind of avoidable.
 */
export async function proposeFromDocument(
  options: { documentId?: string; kind?: LifeItemKind } = {}
): Promise<LifeDraft> {
  const body: Record<string, unknown> = {};
  if (options.documentId) body.document_id = options.documentId;
  if (options.kind) body.kind = options.kind;

  let raw: Record<string, unknown> | null;
  try {
    raw = (await call("/setup/propose-from-document", {
      method: "POST",
      body,
    })) as Record<string, unknown> | null;
  } catch (err) {
    // Only the hint is retried away, and only on a rejection that is ABOUT
    // the request (422 from a schema that forbids unknown fields is the one
    // this exists for). 401/404/409 are the load-bearing statuses and are
    // rethrown untouched by `call`, so they never reach here.
    if (
      options.kind &&
      err instanceof LifeRequestError &&
      err.status >= 400 &&
      err.status < 500
    ) {
      return proposeFromDocument({ documentId: options.documentId });
    }
    throw err;
  }

  const doc = raw?.document as Record<string, unknown> | undefined;
  const documentId =
    doc && typeof doc.id === "string" && doc.id.length > 0 ? doc.id : null;

  const list = Array.isArray(raw?.items) ? raw.items : [];
  const items = (list as unknown[]).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    const kind = r.kind;
    if (!isDraftKind(kind)) return [];
    const title = typeof r.title === "string" ? r.title.trim() : "";
    if (!title) return [];
    const body = typeof r.body === "string" ? r.body : "";
    // A pair, not a description: `body` is the whole line and `title` is its
    // opening. Anything else (a goal with a real description, an empty body)
    // is left alone and edits as it always did.
    const truncated = body.length > title.length && body.startsWith(title);
    return [
      {
        kind,
        title,
        body,
        titleCut: truncated ? title.length : null,
        horizon: typeof r.horizon === "string" ? r.horizon : null,
        dueLabel: typeof r.due_label === "string" ? r.due_label : null,
        bet: typeof r.collection === "string" ? r.collection : null,
        externalId: typeof r.external_id === "string" ? r.external_id : null,
        orderKey: typeof r.order_key === "number" ? r.order_key : 0,
        // Default-checked (founder 2026-07-30): the review UI shows every
        // row and the user unticks. The default never bypasses the display.
        checked: true,
      },
    ];
  });

  return { documentId, items };
}

/** Send ONLY the ticked rows. The backend creates them as the user's own
 *  active items — the tick, made on a fully displayed row, is the explicit
 *  approve (N5).
 *
 *  `documentId` stamps every row created by this call with the file it was
 *  read out of (`origin_document_id`, BE 2026-07-31). Optional on both sides
 *  and deliberately not load-bearing: an id the backend cannot resolve to one
 *  of this user's own documents is skipped, and the rows are created anyway.
 *  Provenance is a nicety; the rows the user ticked are the job.
 *
 *  THE RETURNED COUNT CAN BE LOWER THAN THE NUMBER OF TICKS, and that is
 *  correct. `external_id` is a content hash with a unique index behind it, so
 *  a ticked line the user already has is not duplicated. The screen still ends
 *  up right, because the row is already in the list the caller reloads. */
export async function applyConfirmedItems(
  items: LifeDraftItem[],
  documentId?: string | null
): Promise<number> {
  const ticked = items.filter((i) => i.checked && i.title.trim() !== "");
  if (ticked.length === 0) return 0;
  const raw = (await call("/setup/apply-proposed", {
    method: "POST",
    body: {
      ...(documentId ? { document_id: documentId } : {}),
      items: ticked.map((i) => ({
        kind: i.kind,
        title: i.title.trim(),
        body: i.body,
        horizon: i.horizon,
        due_label: i.dueLabel,
        bet: i.bet,
        external_id: i.externalId,
        order_key: i.orderKey,
      })),
    },
  })) as Record<string, unknown> | null;
  return typeof raw?.count === "number" ? raw.count : ticked.length;
}

/* ------------------------------ principles -------------------------------- */

export async function fetchPrinciples(): Promise<LifePrinciple[]> {
  return mapPrinciples(await call("/principles"));
}

export async function fetchPrinciple(
  id: string
): Promise<LifePrincipleDetail | null> {
  return mapPrincipleDetail(await call(`/principles/${encodeURIComponent(id)}`));
}

/* --------------------------------- items ---------------------------------- */

export async function fetchItems(kind: LifeItemKind): Promise<LifeItem[]> {
  return mapLifeItems(await call(`/items?kind=${encodeURIComponent(kind)}`));
}

/** Inline edit of a row the user owns (a win's wording, a distraction's
 *  environmental response). This edits the USER'S OWN text only. It is not a
 *  path for accepting a model proposal, which always goes through
 *  `decideProposal` so the approve step stays explicit (N5). */
export async function updateItem(
  id: string,
  patch: { title?: string; body?: string }
): Promise<void> {
  await call(`/items/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
}

export interface LifeBetGroup {
  key: LifeBetKey;
  rank: number;
  label: string;
  goals: LifeItem[];
}

/** Bets in rank order with their goals. The rank is data, not decoration: bet 3
 *  never outranks bet 2 in a daily plan (spec §3.2). */
export async function fetchGoals(): Promise<LifeBetGroup[]> {
  const raw = (await call("/goals")) as Record<string, unknown> | null;
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.bets) ? raw.bets : [];
  return (list as unknown[]).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    const key = r.key;
    if (key !== "life" && key !== "company" && key !== "dream") return [];
    return [
      {
        key,
        rank: typeof r.rank === "number" ? r.rank : 0,
        label: typeof r.label === "string" ? r.label : "",
        goals: mapLifeItems(r.goals),
      },
    ];
  });
}

/* ---------------------------------- day ----------------------------------- */

export async function fetchDay(): Promise<LifeDay | null> {
  return mapLifeDay(await call("/day"));
}

/**
 * Tick a checkbox on today's card.
 *
 * NOT IN THE FE PROMPT'S ENDPOINT LIST, and flagged as a contract item to
 * confirm with the backend. It is here because the card's frame includes
 * habit checkboxes, and a checkbox that cannot be ticked is not a checkbox.
 * The alternative reading, that every tick goes through `#edit` in the chat,
 * makes the morning routine a typing exercise.
 *
 * This writes a BOOLEAN on a box the user is looking at. It does not touch the
 * one thing, the focus blocks or any strategy text: those change through #edit
 * and through approved proposals, so the approve step stays where it belongs.
 */
export async function setDayCheck(
  checkId: string,
  done: boolean
): Promise<void> {
  await call("/day", {
    method: "PATCH",
    body: { checks: [{ id: checkId, done }] },
  });
}

/**
 * Save the evening review: the two booleans, what pulled at you, and the answer
 * to the closing question.
 *
 * Same endpoint, same reasoning as `setDayCheck`. `answer` is the user's own
 * prose and is only ever sent because they typed it. Nothing here asks the
 * system to draft it, and the field is rendered with no placeholder that would
 * write for them (L-1 / N6).
 */
export async function saveDayEvening(patch: {
  habitsRan?: boolean;
  oneThingDone?: boolean;
  distraction?: string;
  answer?: string;
}): Promise<void> {
  const evening: Record<string, unknown> = {};
  if (patch.habitsRan !== undefined) evening.habits_ran = patch.habitsRan;
  if (patch.oneThingDone !== undefined) evening.one_thing = patch.oneThingDone;
  if (patch.distraction !== undefined) evening.distraction = patch.distraction;
  if (patch.answer !== undefined) evening.answer = patch.answer;
  await call("/day", { method: "PATCH", body: { evening } });
}

/* --------------------------------- the week ------------------------------- */

/** The Sunday review. Live since BE #262, alongside the ranked batch of three
 *  queued proposals (L-2b) and the untagged-note read. */
export async function fetchWeek(): Promise<LifeWeek | null> {
  return mapLifeWeek(await call("/week"));
}

/** Save the user's half of the review. Their own words, only ever sent because
 *  they typed them: nothing here asks the system to draft any of it (L-1). */
export async function saveWeek(patch: {
  habitsFailed?: Array<{ id: string; label: string; why: string }>;
  goalsMoved?: Array<{ id: string; title: string; nextAction: string }>;
  mainDistraction?: string;
  environmentalChange?: string;
  becomingSentence?: string;
}): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.habitsFailed) {
    body.habits_failed = patch.habitsFailed.map((h) => ({
      id: h.id,
      label: h.label,
      why: h.why,
    }));
  }
  if (patch.goalsMoved) {
    body.goals_moved = patch.goalsMoved.map((g) => ({
      id: g.id,
      title: g.title,
      next_action: g.nextAction,
    }));
  }
  if (patch.mainDistraction !== undefined) {
    body.main_distraction = patch.mainDistraction;
  }
  if (patch.environmentalChange !== undefined) {
    body.environmental_change = patch.environmentalChange;
  }
  if (patch.becomingSentence !== undefined) {
    body.becoming_sentence = patch.becomingSentence;
  }
  await call("/week", { method: "POST", body });
}

/* -------------------------------- timeline -------------------------------- */

export async function fetchTimeline(): Promise<LifeTimelineEvent[]> {
  return mapTimelineEvents(await call("/timeline"));
}

/* ------------------------------- proposals -------------------------------- */

export async function fetchProposals(): Promise<LifeProposal[]> {
  return mapProposals(await call("/proposals"));
}

/** N5 — the only two verbs. There is no "accept silently" and no bulk apply.
 *  `retire_no` is a veto: the backend must never ask that question again. */
export type LifeDecision = "approve" | "dismiss" | "retire_yes" | "retire_no";

export async function decideProposal(
  id: string,
  decision: LifeDecision
): Promise<void> {
  await call(`/proposals/${encodeURIComponent(id)}/decide`, {
    method: "POST",
    body: { decision },
  });
}

/* -------------------------------- strategy -------------------------------- */

export async function fetchStrategy(): Promise<LifeStrategy | null> {
  return mapStrategy(await call("/strategy"));
}

/** Re-upload produces a diff to approve, never a silent overwrite. Arbitrary
 *  formatting will not round-trip cleanly, and the diff is the safety net. */
export async function uploadStrategy(
  body: string
): Promise<LifeStrategyDiff | null> {
  return mapStrategyDiff(
    await call("/strategy/upload", { method: "POST", body: { body } })
  );
}

export async function applyStrategyDiff(
  diff: LifeStrategyDiff
): Promise<void> {
  await call("/strategy/apply", {
    method: "POST",
    body: { version: diff.version, lines: diff.lines },
  });
}

/** FE-11 — the strategy as a real file. BE-4 serves
 *  GET /v2/life/strategy/download?format=json|md|pdf|docx; omitting `format`
 *  still returns today's JSON, so every existing caller is unaffected.
 *
 *  HONOUR THE RESPONSE Content-Type, NEVER THE REQUESTED ONE. The endpoint
 *  DEGRADES TO MARKDOWN WITH A 200 when a renderer is unavailable, so trusting
 *  the request would hand the user a .pdf containing markdown — a file their
 *  reader refuses to open, with no error anywhere to explain it. The served
 *  type and the served filename are the truth. */
export interface StrategyDownload {
  blob: Blob;
  /** From Content-Disposition when the server names the file. */
  filename: string | null;
  /** The type the server actually produced, which may not be what was asked. */
  contentType: string;
}

export async function downloadStrategy(
  format: "pdf" | "docx" | "md" | "json"
): Promise<StrategyDownload> {
  const res = await fetch(`${BASE}/strategy/download?format=${format}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (res.status === 404 || res.status === 401) throw new LifeUnavailableError();
  if (!res.ok) throw new LifeRequestError(res.status);
  return {
    blob: await res.blob(),
    filename: filenameFromDisposition(res.headers.get("Content-Disposition")),
    contentType: res.headers.get("Content-Type") ?? "application/octet-stream",
  };
}

/** The server's own name for the file, or null. Handles RFC 5987 (filename*)
 *  first, since that is the one carrying non-ASCII names correctly. */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, "")) || null;
    } catch {
      // A malformed escape is not worth failing a download over.
    }
  }
  const plain = /filename=("?)([^";]+)\1/i.exec(header);
  return plain ? plain[2].trim() || null : null;
}

/** The extension that matches what the server ACTUALLY sent, for the fallback
 *  filename when there is no Content-Disposition. Unknown → ".md", because
 *  markdown is what this endpoint degrades to. */
export function extensionForContentType(contentType: string): string {
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (type === "application/pdf") return ".pdf";
  if (
    type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return ".docx";
  if (type === "application/json") return ".json";
  return ".md";
}

/* ----------------------- opt-in reminders (item 12) ----------------------- */
/* Founder decision 2026-07-30: web-push reminders exist ONLY behind explicit
 * per-user opt-in. Every default is off; these calls are the user flipping
 * their own switches and registering their own browser. */

export interface LifeReminderSettings {
  morningEnabled: boolean;
  eveningEnabled: boolean;
  /** The checkout ladder (founder, extended 2026-07-30): weekly through
   *  ten-year. Longer cadences deep-link to existing surfaces; there are no
   *  checkout views. */
  weeklyEnabled: boolean;
  monthlyEnabled: boolean;
  quarterlyEnabled: boolean;
  yearlyEnabled: boolean;
  fiveyearEnabled: boolean;
  tenyearEnabled: boolean;
  tzOffsetMinutes: number;
}

export interface LifeReminderState {
  settings: LifeReminderSettings;
  /** null ⇒ the server has no VAPID keys; the FE hides the section behind a
   *  hint rather than offering switches that cannot work. */
  publicKey: string | null;
  subscribed: boolean;
}

function mapReminderSettings(raw: unknown): LifeReminderSettings {
  const r =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    morningEnabled: r.morning_enabled === true,
    eveningEnabled: r.evening_enabled === true,
    weeklyEnabled: r.weekly_enabled === true,
    monthlyEnabled: r.monthly_enabled === true,
    quarterlyEnabled: r.quarterly_enabled === true,
    yearlyEnabled: r.yearly_enabled === true,
    fiveyearEnabled: r.fiveyear_enabled === true,
    tenyearEnabled: r.tenyear_enabled === true,
    tzOffsetMinutes:
      typeof r.tz_offset_minutes === "number" ? r.tz_offset_minutes : 0,
  };
}

export async function fetchReminders(): Promise<LifeReminderState> {
  const raw = (await call("/reminders")) as Record<string, unknown> | null;
  return {
    settings: mapReminderSettings(raw?.settings),
    publicKey: typeof raw?.public_key === "string" ? raw.public_key : null,
    subscribed: raw?.subscribed === true,
  };
}

export async function saveReminderSettings(patch: {
  morningEnabled?: boolean;
  eveningEnabled?: boolean;
  weeklyEnabled?: boolean;
  monthlyEnabled?: boolean;
  quarterlyEnabled?: boolean;
  yearlyEnabled?: boolean;
  fiveyearEnabled?: boolean;
  tenyearEnabled?: boolean;
  tzOffsetMinutes?: number;
}): Promise<LifeReminderSettings> {
  const body: Record<string, unknown> = {};
  const slots: Array<[keyof typeof patch, string]> = [
    ["morningEnabled", "morning_enabled"],
    ["eveningEnabled", "evening_enabled"],
    ["weeklyEnabled", "weekly_enabled"],
    ["monthlyEnabled", "monthly_enabled"],
    ["quarterlyEnabled", "quarterly_enabled"],
    ["yearlyEnabled", "yearly_enabled"],
    ["fiveyearEnabled", "fiveyear_enabled"],
    ["tenyearEnabled", "tenyear_enabled"],
  ];
  for (const [camel, snake] of slots) {
    if (patch[camel] !== undefined) body[snake] = patch[camel];
  }
  if (patch.tzOffsetMinutes !== undefined)
    body.tz_offset_minutes = patch.tzOffsetMinutes;
  const raw = (await call("/reminders", {
    method: "PUT",
    body,
  })) as Record<string, unknown> | null;
  return mapReminderSettings(raw?.settings);
}

/** Store this browser's push subscription (the serialized PushSubscription). */
export async function saveReminderSubscription(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<void> {
  await call("/reminders/subscription", {
    method: "POST",
    body: subscription,
  });
}

export async function deleteReminderSubscription(
  endpoint?: string
): Promise<void> {
  await call("/reminders/subscription", {
    method: "DELETE",
    body: endpoint ? { endpoint } : {},
  });
}

/* ------------------------- editable check-in copy ------------------------- */
/* Founder decision 2026-07-30, "my copy as default, editable": the mantra
 * header and the distraction question ship with the founder's strings (the
 * DAY block in lib/life/copy.ts) and a user may reword them. null means "use
 * the default", so clearing a field restores the original line. */

export interface LifeUserCopy {
  mantraTitle: string | null;
  mantraQuestion: string | null;
  distractionQuestion: string | null;
}

function mapUserCopy(raw: unknown): LifeUserCopy {
  const r =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const text = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v : null;
  return {
    mantraTitle: text(r.mantra_title),
    mantraQuestion: text(r.mantra_question),
    distractionQuestion: text(r.distraction_question),
  };
}

export async function fetchUserCopy(): Promise<LifeUserCopy> {
  const raw = (await call("/copy")) as Record<string, unknown> | null;
  return mapUserCopy(raw?.copy);
}

/** Empty string or null in a field ⇒ back to the founder's line. */
export async function saveUserCopy(patch: {
  mantraTitle?: string | null;
  mantraQuestion?: string | null;
  distractionQuestion?: string | null;
}): Promise<LifeUserCopy> {
  const body: Record<string, unknown> = {};
  if (patch.mantraTitle !== undefined) body.mantra_title = patch.mantraTitle;
  if (patch.mantraQuestion !== undefined)
    body.mantra_question = patch.mantraQuestion;
  if (patch.distractionQuestion !== undefined)
    body.distraction_question = patch.distractionQuestion;
  const raw = (await call("/copy", {
    method: "PUT",
    body,
  })) as Record<string, unknown> | null;
  return mapUserCopy(raw?.copy);
}

/* ----------------------------- export / delete ---------------------------- */

/** Ships in P1, not "later" (spec §2 / FE-10). Returns the raw file so the
 *  caller can hand it straight to a download. */
export async function exportLifeData(): Promise<Blob> {
  const res = await fetch(`${BASE}/export`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  if (res.status === 404 || res.status === 401) throw new LifeUnavailableError();
  if (!res.ok) throw new LifeRequestError(res.status);
  return res.blob();
}

/** Irreversible. The caller must have taken a typed confirmation first. */
export async function deleteLifeData(confirm: string): Promise<void> {
  await call("/data", { method: "DELETE", body: { confirm } });
}
