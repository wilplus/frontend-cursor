"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { joinLinkOpens } from "@/services/api/chats";
import { INVITE_COPY, inviteToken } from "./inviteCopy";

/* -------------------------------------------------------------------------- */
/*  The link field (backend N471 item 4, design B): drawn as the message      */
/*  field of Will's chat (Lounge.tsx): rounded, a thin border that turns      */
/*  orange while you type, 15px, and the send arrow inside it only once       */
/*  there is a link. A link that opens the join page goes there; anything     */
/*  else says so under the field.                                             */
/* -------------------------------------------------------------------------- */

export default function LinkField({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);
  const has = text.trim().length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!has || busy) return;
    const token = inviteToken(text);
    setBusy(true);
    if (token && (await joinLinkOpens(token))) {
      router.push(`/c/${encodeURIComponent(token)}`);
      return;
    }
    setBusy(false);
    setWrong(true);
  };

  return (
    <div data-link-field="" className="flex w-full max-w-[320px] flex-col items-center">
      <form onSubmit={(e) => void submit(e)} className="relative w-full">
        <label htmlFor="invite-link" className="sr-only">
          {INVITE_COPY.paste}
        </label>
        <input
          id="invite-link"
          type="text"
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => {
            setText(e.target.value);
            setWrong(false);
          }}
          placeholder={INVITE_COPY.paste}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`block min-h-[40px] w-full rounded-3xl border border-border bg-background py-2 pl-3.5 text-[15px] leading-snug outline-none focus:border-primary ${
            has ? "pr-12" : "pr-4"
          }`}
        />
        {has ? (
          <button
            type="submit"
            disabled={busy}
            aria-label={INVITE_COPY.open}
            className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors disabled:cursor-default disabled:text-muted-foreground"
          >
            <Send className="h-5 w-5" />
          </button>
        ) : null}
      </form>
      <p aria-live="polite" className="mt-1.5 min-h-[20px] text-center text-[13px] text-destructive">
        {wrong ? INVITE_COPY.wrongLink : ""}
      </p>
    </div>
  );
}
