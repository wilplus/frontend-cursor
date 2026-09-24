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

  /** Does this exercise also get a write-up on the journal?
   *
   *  It used to be forced: the lane's last four screens were the post and
   *  there was no way past them. Since 2026-09-23 (backend migration 0353) an
   *  exercise stands on its video and its instruction, and the write-up is a
   *  companion the author may decline. Untick it and the post screens do not
   *  render at all — see `stepsFor`. */
  publishPost: boolean;

  /** May this recording seed a future avatar? Perishable: only the person in
   *  the room knows whether the shirt, angle and light matched. */
  avatarEligible: boolean;

  /** WHICH setup it was shot in — the same short string for every clip shot
   *  the same way. Required whenever `avatarEligible`, because a bare yes says
   *  a clip was shot carefully but never that two clips MATCH, and matching is
   *  the whole requirement of a training set. */
  avatarSetupLabel: string;
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
    publishPost: true,
    avatarEligible: false,
    avatarSetupLabel: "",
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

/** The screens that only exist because the exercise also becomes a post.
 *  Kept as one named list so `stepsFor` drops them as a unit and nobody has to
 *  remember which four they were. */
const POST_STEP_IDS = new Set(["writeup", "cover", "details"]);

export const EXERCISE_STEPS: StepDef[] = [
  {
    id: "record",
    heading: "Show the exercise",
    problem: (d) => (d.videoUrl ? null : "Record it, or add a video another way."),
  },
  {
    id: "where",
    heading: "Where does this go?",
    problem: (d) =>
      d.avatarEligible && !d.avatarSetupLabel.trim()
        ? "Name the setup — the same label for every clip with this shirt, angle and light."
        : null,
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
    // OPTIONAL (founder 2026-09-24: "that is not obligatory!"). A video is
    // required and always was, so what this allows is an exercise that
    // DEMONSTRATES rather than describes — the shape the speaker's screen
    // already takes, with the coach's recording first and the words below it.
    // The backend stopped requiring them in the same change; relaxing only
    // here would have moved the refusal to the end of a nine-screen lane.
    problem: () => null,
    skippable: true,
  },
  {
    id: "writeup",
    heading: "The write-up",
    problem: (d) => needs(d.body, "A post with nothing written on it helps nobody."),
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

/** The screens this draft actually walks.
 *
 *  DRAFT-AWARE SINCE 2026-09-23, and that is the point of the change rather
 *  than a detail of it. The three ticks on the `where` screen decide the SHAPE
 *  of the rest of the lane: decline the write-up and the four post screens do
 *  not render, so nobody walks a cover picker for a post they already said
 *  they did not want. It is also why `where` sits at position two — the lane
 *  needs the answer before it can know how long it is.
 *
 *  Overload kept for the `Lane`-only callers: they ask "how long is a fresh
 *  exercise lane", and a fresh one publishes. */
export function stepsFor(input: Lane | LaneDraft): StepDef[] {
  const lane = typeof input === "string" ? input : input.lane;
  if (lane !== "exercise") return POST_STEPS;
  const publish = typeof input === "string" ? true : input.publishPost;
  return publish
    ? EXERCISE_STEPS
    : EXERCISE_STEPS.filter((s) => !POST_STEP_IDS.has(s.id));
}

/** 1-based, clamped into the lane. An out-of-range step in the URL lands on a
 *  real screen rather than a blank one. */
export function clampStep(lane: Lane | LaneDraft, raw: unknown): number {
  const total = stepsFor(lane).length;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.trunc(n), 1), total);
}
