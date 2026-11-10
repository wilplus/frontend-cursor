"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { joinChatLink } from "@/services/api/chats";
import { signUpWidgetChat } from "@/services/api/chatWidget";
import { getAuthToken } from "@/lib/api/auth-client";
import { JOIN_BUTTON, JOIN_ONLY_THE_TWO_OF_YOU, joinInvited } from "@/components/willab/chats/joinCopy";

/* -------------------------------------------------------------------------- */
/*  The join page (backend N308, N328, N335; rules:                            */
/*  docs/flows/customer-requests.md §1 C1): who invites you and what you get, */
/*  then Join. Signed out, Join goes to sign in or sign up and comes back here */
/*  to finish (`?join=1`). Joined, /chat opens on the list of chats, the chat */
/*  with the person who invited you its first row, marked new (N357; was     */
/*  N348 item 1). Your own link, or a link that stops working on the way,     */
/*  lands on /chat: no new words. From the website chat's sign-up after asking   */
/*  (N591 item 4; was N567's "Keep this chat"), the page opens with the      */
/*  visitor's secret after `#g=`: it is kept in this browser while they sign */
/*  in (phone, email, Google or another sign-in), and Join takes the         */
/*  website chat, named after them, instead of making a new one.             */
/*                                                                            */
/*  Three lines and Join, nothing under it (backend N601): "{name} invited   */
/*  you"; what you'll learn in their chat, in the host's words when the       */
/*  backend sends them (N586 item 1's about); "Only the two of you are in    */
/*  this chat.". Was (N310 item 3, N335 item 2, N586 item 2): a title, a      */
/*  list with the assistant's name and Will's line, and a line under Join.   */
/* -------------------------------------------------------------------------- */

const SIGNING_UP = (token: string) => `wpl-sign-up:${token}`;

/** The widget visitor's secret this page was opened with, kept while they
 *  sign in; or the one kept before. */
function visitorSecret(token: string): string | null {
  try {
    const hash = new URLSearchParams(window.location.hash.slice(1)).get("g");
    if (hash) {
      window.localStorage.setItem(SIGNING_UP(token), hash);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return hash;
    }
    return window.localStorage.getItem(SIGNING_UP(token));
  } catch {
    return null;
  }
}

export default function JoinPage({
  token,
  name,
  finish,
  about = [],
}: {
  token: string;
  name: string;
  finish: boolean;
  /** What you'll learn in their chat, in the host's own words (N601 item
   *  1), as the backend sends it; nothing otherwise. */
  about?: readonly string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const visitor = useRef<string | null>(null);
  useEffect(() => {
    visitor.current = visitorSecret(token);
  }, [token]);

  const signUpVisitor = async (secret: string): Promise<boolean> => {
    const kept = await signUpWidgetChat(token, secret, await getAuthToken());
    if (kept === "signin") {
      const back = `/c/${encodeURIComponent(token)}?join=1`;
      router.push(`/login?redirectTo=${encodeURIComponent(back)}`);
      return true;
    }
    try {
      window.localStorage.removeItem(SIGNING_UP(token));
    } catch {
      // Nothing kept, nothing to clear.
    }
    if (kept && kept !== "waitlist") {
      router.push(`/chat?with=${encodeURIComponent(kept.chatId)}`);
      return true;
    }
    if (kept === "waitlist") {
      router.push("/chat");
      return true;
    }
    return false;
  };

  const join = async () => {
    if (busy) return;
    setBusy(true);
    const secret = visitor.current ?? visitorSecret(token);
    if (secret && (await signUpVisitor(secret))) return;
    const result = await joinChatLink(token);
    if (result.kind === "signin") {
      const back = `/c/${encodeURIComponent(token)}?join=1`;
      router.push(`/login?redirectTo=${encodeURIComponent(back)}`);
      return;
    }
    router.push(result.kind === "joined" ? `/chat?with=${encodeURIComponent(result.chatId)}` : "/chat");
  };

  // Back from signing in: finish joining without a second tap.
  useEffect(() => {
    if (finish && !started.current) {
      started.current = true;
      void join();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish]);

  return (
    <main data-join-page className="mx-auto flex min-h-full w-full max-w-[480px] flex-col gap-5 bg-background px-5 pb-8 pt-12">
      <span
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FFE9DB] text-[26px] font-semibold text-[#A33A00]"
      >
        {(Array.from(name.trim())[0] ?? "").toUpperCase()}
      </span>
      <h1 className="text-balance text-[24px] font-bold leading-tight text-foreground">{joinInvited(name)}</h1>
      {about.length > 0 ? (
        <p data-join-learn="" className="text-[16px] leading-snug text-foreground">
          {about.join(" ")}
        </p>
      ) : null}
      <p data-join-only-two="" className="text-[15px] leading-snug text-muted-foreground">
        {JOIN_ONLY_THE_TWO_OF_YOU}
      </p>
      <div className="flex-1" />
      <button
        type="button"
        data-join-button=""
        onClick={() => void join()}
        disabled={busy}
        className="h-[54px] w-full rounded-full bg-foreground text-[16px] font-semibold text-background disabled:opacity-60"
      >
        {JOIN_BUTTON}
      </button>
    </main>
  );
}
