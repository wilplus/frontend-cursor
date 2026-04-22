import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

type ProxyOptions = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  backendPath: string;
  body?: unknown;
};

function jsonError(status: number, code: string, error: string, details?: unknown) {
  return NextResponse.json(
    details == null ? { code, error } : { code, error, details },
    { status }
  );
}

export async function proxyAdminWithCodes(request: NextRequest, options: ProxyOptions) {
  const token = await getV2AccessToken(request);
  if (!token) {
    return jsonError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const backend = getBackendUrl();
  const url = `${backend}${options.backendPath}`;
  const response = await fetch(url, {
    method: options.method,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const raw = await response.text();
  if (!raw.trim()) {
    if (!response.ok) {
      return jsonError(
        response.status,
        `HTTP_${response.status}`,
        response.statusText || "Request failed"
      );
    }
    return NextResponse.json({});
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    if (!response.ok) {
      return jsonError(
        response.status,
        `HTTP_${response.status}`,
        "Backend returned non-JSON error",
        { raw: raw.slice(0, 500) }
      );
    }
    return jsonError(502, "INVALID_BACKEND_RESPONSE", "Backend returned non-JSON response");
  }

  if (!response.ok) {
    const asObj = parsed as { code?: string; error?: string; message?: string; details?: unknown };
    return jsonError(
      response.status,
      asObj.code || `HTTP_${response.status}`,
      asObj.error || asObj.message || response.statusText || "Request failed",
      asObj.details
    );
  }

  return NextResponse.json(parsed);
}

