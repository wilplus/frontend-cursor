/**
 * Setup drafts — a brand-new project's half-answered setup (founder
 * 2026-09-25). Someone who answers at least one setup question and then gets
 * interrupted (closes the overlay, leaves the page, the tab dies) finds the
 * project in the picker as a draft and resumes it where they left off.
 *
 * THIS DEVICE ONLY, by founder choice: a draft is browser storage, scoped to
 * the account (or this browser's guest lane) exactly like the explore-arc seed,
 * so an account switch never shows another person's draft. A draft is NOT a
 * project: it has no arc, no take and no server identity until Take 1 is
 * submitted, at which point it is deleted and the real project takes over.
 *
 * Only continuous fields are kept. An attached brief is a File and cannot be
 * stored, so it has to be attached again; an uploaded slide PDF is a served
 * ref and survives.
 *
 * "Active" is which draft the setup flow currently writes to. It is set ONLY
 * by the new-project entries (start a new project / resume a draft) and
 * cleared by everything else, so a continued take of an existing project can
 * never be written into a draft.
 */

const KEY_PREFIX = "willab_setup_drafts:v1";

export interface SetupDraft {
  id: string;
  updatedAt: string;
  step: number;
  topic: string;
  audience: string;
  desiredCallToAction: string;
  lengthSec: number | null;
  slides: { title: string; body: string }[];
  presentationRef: string | null;
  strategicContext: string;
}

export type SetupDraftFields = Omit<SetupDraft, "id" | "updatedAt">;

interface Store {
  active: string | null;
  drafts: SetupDraft[];
}

export function setupDraftStorageKey(ownerId: string | null): string {
  return `${KEY_PREFIX}:${ownerId ?? "guest"}`;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

function pickDraft(raw: unknown): SetupDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.id !== "string" || d.id.length === 0) return null;
  const slides = (Array.isArray(d.slides) ? d.slides : [])
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({ title: str(s.title), body: str(s.body) }));
  return {
    id: d.id,
    updatedAt: str(d.updatedAt),
    step: typeof d.step === "number" && d.step >= 0 ? Math.floor(d.step) : 0,
    topic: str(d.topic),
    audience: str(d.audience),
    desiredCallToAction: str(d.desiredCallToAction),
    lengthSec:
      typeof d.lengthSec === "number" && d.lengthSec > 0 ? d.lengthSec : null,
    slides,
    presentationRef:
      typeof d.presentationRef === "string" && d.presentationRef.length > 0
        ? d.presentationRef
        : null,
    strategicContext: str(d.strategicContext),
  };
}

function read(ownerId: string | null): Store {
  try {
    const raw = localStorage.getItem(setupDraftStorageKey(ownerId));
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    const drafts = (Array.isArray(parsed?.drafts) ? parsed.drafts : [])
      .map(pickDraft)
      .filter((d): d is SetupDraft => !!d);
    const active = typeof parsed?.active === "string" ? parsed.active : null;
    return { active, drafts };
  } catch {
    return { active: null, drafts: [] };
  }
}

function write(ownerId: string | null, store: Store): void {
  try {
    const key = setupDraftStorageKey(ownerId);
    if (!store.active && store.drafts.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(store));
  } catch {
    /* storage unavailable (private mode / quota) — drafts are a convenience */
  }
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `d-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** "At least one question answered" — the bar a setup must clear to be kept
 *  as a draft. Topic, audience, call to action and context count once they
 *  hold text; length once a preset is picked; slides once any carry content. */
export function isDraftWorthKeeping(f: SetupDraftFields): boolean {
  return (
    f.topic.trim().length > 0 ||
    f.audience.trim().length > 0 ||
    f.desiredCallToAction.trim().length > 0 ||
    f.strategicContext.trim().length > 0 ||
    f.lengthSec !== null ||
    f.presentationRef !== null ||
    f.slides.some((s) => s.title.trim().length > 0 || s.body.trim().length > 0)
  );
}

/** Every draft, most recently touched first. */
export function listSetupDrafts(ownerId: string | null): SetupDraft[] {
  return [...read(ownerId).drafts].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

/** The draft the setup flow is writing to right now, if any. */
export function readActiveSetupDraft(
  ownerId: string | null
): { id: string; draft: SetupDraft | null } | null {
  const store = read(ownerId);
  if (!store.active) return null;
  return {
    id: store.active,
    draft: store.drafts.find((d) => d.id === store.active) ?? null,
  };
}

/** "Start a new project" — a fresh draft slot. Nothing is stored until a
 *  question is answered. */
export function beginSetupDraft(ownerId: string | null): void {
  const store = read(ownerId);
  write(ownerId, { ...store, active: newId() });
}

/** Resume a draft from the picker. */
export function resumeSetupDraft(ownerId: string | null, id: string): void {
  const store = read(ownerId);
  if (!store.drafts.some((d) => d.id === id)) return;
  write(ownerId, { ...store, active: id });
}

/** Any entry that is NOT a new project (continuing one) stops draft writes. */
export function clearActiveSetupDraft(ownerId: string | null): void {
  const store = read(ownerId);
  if (store.active) write(ownerId, { ...store, active: null });
}

/** Write the active draft. A setup emptied back to nothing is removed rather
 *  than left in the list as a blank draft. */
export function saveSetupDraft(
  ownerId: string | null,
  id: string,
  fields: SetupDraftFields
): void {
  const store = read(ownerId);
  if (store.active !== id) return; // superseded by another entry — never clobber
  const rest = store.drafts.filter((d) => d.id !== id);
  const drafts = isDraftWorthKeeping(fields)
    ? [...rest, { ...fields, id, updatedAt: new Date().toISOString() }]
    : rest;
  write(ownerId, { active: store.active, drafts });
}

/** Delete a draft — from the picker's menu, or because Take 1 was submitted
 *  and the draft became a real project. */
export function deleteSetupDraft(ownerId: string | null, id: string): void {
  const store = read(ownerId);
  write(ownerId, {
    active: store.active === id ? null : store.active,
    drafts: store.drafts.filter((d) => d.id !== id),
  });
}
