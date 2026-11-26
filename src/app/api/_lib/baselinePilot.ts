import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, relayAudio, type Relay } from "./backend";
import { isUuid } from "@/lib/uuid";
import { readBaselineStatus, readBaselineWrite } from "@/lib/willab/baselinePilotContract";

export const PILOT_UPSTREAM = "/v2/experiments/baseline-pilot";
export const PILOT_CACHE = "private, no-store";
const AUDIO_LIMIT = 4 * 1024 * 1024;
export type PilotRouteContext = { params: { path?: string[] } };

export function pilotError(status: number, code: string): NextResponse {
  return NextResponse.json({ code }, { status, headers: { "Cache-Control": PILOT_CACHE } });
}

function collectionRoute(method: string, path: string[]): boolean {
  if (!path.length) return method === "GET";
  if (path.length === 1 && path[0] === "runs") return method === "POST";
  return path.length === 5 && path[0] === "runs" && isUuid(path[1]) && path[2] === "steps" &&
    /^[A-Za-z0-9_-]{1,80}$/.test(path[3]) && (
      (path[4] === "audio" && (method === "GET" || method === "PUT")) ||
      (path[4] === "report" && method === "PUT")
    );
}

function consentRoute(method: string, path: string[]): boolean {
  if (path[0] !== "authorization") return false;
  if (path.length === 1) return method === "GET" || method === "POST";
  return path.length === 2 && ((path[1] === "ai-rendered" && method === "POST") ||
    (path[1] === "policy-text" && method === "GET"));
}

async function requestBody(req: NextRequest, audio: boolean): Promise<{ body?: BodyInit; headers?: Record<string, string> }> {
  if (req.method === "GET") return {};
  if (audio) {
    const uploaded = await req.formData();
    const file = uploaded.get("audio");
    if (!file || typeof file === "string" || !file.size || file.size > AUDIO_LIMIT) throw Error();
    const form = new FormData();
    form.append("audio", file, file.name || "baseline.webm");
    return { body: form };
  }
  const body = await req.text();
  if (Buffer.byteLength(body) > 8192) throw Error();
  JSON.parse(body);
  return { body, headers: { "Content-Type": "application/json" } };
}

function sanitizedRelay(parse: (payload: unknown) => unknown): Relay {
  return async (upstream) => {
    if (!upstream.ok) return pilotError(upstream.status, "PILOT_REQUEST_FAILED");
    try {
      return NextResponse.json(parse(await upstream.json()), { status: upstream.status });
    } catch {
      return pilotError(502, "PILOT_UNREADABLE");
    }
  };
}

const pilotAudio: Relay = async (upstream) => {
  if (!upstream.ok) return pilotError(upstream.status, "PILOT_REQUEST_FAILED");
  if (!upstream.headers.get("content-type")?.startsWith("audio/")) return pilotError(502, "PILOT_UNREADABLE");
  return relayAudio(upstream);
};

function destinationFor(req: NextRequest, path: string[], consent: boolean): string {
  const encoded = path.map(encodeURIComponent);
  if (consent) return ["/v2/processing-authorization", ...encoded.slice(1)].join("/");
  if (encoded.length) return [PILOT_UPSTREAM, ...encoded].join("/");
  const language = req.nextUrl.searchParams.get("language");
  return language === "en" || language === "pl" ? PILOT_UPSTREAM + "?language=" + language : PILOT_UPSTREAM;
}

/** The only browser routes for collection; local consent is deliberately separate. */
export async function relayBaselinePilot(req: NextRequest, path: string[], token?: string): Promise<NextResponse> {
  const preview = token !== undefined;
  const consent = preview && consentRoute(req.method, path);
  if (!consent && !collectionRoute(req.method, path)) return pilotError(404, "NOT_FOUND");
  if (Number(req.headers.get("content-length") ?? 0) > AUDIO_LIMIT + 65_536) return pilotError(413, "PILOT_AUDIO_TOO_LARGE");
  const audio = path.at(-1) === "audio";
  let payload: Awaited<ReturnType<typeof requestBody>>;
  try { payload = await requestBody(req, audio); }
  catch { return pilotError(422, "PILOT_INPUT"); }
  const range = audio && req.method === "GET" ? req.headers.get("range") : null;
  const parse = path.length ? readBaselineWrite : readBaselineStatus;
  const relay = consent ? undefined : audio && req.method === "GET" ? pilotAudio
    : sanitizedRelay((value) => parse(value, preview));
  const response = await callBackend(destinationFor(req, path, consent), {
    ...payload,
    headers: range ? { Range: range } : payload.headers,
    method: req.method,
    ...(preview ? { token } : {}),
    relay,
    redirect: "error",
    signal: AbortSignal.timeout(60_000),
  });
  response.headers.set("Cache-Control", PILOT_CACHE);
  return response;
}
