"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { VoiceMark } from "./LoadingState";
import { Button } from "@/components/ui/button";
import { mergeSession } from "@/services/api/mergeSession";

/* -------------------------------------------------------------------------- */
/*  SendGate — Readout footer → coach handoff (§13)                            */
/*                                                                            */
/*  The only sign-up gate in the flow. Confirmation ONLY on send success       */
/*  (§3.6/§13's trap) — never on auth alone. On failure the recording stays     */
/*  held (parked), never shows "sent".                                        */
/*    signed-in → mergeSession(session_id) → instant claim+send → confirmation │
/*    unsigned  → honest interim; the OAuth round-trip (park → sign in →        */
/*               auto-send → review_pending) is the next slice (mirrors         */
/*               PendingSessionClaim).                                         */
/* -------------------------------------------------------------------------- */

type SendState =
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string }
  | { kind: "need_signin" };

export default function SendGate({
  sessionId,
  signedIn,
  onSent,
  onPark,
  onSignIn,
}: {
  sessionId: string | null;
  signedIn: boolean | null;
  onSent: () => void; // → review_pending (Lounge)
  onPark: () => void; // → parked (held, resumable)
  onSignIn: () => void; // unsigned → OAuth round-trip (§13 Path 2)
}) {
  const [send, setSend] = useState<SendState>({ kind: "sending" });
  const firedRef = useRef(false);

  const runSend = useCallback(async () => {
    if (!sessionId) {
      setSend({
        kind: "error",
        message: "We lost the recording reference — head back and try again.",
      });
      return;
    }
    setSend({ kind: "sending" });
    const r = await mergeSession(sessionId);
    if (r.kind === "sent") setSend({ kind: "sent" });
    else if (r.kind === "unauthenticated") setSend({ kind: "need_signin" });
    else setSend({ kind: "error", message: r.message });
  }, [sessionId]);

  useEffect(() => {
    if (signedIn === null) return; // auth still resolving — stay on "sending"
    if (signedIn) {
      if (!firedRef.current) {
        firedRef.current = true;
        void runSend();
      }
    } else {
      setSend({ kind: "need_signin" });
    }
  }, [signedIn, runSend]);

  if (send.kind === "sending") {
    return (
      <Centered>
        <VoiceMark size={48} />
        <p className="text-[15px] text-foreground">Sending to your coach…</p>
      </Centered>
    );
  }

  if (send.kind === "sent") {
    return (
      <Centered>
        <CheckCircle2 className="h-10 w-10 text-primary" />
        <p className="text-[17px] font-semibold text-foreground">
          Your coach has it.
        </p>
        <p className="max-w-sm text-[15px] text-muted-foreground">
          They&apos;ll analyze your recording and send fresh insights — by email,
          and right here in your Lounge.
        </p>
        <Button onClick={onSent} className="mt-2 rounded-full px-6">
          Back to Lounge
        </Button>
      </Centered>
    );
  }

  if (send.kind === "error") {
    return (
      <Centered>
        <p className="max-w-sm text-[15px] text-destructive">{send.message}</p>
        <p className="max-w-sm text-[12px] text-muted-foreground">
          Your recording is held — nothing was lost.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => void runSend()} className="rounded-full px-6">
            Try again
          </Button>
          <Button onClick={onPark} variant="outline" className="rounded-full px-6">
            Back to Lounge
          </Button>
        </div>
      </Centered>
    );
  }

  // need_signin — sign in, then we auto-send on the callback (§13 Path 2).
  return (
    <Centered>
      <p className="text-[17px] font-semibold text-foreground">One quick step</p>
      <p className="max-w-sm text-[15px] text-muted-foreground">
        Sign in so your coach&apos;s insights can find their way back to you. We
        keep your recording safe and send it the moment you&apos;re in.
      </p>
      <Button onClick={onSignIn} className="mt-2 rounded-full px-6">
        Sign in &amp; send
      </Button>
      <button
        type="button"
        onClick={onPark}
        className="text-[13px] text-muted-foreground hover:text-foreground"
      >
        Not now
      </button>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      {children}
    </div>
  );
}
