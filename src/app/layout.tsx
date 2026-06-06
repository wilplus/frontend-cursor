import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import Footer from "@/components/Footer";
import WillabPendingSend from "@/components/willab/WillabPendingSend";
import PwaInstallPrompt from "@/components/pwa/PwaInstallPrompt";

// Use system fonts instead of Google Fonts to avoid build-time network dependency
// Inter font will be loaded at runtime if available

const SITE_URL = "https://www.willpowerlab.com";
const SITE_TITLE = "WillpowerLab — Turning stress into charisma";
const SITE_DESCRIPTION =
  "Turning stress into charisma. WillpowerLab analyses your voice and shows you the exact moments where you sound powerful — and where stress takes over.";

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
        <PwaInstallPrompt />
        {/* Side-effect-only: post-OAuth merge-then-send for the unsigned
            send gate (§13). Bridges the OAuth round-trip; renders nothing. */}
        <WillabPendingSend />
      </body>
    </html>
  );
}

