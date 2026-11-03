"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isNativeApp, signInWithApple } from "@/lib/auth/nativeSignIn";

/* -------------------------------------------------------------------------- */
/*  Sign in with Apple (backend N365 item 2), in the iPhone app only: Apple's  */
/*  rule 4.8 asks for it beside Google and LinkedIn. Apple's own button: black, */
/*  full width, its logo and its words, at least as prominent as the others.   */
/*  On the web it renders nothing.                                             */
/* -------------------------------------------------------------------------- */

export const APPLE_BUTTON_LABEL = "Sign in with Apple";
const FAILED = "Sign-in failed. Please try again.";

export default function AppleAuthButton() {
  const [app, setApp] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setApp(isNativeApp()), []);
  if (!app) return null;

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    const { result, message } = await signInWithApple();
    if (result === "ok") return; // leaving for the page they came for
    if (result === "failed") {
      console.error("[Apple sign-in]", message);
      toast.error(FAILED);
    }
    setBusy(false);
  };

  return (
    <button
      type="button"
      data-apple-sign-in=""
      onClick={() => void onClick()}
      disabled={busy}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-black text-[15px] font-medium text-white disabled:opacity-60"
    >
      <AppleLogo className="h-[18px] w-[18px]" />
      {APPLE_BUTTON_LABEL}
    </button>
  );
}

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 814 1000" fill="currentColor" aria-hidden>
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
    </svg>
  );
}
