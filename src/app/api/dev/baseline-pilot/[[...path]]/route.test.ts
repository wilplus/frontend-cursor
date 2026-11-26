/*
STORY    A local founder preview keeps its credential server-side and scoped.
OUTCOME
  O1  Production, hosted upstreams and unrelated routes never receive the local token.
  O2  Audio and normal processing consent use the fixed isolated founder profile.
PROVES   O1,O2 -> "the isolated baseline bridge"
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
const backend = vi.hoisted(() => ({ local: true, call: vi.fn(), audio: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/app/api/_lib/backend", () => ({ backendTargetsLoopback: () => backend.local,
  callBackend: backend.call, relayAudio: backend.audio }));
import { GET, POST, PUT } from "./route";

const id = "11111111-1111-4111-8111-111111111111";
const root = "http://127.0.0.1:3117/api/dev/baseline-pilot";
const request = (url = root, init: NonNullable<ConstructorParameters<typeof NextRequest>[1]> = {}) => {
  const headers = new Headers({ host: "127.0.0.1:3117", origin: "http://127.0.0.1:3117" });
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return new NextRequest(url, { ...init, headers });
};

describe("the isolated baseline bridge", () => {
  let folder: string;
  beforeEach(async () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("ISOLATED_BASELINE_PREVIEW", "1");
    folder = await mkdtemp(join(tmpdir(), "baseline-bridge-test-"));
    const file = join(folder, "token"); await writeFile(file, "local-founder-fixture", { mode: 0o600 });
    vi.stubEnv("ISOLATED_BASELINE_TOKEN_FILE", file);
    backend.local = true; backend.call.mockReset();
    backend.call.mockImplementation(async () => NextResponse.json({ entry_allowed: false }));
  });
  afterEach(async () => { vi.unstubAllEnvs(); await rm(folder, { recursive: true, force: true }); });

  it("stays closed in production or when the configured upstream is hosted", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await GET(request(), { params: {} })).status).toBe(404);
    vi.stubEnv("NODE_ENV", "development"); backend.local = false;
    expect((await GET(request(), { params: {} })).status).toBe(404);
    expect(backend.call).not.toHaveBeenCalled();
  });

  it("refuses a cross-site request and every route outside collection and consent", async () => {
    expect((await GET(request(root, { headers: { origin: "https://another.example" } }), { params: {} })).status).toBe(404);
    expect((await POST(request(root + "/authorization/terminate", { method: "POST" }),
      { params: { path: ["authorization", "terminate"] } })).status).toBe(404);
    expect(backend.call).not.toHaveBeenCalled();
  });

  it("passes unchanged consent bytes and only the server-held founder identity", async () => {
    const payload = JSON.stringify({ policy_version: "test-policy", terms_copy_sha256: "exact-hash" });
    const response = await POST(request(root + "/authorization", {
      method: "POST", body: payload, headers: { "Content-Type": "application/json", Authorization: "Bearer other-profile" },
    }), { params: { path: ["authorization"] } });
    expect(backend.call).toHaveBeenCalledWith("/v2/processing-authorization", expect.objectContaining({
      method: "POST", body: payload, token: "local-founder-fixture",
    }));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.stringify(await response.json())).not.toContain("local-founder-fixture");
  });

  it("uploads and replays only the exact saved recording using the same identity", async () => {
    const path = ["runs", id, "steps", "quiet", "audio"];
    const body = new FormData(); body.append("audio", new Blob(["fixture audio"], { type: "audio/webm" }), "baseline.webm");
    await PUT(request(root + "/" + path.join("/"), { method: "PUT", body }), { params: { path } });
    expect(backend.call).toHaveBeenLastCalledWith("/v2/experiments/baseline-pilot/" + path.join("/"), expect.objectContaining({
      method: "PUT", body: expect.any(FormData), token: "local-founder-fixture",
    }));
    await GET(request(root + "/" + path.join("/"), { headers: { Range: "bytes=0-15" } }), { params: { path } });
    expect(backend.call).toHaveBeenLastCalledWith("/v2/experiments/baseline-pilot/" + path.join("/"), expect.objectContaining({
      method: "GET", relay: expect.any(Function), headers: { Range: "bytes=0-15" }, token: "local-founder-fixture",
    }));
  });
});
