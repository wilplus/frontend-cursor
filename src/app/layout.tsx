import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "sonner";
import Footer from "@/components/Footer";
import { isAppUserAgent } from "@/lib/nativeAppAgent";
import PendingCoachSend from "@/components/willab/PendingCoachSend";
import GuestProjectClaim from "@/components/willab/GuestProjectClaim";
import ServiceWorkerRegistrar from "@/components/pwa/ServiceWorkerRegistrar";
import HomeScreenReporter from "@/components/pwa/HomeScreenReporter";
import NativeAppMarker from "@/components/pwa/NativeAppMarker";
import NativePush from "@/components/pwa/NativePush";
import NativeLinks from "@/components/pwa/NativeLinks";
import NativeLaunchScreen from "@/components/pwa/NativeLaunchScreen";
import NativeKeyboard from "@/components/pwa/NativeKeyboard";
import BookingReturn from "@/components/booking/BookingReturn";
import {
  resolveUiLocaleFromRequest,
  UI_LOCALE_COOKIE,
} from "@/lib/uiLocale";
import UiLocaleProvider from "@/components/ui/UiLocaleProvider";

// Body copy stays on the system stack (font-sans). Headings opt in to DM
// Serif Display via Tailwind's `font-heading`, whose stack reads
// var(--font-dm-serif) — defined here. Self-hosted woff2 (latin subset) so
// the build has no Google Fonts network dependency. Founder-approved
// 2026-08-04: headings shifting to DM Serif is the intended design.
//
// Not preloaded: only /voice-album, /unsubscribe and /admin/booking draw a
// `font-heading` heading, and a preload made every page (/login and /chat in
// the app among them) fetch the 25 kB file at high priority on every cold
// open. The browser now fetches it when a heading uses it; `swap` shows the
// fallback serif until it is in.
const dmSerifDisplay = localFont({
  src: "./fonts/DMSerifDisplay-Regular-latin.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  preload: false,
  variable: "--font-dm-serif",
});

// Honest positioning (founder 2026-07-17): metadata promises the deliverable
// (the ideal text of your talk + your strongest moments), not "charisma now".
// Founder 2026-11-04 (in chat): the link-preview title is now
// "You know it. Can you explain it?".
const SITE_URL = "https://www.willpowerlab.com";
const SITE_TITLE = "WillpowerLab - You know it. Can you explain it?";
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
  const requestHeaders = headers();
  const persistedOverride = cookies().get(UI_LOCALE_COOKIE)?.value;
  const uiLocale = resolveUiLocaleFromRequest(requestHeaders, persistedOverride);

  return (
    <html lang={uiLocale} data-ui-locale={uiLocale} suppressHydrationWarning className={dmSerifDisplay.variable}>
      {/*
        Body owns the global viewport-locked column: content fills the
        remaining height (flex-1 + overflow-y-auto), Footer sits pinned at
        the bottom (shrink-0). Pages that previously used h-[100dvh] now
        use h-full so they fill the content slot instead of the document.
      */}
      <body className="flex h-[100dvh] flex-col font-sans antialiased">
        <UiLocaleProvider initialLocale={uiLocale}>
          <div data-app-content className="relative min-h-0 flex-1">
            <div className="h-full overflow-y-auto">{children}</div>
          </div>
          {/* No website footer inside the iPhone app (backend N674 item 1): the
              language follows the iPhone's, About us, Blog and Privacy are in
              the menu. Read from the user agent, so it never flashes. */}
          {isAppUserAgent(requestHeaders.get("user-agent")) ? null : <Footer />}
          <Toaster position="top-center" />
          <ServiceWorkerRegistrar />
          <HomeScreenReporter />
          <NativeAppMarker />
          <NativePush />
          <NativeLinks />
          <NativeLaunchScreen />
          <NativeKeyboard />
          {/* Side-effect-only: claim the guest graph, then send the exact parked
              Project Take after OAuth. Renders nothing. */}
          <PendingCoachSend />
          <GuestProjectClaim />
          <BookingReturn />
        </UiLocaleProvider>
      </body>
    </html>
  );
}
