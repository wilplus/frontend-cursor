import { getAuthToken } from "@/lib/api/auth-client";
import type { FiveAnswers } from "./afterPractice";
import type { Outcome } from "./practiceCheck";

export interface Community {
  id: string;
  kind: "general" | "private";
  name: string | null;
  role: string | null;
}

export interface ShareChoice {
  general: boolean;
  communityIds: string[];
  none: boolean;
  /** The version of the sharing screen's words the speaker saw (0443); a
   *  share needs it, "None" does not (null sends none). */
  shareWordsVersion?: string | null;
}

export interface ShareResult {
  takeSessionId: string;
  communityIds: string[];
  none: boolean;
}

export interface CommunityClip {
  clipId: string;
  source: "community" | "training";
  audioRef: string | null;
  startOffsetMs: number | null;
  durationMs: number | null;
}

async function call<T>(
  path: string,
  init: { method: "GET" | "POST" | "PUT"; body?: unknown },
  map: (data: Record<string, unknown>) => T,
): Promise<Outcome<T>> {
  try {
    const token = await getAuthToken();
    if (!token) return { ok: false, status: 401, code: "NO_SESSION" };
    const res = await fetch(path, {
      method: init.method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      return { ok: false, status: res.status, code: typeof data?.code === "string" ? data.code : null };
    }
    return { ok: true, data: map(data ?? {}) };
  } catch {
    return { ok: false, status: 0, code: null };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mapCommunity(raw: unknown): Community {
  const row = asRecord(raw);
  return {
    id: typeof row.id === "string" ? row.id : "",
    kind: row.kind === "general" ? "general" : "private",
    name: strOrNull(row.name),
    role: strOrNull(row.role),
  };
}

function mapCommunities(data: Record<string, unknown>): Community[] {
  if (!Array.isArray(data.communities)) return [];
  return data.communities.map(mapCommunity);
}

function mapOneCommunity(data: Record<string, unknown>): Community {
  return mapCommunity(data.community);
}

function mapShare(data: Record<string, unknown>): ShareResult {
  return {
    takeSessionId: typeof data.take_session_id === "string" ? data.take_session_id : "",
    communityIds: strings(data.community_ids),
    none: data.none === true,
  };
}

function mapClip(raw: unknown): CommunityClip {
  const row = asRecord(raw);
  return {
    clipId: typeof row.clip_id === "string" ? row.clip_id : "",
    source: row.source === "community" ? "community" : "training",
    audioRef: strOrNull(row.audio_ref),
    startOffsetMs: numOrNull(row.start_offset_ms),
    durationMs: numOrNull(row.duration_ms),
  };
}

function mapClips(data: Record<string, unknown>): CommunityClip[] {
  if (!Array.isArray(data.clips)) return [];
  return data.clips.map(mapClip);
}

function mapRecorded(data: Record<string, unknown>): { recorded: boolean } {
  return { recorded: data.recorded === true };
}

export function fetchCommunities(): Promise<Outcome<Community[]>> {
  return call("/api/v2/user/communities", { method: "GET" }, mapCommunities);
}

export function createCommunity(name: string, passCode: string): Promise<Outcome<Community>> {
  return call(
    "/api/v2/user/communities",
    { method: "POST", body: { name, pass_code: passCode } },
    mapOneCommunity,
  );
}

export function joinCommunity(passCode: string): Promise<Outcome<Community>> {
  return call(
    "/api/v2/user/communities/join",
    { method: "POST", body: { pass_code: passCode } },
    mapOneCommunity,
  );
}

export function shareTake(takeSessionId: string, choice: ShareChoice): Promise<Outcome<ShareResult>> {
  return call(
    `/api/v2/user/takes/${encodeURIComponent(takeSessionId)}/share`,
    {
      method: "PUT",
      body: {
        general: choice.general,
        community_ids: choice.communityIds,
        none: choice.none,
        ...(choice.shareWordsVersion ? { share_words_version: choice.shareWordsVersion } : {}),
      },
    },
    mapShare,
  );
}

export function fetchCommunityQueue(): Promise<Outcome<CommunityClip[]>> {
  return call("/api/v2/user/communities/queue", { method: "GET" }, mapClips);
}

export function answerCommunityClip(
  clipId: string,
  value: FiveAnswers,
): Promise<Outcome<{ recorded: boolean }>> {
  return call(
    "/api/v2/user/communities/answers",
    { method: "POST", body: { clip_id: clipId, value } },
    mapRecorded,
  );
}
