import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CEO | WillpowerLab",
  alternates: {
    canonical: "https://dev.willpowerlab.com/admin/ceo",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      noimageindex: true,
    },
  },
};

export default function CeoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
