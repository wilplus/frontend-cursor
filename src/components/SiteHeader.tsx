"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Logo from "@/components/Logo";

/**
 * Shared sticky header for the public marketing pages (About, Science,
 * Journal). The WillpowerLab logo links home; a small menu offers Home /
 * About / Science / Journal plus a way into the product. This is the common
 * chrome that makes those pages feel like one site.
 */
export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur">
      <Link href="/" className="no-underline" aria-label="WillpowerLab — home">
        <Logo />
      </Link>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={menuOpen}
          className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-muted active:scale-95"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <nav className="absolute right-0 top-11 z-20 w-40 overflow-hidden rounded-xl border border-border bg-background py-1 shadow-lg">
              {[
                { href: "/", label: "Home" },
                { href: "/about", label: "About" },
                { href: "/science", label: "Science" },
                { href: "/blog", label: "Journal" },
                { href: "/chat", label: "The lab" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-[13px] text-foreground no-underline transition hover:bg-muted"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </>
        )}
      </div>
    </header>
  );
}
