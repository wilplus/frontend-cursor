"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WelcomeConsent from "@/components/willab/WelcomeConsent";
import { acceptConsentLocally } from "@/components/willab/useWillabFlow";
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

export default function LandingClient({
  posts,
}: {
  posts: JournalPostSummary[];
}) {
  const signedIn = useSignedIn();
  const router = useRouter();

  useEffect(() => {
    if (signedIn === true) router.replace("/chat");
  }, [signedIn, router]);

  // Already signed in: render nothing rather than flash marketing during the
  // redirect. While auth is still resolving (null) the landing shows, which is
  // the right default — anonymous visitors are who this page is for.
  if (signedIn === true) return null;

  return (
    <main className="bg-background text-foreground">
      <section className="flex min-h-[100dvh] flex-col">
        <WelcomeConsent
          onAccept={() => {
            acceptConsentLocally();
            router.push("/chat");
          }}
        />
      </section>

      {posts.length > 0 ? (
        <section className="border-t border-border/70 py-14">
          <div className="mx-auto w-full max-w-5xl px-6">
            <div className="mb-8 flex items-baseline justify-between gap-4">
              <h2 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                From the journal
              </h2>
              <Link
                href="/blog"
                className="text-[13px] text-foreground underline underline-offset-4 hover:text-foreground/70"
              >
                Read all
              </Link>
            </div>

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
          </div>
        </section>
      ) : null}
    </main>
  );
}
