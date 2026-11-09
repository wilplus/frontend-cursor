import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadJoinLink } from "@/lib/chats/server";
import { joinTitle } from "@/components/willab/chats/joinCopy";
import JoinPage from "./JoinPage";

export const dynamic = "force-dynamic";

/* A person's join link, /c/<token> (backend N308, N328, N335). A wrong,
   replaced or switched-off link is the site's own not-found page. */

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const info = await loadJoinLink(params.token);
  return info ? { title: joinTitle(info.name), robots: { index: false, follow: false } } : {};
}

export default async function Page({ params, searchParams }: {
  params: { token: string };
  searchParams: { join?: string | string[] };
}) {
  const info = await loadJoinLink(params.token);
  if (!info) notFound();
  return (
    <JoinPage
      token={params.token}
      name={info.name}
      assistant={info.assistant}
      willLine={info.willLine}
      finish={searchParams.join === "1"}
    />
  );
}
