import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

const GUEST_OWNER_HEADER = "X-Willab-Guest-Owner";

export async function POST(req: NextRequest) {
  const guestOwner = req.headers.get(GUEST_OWNER_HEADER);
  return callBackend("/v2/projects/claim", {
    method: "POST",
    headers: guestOwner ? { [GUEST_OWNER_HEADER]: guestOwner } : {},
  });
}
