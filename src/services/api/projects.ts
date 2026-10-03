import { getAuthToken } from "@/lib/api/auth-client";

export const GUEST_OWNER_HEADER = "X-Willab-Guest-Owner";
const GUEST_OWNER_KEY = "willab_guest_owner:v1";
// Set while the guest identity was only minted and nothing has been done with
// it yet (no acceptance, no project). Such an identity is never claimed into
// an account on sign-in: claiming an empty guest would make the account's
// acquisition identity a principal that never acquired anything (see
// performGuestProjectClaim).
const MINTED_ONLY_KEY = "willab_guest_owner_minted_only:v1";

// The same values in memory, for a browser whose storage refuses writes
// (Safari private mode): the identity must still hold for this tab, or every
// call would mint a different owner and the project would be refused.
let memoryToken: string | null = null;
let memoryMintedOnly = false;

export function readGuestOwnerToken(): string | null {
  try {
    return localStorage.getItem(GUEST_OWNER_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

function writeGuestOwnerToken(token: string): void {
  memoryToken = token;
  try {
    localStorage.setItem(GUEST_OWNER_KEY, token);
  } catch {
    // The request can still complete; a later guest take will ask to sign in.
  }
}

function clearGuestOwnerToken(): void {
  memoryToken = null;
  memoryMintedOnly = false;
  try {
    localStorage.removeItem(GUEST_OWNER_KEY);
    localStorage.removeItem(MINTED_ONLY_KEY);
  } catch {}
}

function isMintedOnly(): boolean {
  try {
    return localStorage.getItem(MINTED_ONLY_KEY) === "1" || memoryMintedOnly;
  } catch {
    return memoryMintedOnly;
  }
}

function setMintedOnly(): void {
  memoryMintedOnly = true;
  try {
    localStorage.setItem(MINTED_ONLY_KEY, "1");
  } catch {}
}

/** The guest identity now carries something of the guest's own (an
 *  acceptance or a project), so a later sign-in claims it as before. */
export function markGuestOwnerUsed(): void {
  memoryMintedOnly = false;
  try {
    localStorage.removeItem(MINTED_ONLY_KEY);
  } catch {}
}

/** Test-only: forget the in-memory copies between cases. */
export function __resetGuestOwnerMemoryForTests(): void {
  memoryToken = null;
  memoryMintedOnly = false;
}

/** Drop a stored guest identity the backend no longer accepts (claimed,
 *  deleted), so the next call mints a fresh one instead of failing forever. */
export function forgetGuestOwnerToken(): void {
  clearGuestOwnerToken();
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
    if (token) {
      writeGuestOwnerToken(token);
      setMintedOnly();
    }
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
  markGuestOwnerUsed();
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
  // An identity that was only minted holds nothing to move. Claiming it would
  // record a claim event that the backend's acquisition resolver prefers over
  // the account itself, binding the account's acceptance and recordings to an
  // empty guest. Drop it instead.
  if (isMintedOnly()) {
    clearGuestOwnerToken();
    return true;
  }
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
