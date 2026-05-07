import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
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
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-center" />
        <PwaInstallPrompt />
      </body>
    </html>
  );
}

