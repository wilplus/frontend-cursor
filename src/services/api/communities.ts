import { outcomeCall as call, type Outcome } from "@/lib/api/bffCall";

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

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
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
