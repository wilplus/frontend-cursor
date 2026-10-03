import { getAuthToken } from "@/lib/api/auth-client";

export const GUEST_OWNER_HEADER = "X-Willab-Guest-Owner";
const GUEST_OWNER_KEY = "willab_guest_owner:v1";

export function readGuestOwnerToken(): string | null {
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

/** A first-time visitor's guest identity, minted before anything else needs it.

    Under PLF1 enforce every core route, project creation included, refuses a
    caller with no owner ("A verified owner is required."), and acceptance
    needs an owner too. A guest used to receive their identity only as a side
    effect of creating their first project, so a brand-new guest could neither
    accept nor create a project: a closed loop from 2026-09-21 to the fix of
    2026-10-03 (F1 Repair Plan Phase 0.5). The backend has always offered the
    mint (`POST /v2/processing-authorization/principal`, outside the gate);
    this is its caller.

    Signed-in people never mint: the backend resolves their owner from the
    session. A stored token is reused as is. Concurrent callers share one
    request, so one visitor never ends up with two guest principals. A failed
    mint returns null and leaves the caller where it was before this existed. */
let mintInFlight: Promise<string | null> | null = null;

export async function ensureGuestOwnerToken(): Promise<string | null> {
  const stored = readGuestOwnerToken();
  if (stored) return stored;
  if (await getAuthToken()) return null;
  if (!mintInFlight) {
    mintInFlight = mintGuestOwnerToken().finally(() => {
      mintInFlight = null;
    });
  }
  return mintInFlight;
}

async function mintGuestOwnerToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/v2/processing-authorization/principal", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const token =
      typeof body?.guest_owner_token === "string" ? body.guest_owner_token : null;
    if (token) writeGuestOwnerToken(token);
    return token ?? readGuestOwnerToken();
  } catch {
    return null;
  }
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
  | { kind: "ok"; projectId: string; guestOwnerToken: string | null }
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
  const issuedGuestOwnerToken =
    typeof body.guest_owner_token === "string"
      ? body.guest_owner_token
      : null;
  if (issuedGuestOwnerToken) writeGuestOwnerToken(issuedGuestOwnerToken);
  return {
    kind: "ok",
    projectId: body.project_id,
    // Carry the credential through the same in-memory transaction as project
    // creation. localStorage remains the cross-screen persistence layer, but
    // Safari storage restrictions must not orphan the Take created one line
    // later from the guest principal that owns its Project.
    guestOwnerToken: authToken
      ? null
      : issuedGuestOwnerToken ?? readGuestOwnerToken(),
  };
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
