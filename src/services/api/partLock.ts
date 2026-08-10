import { getAuthToken } from "@/lib/api/auth-client";

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
  | { kind: "ok"; locked: boolean }
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
  }
): Promise<PartLockResult> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/parts/${encodeURIComponent(
        partId
      )}/lock`,
      {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({
          locked,
          text_echo: textEcho,
          ...(opts?.seedParts && opts.seedParts.length > 0
            ? {
                parts: opts.seedParts.map((p) => ({ id: p.id, text: p.text })),
              }
            : {}),
        }),
      }
    );
  } catch {
    return { kind: "error" };
  }
  if (res.status === 409) {
    // Two different 409s share the status; the code discriminates them, and
    // they need different handling — one is a message, the other a refetch.
    const body = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    return body?.code === "UNDECIDED" ? { kind: "undecided" } : { kind: "stale" };
  }
  if (!res.ok) return { kind: "error" };
  return { kind: "ok", locked };
}
