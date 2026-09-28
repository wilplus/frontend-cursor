import { bffFetch } from "@/lib/api/bffFetch";

export async function postJourneyNextSteps(arcId: string): Promise<boolean> {
  const result = await bffFetch(
    `/api/v2/explore/arc/${encodeURIComponent(arcId)}/journey/next-steps`,
    { method: "POST", cache: "no-store" }
  );
  return result.kind === "response" && result.ok;
}
