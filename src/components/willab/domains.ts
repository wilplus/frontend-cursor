/* -------------------------------------------------------------------------- */
/*  willab domains — the locked §2 table (single source of truth)             */
/*                                                                            */
/*  Enum keys ARE the contract (§2 implementer notes): store the key, render   */
/*  the label, keep keys stable — the coach packet and session_context (§4)    */
/*  reference them. Intake (§2) consumes the labels + goal placeholders; the    */
/*  Lab session_context form (§4) seeds `domain_vocabulary` from `vocabulary`.  */
/*  Exactly five, bounded by design Decisions 6 & 9 — do not add or substitute.*/
/* -------------------------------------------------------------------------- */

export type WillabDomain =
  | "public_speaking"
  | "sales"
  | "executive_presence"
  | "customer_service"
  | "interview_prep";

export interface DomainSpec {
  /** Stable enum key — the metadata contract. */
  key: WillabDomain;
  /** Chip label (no gloss — the population self-identifies its domain). */
  label: string;
  /** Rotating example copy for the goal free-text field; nudges, never constrains. */
  goalPlaceholder: string;
  /** Editable default for `session_context.domain_vocabulary` (§4) + Whisper prime. */
  vocabulary: string[];
}

export const WILLAB_DOMAINS: readonly DomainSpec[] = [
  {
    key: "public_speaking",
    label: "Public speaking",
    goalPlaceholder: "I want to keep my nerve through the opening minute of a talk.",
    vocabulary: ["keynote", "slide", "audience", "podium", "Q&A", "pacing"],
  },
  {
    key: "sales",
    label: "Sales",
    goalPlaceholder: "I want to sound steady when I get to pricing.",
    vocabulary: ["pipeline", "objection", "close", "discovery call", "pitch", "quota"],
  },
  {
    key: "executive_presence",
    label: "Executive presence",
    goalPlaceholder: "I want to command the room in leadership updates.",
    vocabulary: ["board", "stakeholder", "all-hands", "gravitas", "brief", "alignment"],
  },
  {
    key: "customer_service",
    label: "Customer service",
    goalPlaceholder: "I want to stay calm with an angry caller.",
    vocabulary: ["ticket", "escalation", "resolution", "caller", "SLA", "de-escalate"],
  },
  {
    key: "interview_prep",
    label: "Interview preparation",
    goalPlaceholder: "I want to stop rushing my answers under pressure.",
    vocabulary: ["recruiter", "behavioral question", "STAR", "panel", "role", "offer"],
  },
] as const;

/** Look up a domain spec by key (falls back to the first — all keys are present). */
export function domainSpec(key: WillabDomain): DomainSpec {
  return WILLAB_DOMAINS.find((d) => d.key === key) ?? WILLAB_DOMAINS[0];
}
