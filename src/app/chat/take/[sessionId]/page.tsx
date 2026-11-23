"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LoadingState from "@/components/willab/LoadingState";
import { fetchSessionReadout, type SessionReadout } from "@/services/api/sessionReadout";

function TakeTranscript({
  sessionId,
  slide,
}: {
  sessionId: string;
  slide: string | string[] | undefined;
}) {
  const [session, setSession] = useState<SessionReadout | null>();

  useEffect(() => {
    let active = true;
    void fetchSessionReadout(sessionId).then((result) => {
      if (active) setSession(result);
    }).catch(() => {
      if (active) setSession(null);
    });
    return () => {
      active = false;
    };
  }, [sessionId]);

  const slideTranscripts = session?.readout.slideTranscripts ?? [];
  const passages = slideTranscripts.some((entry) => entry.transcript.trim())
    ? slideTranscripts
    : session?.readout.fullTranscriptChunks ?? [];
  const wanted = typeof slide === "string" && /^\d+$/.test(slide) ? Number(slide) : null;
  const focused = passages.find((entry) => entry.index === wanted && entry.transcript.trim());
  const visible = focused ? [focused] : passages.filter((entry) => entry.transcript.trim());

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-6">
      <Link href="/chat" className="text-sm text-muted-foreground underline underline-offset-4">
        Back to chat
      </Link>
      <h1 className="mb-4 mt-3 text-xl font-semibold">Transcript</h1>
      {session === undefined ? (
        <LoadingState placement="surface" />
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Transcript unavailable.</p>
      ) : (
        <div className="space-y-4">
          {visible.map((passage) => (
            <p key={passage.index} className="whitespace-pre-wrap leading-relaxed">{passage.transcript}</p>
          ))}
        </div>
      )}
    </main>
  );
}

export default function TakeTranscriptPage({
  params,
  searchParams,
}: {
  params: { sessionId: string };
  searchParams: { slide?: string | string[] };
}) {
  return <TakeTranscript key={params.sessionId} sessionId={params.sessionId} slide={searchParams.slide} />;
}
