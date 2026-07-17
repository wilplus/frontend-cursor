import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import Footer from "@/components/Footer";
import WillabPendingSend from "@/components/willab/WillabPendingSend";
import ServiceWorkerRegistrar from "@/components/pwa/ServiceWorkerRegistrar";

// Use system fonts instead of Google Fonts to avoid build-time network dependency
// Inter font will be loaded at runtime if available

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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

