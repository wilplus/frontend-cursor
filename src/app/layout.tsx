import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import Footer from "@/components/Footer";
import PendingSessionClaim from "@/components/funnel/PendingSessionClaim";
import PwaInstallPrompt from "@/components/pwa/PwaInstallPrompt";

// Use system fonts instead of Google Fonts to avoid build-time network dependency
// Inter font will be loaded at runtime if available

export const metadata: Metadata = {
  title: "Willab — Turning stress into charisma",
  description: "Turning stress into charisma. Willab analyses your voice and shows you the exact moments where you sound powerful — and where stress takes over.",
  manifest: "/manifest.webmanifest",
  applicationName: "willab",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "willab",
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
        {/*
          Side-effect-only client component that runs once on mount.
          Bridges the OAuth round-trip: if a guest_session_id is stashed
          in localStorage from the cold-start funnel and the user is now
          authenticated, claim that anonymous session for them and route
          to /results. Renders nothing on its own.
        */}
        <PendingSessionClaim />
      </body>
    </html>
  );
}

