import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Training corpus | WillpowerLab",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function TrainingCorpusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
