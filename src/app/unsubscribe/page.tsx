"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { VoiceMark } from "@/components/willab/LoadingState";
import { Button } from "@/components/ui/button";

/**
 * /unsubscribe?token=<signed_token>
 *
 * Landing page for the unsubscribe link in transactional emails
 * (currently PostSessionResultsEmail). Reads the token from the
 * query string, POSTs it to /api/public/unsubscribe on mount, and
 * shows one of three states:
 *
 *   • loading    — spinner while the request is in flight
 *   • success    — confirmation card, optional re-subscribe note
 *   • error      — friendly error with the backend's reason and a
 *                  link to support
 *
 * No auth required — the token IS the auth. If the token is missing
 * (someone hit /unsubscribe directly), we render a "this link is
 * invalid" state instead of firing a useless POST.
 *
 * Wrapped in <Suspense> so Next 14's useSearchParams doesn't break
 * the static-generation prerender pass.
 */
export default function UnsubscribePage() {
  return (
    <Suspense fallback={<UnsubscribeShell><UpdatingState /></UnsubscribeShell>}>
      <UnsubscribeInner />
    </Suspense>
  );
}

type Phase =
  | { kind: "loading" }
  | { kind: "missing-token" }
  | { kind: "success"; emailObscured?: string; alreadyUnsubscribed?: boolean }
  | { kind: "error"; message: string };

function UnsubscribeInner() {
  const params = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setPhase({ kind: "missing-token" });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/public/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          code?: string;
          error?: string;
          email_obscured?: string;
          already_unsubscribed?: boolean;
        };
        if (cancelled) return;
        if (res.ok) {
          setPhase({
            kind: "success",
            emailObscured: data.email_obscured,
            alreadyUnsubscribed: data.already_unsubscribed,
          });
          return;
        }
        // Backend's `error` field is canonical; specific code copy
        // overrides for the well-known cases.
        const msg =
          data.code === "INVALID_TOKEN"
            ? "This unsubscribe link is invalid or has expired."
            : data.code === "USER_NOT_FOUND"
            ? "We couldn't find the account for this link."
            : data.error ?? `Couldn't unsubscribe (HTTP ${res.status}).`;
        setPhase({ kind: "error", message: msg });
      } catch (err) {
        if (cancelled) return;
        console.error("unsubscribe failed:", err);
        setPhase({
          kind: "error",
          message: "We couldn't reach the server. Check your connection and refresh.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <UnsubscribeShell>
      {phase.kind === "loading" && <UpdatingState />}
      {phase.kind === "missing-token" && <MissingTokenState />}
      {phase.kind === "success" && (
        <SuccessState
          emailObscured={phase.emailObscured}
          alreadyUnsubscribed={phase.alreadyUnsubscribed}
        />
      )}
      {phase.kind === "error" && <ErrorState message={phase.message} />}
    </UnsubscribeShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Shell — uses .willab-chat scope so the warm palette applies the way it    */
/* does on /chat and /results (no need to wrap the whole site).              */
/* -------------------------------------------------------------------------- */

function UnsubscribeShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="willab-chat flex min-h-[100dvh] items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {children}
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* States                                                                      */
/* -------------------------------------------------------------------------- */

/* Renamed from a local `LoadingState` to avoid colliding with the shared
   willab LoadingState (the one circular logo loader). */
function UpdatingState() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <VoiceMark size={48} />
      <p className="text-sm text-muted-foreground">
        Updating your email preferences…
      </p>
    </div>
  );
}

function MissingTokenState() {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <XCircle className="h-6 w-6 text-destructive" aria-hidden />
      </div>
      <h1 className="font-heading text-2xl text-foreground">
        Link isn&apos;t valid
      </h1>
      <p className="text-sm text-muted-foreground">
        This page needs an unsubscribe link from a WillpowerLab email. If you got
        here by typing the URL, head back to your inbox and click the
        Unsubscribe link in the email footer.
      </p>
      <Link href="/" className="inline-block">
        <Button variant="outline" size="sm" className="rounded-full">
          Back to WillpowerLab
        </Button>
      </Link>
    </div>
  );
}

function SuccessState({
  emailObscured,
  alreadyUnsubscribed,
}: {
  emailObscured?: string;
  alreadyUnsubscribed?: boolean;
}) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-6 w-6 text-emerald-700" aria-hidden />
      </div>
      <h1 className="font-heading text-2xl text-foreground">
        {alreadyUnsubscribed
          ? "You were already unsubscribed"
          : "You're unsubscribed"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {emailObscured ? (
          <>
            We won&apos;t send <span className="font-medium">{emailObscured}</span> any
            more publish notifications.
          </>
        ) : (
          <>
            We won&apos;t send you any more publish notifications.
          </>
        )}{" "}
        Account-related emails (sign-in links, security alerts) still come
        through — those aren&apos;t marketing.
      </p>
      <p className="text-xs text-muted-foreground">
        Changed your mind?{" "}
        <a
          href="mailto:artur@willonski.com?subject=Resubscribe%20me"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          Email us
        </a>{" "}
        to turn them back on.
      </p>
      <Link href="/" className="inline-block pt-2">
        <Button variant="outline" size="sm" className="rounded-full">
          Back to WillpowerLab
        </Button>
      </Link>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <XCircle className="h-6 w-6 text-destructive" aria-hidden />
      </div>
      <h1 className="font-heading text-2xl text-foreground">
        Something went wrong
      </h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground">
        If the problem keeps happening,{" "}
        <a
          href="mailto:artur@willonski.com?subject=Unsubscribe%20issue"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          email artur@willonski.com
        </a>{" "}
        and we&apos;ll take you off the list manually.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() => window.location.reload()}
      >
        Try again
      </Button>
    </div>
  );
}
