"use client";

import { useLayoutEffect } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import AppMenu from "@/components/AppMenu";
import { COMMUNITY_URL, SUPPORT_EMAIL } from "@/lib/appMenuLinks";
import { useAppMenuData } from "@/hooks/useAppMenuData";
import { toast } from "sonner";
import {
  WILLAB_CREDITS_CHECKOUT_SUCCESS_EVENT,
  type CreditsCheckoutSuccessDetail,
} from "@/lib/willabWindowEvents";
import { pollCreditsAfterCheckout } from "@/lib/homework/pollCreditsAfterCheckout";

/* -------------------------------------------------------------------------- */
/*  DashboardHeader — the lab's chrome.                                        */
/*                                                                            */
/*  FE-3 — the menu itself now lives in AppMenu and its data in                */
/*  useAppMenuData, so the blog mounts the SAME component rather than a        */
/*  lookalike. What stays here is what is genuinely lab-only: the logo, and    */
/*  the post-Stripe-checkout credits reconciliation.                          */
/* -------------------------------------------------------------------------- */

export default function DashboardHeader() {
  const menu = useAppMenuData();
  const { setCredits } = menu;

  /** After Stripe checkout: claim the session server-side (instant), then poll
   *  if needed. useLayoutEffect so the listener is registered before the
   *  sibling CreditsCheckoutReturnToast fires the event in useEffect. */
  useLayoutEffect(() => {
    const onCheckoutSuccess = (e: Event) => {
      const detail = (e as CustomEvent<CreditsCheckoutSuccessDetail>).detail;
      const checkoutSessionId = detail?.checkoutSessionId?.trim() || undefined;
      void (async () => {
        const toastId = toast.loading("Payment received — updating your credits…");
        const result = await pollCreditsAfterCheckout({ checkoutSessionId });
        const fallbackMsg =
          "We could not confirm your new balance. Check Network → claim-checkout and session/status, or refresh.";
        if (result.ok) {
          setCredits(result.credits);
          toast.success(`You now have ${result.credits} credits.`, { id: toastId });
          return;
        }
        if (result.reason === "unauthorized") {
          toast.error("Session expired — sign in again, then check your credits.", {
            id: toastId,
          });
          return;
        }
        if (result.reason === "claim_failed") {
          toast.error(result.message?.trim() || fallbackMsg, {
            id: toastId,
            duration: 14_000,
          });
          return;
        }
        toast.error(result.message?.trim() || fallbackMsg, {
          id: toastId,
          duration: 12_000,
        });
      })();
    };

    window.addEventListener(WILLAB_CREDITS_CHECKOUT_SUCCESS_EVENT, onCheckoutSuccess);
    return () =>
      window.removeEventListener(
        WILLAB_CREDITS_CHECKOUT_SUCCESS_EVENT,
        onCheckoutSuccess
      );
  }, [setCredits]);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-4xl min-w-0 items-center justify-between gap-2 px-[15px] py-4 sm:gap-4">
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/"
            className="rounded transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="WillpowerLab home"
          >
            <Logo size="md" />
          </Link>
        </div>

        {/* Credits live INSIDE the menu; the right side is just the hamburger.
            While auth is "unknown" AppMenu renders an invisible spacer of the
            same height, so the page does not shift when it resolves. */}
        <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 sm:gap-3">
          <AppMenu
            authState={menu.authState}
            userEmail={menu.userEmail}
            credits={menu.credits}
            lifeMenu={menu.lifeMenu}
            supportEmail={SUPPORT_EMAIL}
            communityUrl={COMMUNITY_URL}
            onLogout={menu.logout}
            loggingOut={menu.loggingOut}
            // Reachable from /panel/* too, which is where this header also
            // mounts — "Lab" is a real destination there, not a self-link.
            labHref="/chat"
            gameHref="/game"
            corpusHref={menu.isCoach ? "/coach/corpus" : null}
          />
        </div>
      </div>
    </header>
  );
}
