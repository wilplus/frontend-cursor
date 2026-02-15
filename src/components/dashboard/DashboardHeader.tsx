"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu } from "lucide-react";
import WillabLogo from "@/components/WillabLogo";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CAL_LESSON_URL = "https://cal.com/artur-willonski-zywzu7/lesson";
const SUPPORT_EMAIL = "artur@willonski.com";
const HEADER_MENU_ID = "dashboard-header-menu";

export default function DashboardHeader() {
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const openByKeyboardRef = useRef(false);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
    };
    getUser();
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
      toast.success("Logged out");
      router.push("/login");
    } catch (err) {
      console.error(err);
      toast.error("Logout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-4xl min-w-0 items-center justify-between gap-2 px-[15px] py-4 sm:gap-4">
        <Link
          href="/dashboard"
          className="shrink-0 hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        >
          <WillabLogo size="md" />
        </Link>
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
              <a
                ref={firstLinkRef}
                href={CAL_LESSON_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-2.5 text-left font-semibold text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                onClick={() => setMenuOpen(false)}
              >
                Book a lesson
              </a>
              <div className="px-4 py-2.5 text-left">
                <div className="font-medium text-foreground">Support &amp; settings</div>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline focus:outline-none focus:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>
              <div className="border-t px-4 py-2.5">
                <div className="min-w-0 truncate text-sm font-medium text-foreground">
                  {userEmail ?? "…"}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loading}
                  className={cn(
                    "text-sm text-muted-foreground hover:text-foreground hover:underline focus:outline-none focus:underline disabled:opacity-50"
                  )}
                >
                  {loading ? "Logging out…" : "Logout"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

