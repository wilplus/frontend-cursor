import type { Metadata } from "next";
import { fetchJournalPosts } from "@/services/api/journalServer";
import { sortJournalPosts } from "@/services/api/journal";
import LandingClient from "./page.client";

/* -------------------------------------------------------------------------- */
/*  / — the landing                                                            */
/*                                                                            */
/*  Was a bare redirect to /chat for everyone. It is now a real public landing  */
/*  for ANONYMOUS visitors (the WelcomeConsent hero + the most recent Journal   */
/*  posts); signed-in visitors are still sent to /chat by the client half, so   */
/*  marketing never sits in front of the app for an existing user.              */
/*                                                                            */
/*  Server-rendered with ISR so the posts strip is in the HTML crawlers see.    */
/* -------------------------------------------------------------------------- */

export const revalidate = 300;

export const metadata: Metadata = {
  title: "WillpowerLab",
  description:
    "Record your talk. You get the ideal text of your presentation and see which moments landed best.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "WillpowerLab",
    description:
      "Record your talk. You get the ideal text of your presentation and see which moments landed best.",
    url: "https://www.willpowerlab.com/",
    type: "website",
  },
};

export default async function Home() {
  // Newest three. Soft-fails to [] (see journalServer), so a backend that is
  // down or unshipped costs the strip, never the landing.
  const posts = sortJournalPosts(await fetchJournalPosts(), "newest").slice(
    0,
    3
  );
  return <LandingClient posts={posts} />;
}
