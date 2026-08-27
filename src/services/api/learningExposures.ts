import { getAuthToken } from "@/lib/api/auth-client";

export type LearningSurface =
  | "confidence_classification"
  | "correction_generation"
  | "coach_comment_generation"
  | "praise_generation"
  | "praise_selection"
  | "correction_selection"
  | "ideal_text_generation";

export interface LearningExposureHandle {
  presentationId: string;
  acknowledgementToken: string;
  learningSurface: LearningSurface;
}

const LEARNING_SURFACES: readonly LearningSurface[] = [
  "confidence_classification",
  "correction_generation",
  "coach_comment_generation",
  "praise_generation",
  "praise_selection",
  "correction_selection",
  "ideal_text_generation",
];

export function mapLearningExposureHandles(
  value: unknown,
): LearningExposureHandle[] {
  if (!Array.isArray(value)) return [];
  const handles: LearningExposureHandle[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    if (record.evaluation_only === true) continue;
    const presentationId =
      typeof record.presentation_id === "string" && record.presentation_id
        ? record.presentation_id
        : null;
    const acknowledgementToken =
      typeof record.acknowledgement_token === "string" &&
      record.acknowledgement_token
        ? record.acknowledgement_token
        : null;
    const learningSurface = LEARNING_SURFACES.find(
      (surface) => surface === record.learning_surface,
    );
    if (!presentationId || !acknowledgementToken || !learningSurface) continue;
    handles.push({ presentationId, acknowledgementToken, learningSurface });
  }
  return handles;
}

export function newRenderInstanceId(): string {
  const webCrypto = globalThis.crypto;
  if (!webCrypto) {
    throw new Error("Secure browser randomness is unavailable");
  }
  if (typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  webCrypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export async function acknowledgeVisibleLearningExposures(
  handles: readonly LearningExposureHandle[],
  renderInstanceId: string,
  actorRole: "owner" | "coach" | "peer" = "owner",
): Promise<boolean> {
  if (handles.length === 0) return true;
  const token = await getAuthToken();
  if (!token) return false;
  const renderedAt = new Date().toISOString();
  const results = await Promise.all(
    handles.map(async (handle) => {
      try {
        const response = await fetch("/api/v2/learning-exposures/ack", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            presentation_id: handle.presentationId,
            acknowledgement_token: handle.acknowledgementToken,
            actor_role: actorRole,
            render_instance_id: renderInstanceId,
            client_rendered_at: renderedAt,
          }),
        });
        return response.ok;
      } catch {
        return false;
      }
    }),
  );
  return results.every(Boolean);
}
