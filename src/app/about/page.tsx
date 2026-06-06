import type { Metadata } from "next";
import AboutTimeline from "./page.client";

export const metadata: Metadata = {
  title: "About Us | WillpowerLab",
  description:
    "WillpowerLab — voice analysis that turns stress into charisma. Our story, where we are now, and where we're going.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Us | WillpowerLab",
    description:
      "WillpowerLab — voice analysis that turns stress into charisma. Our story, now, and what's next.",
    url: "https://www.willpowerlab.com/about",
    type: "website",
  },
};

export default function AboutPage() {
  return <AboutTimeline />;
}
