import { getAuthToken } from "@/lib/api/auth-client";

export async function postJourneyNextSteps(arcId: string): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;
  try {
    const response = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/journey/next-steps`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}
