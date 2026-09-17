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
/*  the server so the pages stay indexable and readable with JS off. The       */
/*  moment the policy record answers, it is replaced — and if it cannot be     */
/*  replaced, the page says plainly that it is showing the last published      */
/*  version rather than letting a reader assume it is current.                 */
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
  staticVersion,
  children,
}: {
  which: Which;
  /** The version the hardcoded JSX below represents, so a reader who gets the
   *  fallback is told exactly which document they are looking at. */
  staticVersion: string;
  /** The server-rendered static document. SEO and no-JS only. */
  children: ReactNode;
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

  return (
    <>
      {state?.kind === "fallback" ? (
        <p className="mb-6 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          Showing the last published version ({staticVersion}). The current
          version could not be loaded just now.
        </p>
      ) : null}
      {children}
    </>
  );
}
