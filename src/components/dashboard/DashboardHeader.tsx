"use client";

import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu } from "lucide-react";
import Logo from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import { homeworkApi } from "@/lib/api/homework-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  WILLAB_CREDITS_CHECKOUT_SUCCESS_EVENT,
  type CreditsCheckoutSuccessDetail,
} from "@/lib/willabWindowEvents";
import { pollCreditsAfterCheckout } from "@/lib/homework/pollCreditsAfterCheckout";

const SUPPORT_EMAIL = "artur@willonski.com";
const HEADER_MENU_ID = "dashboard-header-menu";
type AuthState = "unknown" | "anonymous" | "signed_in";
// Shared menu-item styling so Support / Log in / Log out read identically.
const MENU_ITEM_CLASS =
  "block w-full px-4 py-2.5 text-left font-semibold text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none";

export default function DashboardHeader() {
  const router = useRouter();
  const supabase = createClient();
  const [authState, setAuthState] = useState<AuthState>("unknown");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const openByKeyboardRef = useRef(false);

  /** After Stripe checkout: claim session server-side (instant), then poll if needed.
   *  useLayoutEffect so the listener is registered before sibling CreditsCheckoutReturnToast fires the event in useEffect. */
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
          toast.error(result.message?.trim() || fallbackMsg, { id: toastId, duration: 14_000 });
          return;
        }
        toast.error(result.message?.trim() || fallbackMsg, { id: toastId, duration: 12_000 });
      })();
    };

    window.addEventListener(WILLAB_CREDITS_CHECKOUT_SUCCESS_EVENT, onCheckoutSuccess);
    return () =>
      window.removeEventListener(WILLAB_CREDITS_CHECKOUT_SUCCESS_EVENT, onCheckoutSuccess);
  }, []);

  /** Credits: single source of truth — same field as homework flow (`GET /homework/session/status`). */
  useEffect(() => {
    let cancelled = false;

    async function refreshCreditsFromStatus() {
      try {
        const status = await homeworkApi.getStatus();
        if (!cancelled) {
          setCredits(status?.credits != null ? status.credits : null);
        }
      } catch {
        if (!cancelled) setCredits(null);
      }
    }

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setAuthState("anonymous");
        setUserEmail(null);
        setCredits(null);
        return;
      }
      setAuthState("signed_in");
      setUserEmail(user.email ?? null);
      await refreshCreditsFromStatus();
    }

    void load();

    // Only attach the credits-refresh listeners when we know the user is
    // signed in — guests don't have credits and shouldn't trigger /status
    // requests in the background.
    let cleanupListeners: (() => void) | null = null;
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      const onVisibilityOrFocus = () => {
        if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
        void refreshCreditsFromStatus();
      };
      window.addEventListener("focus", onVisibilityOrFocus);
      document.addEventListener("visibilitychange", onVisibilityOrFocus);
      const intervalId = window.setInterval(() => {
        void refreshCreditsFromStatus();
      }, 60_000);
      cleanupListeners = () => {
        window.removeEventListener("focus", onVisibilityOrFocus);
        document.removeEventListener("visibilitychange", onVisibilityOrFocus);
        window.clearInterval(intervalId);
      };
    });

    return () => {
      cancelled = true;
      cleanupListeners?.();
    };
  }, [supabase]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      if (buttonRef.current && document.contains(buttonRef.current)) {
        buttonRef.current.focus();
      }
    };
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen && openByKeyboardRef.current && firstLinkRef.current) {
      const t = requestAnimationFrame(() => {
        firstLinkRef.current?.focus();
        openByKeyboardRef.current = false;
      });
      return () => cancelAnimationFrame(t);
    }
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    setLoading(true);
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err) {
      console.error(err);
      toast.error("Logout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-4xl min-w-0 items-center justify-between gap-2 px-[15px] py-4 sm:gap-4">
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/"
            className="hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
            aria-label="WillpowerLab home"
          >
            <Logo size="md" />
          </Link>
        </div>

        {/* Right-side: depends on auth state. While "unknown" we render an
            invisible spacer of equivalent height so the page doesn't shift
            when auth resolves. */}
        <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 sm:gap-3">
          {authState === "unknown" && <div className="h-10" aria-hidden />}

          {authState !== "unknown" && (
            <>
              {/* C4 — credits moved INTO the hamburger menu (name → Support →
                  Credits → Log out); the right side is just the hamburger now. */}

              {/* Unified hamburger — rendered for guests AND signed-in users.
                  Menu (C4): signed-in → name → Support → Credits → Log out;
                  guest → Support → Log in. */}
              <div className="relative flex shrink-0" ref={menuRef}>
                <Button
                  ref={buttonRef}
                  variant="outline"
                  size="icon"
                  onClick={() => setMenuOpen((o) => !o)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openByKeyboardRef.current = true;
                  }}
                  aria-label={menuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                  aria-controls={menuOpen ? HEADER_MENU_ID : undefined}
                  className="h-10 w-10"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                {menuOpen && (
                  <div
                    id={HEADER_MENU_ID}
                    className="absolute right-0 top-full z-50 mt-2 w-64 min-w-[14rem] rounded-lg border bg-card py-2 shadow-lg"
                  >
                    {authState === "signed_in" ? (
                      <>
                        {/* C4 — name. Intake captures no name, so this is the
                            linked-account email (S.3); hidden if unavailable. */}
                        {userEmail && (
                          <div
                            className="truncate border-b border-border px-4 py-2 text-[13px] text-muted-foreground"
                            title={userEmail}
                          >
                            {userEmail}
                          </div>
                        )}
                        <a
                          ref={firstLinkRef}
                          href={`mailto:${SUPPORT_EMAIL}`}
                          className={MENU_ITEM_CLASS}
                          onClick={() => setMenuOpen(false)}
                        >
                          Support
                        </a>
                        {/* Credits count → checkout. Shown EVERYWHERE incl.
                            /chat since the $25-per-analysis credit model
                            (the old "payments-free /chat" C5 rule is retired). */}
                        {credits !== null && (
                          <Link
                            href="/dashboard/pricing"
                            className={cn(
                              MENU_ITEM_CLASS,
                              "flex items-center justify-between"
                            )}
                            onClick={() => setMenuOpen(false)}
                          >
                            <span>Credits</span>
                            <span className="flex items-center gap-1 font-normal text-muted-foreground">
                              <span className="text-base leading-none">🎓</span>
                              {credits}
                            </span>
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={handleLogout}
                          disabled={loading}
                          className={cn(MENU_ITEM_CLASS, "disabled:opacity-50")}
                        >
                          {loading ? "Logging out…" : "Log out"}
                        </button>
                      </>
                    ) : (
                      <>
                        <a
                          ref={firstLinkRef}
                          href={`mailto:${SUPPORT_EMAIL}`}
                          className={MENU_ITEM_CLASS}
                          onClick={() => setMenuOpen(false)}
                        >
                          Support
                        </a>
                        <Link
                          href="/login"
                          className={MENU_ITEM_CLASS}
                          onClick={() => setMenuOpen(false)}
                        >
                          Log in
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

