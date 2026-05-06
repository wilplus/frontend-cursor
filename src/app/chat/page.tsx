import { Suspense } from "react";
import ChatPageClient from "./page.client";

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
  const sourceSnippet = firstQueryValue(searchParams.sourceSnippet);
  const rawIntent = firstQueryValue(searchParams.intent);
  const intent =
    rawIntent === "charisma" || rawIntent === "stress" ? rawIntent : null;

  return (
    <Suspense
      fallback={
        <div className="willab-chat flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <ChatPageClient sourceSnippet={sourceSnippet} intent={intent} />
    </Suspense>
  );
}
