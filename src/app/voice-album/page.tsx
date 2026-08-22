import { Suspense } from "react";
import LoadingState from "@/components/willab/LoadingState";
import VoiceAlbumPageClient from "./page.client";

export const dynamic = "force-dynamic";

function firstQueryValue(
  value: string | string[] | undefined
): string | null {
  if (typeof value === "string") return value || null;
  return Array.isArray(value) && value[0] ? value[0] : null;
}

export default function VoiceAlbumPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <Suspense fallback={<LoadingState fullscreen />}>
      <VoiceAlbumPageClient
        initialProjectId={firstQueryValue(searchParams.arc)}
      />
    </Suspense>
  );
}
