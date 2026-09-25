import { NextRequest } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";


const UPSTREAM = "/v2/user/training-consent";

export async function GET() {
  return callBackend(UPSTREAM, { method: "GET" });
}

export async function POST(req: NextRequest) {
  return callBackend(UPSTREAM, {
    method: "POST",
    body: await req.text(),
    headers: {
      "Content-Type": "application/json",
      "X-Willab-Client-Version": "willab-web-training-consent-v1",
    },
  });
}

export async function DELETE(req: NextRequest) {
  return callBackend(UPSTREAM, {
    method: "DELETE",
    body: await req.text(),
    headers: {
      "Content-Type": "application/json",
      "X-Willab-Client-Version": "willab-web-training-consent-v1",
    },
  });
}
