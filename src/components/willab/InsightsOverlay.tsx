"use client";

import { useEffect, useRef, useState } from "react";
import LoadingState from "./LoadingState";
import { Button } from "@/components/ui/button";
import {
  fetchSessionReadout,
  type SessionReadout,
} from "@/services/api/sessionReadout";
import { fetchGuestLabReadout } from "@/services/api/labRecording";
import ReadoutCard from "./ReadoutCard";
import { useBackDismiss } from "./useBackDismiss";
import { useSignedIn } from "./useSignedIn";
import { useSayItStrongerPolling } from "./useSayItStrongerPolling";

export default function InsightsOverlay({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  // Device Back steps the readout's own layout (collapse a moment, page back)
  // before closing the overlay.
  const readoutBackRef = useRef<(() => boolean) | null>(null);
  useBackDismiss(onClose, () => readoutBackRef.current?.() ?? false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<SessionReadout | null>(null);
  // Bug 6 — a guest re-opening their "Your Recording" bubble used to call the
  // authed re-read (401 → "couldn't load these insights"). fetchSessionReadout
  // itself bails to null with no auth token, so branch on signed-in and use
  // the guest endpoint (BE-1) instead; it also serves an authed owner's OWN
  // session, but the explicit authed path stays for the signed-in case.
  const signedIn = useSignedIn();

  useEffect(() => {
    if (signedIn === null) return; // auth still resolving
    let active = true;
    setStatus("loading");
    const fetcher = signedIn ? fetchSessionReadout : fetchGuestLabReadout;
    void fetcher(sessionId).then((r) => {
      if (!active) return;
      if (r) {
        setData(r);
        setStatus("ready");
      } else {
        setStatus("error");
      }
    });
    return () => {
      active = false;
    };
  }, [sessionId, signedIn]);

  // Bug 4 — poll until the Say It Stronger cards land (they generate a few
  // seconds after the session was first read; a re-open shortly after
  // recording can still catch them mid-generation).
  useSayItStrongerPolling(sessionId, signedIn, data?.readout ?? null, (next) =>
    setData((prev) => (prev ? { ...prev, readout: next } : prev))
  );

  if (status === "loading" || (status === "ready" && data)) {
    if (status === "ready" && data) {
      return (
        <ReadoutCard
          payload={data.readout}
          sessionId={sessionId}
          onClose={onClose}
          managed={false}
          onRegisterBack={(fn) => {
            readoutBackRef.current = fn;
          }}
        />
      );
    }
    return <LoadingState fullscreen />;
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="max-w-sm text-[15px] text-muted-foreground">
        We couldn&apos;t load these insights just now. Try again in a moment.
      </p>
      <Button onClick={onClose} variant="outline" className="rounded-full px-6">
        Back to Lounge
      </Button>
    </div>
  );
}
