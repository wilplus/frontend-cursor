import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

// Use system fonts instead of Google Fonts to avoid build-time network dependency
// Inter font will be loaded at runtime if available

export const metadata: Metadata = {
  title: "willab - willpower lab that fuels your speaking confidence",
  description: "willab - willpower lab for your confidence on stage",
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
      </body>
    </html>
  );
}

