import type { NextRequest } from "next/server";
import { proxyMultipart } from "@/lib/api/bff";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  // Flask endpoint is /recordings/upload (note: plural "recordings")
  return proxyMultipart("/recordings/upload", formData, "POST");
}

