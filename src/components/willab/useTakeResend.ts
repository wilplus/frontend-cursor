"use client";

import { useEffect, useRef, useState } from "react";
import { afterChatBoot } from "@/lib/chatBoot";
import { resendKeptTakes } from "@/lib/willab/takeResend";
import { needsPolicyAcceptance, usePolicyUpdate } from "./PolicyUpdate";
import type { UseLoungeThreadReturn } from "./useLoungeThread";

/* -------------------------------------------------------------------------- */
/*  useTakeResend — when a kept Take goes up again (backend N556 item 2)        */
/*                                                                            */
/*  At the next open (once the chat has painted), at a sign-in, when the      */
/*  connection comes back and when the app returns to the front. Only while   */
/*  the Lab is closed and no other Take is still landing, so one Take goes at */
/*  a time; the pass itself is in lib/willab/takeResend.ts. True while one is */
/*  going up: the record button waits with its signed line, "One moment —    */
/*  finishing your last take." (flowCopy.ts), as for any Take still landing. */
/*  An out-of-date acceptance goes through the policy update prompt, and the  */
/*  Take goes again once it is accepted.                                       */
/* -------------------------------------------------------------------------- */

export function useTakeResend({
  userId,
  labOpen,
  busy,
  thread,
}: {
  userId: string | null;
  labOpen: boolean;
  /** Another Take is still processing (the Lounge's in-flight truth). */
  busy: boolean;
  thread: Pick<UseLoungeThreadReturn, "messages" | "append" | "loading">;
}): boolean {
  const policy = usePolicyUpdate();
  const [sending, setSending] = useState(false);
  const [booted, setBooted] = useState(false);
  const [wanted, setWanted] = useState(true);
  const [running, setRunning] = useState(false);
  const now = useRef({ labOpen, thread, policy });
  now.current = { labOpen, thread, policy };

  useEffect(() => afterChatBoot(() => setBooted(true)), []);
  useEffect(() => setWanted(true), [userId]);
  useEffect(() => {
    const again = () => {
      if (document.visibilityState === "visible") setWanted(true);
    };
    window.addEventListener("online", again);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.removeEventListener("online", again);
      document.removeEventListener("visibilitychange", again);
    };
  }, []);

  const ready = booted && wanted && !running && !labOpen && !busy && !thread.loading;
  useEffect(() => {
    if (!ready) return;
    setWanted(false);
    setRunning(true);
    void resendKeptTakes({
      ownerId: userId,
      labOpen: () => now.current.labOpen,
      messages: () => now.current.thread.messages,
      append: (draft) => now.current.thread.append(draft),
      onSending: setSending,
      onKept: (code) => {
        if (needsPolicyAcceptance(code)) now.current.policy?.refused(code, () => setWanted(true));
      },
    }).then((end) => {
      setRunning(false);
      if (end === "more") setWanted(true);
    });
  }, [ready, userId]);

  return sending;
}
