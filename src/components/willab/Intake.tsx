"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchUserProfile, saveUserProfile } from "@/services/api/userProfile";
import { useSignedIn } from "./useSignedIn";
import { WILLAB_DOMAINS, domainSpec, type WillabDomain } from "./domains";
import { writeWillabProfile } from "./willabProfile";

/* -------------------------------------------------------------------------- */
/*  Intake — first-run interview (§2)                                          */
/*                                                                            */
/*  Exactly two questions, then the CTA to the Lounge. No audio. No branching  */
/*  (domain is metadata, not a fork). No evaluation language — it captures, it  */
/*  does not assess.                                                          */
/*    Q1 domain — five DomainChips (tappable; structured input, clean enum).   */
/*    Q2 goal   — one free-text line, placeholder coupled to the chosen domain.*/
/*  Order is domain-then-goal because the placeholder swaps to match the chip. */
/*  Result is stored locally (seeds the Lab's domain_vocabulary §4);           */
/*  the server profile PUT lands once its contract is confirmed.              */
/* -------------------------------------------------------------------------- */

export default function Intake({ onDone }: { onDone: () => void }) {
  const signedIn = useSignedIn();
  const [checking, setChecking] = useState(true);
  const [domain, setDomain] = useState<WillabDomain | null>(null);
  const [goal, setGoal] = useState("");

  // Returning signed-in users with a server profile skip the interview (§2 runs
  // once). Covers the cross-device / cleared-storage case — same-device
  // returners never reach intake (the flow routes them to the Lounge).
  useEffect(() => {
    if (signedIn === null) return; // auth still resolving
    if (!signedIn) {
      setChecking(false);
      return;
    }
    let active = true;
    void fetchUserProfile().then((p) => {
      if (!active) return;
      if (p?.domain) {
        writeWillabProfile({ domain: p.domain as WillabDomain, goal: p.goal });
        onDone(); // already onboarded
      } else {
        setChecking(false);
      }
    });
    return () => {
      active = false;
    };
  }, [signedIn, onDone]);

  function handleContinue() {
    if (!domain) return;
    const trimmedGoal = goal.trim();
    writeWillabProfile({ domain, goal: trimmedGoal });
    // Best-effort server sync (POST per ①). Unsigned first-run callers 401
    // and rely on the local cache above; the profile is (re-)synced at
    // sign-up. Never blocks the flow — onDone advances immediately.
    void saveUserProfile({ domain, goal: trimmedGoal });
    onDone();
  }

  if (checking) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5 py-2">
      {/* Q1 — domain: chips inside the (intake) thread, not a free chat turn */}
      <div className="flex flex-col gap-3">
        <div className="mr-auto max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
          First — what do you want to work on?
        </div>
        <div className="flex flex-wrap gap-2">
          {WILLAB_DOMAINS.map((d) => {
            const active = d.key === domain;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setDomain(d.key)}
                aria-pressed={active}
                className={`rounded-full border px-4 py-2 text-[15px] transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary/50"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Q2 — goal: the genuinely open turn (free text, no goal chips) */}
      {domain && (
        <div className="flex flex-col gap-3">
          <div className="mr-auto max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
            And what specifically do you want to get better at?
          </div>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={domainSpec(domain).goalPlaceholder}
            className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-[15px] outline-none focus:border-primary"
            aria-label="Your goal, in your own words"
            autoFocus
          />
        </div>
      )}

      <div className="mt-auto">
        <Button
          type="button"
          onClick={handleContinue}
          disabled={!domain}
          className="w-full rounded-full"
        >
          Continue to the Lounge
        </Button>
      </div>
    </div>
  );
}
