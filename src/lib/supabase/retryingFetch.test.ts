import { describe, expect, it, vi } from "vitest";

import { createRetryingFetch } from "./retryingFetch";

const TOKEN = "https://proj.supabase.co/auth/v1/token?grant_type=pkce";
const noSleep = () => Promise.resolve();

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
});
