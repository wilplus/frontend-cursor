import { notFound, redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";
import { PILOT_UPSTREAM } from "@/app/api/_lib/baselinePilot";
import { PrivateBaselinePilotGate } from "@/components/willab/chats/experiments/baseline/BaselinePilotGate";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function SpeakingCoachPilotPage() {
  const response = await callBackend(PILOT_UPSTREAM, {
    relay: async (upstream) => new NextResponse(null, { status: upstream.status }),
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 401) redirect("/login?redirectTo=/speaking-coach/pilot");
  if (response.status === 403 || response.status === 404) notFound();
  return <PrivateBaselinePilotGate />;
}
