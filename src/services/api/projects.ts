import { getAuthToken } from "@/lib/api/auth-client";

export const GUEST_OWNER_HEADER = "X-Willab-Guest-Owner";
const GUEST_OWNER_KEY = "willab_guest_owner:v1";

function readGuestOwnerToken(): string | null {
  try {
    return localStorage.getItem(GUEST_OWNER_KEY);
  } catch {
    return null;
  }
}

function writeGuestOwnerToken(token: string): void {
  try {
    localStorage.setItem(GUEST_OWNER_KEY, token);
  } catch {
    // The request can still complete; a later guest take will ask to sign in.
  }
}

function clearGuestOwnerToken(): void {
  try {
    localStorage.removeItem(GUEST_OWNER_KEY);
  } catch {}
}

export function guestOwnerHeaders(): Record<string, string> {
  const token = readGuestOwnerToken();
  return token ? { [GUEST_OWNER_HEADER]: token } : {};
}

export interface CreateProjectInput {
  displayName: string;
  setup: Record<string, unknown>;
  presentationRef?: string | null;
}

export type CreateProjectResult =
  | { kind: "ok"; projectId: string }
  | { kind: "error"; message: string };

export async function createProject(
  input: CreateProjectInput
): Promise<CreateProjectResult> {
  const authToken = await getAuthToken();
  let response: Response;
  try {
    response = await fetch("/api/v2/projects", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(authToken ? {} : guestOwnerHeaders()),
      },
      body: JSON.stringify({
        display_name: input.displayName,
        setup: input.setup,
        presentation_ref: input.presentationRef ?? null,
      }),
    });
  } catch {
    return { kind: "error", message: "Couldn't create the project." };
  }
  const body = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!response.ok || typeof body?.project_id !== "string") {
    return {
      kind: "error",
      message:
        typeof body?.error === "string"
          ? body.error
          : "Couldn't create the project.",
    };
  }
  if (typeof body.guest_owner_token === "string") {
    writeGuestOwnerToken(body.guest_owner_token);
  }
  return { kind: "ok", projectId: body.project_id };
}

/** Atomically transfer the complete guest-owned graph after authentication. */
let claimInFlight: Promise<boolean> | null = null;

async function performGuestProjectClaim(): Promise<boolean> {
  const guestHeaders = guestOwnerHeaders();
  if (!guestHeaders[GUEST_OWNER_HEADER]) return true;
  const authToken = await getAuthToken();
  if (!authToken) return false;
  try {
    const response = await fetch("/api/v2/projects/claim", {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${authToken}`,
        ...guestHeaders,
      },
    });
    if (!response.ok) return false;
    clearGuestOwnerToken();
    return true;
  } catch {
    return false;
  }
}

/** Coalesce signup listeners so one guest credential is never claimed twice. */
export async function claimGuestProjects(): Promise<boolean> {
  if (claimInFlight) return claimInFlight;
  claimInFlight = performGuestProjectClaim();
  try {
    return await claimInFlight;
  } finally {
    claimInFlight = null;
  }
}
