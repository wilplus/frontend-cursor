import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { fetchJournalPosts } from "@/services/api/journalServer";
import JournalIndex from "./page.client";

/* -------------------------------------------------------------------------- */
/*  /journal — the public Journal index                                        */
/*                                                                            */
/*  Server component: fetches published posts from the PUBLIC backend (never    */
/*  the authed BFF, which 401s for logged-out visitors) and hands them to a     */
/*  client child that owns search / category / sort entirely in memory.        */
/*                                                                            */
/*  Chrome note: pages compose SiteHeader themselves (same as /science); the    */
/*  Footer is rendered globally by the root layout, so this page must NOT       */
/*  render one or the site gets two.                                          */
/* -------------------------------------------------------------------------- */

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Journal | WillpowerLab",
  description:
    "Notes on physiology, voice, language and philosophy from the WillpowerLab team. What we're reading, testing, and learning about speaking under pressure.",
  alternates: { canonical: "/journal" },
  openGraph: {
    title: "Journal | WillpowerLab",
    description:
      "Notes on physiology, voice, language and philosophy from the WillpowerLab team.",
    url: "https://www.willpowerlab.com/journal",
    type: "website",
  },
};

export default async function JournalPage() {
  const posts = await fetchJournalPosts();

  return (
    <div className="bg-background text-foreground">
      <SiteHeader />
      <JournalIndex posts={posts} />
    </div>
  );
}
