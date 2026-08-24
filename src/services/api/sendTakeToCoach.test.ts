import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(),
}));

import { getAuthToken } from "@/lib/api/auth-client";
import { sendTakeToCoach } from "./sendTakeToCoach";

const mockedToken = vi.mocked(getAuthToken);

describe("sendTakeToCoach", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockedToken.mockResolvedValue("access-token");
  });

  it("sends exact encoded Project and Take coordinates", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ review_pending: true, already_sent: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(sendTakeToCoach("project/1", "take/1")).resolves.toEqual({
      kind: "sent",
      alreadySent: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v2/projects/project%2F1/takes/take%2F1/send-to-coach",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("does not attempt delivery without an authenticated owner", async () => {
    mockedToken.mockResolvedValue(null);
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(sendTakeToCoach("p", "t")).resolves.toEqual({
      kind: "unauthenticated",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
