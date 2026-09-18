"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WelcomeConsent from "@/components/willab/WelcomeConsent";
import LoadingState from "@/components/willab/LoadingState";
import {
  acceptConsentLocally,
  hasAcceptedConsentLocally,
} from "@/components/willab/useWillabFlow";
import { useSignedIn } from "@/components/willab/useSignedIn";
import JournalCard from "@/components/journal/JournalCard";
import { type JournalPostSummary } from "@/services/api/journal";

/* -------------------------------------------------------------------------- */
/*  Landing (client half)                                                      */
/*                                                                            */
/*  The hero is the EXISTING WelcomeConsent composition, reused verbatim so the */
/*  landing and the first-run screen can never drift apart. Its CTA accepts     */
/*  consent and enters the lab, writing the same flag the Lounge reads, so the  */
/*  welcome screen is not shown a second time on arrival.                       */
/*                                                                            */
/*  Signed-in visitors are sent straight to /chat: the app is their home, and   */
/*  marketing must never sit in front of it.                                    */
/* -------------------------------------------------------------------------- */

/** Client-only "returning visitor" hint, read synchronously so the very first
 *  post-mount render can already skip the entrance animation. True when the
 *  consent flag was written before, or a Supabase auth token key is present —
 *  either way this browser has been past Welcome, so the breathing-mark intro
 *  should not replay while auth resolves. */
function readReturningHint(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (hasAcceptedConsentLocally()) return true;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sb-") && key.includes("auth-token")) {
        return true;
      }
    }
  } catch {
    /* ignore — treat as first-time */
  }
  return false;
}

export default function LandingClient({
  posts,
}: {
  posts: JournalPostSummary[];
}) {
  const signedIn = useSignedIn();
  const router = useRouter();

  // Lazy initializer: false on the server, the real flag on the client's first
  // render. It is only ACTED on after mount (below), so SSR markup and the
  // hydration pass stay identical — the standard two-pass pattern.
  const [returningHint] = useState(readReturningHint);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (signedIn === true) router.replace("/chat");
  }, [signedIn, router]);

  // Already signed in: render nothing rather than flash marketing during the
  // redirect. While auth is still resolving (null) the landing shows for
  // anonymous visitors — they are who this page is for — but a RETURNING
  // browser (consent flag / auth token present) gets a neutral instant wait
  // instead, so the entrance animation never flashes before the redirect.
  if (signedIn === true) return null;
  if (mounted && returningHint && signedIn === null) {
    return <LoadingState placement="viewport" />;
  }

  return (
    <main className="bg-background text-foreground">
      {/* THE HERO DELIBERATELY DOES NOT FILL THE VIEWPORT (founder 2026-09-18).
          It gives up ~96px so the top of the first journal cover sits in view
          before anyone scrolls. A full-height hero over a strip nobody can see
          is a strip nobody reads; a sliver of an image is the whole invitation
          and needs no label. */}
      <section className="flex min-h-[calc(100dvh-6rem)] flex-col">
        <WelcomeConsent
          onAccept={() => {
            acceptConsentLocally();
            router.push("/chat");
          }}
          onReadJournal={
            posts.length > 0
              ? () =>
                  document
                    .getElementById("journal")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
              : undefined
          }
        />
      </section>

      {posts.length > 0 ? (
        /* No heading rule and no "From the journal" bar. The covers say there
           are posts; a label above them only pushed them below the fold. */
        <section id="journal" className="scroll-mt-4 pb-14 pt-3">
          <div className="mx-auto w-full max-w-5xl px-6">
            {/* Horizontal strip on small screens, settling into a grid once
                there is room. -mx/px padding keeps the first and last card
                from clipping against the viewport edge while scrolling. */}
            <div className="-mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-12 sm:overflow-visible sm:px-0 lg:grid-cols-3">
              {posts.map((p) => (
                <div
                  key={p.slug}
                  className="w-[78vw] shrink-0 snap-start sm:w-auto sm:shrink"
                >
                  <JournalCard post={p} />
                </div>
              ))}
            </div>

            {/* "Read all" moved under the cards. Above them it competed with
                the covers for the one thing the strip is for. */}
            <div className="mt-8 flex justify-center">
              <Link
                href="/blog"
                className="h-11 px-2 text-[14px] text-muted-foreground no-underline transition-colors hover:text-foreground"
              >
                Read all
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
