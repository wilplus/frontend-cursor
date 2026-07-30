import { Suspense } from "react";
import GamePageClient from "./page.client";
import LoadingState from "@/components/willab/LoadingState";

/** Avoid static prerender (search params + client subtree). */
export const dynamic = "force-dynamic";

function firstQueryValue(
  value: string | string[] | undefined
): string | null {
  if (typeof value === "string") return value || null;
  if (Array.isArray(value) && value[0]) return value[0];
  return null;
}

/**
 * /game?arc=<arcId>&snippet=<snippetId> — the key-moment game (E5).
 *
 * `arc` picks the training; absent → the client falls back to the active
 * explore arc in localStorage. `snippet` deep-links a specific moment (the
 * BE places its round first; entry points: the Recording view's "Key moment"
 * button + ideal-text PDF links).
 */
export default function GamePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <Suspense fallback={<LoadingState fullscreen />}>
      <GamePageClient
        initialArcId={firstQueryValue(searchParams.arc)}
        initialSnippetId={firstQueryValue(searchParams.snippet)}
      />
    </Suspense>
  );
}
