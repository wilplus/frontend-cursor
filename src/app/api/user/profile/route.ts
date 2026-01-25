import type { NextRequest } from "next/server";
import { proxyJson } from "@/lib/api/bff";

export async function GET(_req: NextRequest) {
  return proxyJson("/user/profile");
}

