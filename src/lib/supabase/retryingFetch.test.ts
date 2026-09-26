import { describe, expect, it, vi } from "vitest";

import { createRetryingFetch, isPkceTokenExchange } from "./retryingFetch";

const TOKEN = "https://proj.supabase.co/auth/v1/token?grant_type=pkce";
const noSleep = () => Promise.resolve();

describe("isPkceTokenExchange", () => {
  it("matches only the PKCE code exchange", () => {
    expect(isPkceTokenExchange(TOKEN, { method: "POST" })).toBe(true);
    expect(isPkceTokenExchange(TOKEN, { method: "GET" })).toBe(false);
    expect(
      isPkceTokenExchange("https://proj.supabase.co/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
      })
    ).toBe(false);
    expect(isPkceTokenExchange("https://proj.supabase.co/rest/v1/x", { method: "POST" })).toBe(false);
  });
});

describe("createRetryingFetch", () => {
  it("resends the code exchange after a dropped connection", async () => {
    const ok = new Response("{}", { status: 200 });
    const base = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Load failed"))
      .mockResolvedValueOnce(ok);
    const f = createRetryingFetch(base as unknown as typeof fetch, noSleep);
    await expect(f(TOKEN, { method: "POST", body: "{}" })).resolves.toBe(ok);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("gives up after two resends", async () => {
    const base = vi.fn().mockRejectedValue(new TypeError("Load failed"));
    const f = createRetryingFetch(base as unknown as typeof fetch, noSleep);
    await expect(f(TOKEN, { method: "POST" })).rejects.toThrow("Load failed");
    expect(base).toHaveBeenCalledTimes(3);
  });

  it("never resends an HTTP error — the server answered", async () => {
    const refused = new Response("{}", { status: 400 });
    const base = vi.fn().mockResolvedValue(refused);
    const f = createRetryingFetch(base as unknown as typeof fetch, noSleep);
    await expect(f(TOKEN, { method: "POST" })).resolves.toBe(refused);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("passes every other request through without retrying", async () => {
    const base = vi.fn().mockRejectedValue(new TypeError("Load failed"));
    const f = createRetryingFetch(base as unknown as typeof fetch, noSleep);
    await expect(f("https://proj.supabase.co/rest/v1/x", { method: "POST" })).rejects.toThrow();
    expect(base).toHaveBeenCalledTimes(1);
  });
});
