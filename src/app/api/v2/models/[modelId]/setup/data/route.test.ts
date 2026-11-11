/*
STORY    As someone starting a model, "I don't have any" on the data step goes
         on, as "Use this data" does: the step's answer reaches the backend as
         JSON, and only a file is relayed as an upload (the founder's trial).
PROVES   one test, named TRIAL-DATA-BFF
*/
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const seen = vi.hoisted(() => ({ upload: 0, answer: 0 }));
vi.mock("@/app/api/v2/chats/chatUpload", () => ({
  uploadRoute: () => async () => {
    seen.upload += 1;
    return new Response(null, { status: 200 });
  },
}));
vi.mock("@/app/api/_lib/proxyRoute", () => ({
  proxyRoute: (_m: string, template: string) => async () => {
    seen.answer += 1;
    return new Response(JSON.stringify({ template }), { status: 200 });
  },
}));

import { POST } from "./route";

describe("the data step's route", () => {
  it("TRIAL-DATA-BFF: a JSON answer goes on as the step's answer, a file as an upload", async () => {
    const ctx = { params: { modelId: "pitch" } };
    const json = new Request("http://x/api/v2/models/pitch/setup/data", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const out = await POST(json as never, ctx);
    expect(await out.json()).toEqual({ template: "/v2/models/:modelId/setup/data" });
    const form = new FormData();
    form.append("file", new Blob(["a,b"]), "a.csv");
    await POST(new Request("http://x/api/v2/models/pitch/setup/data", { method: "POST", body: form }) as never, ctx);
    expect(seen).toEqual({ upload: 1, answer: 1 });
  });
});
