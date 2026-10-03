import { getAuthToken } from "@/lib/api/auth-client";

export const GUEST_OWNER_HEADER = "X-Willab-Guest-Owner";
const GUEST_OWNER_KEY = "willab_guest_owner:v1";
// Set while the guest identity was only minted and nothing has been done with
// it yet (no acceptance, no project). Such an identity is never claimed into
// an account on sign-in: claiming an empty guest would make the account's
// acquisition identity a principal that never acquired anything (see
// performGuestProjectClaim).
const MINTED_ONLY_KEY = "willab_guest_owner_minted_only:v1";

// The same values in memory, used ONLY while this tab's storage refuses
// writes (Safari private mode): the identity must still hold for the tab, or
// every call would mint a different owner and the project would be refused.
// While storage works it is the one truth, shared by every tab, so a clear or
// a "used" mark made in another tab is never overridden by this tab's memory.
let storageWritable = true;
let memoryToken: string | null = null;
let memoryMintedOnly = false;

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    storageWritable = true;
  } catch {
    storageWritable = false;
  }
}

function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function readGuestOwnerToken(): string | null {
  return storageWritable ? storageGet(GUEST_OWNER_KEY) : memoryToken;
}

function writeGuestOwnerToken(token: string): void {
  memoryToken = token;
  // The request can still complete when storage refuses; the tab keeps the
  // identity in memory (above).
  storageSet(GUEST_OWNER_KEY, token);
}

function clearGuestOwnerToken(): void {
  memoryToken = null;
  memoryMintedOnly = false;
  storageRemove(GUEST_OWNER_KEY);
  storageRemove(MINTED_ONLY_KEY);
}

function isMintedOnly(): boolean {
  return storageWritable
    ? storageGet(MINTED_ONLY_KEY) === "1"
    : memoryMintedOnly;
}

function setMintedOnly(): void {
  memoryMintedOnly = true;
  storageSet(MINTED_ONLY_KEY, "1");
}

/** The guest identity now carries something of the guest's own (an
 *  acceptance or a project), so a later sign-in claims it as before. Only a
 *  guest's act counts: a signed-in person's acceptance or project belongs to
 *  their account, never to a guest token left in storage. */
export async function markGuestOwnerUsed(): Promise<void> {
  if (await getAuthToken()) return;
  memoryMintedOnly = false;
  storageRemove(MINTED_ONLY_KEY);
}

/** Test-only: forget the in-memory copies between cases. */
export function __resetGuestOwnerMemoryForTests(): void {
  storageWritable = true;
  memoryToken = null;
  memoryMintedOnly = false;
}

/** Drop a guest identity the backend refused, but ONLY one that holds
 *  nothing (minted, never used). The backend answers INVALID_GUEST_OWNER on a
 *  failed principal read too, so dropping a used identity on that answer
 *  would erase the only key to a guest's acceptance, projects and Takes after
 *  one database hiccup. Returns whether it dropped anything. */
export function forgetMintedOnlyGuestOwnerToken(): boolean {
  if (!readGuestOwnerToken() || !isMintedOnly()) return false;
  clearGuestOwnerToken();
  return true;
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
    // Another tab may have stored (and used) an identity while this mint was
    // in flight: keep that one, never overwrite a guest's work with an empty
    // identity.
    const already = readGuestOwnerToken();
    if (already) return already;
    if (token) {
      writeGuestOwnerToken(token);
      setMintedOnly();
    }
    return token;
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
  if (!authToken) await markGuestOwnerUsed();
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
