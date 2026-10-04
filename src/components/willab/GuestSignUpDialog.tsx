"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** A guest is asked to sign up without having to look for the button
 *  (founder 2026-10-04: "prompt the user with a sign up page; and not wait
 *  for them to click it").
 *
 *  WHY. A guest's Take ends at plain text: no Feedback, no Take 2, and once
 *  they leave the screen the text cannot be reopened until the project
 *  belongs to an account. The "Create an account to keep this text" button
 *  under the text was the only way on, and a guest had to find it.
 *
 *  WHEN (founder's pick, "when the text is ready"): the guest sees their text
 *  first, and the dialog opens over it by itself a moment later. "Not now"
 *  returns to the text, where the button under it stays. It opens once per
 *  readout, so closing it is respected. */
export const GUEST_SIGN_UP_DELAY_MS = 2000;

export const GUEST_SIGN_UP_COPY = {
  title: "Keep your text",
  body: "Create an account to keep this text, get your feedback and record Take 2.",
  primary: "Create an account",
  secondary: "Not now",
} as const;

export default function GuestSignUpDialog({
  armed,
  onSignUp,
}: {
  /** True once a guest's text is on screen. */
  armed: boolean;
  onSignUp: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!armed || shown) return;
    const timer = window.setTimeout(() => {
      setOpen(true);
      setShown(true);
    }, GUEST_SIGN_UP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [armed, shown]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-sign-up-title"
    >
      <div className="w-full max-w-sm rounded-3xl bg-background p-5 shadow-xl">
        <h2
          id="guest-sign-up-title"
          className="text-[18px] font-semibold text-foreground"
        >
          {GUEST_SIGN_UP_COPY.title}
        </h2>
        <p className="mt-2 text-[14px] text-muted-foreground">
          {GUEST_SIGN_UP_COPY.body}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            type="button"
            onClick={onSignUp}
            className="h-12 w-full rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
          >
            {GUEST_SIGN_UP_COPY.primary}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="h-12 w-full rounded-full text-[15px] font-medium"
          >
            {GUEST_SIGN_UP_COPY.secondary}
          </Button>
        </div>
      </div>
    </div>
  );
}
