import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import FounderComparisonClient from "./page.client";

export const dynamic = "force-dynamic";

const FOUNDER_EMAIL = "artur@willonski.com";

export default async function FounderComparisonPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/login?redirectTo=/coach/corpus/summary/${encodeURIComponent(
        params.sessionId,
      )}`,
    );
  }
  if (user.email?.trim().toLowerCase() !== FOUNDER_EMAIL) notFound();
  return <FounderComparisonClient sessionId={params.sessionId} />;
}
