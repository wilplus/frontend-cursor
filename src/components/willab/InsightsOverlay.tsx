"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchSessionReadout,
  type SessionReadout,
} from "@/services/api/sessionReadout";
import ReadoutCard from "./ReadoutCard";
import { useBackDismiss } from "./useBackDismiss";

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

  useEffect(() => {
    let active = true;
    setStatus("loading");
    void fetchSessionReadout(sessionId).then((r) => {
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
  }, [sessionId]);

  if (status === "loading" || (status === "ready" && data)) {
    if (status === "ready" && data) {
      return (
        <ReadoutCard
          payload={data.readout}
          onClose={onClose}
          managed={false}
          onRegisterBack={(fn) => {
            readoutBackRef.current = fn;
          }}
        />
      );
    }
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
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
