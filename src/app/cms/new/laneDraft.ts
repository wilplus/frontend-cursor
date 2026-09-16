/* -------------------------------------------------------------------------- */
/*  THE LANE DRAFT (founder 2026-09-16, "one action per screen")               */
/*                                                                            */
/*  Everything both lanes collect, in one flat object, mirrored to             */
/*  sessionStorage on every change. The point is not tidiness: a lane is eight */
/*  screens long, and an author who loses a recording to a stray back-swipe    */
/*  does not make a second exercise.                                          */
/*                                                                            */
/*  sessionStorage, never localStorage — the same rule the CMS password        */
/*  follows. It dies with the tab.                                            */
/*                                                                            */
/*  The VIDEO is the one thing not kept here. A recorded File cannot be        */
/*  serialised, so the lane uploads it as soon as it is accepted and keeps the */
/*  returned URL instead. That also means a restored draft has a working       */
/*  video rather than a blob URL pointing at nothing.                          */
/* -------------------------------------------------------------------------- */

export const DRAFT_KEY = "willpower.cms.lane";

export type Lane = "post" | "exercise";

export interface LaneDraft {
  lane: Lane;
  /** Set once the post exists on the server, so later steps update rather than
   *  create a second one. */
  postId: string | null;

  title: string;
  slug: string;
  excerpt: string;
  body: string;
  category: string;
  author: string;
  publishedAt: string;
  readMinutes: string;

  coverKind: "image" | "video" | "audio";
  coverUrl: string;
  coverAlt: string;

  /* exercise lane only */
  exerciseId: string;
  videoUrl: string;
  videoSeconds: number;
  tags: string[];
  opening: string;
  instruction: string;
}

export function blankDraft(lane: Lane): LaneDraft {
  return {
    lane,
    postId: null,
    title: "",
    slug: "",
    excerpt: "",
    body: "",
    category: "others",
    author: "Willpower Lab",
    publishedAt: "",
    readMinutes: "",
    coverKind: "image",
    coverUrl: "",
    coverAlt: "",
    exerciseId: "",
    videoUrl: "",
    videoSeconds: 0,
    tags: [],
    opening: "",
    instruction: "",
  };
}

/** A slug or exercise id from a human title.
 *
 *  `keep` is the character allowed between words: posts use hyphens, and the
 *  exercise catalogue accepts both. Matching is exact string comparison on the
 *  server, so a capital or a space here routes nothing and reports nothing. */
export function slugify(title: string, keep: "-" | "_" = "-"): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, keep)
    .replace(new RegExp(`^[^a-z]+`), "")
    .replace(new RegExp(`\\${keep}+$`), "")
    .slice(0, 59);
}

export function loadDraft(): LaneDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LaneDraft>;
    if (parsed.lane !== "post" && parsed.lane !== "exercise") return null;
    // Merged over a blank so a draft written by an older build — one missing a
    // field added since — restores instead of throwing the author back to the
    // start of the lane.
    return { ...blankDraft(parsed.lane), ...parsed };
  } catch {
    return null;
  }
}

export function saveDraft(draft: LaneDraft): void {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* a full or blocked store must not stop the author mid-lane */
  }
}

export function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/* -------------------------------------------------------------------------- */
/*  Steps                                                                      */
/* -------------------------------------------------------------------------- */

export interface StepDef {
  id: string;
  /** What the author is deciding. One thing. */
  heading: string;
  /** null when the step may be left empty. */
  problem: (draft: LaneDraft) => string | null;
  skippable?: boolean;
}

const needs = (value: string, said: string) =>
  value.trim() ? null : said;

export const EXERCISE_STEPS: StepDef[] = [
  {
    id: "record",
    heading: "Show the exercise",
    problem: (d) => (d.videoUrl ? null : "Record it, or add a video another way."),
  },
  {
    id: "name",
    heading: "Name it",
    problem: (d) =>
      needs(d.title, "Give it a name.") ??
      (/^[a-z][a-z0-9_-]{1,62}$/.test(d.exerciseId)
        ? null
        : "Id: lower-case letters, digits, hyphens and underscores only."),
  },
  {
    id: "fixes",
    heading: "What does it fix?",
    problem: (d) =>
      d.tags.length
        ? null
        : "Pick at least one — an exercise that treats nothing is never offered.",
  },
  {
    id: "words",
    heading: "The words",
    problem: (d) =>
      needs(d.opening, "Write what they see first.") ??
      needs(d.instruction, "Write what they do."),
  },
  {
    id: "writeup",
    heading: "The write-up",
    problem: (d) => needs(d.body, "An exercise goes live on a published post."),
  },
  { id: "cover", heading: "Cover", problem: () => null, skippable: true },
  {
    id: "details",
    heading: "Details",
    problem: (d) => needs(d.slug, "Give it an address."),
  },
  { id: "publish", heading: "Ready", problem: () => null },
];

export const POST_STEPS: StepDef[] = [
  { id: "title", heading: "Title", problem: (d) => needs(d.title, "Give it a title.") },
  { id: "cover", heading: "Cover", problem: () => null, skippable: true },
  { id: "excerpt", heading: "Excerpt", problem: () => null, skippable: true },
  { id: "body", heading: "Body", problem: (d) => needs(d.body, "Write something.") },
  { id: "community", heading: "Community prompts", problem: () => null, skippable: true },
  {
    id: "publish",
    heading: "Ready",
    problem: (d) => needs(d.slug, "Give it an address."),
  },
];

export function stepsFor(lane: Lane): StepDef[] {
  return lane === "exercise" ? EXERCISE_STEPS : POST_STEPS;
}

/** 1-based, clamped into the lane. An out-of-range step in the URL lands on a
 *  real screen rather than a blank one. */
export function clampStep(lane: Lane, raw: unknown): number {
  const total = stepsFor(lane).length;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.trunc(n), 1), total);
}
