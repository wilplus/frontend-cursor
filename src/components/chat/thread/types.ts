/**
 * Unified bubble schema for the `/chat` thread.
 *
 * ONE array carries every bubble shown on the surface: AI questions,
 * user audio, typing dots, raw acoustic metrics, the Calm-Anchor
 * dashboard, snippet players, pending YES/NO action prompts, and
 * file-upload status messages. ChatInterview (recording engine) and
 * ChatPageClient (everything else) both write into this shared array
 * via the bubble-lifecycle API in `useThread`.
 *
 * Variants are discriminated by `kind`. Optional fields on `bot_text`
 * / `user_audio` carry recording-context the LLM-question rebuild path
 * inside ChatInterview needs (fullText for chunked replies,
 * isChunkContinuation to skip continuations when reconstructing the
 * logical message, tone for charisma/stress chunked styling,
 * transcript on user audio for the previous-turns chain).
 *
 * Recording-context fields are presentation-INVISIBLE — the
 * `ThreadView` renderer ignores them. Keeping them on the same
 * objects (rather than a parallel map) keeps the API surface tight
 * for FE Prompt 1; if the metadata pollution becomes painful later
 * it can move out without breaking the renderer contract.
 *
 * `pending?: boolean` is the optimistic-update flag — set true when
 * a bubble is appended before the backend acknowledges, then committed
 * via `updateBubble(id, { pending: false })` on success, or
 * `replaceBubble(id, errorBubble)` on failure. No caller uses this
 * in FE Prompt 1; FE Prompt 3 will be the first consumer for the
 * snippet-label echo bubble.
 */

import type {
  AcousticMetricsBubbleData,
  DashboardBubbleData,
  SnippetPlayerData,
  StressContrastBubbleData,
} from "@/components/chat/RichBubbles";

export type Bubble =
  | {
      id: string;
      kind: "bot_text";
      text: string;
      /** Charisma/stress tone tag for chunked AI questions. */
      tone?: "charisma" | "stress";
      /** First chunk of a `|||`-delimited LLM reply holds the joined
       *  full text so buildPreviousTurns can rebuild the logical
       *  message as a single turn. */
      fullText?: string;
      /** Chunks 1..N (continuations) are skipped by
       *  buildPreviousTurns so the LLM doesn't see N turns for one
       *  logical message. */
      isChunkContinuation?: boolean;
      pending?: boolean;
      /**
       * Internal classification tag for ChatInterview's
       * previous-turns reconstruction. `"farewell"` flags the
       * end-of-session bubble so it's filtered out of the LLM
       * context (the model doesn't need "we'll analyse it!" as
       * a prior question). Before the lift this was tagged via
       * a hard-coded id ("farewell"); ids are now client-UUIDs
       * so the role moves to this typed field.
       */
      meta?: "farewell";
    }
  | {
      id: string;
      kind: "user_text";
      text: string;
      pending?: boolean;
    }
  | {
      id: string;
      kind: "user_audio";
      audioUrl?: string;
      duration?: string;
      /** Whisper transcript landed via upload-answer. Paired with the
       *  preceding bot_text bubble in buildPreviousTurns to give the
       *  LLM a full Q→A chain. */
      transcript?: string | null;
    }
  | { id: string; kind: "typing" }
  | { id: string; kind: "metrics"; data: AcousticMetricsBubbleData }
  | { id: string; kind: "dashboard"; data: DashboardBubbleData }
  | { id: string; kind: "contrast"; data: StressContrastBubbleData }
  | { id: string; kind: "snippet"; data: SnippetPlayerData }
  | {
      id: string;
      kind: "action_pending";
      snippetId: string;
      snippetType: "charisma" | "stress";
      submitting: boolean;
      errored?: boolean;
    };

export type BubbleKind = Bubble["kind"];

/**
 * Phase state machine for the `/chat` surface. Lives here (rather
 * than inline in `page.client.tsx`) so the pure derivation helpers
 * in `toolbar.ts` can type their inputs without circular imports.
 * See the matrix in `docs/PANEL-STATE-MATRIX.md` for the meaning
 * of each phase.
 */
export type Phase =
  | "loading"
  | "onboarding"
  | "compiling"
  | "metrics_ask"
  | "welcome_back"
  | "q_and_a"
  | "reviewing"
  | "roleplaying"
  | "error";

/**
 * Distributed `Omit` over the discriminated union. Plain
 * `Omit<Bubble, "id">` collapses to `Pick<Bubble, keyof Bubble ∩
 * "id">` and drops every non-shared field (i.e. it returns
 * `{ kind: ... }` only), which makes append/replace callers fail
 * excess-property checks for `text`/`data`/`snippetId`/etc. Passing
 * the union through a generic alias forces TS to distribute the
 * mapped type across each variant, producing the union of bubbles
 * each with its id field stripped.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;
export type BubbleInput = DistributiveOmit<Bubble, "id">;
