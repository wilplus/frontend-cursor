"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* -------------------------------------------------------------------------- */
/*  THE LINK IS FOR ANOTHER ACCOUNT (founder 2026-10-21, WIL-93; the words     */
/*  signed in chat: "ok")                                                      */
/*                                                                            */
/*  The coach's WhatsApp or email link, opened in an account the project is   */
/*  not in: the server answers "not found" (only the account that recorded a  */
/*  project reads it), which the page used to read as "your Ideal Text is     */
/*  still being built" and waited on for nothing. It says so instead. Its one */
/*  button signs out and comes back to the link through log in; the page's ✕  */
/*  stays the way out.                                                         */
/* -------------------------------------------------------------------------- */

export const OTHER_ACCOUNT_COPY = {
  title: "This link is for another account.",
  logIn: "Log in with that account",
} as const;

/** Where "Log in with that account" goes: log in, then back to the link. */
export function otherAccountLoginHref(link: string): string {
  return `/login?redirectTo=${encodeURIComponent(link)}`;
}

export default function OtherAccountLink({
  go = (href: string) => window.location.assign(href),
}: {
  /** A full load, so nothing of the account just left stays on screen. */
  go?: (href: string) => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const logIn = async () => {
    setLeaving(true);
    const link = `${window.location.pathname}${window.location.search}`;
    try {
      await createClient().auth.signOut();
    } catch {
      /* still signed in: log in brings them straight back here */
    }
    go(otherAccountLoginHref(link));
  };
  return (
    <div data-other-account className="flex flex-col items-center gap-6 py-16 text-center">
      <p className="max-w-xs text-[18px] font-medium leading-snug text-foreground">
        {OTHER_ACCOUNT_COPY.title}
      </p>
      <button
        type="button"
        onClick={() => void logIn()}
        disabled={leaving}
        className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-[15px] font-medium text-background disabled:opacity-60"
      >
        {OTHER_ACCOUNT_COPY.logIn}
      </button>
    </div>
  );
}
