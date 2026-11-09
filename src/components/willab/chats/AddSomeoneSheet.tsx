"use client";

import { useEffect, useState } from "react";
import { Link as LinkIcon, Lock, Share } from "lucide-react";
import { getMyChatLink } from "@/services/api/chats";
import { isNativeApp } from "@/lib/auth/nativeSignIn";
import {
  ADD_SHEET_TITLE,
  CANCEL,
  COPIED,
  COPY_MY_CODE,
  COPY_MY_LINK,
  EACH_CUSTOMER,
  ONLY_THE_TWO_OF_YOU,
  PASTE_LINE,
  WEBSITE_LINE,
  WEBSITE_SWITCH,
  widgetCode,
} from "./joinCopy";

/** Add someone (backend N308, N310, N328): your own link, to paste into any
 *  email or message; whoever opens it joins you here. The only way anyone
 *  comes into your chats. The list's "+" opens it, so does "Someone else" on
 *  a chat's "+" (N351), and so does Copy my link in the ☰ menu (N567 item 1;
 *  was: it copied at once, N367). As redesigned (N367 item 3, the locked
 *  prototype "One bar" v12; N567): a handle, the title large; under it one
 *  card with a small switch, "Put this chat on your website", which turns the
 *  link into one line of code for a site, with where to paste it (N567); the
 *  link with its icon, or the code; one big Copy my link, or Copy my code,
 *  that turns green and closes the sheet; one quiet line, "Only the two of
 *  you are in it." (the three tiles it replaces are gone, N567 item 1), or
 *  "Each customer has a chat of their own with you."; Cancel. `fixed` lays
 *  it over the whole screen (from the ☰ menu); otherwise it needs a
 *  `relative` parent. */
export function AddSomeoneSheet({ onClose, fixed = false }: { onClose: () => void; fixed?: boolean }) {
  const [path, setPath] = useState<string | null>(null);
  const [code, setCode] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    void getMyChatLink().then((got) => {
      if (alive) setPath(got);
    });
    return () => {
      alive = false;
    };
  }, []);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link = path ? `${origin}${path}` : null;
  const token = path ? decodeURIComponent(path.replace(/^\/c\//, "")) : null;
  const shown = code ? (token ? widgetCode(origin, token) : null) : link;
  const copy = async () => {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(shown);
      setCopied(true);
      window.setTimeout(onClose, 1100);
    } catch {
      // The clipboard is refused: the link or the code stays on screen to select.
    }
  };
  const share = !code && isNativeApp() && typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <div data-add-sheet className={`${fixed ? "fixed" : "absolute"} inset-0 z-30 flex flex-col justify-end bg-black/30`} onClick={onClose}>
      <div
        role="dialog"
        aria-label={ADD_SHEET_TITLE}
        className="mx-auto flex w-full max-w-[480px] flex-col gap-3.5 rounded-t-3xl bg-background px-[18px] pb-6 pt-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <span aria-hidden className="h-[5px] w-10 self-center rounded-full bg-[#E0E0E0]" />
        <p className="mt-1 text-[21px] font-bold leading-tight text-foreground">{ADD_SHEET_TITLE}</p>
        <button
          type="button"
          role="switch"
          aria-checked={code}
          data-website-switch=""
          onClick={() => {
            setCode((was) => !was);
            setCopied(false);
          }}
          className={`-mt-1 flex w-full items-center gap-3.5 rounded-2xl border px-3.5 py-3 text-left transition-colors ${
            code ? "border-[#FFD9C2] bg-[#FFF6F0]" : "border-border bg-muted/60"
          }`}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <b className="text-[14.5px] font-semibold text-foreground">{WEBSITE_SWITCH}</b>
            <span className="text-[13px] leading-snug text-muted-foreground">{WEBSITE_LINE}</span>
          </span>
          <span aria-hidden className={`relative h-5 w-8 shrink-0 rounded-full transition-colors ${code ? "bg-[#1F9D55]" : "bg-[#E3E3E3]"}`}>
            <span className={`absolute top-[3px] h-[14px] w-[14px] rounded-full bg-white shadow transition-transform ${code ? "left-[15px]" : "left-[3px]"}`} />
          </span>
        </button>
        {code ? (
          shown ? (
            <>
              <code data-my-code="" className="select-all break-all rounded-xl bg-[#141414] px-3.5 py-3 font-mono text-[12.5px] leading-[1.55] text-[#EDEDED]">
                {shown}
              </code>
              <p className="-mt-1.5 text-[13px] leading-snug text-muted-foreground">{PASTE_LINE}</p>
            </>
          ) : null
        ) : link ? (
          <div className="flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-foreground px-3.5 py-3">
            <span aria-hidden className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#FFF1E7] text-[#F26B21]">
              <LinkIcon className="h-4 w-4" />
            </span>
            <span data-my-link className="min-w-0 select-all break-all text-[15px] font-semibold text-foreground">
              {link}
            </span>
          </div>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            data-copy-link=""
            onClick={() => void copy()}
            disabled={!shown}
            className={`flex h-[54px] flex-1 items-center justify-center rounded-full text-[16px] font-semibold text-white transition-colors disabled:opacity-50 ${copied ? "bg-[#1F9D55]" : "bg-foreground"}`}
          >
            {copied ? COPIED : code ? COPY_MY_CODE : COPY_MY_LINK}
          </button>
          {share && link ? (
            // The iPhone share sheet next to Copy my link (backend N365 item 6).
            <button
              type="button"
              aria-label="Share"
              onClick={() => void navigator.share({ url: link }).catch(() => {})}
              className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground"
            >
              <Share className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
        </div>
        <p data-add-private="" className="-mt-1 flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground">
          <Lock aria-hidden className="h-3 w-3" />
          {code ? EACH_CUSTOMER : ONLY_THE_TWO_OF_YOU}
        </p>
        <button type="button" onClick={onClose} className="h-10 text-[15px] font-medium text-muted-foreground">
          {CANCEL}
        </button>
      </div>
    </div>
  );
}
