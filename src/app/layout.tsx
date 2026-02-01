import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

// Use system fonts instead of Google Fonts to avoid build-time network dependency
// Inter font will be loaded at runtime if available

export const metadata: Metadata = {
  title: "Willab",
  description: "Communication coaching through interview practice",
  icons: {
    icon: "/icon",
  },
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

