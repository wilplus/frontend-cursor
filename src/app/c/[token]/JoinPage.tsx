"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { joinChatLink } from "@/services/api/chats";
import { signUpWidgetChat } from "@/services/api/chatWidget";
import { getAuthToken } from "@/lib/api/auth-client";
import { AssistantMark } from "@/components/willab/chats/ChatList";
import { HostAboutLines } from "@/components/willab/chats/HostChat";
import {
  JOIN_BUTTON,
  JOIN_NOBODY_ELSE,
  JOIN_NOTHING_TO_INSTALL,
  JOIN_WILL_LINE,
  joinChatWith,
  joinTitle,
} from "@/components/willab/chats/joinCopy";

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
/*  A link whose owner has the chat builder (ring row `chat_builder`, N579    */
/*  item 2) also says whose assistant answers in their chat ("{name}'s        */
/*  assistant", N578 item 1, with its mark) and gives Will's line its new     */
/*  words (N586 item 2); both come from the backend, which sends them only    */
/*  for that ring. Without them the page is as it was.                        */
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
  assistant = null,
  willLine = null,
  about = [],
}: {
  token: string;
  name: string;
  finish: boolean;
  /** "{name}'s assistant", from the backend, for the chat builder's ring. */
  assistant?: string | null;
  /** Will's line in the backend's words (N586 item 2), for that ring. */
  willLine?: string | null;
  /** Who the host is and what you can learn with them, in their own words
   *  (N586 item 1), as the backend sends them; none otherwise. */
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
      <h1 className="text-balance text-[24px] font-bold leading-tight text-foreground">{joinTitle(name)}</h1>
      <HostAboutLines lines={about} />
      <ul className="flex flex-col gap-2 rounded-xl bg-muted px-4 py-3 text-[15px] leading-snug text-foreground">
        <li>{joinChatWith(name)}</li>
        {assistant ? (
          <li data-join-assistant="" className="flex items-center gap-2">
            <AssistantMark label={assistant} inline />
            {assistant}
          </li>
        ) : null}
        <li data-join-will-line="">{willLine ?? JOIN_WILL_LINE}</li>
        <li>{JOIN_NOBODY_ELSE}</li>
      </ul>
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
      <p className="text-center text-[13px] text-muted-foreground">{JOIN_NOTHING_TO_INSTALL}</p>
    </main>
  );
}
