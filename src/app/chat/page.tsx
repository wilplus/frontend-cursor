import { Suspense } from "react";
import ChatPageClient from "./page.client";
import LoadingState from "@/components/willab/LoadingState";
import { chatLinkOf } from "@/lib/willab/chatLink";

/** Avoid static prerender (search params + client subtree). */
export const dynamic = "force-dynamic";

function firstQueryValue(
  value: string | string[] | undefined
): string | null {
  if (typeof value === "string") return value || null;
  if (Array.isArray(value) && value[0]) return value[0];
  return null;
}

export default function ChatPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // One link (backend N691 item 3): `?take=` opens the chat on that Take's
  // coach bubble. Older links are read by chatLinkOf and dropped on arrival.
  const link = chatLinkOf((name) => firstQueryValue(searchParams[name]));
  return (
    <Suspense fallback={<LoadingState placement="viewport" />}>
      <ChatPageClient take={link.take} coach={link.coach} />
    </Suspense>
  );
}
