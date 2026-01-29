import type { NextRequest } from "next/server";
import { proxyMultipart } from "@/lib/api/bff";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  return proxyMultipart("/recordings/upload", formData, "POST", req);
}

