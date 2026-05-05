/**
 * Shared shapes for the user-facing /results page.
 *
 * Designed so the page can swap inline MOCK_DATA for a real API payload
 * (e.g. GET /api/results/me) without touching component code.
 */

import type { AcousticMetric } from "@/components/results/journey/AcousticToggle";

/**
 * High-level state machine for the page.
 *  - "processing": backend hasn't published this user's results yet
 *  - "ready":      results are published and ready to view
 *  - "completed":  alias for "ready" used by some upstream payloads
 */
export type ResultsStatus = "processing" | "ready" | "completed";

/**
 * One snippet inside a session. Type alias of JourneySnippet so callers
 * can use the shorter spec name `Snippet`.
 */
export interface Snippet {
  id: string;
  type: "charisma" | "stress";
  /** Display duration label, e.g. "0:15". */
  duration: string;
  /** Pill text near the play control, e.g. "Charisma Moment". */
  badgeLabel: string;
  /** Coach's insight body shown under the player. */
  insight: string;
  /** CTA copy on the action button. */
  ctaLabel: string;
  metrics: AcousticMetric[];
  /** Optional: real audio URL when wired. */
  audioUrl?: string;
}

/** A session bundles its title + the snippets the admin published. */
export interface JourneySession {
  id: string;
  title: string;
  snippets: Snippet[];
}

/**
 * Top-level payload the future /api/results/me endpoint should return.
 * Backend keys to confirm:
 *  - status                — see ResultsStatus
 *  - current_session_index — 1-based number for the progress tracker
 *  - total_sessions        — N in "Session 1 of N"
 *  - sessions[]            — JourneySession[]
 *  - ai_summary?           — TODO(backend): plain-text summary line
 */
export interface VoiceJourneyPayload {
  status: ResultsStatus;
  current_session_index: number;
  total_sessions: number;
  sessions: JourneySession[];
  ai_summary?: string | null;
}

export type { AcousticMetric };
