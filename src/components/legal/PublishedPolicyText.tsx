"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fetchAuthorization } from "@/services/api/processingAuthorization";
import {
  policyTextState,
  type PolicyTextState,
  type Which,
} from "@/lib/legal/policyText";

/* -------------------------------------------------------------------------- */
/*  Render the policy text the DATABASE stores, not a copy of it (Task 4).     */
/*                                                                            */
/*  `03-article-50-assessment-v1.0-DRAFT.md` §6 gap 3, and it is the one the   */
/*  assessment says to fix first — less an Article 50 problem than the         */
/*  foundation the whole receipt mechanism rests on.                           */
/*                                                                            */
/*  While /terms and /privacy are hardcoded JSX, the text a user READS and the */
/*  text whose hash they ACCEPT are two separate artifacts that can drift      */
/*  apart with nothing to notice. POLICY_COPY_HASH_MISMATCH and                */
/*  PROCESSING_POLICY_STALE both guard the stored copy, and neither can see a  */
/*  separately maintained React page. The receipt would then prove agreement   */
/*  to words nobody was ever shown — which is worse than having no receipt,    */
/*  because it looks like evidence.                                            */
/*                                                                            */
/*  THE FALLBACK IS FOR CRAWLERS, NOT FOR PEOPLE. The static JSX renders on    */
/*  the server so the pages stay indexable and readable with JS off, and the   */
/*  moment the policy record answers it is replaced. It carries its own        */
/*  version and effective date in its header, so a reader who gets it is never */
/*  told something untrue — see the note above the fallback return.            */
/*                                                                            */
/*  The stored copy is PLAIN TEXT on purpose (the pack: "their exact bytes are */
/*  what gets hashed"), so it is rendered with preserved whitespace and never  */
/*  parsed, styled per-line, or run through a markdown renderer. Anything that */
/*  transforms it would show something other than the bytes that were hashed.  */
/* -------------------------------------------------------------------------- */

/** `null` until the policy record answers — the static children stand in, with
 *  no fallback notice, because nothing has failed yet. */
type State = PolicyTextState | null;

export function PublishedPolicyText({
  which,
  children,
  unavailable,
}: {
  which: Which;
  /** What shows until the policy record answers (and, for a page that gives
   *  no `unavailable`, after it fails to). */
  children: ReactNode;
  /** Shown once the record has answered WITHOUT a published copy. A page
   *  whose fallback is only a loading line needs it, or a failed read would
   *  leave that line spinning for good (founder 2026-09-25, F3). */
  unavailable?: ReactNode;
}) {
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    let active = true;
    void fetchAuthorization().then((status) => {
      if (active) setState(policyTextState(status, which));
    });
    return () => {
      active = false;
    };
  }, [which]);

  if (state?.kind === "published") {
    return (
      <article className="space-y-6 text-sm leading-relaxed text-foreground">
        <p className="text-xs text-muted-foreground">Version {state.version}</p>
        {/* Exactly the stored bytes. No markdown, no per-line styling. */}
        <div className="whitespace-pre-wrap">{state.copy}</div>
      </article>
    );
  }

  // NO FALLBACK BANNER (corrected 2026-09-17, same day it shipped).
  //
  // This rendered "Showing the last published version (N). The current version
  // could not be loaded just now." on every fallback. With no policy registered
  // yet — which is the state today and for as long as registration is blocked —
  // that fired for every visitor on a public page, and it was false twice: the
  // static document IS the current published version, nothing failed to load,
  // and it was user-facing copy that never had sign-off (LIVE LOOP).
  //
  // The static document already carries its own version and effective date in
  // its header, which is the honest statement and needs no help. When a policy
  // is registered this branch stops being reached at all.
  if (state !== null && unavailable !== undefined) return <>{unavailable}</>;
  return <>{children}</>;
}
