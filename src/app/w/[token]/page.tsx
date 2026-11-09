import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadWidget } from "@/lib/chats/server";
import WidgetChat from "@/components/willab/chats/WidgetChat";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/* Your chat on any website (backend N566): the page w.js opens in an iframe
   on someone's site, the one page any site may frame (middleware.ts). The
   site's host comes from w.js as `?site=`. A wrong, replaced or switched-off
   link is the not-found page, and w.js shows nothing. */

const SITE = /^[a-z0-9.-]{1,120}$/i;

export default async function Page({ params, searchParams }: {
  params: { token: string };
  searchParams: { site?: string | string[] };
}) {
  const widget = await loadWidget(params.token);
  if (!widget) notFound();
  const site = typeof searchParams.site === "string" && SITE.test(searchParams.site) ? searchParams.site : null;
  return (
    <>
      {/* Inside the frame: no footer, and nothing painted around the pill. */}
      <style>{`html,body{background:transparent!important;color-scheme:normal!important}footer:not([data-widget-foot]){display:none!important}`}</style>
      <WidgetChat token={params.token} name={widget.name} asks={widget.asks} site={site} />
    </>
  );
}
