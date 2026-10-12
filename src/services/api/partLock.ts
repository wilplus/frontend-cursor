import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  partLock — lock or unlock one section of the ideal text.                    */
/*  SPEC-parts-locking-and-layers §4, R3, R5.                                  */
/*                                                                            */
/*  A LOCK IS NOT A SETTING. It changes which INTERVENTION LAYER may fire on    */
/*  that section: open takes composition (the machine may propose changing the */
/*  words), locked takes accentuation (it may only propose styling words       */
/*  already there). Offering the wrong one is worse than offering nothing — a   */
/*  rewrite destroys memorisation the speaker has already paid for, and an     */
/*  emphasis styles a sentence about to be replaced.                           */
/*                                                                            */
/*  `textEcho` IS THE DOCUMENT THE STUDENT WAS LOOKING AT, and the server       */
/*  requires it. A lock is a claim about SPECIFIC WORDS, so it has to name      */
/*  them: between the read and the tap a take can assemble or the coach can     */
/*  verify, and locking a section id against a document that moved settles a    */
/*  paragraph the student never read.                                          */
/* -------------------------------------------------------------------------- */

export type PartLockResult =
  | {
      kind: "ok";
      locked: boolean;
      rootPhraseProposal: RootPhraseSpan | null;
    }
  /** 409 UNDECIDED — R3. Suggestions on this section are still open, and
   *  locking would make them unreachable. The caller shows the founder-approved
   *  line; it does NOT decide them on the student's behalf, because that would
   *  write a decision they never made. */
  | { kind: "undecided" }
  /** 409 STALE_DOCUMENT — the document moved. Refetch; the text visibly
   *  refreshing is the message, so there is no copy for this. */
  | { kind: "stale" }
  /** Not deployed, not owned, or the request failed. */
  | { kind: "error" };

export async function setPartLock(
  arcId: string,
  partId: string,
  locked: boolean,
  textEcho: string,
  opts?: {
    /** SEED-ON-LOCK (SPEC-lockin-loop §2). The founder's loop locks a
     *  paragraph the student never manually edited — and an unedited document
     *  has no server-stored identity, so the lock used to 409 STALE forever
     *  on exactly the DoD flow. Sending the client-derived list lets the BE
     *  validate and adopt it (same trust model as the user-edit PUT: client
     *  mints, server validates). Ignored server-side whenever stored identity
     *  already exists; lock flags are NOT sent — the seed lands all open and
     *  only this request's target locks, behind the R3 gate. */
    seedParts?: ReadonlyArray<{ id: string; text: string }> | null;
    /** Explicitly distinguishes an ordinary unlock from the post-review
     *  "Keep evolving" versioning decision in the immutable revision log. */
    reason?: "keep_evolving";
  }
): Promise<PartLockResult> {
  const res = await bffFetch(
    `/api/v2/explore/arc/${encodeURIComponent(arcId)}/parts/${encodeURIComponent(partId)}/lock`,
    {
      method: "PUT",
      auth: "optional",
      credentials: "include",
      json: {
        locked,
        text_echo: textEcho,
        ...(opts?.seedParts && opts.seedParts.length > 0
          ? { parts: opts.seedParts.map((p) => ({ id: p.id, text: p.text })) }
          : {}),
        ...(opts?.reason ? { reason: opts.reason } : {}),
      },
    }
  );
  if (res.kind !== "response") return { kind: "error" };
  const body = res.body as Record<string, unknown> | null;
  if (res.status === 409) {
    // Two different 409s share the status; the code discriminates them, and
    // they need different handling — one is a message, the other a refetch.
    return body?.code === "UNDECIDED" ? { kind: "undecided" } : { kind: "stale" };
  }
  if (!res.ok) return { kind: "error" };
  return {
    kind: "ok",
    locked,
    rootPhraseProposal: mapRootPhraseSpan(body?.root_phrase_proposal),
  };
}

export interface RootPhraseSpan {
  text: string;
  start: number;
  end: number;
}

function mapRootPhraseSpan(raw: unknown): RootPhraseSpan | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (
    typeof row.text !== "string" ||
    !row.text ||
    typeof row.start !== "number" ||
    !Number.isInteger(row.start) ||
    typeof row.end !== "number" ||
    !Number.isInteger(row.end) ||
    row.start < 0 ||
    row.end <= row.start
  ) return null;
  return { text: row.text, start: row.start, end: row.end };
}

export async function setPartRootPhrase(
  arcId: string,
  partId: string,
  textEcho: string,
  phrase: RootPhraseSpan | null,
): Promise<boolean> {
  const res = await bffFetch(
    `/api/v2/explore/arc/${encodeURIComponent(arcId)}/parts/${encodeURIComponent(partId)}/root`,
    {
      method: "PUT",
      auth: "optional",
      credentials: "include",
      json: {
        text_echo: textEcho,
        phrase: phrase?.text ?? null,
        start: phrase?.start ?? null,
        end: phrase?.end ?? null,
      },
    }
  );
  return res.kind === "response" && res.ok;
}

/** Helper words taken from an earlier Take (founder lock 2026-09-30, B4,
 *  D5): the words need not be in the current text, so they go to the
 *  Slide rather than to a span of the paragraph. `takeIndex` is the Take
 *  whose version of the paragraph they were tapped in. The lock that
 *  follows is `setPartLock`, as for any pick. */
export async function setPartHelperWordsFromTake(
  arcId: string,
  partId: string,
  phrase: string,
  takeIndex: number,
): Promise<boolean> {
  const res = await bffFetch(
    `/api/v2/explore/arc/${encodeURIComponent(arcId)}/parts/${encodeURIComponent(partId)}/helper-words`,
    { method: "PUT", auth: "optional", credentials: "include", json: { phrase, take_index: takeIndex } }
  );
  return res.kind === "response" && res.ok;
}
