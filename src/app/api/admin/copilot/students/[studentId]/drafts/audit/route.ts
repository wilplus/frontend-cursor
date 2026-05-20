import { NextRequest, NextResponse } from "next/server";
import { getV2AccessToken, getBackendUrl } from "@/app/api/getAuth";

type Ctx = { params: Promise<{ studentId: string }> };

const passthrough = (h: Headers, key: string) => {
  const v = h.get(key);
  return v ? { [key]: v } : {};
};

async function proxy(req: NextRequest, ctx: Ctx) {
  const { studentId } = await ctx.params;
  if (!studentId || !studentId.trim()) {
    return NextResponse.json({ code: "BAD_REQUEST", error: "Missing studentId" }, { status: 400 });
  }
  const token = await getV2AccessToken(req);
  if (!token) {
    return NextResponse.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, { status: 401 });
  }
  const backend = getBackendUrl().replace(/\/$/, "");
  const url = new URL(`${backend}/v2/admin/copilot/students/${encodeURIComponent(studentId)}/drafts/audit`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const rawBody = hasBody ? await req.text() : undefined;

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(rawBody
        ? { "Content-Type": req.headers.get("content-type") || "application/json" }
        : {}),
    },
    body: rawBody,
    cache: "no-store",
  });

  const text = await res.text();
  const contentType = res.headers.get("content-type") || "application/json";
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": contentType,
      ...passthrough(res.headers, "cache-control"),
    },
  });
}

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx);
}
