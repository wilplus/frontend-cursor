import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "sonner";
import Footer from "@/components/Footer";
import WillabPendingSend from "@/components/willab/WillabPendingSend";
import ServiceWorkerRegistrar from "@/components/pwa/ServiceWorkerRegistrar";

// Body copy stays on the system stack (font-sans). Headings opt in to DM
// Serif Display via Tailwind's `font-heading`, whose stack reads
// var(--font-dm-serif) — defined here. Self-hosted woff2 (latin subset) so
// the build has no Google Fonts network dependency. Founder-approved
// 2026-08-04: headings shifting to DM Serif is the intended design.
const dmSerifDisplay = localFont({
  src: "./fonts/DMSerifDisplay-Regular-latin.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-dm-serif",
});

// Honest positioning (founder 2026-07-17): metadata promises the deliverable
// (the ideal text of your talk + your strongest moments), not "charisma now".
const SITE_URL = "https://www.willpowerlab.com";
const SITE_TITLE = "WillpowerLab - Your best talk, in your own words";
const SITE_DESCRIPTION =
  "Record your talk three times. WillpowerLab gives you the ideal text of your presentation, in your own words, and shows you which moments landed best.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  applicationName: "WillpowerLab",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WillpowerLab",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "WillpowerLab",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/icon", alt: "WillpowerLab" }],
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/icon"],
  },
  icons: {
    icon: "/icon",
    shortcut: "/icon",
    apple: "/icon",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

// The nonce-based CSP (middleware.ts) needs every page rendered per request:
// build-time-prerendered HTML ships inline bootstrap scripts without the
// request's nonce, and script-src 'nonce-…' would block them (dead page).
// Middleware already runs a per-request Supabase auth check on every page,
// so per-request rendering is the marginal cost, not a new one.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={dmSerifDisplay.variable}>
      {/*
        Body owns the global viewport-locked column: content fills the
        remaining height (flex-1 + overflow-y-auto), Footer sits pinned at
        the bottom (shrink-0). Pages that previously used h-[100dvh] now
        use h-full so they fill the content slot instead of the document.
      */}
      <body className="flex h-[100dvh] flex-col font-sans antialiased">
        <div className="flex-1 overflow-y-auto">{children}</div>
        <Footer />
        <Toaster position="top-center" />
        <ServiceWorkerRegistrar />
        {/* Side-effect-only: post-OAuth merge-then-send for the unsigned
            send gate (§13). Bridges the OAuth round-trip; renders nothing. */}
        <WillabPendingSend />
      </body>
    </html>
  );
}

