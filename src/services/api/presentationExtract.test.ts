import { afterEach, describe, expect, it, vi } from "vitest";
import { extractPresentation } from "./presentationExtract";

let authToken: string | null = null;
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: async () => authToken,
}));

const GUEST = "principal.secret-value-that-is-long-enough";

function deck(): File {
  return new File([new Uint8Array([37, 80, 68, 70])], "deck.pdf", {
    type: "application/pdf",
  });
}

let sent: Record<string, string> | undefined;
function mockFetch() {
  sent = undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      sent = init.headers as Record<string, string>;
      return new Response(
        JSON.stringify({ slides: [{ title: "One", body: "" }], presentation_ref: "r" }),
        { status: 200 }
      );
    })
  );
}

afterEach(() => {
  authToken = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* The deck could not be uploaded (2026-10-08): the backend's processing gate
   covers /v2/lab/, and the deck call carried no guest owner token, so every
   guest deck was refused before the parser ran. */
describe("extractPresentation identity", () => {
  it("sends a guest's owner token", async () => {
    vi.stubGlobal("localStorage", { getItem: () => GUEST });
    mockFetch();
    const r = await extractPresentation(deck());
    expect(r.status).toBe("ok");
    expect(sent).toEqual(expect.objectContaining({ "X-Willab-Guest-Owner": GUEST }));
    expect(sent).not.toHaveProperty("Authorization");
  });

  it("sends only the bearer for a signed-in person", async () => {
    authToken = "tok";
    vi.stubGlobal("localStorage", { getItem: () => GUEST });
    mockFetch();
    await extractPresentation(deck());
    expect(sent).toEqual(expect.objectContaining({ Authorization: "Bearer tok" }));
    expect(sent).not.toHaveProperty("X-Willab-Guest-Owner");
  });
});
