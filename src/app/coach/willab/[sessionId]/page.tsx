"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  fetchSessionReadout,
  type SessionReadout,
} from "@/services/api/sessionReadout";
import CoachAuthoring from "@/components/willab/CoachAuthoring";

/**
 * /coach/willab/<sessionId> — willab coach authoring (§14).
 *
 * Loads a session's Readout and renders the authoring surface (label + note +
 * tag + publish). NOTE: it currently loads via the USER re-read
 * (/v2/user/sessions/<id>/readout), which is owner-auth — fine for a coach
 * smoke-testing their own session. The real review queue (other users' sessions)
 * needs the two BE coach contracts still open: (1) the review-queue list, and
 * (2) an ADMIN-auth Readout fetch. Swap fetchSessionReadout for the admin fetch
 * once confirmed.
 */
export default function CoachWillabAuthoringPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const { sessionId } = params;
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "published"
  >("loading");
  const [data, setData] = useState<SessionReadout | null>(null);

  useEffect(() => {
    let active = true;
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

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col px-4 py-6">
      <h1 className="text-[17px] font-semibold text-foreground">Coach authoring</h1>
      <p className="mb-4 text-[12px] text-muted-foreground">Session {sessionId}</p>

      {status === "loading" ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : status === "published" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-[17px] font-semibold text-foreground">Published.</p>
          <p className="max-w-sm text-[15px] text-muted-foreground">
            The user gets their insights by email and in their Lounge.
          </p>
        </div>
      ) : status === "error" || !data ? (
        <p className="text-[15px] text-muted-foreground">
          Couldn&apos;t load this session&apos;s Readout.
        </p>
      ) : (
        <CoachAuthoring
          sessionId={sessionId}
          readout={data.readout}
          onPublished={() => setStatus("published")}
        />
      )}
    </main>
  );
}
