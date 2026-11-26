import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { localBaselineAvailable, loopbackHost } from "@/app/api/_lib/localBaseline";
import BaselinePilotGate from "@/components/willab/chats/experiments/baseline/BaselinePilotGate";

export const dynamic = "force-dynamic";

/** Isolated local collection only. This never gates /chat or production. */
export default function BaselinePilotPreview() {
  if (!localBaselineAvailable() || !loopbackHost(headers().get("host") ?? "")) notFound();
  return <BaselinePilotGate />;
}
