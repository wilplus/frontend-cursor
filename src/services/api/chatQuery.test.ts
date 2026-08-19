import { afterEach, describe, expect, it, vi } from "vitest";
import { postChatQuery } from "./chatQuery";

describe("postChatQuery presentation context", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends the active project's explicit take state on text turns", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ answer: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await postChatQuery({
      question: "Can I replace the PDF?",
      presentationContext: {
        has_current_project: true,
        completed_takes: 1,
        has_pdf: true,
      },
    });

    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body));
    expect(body.presentation_context).toEqual({
      has_current_project: true,
      completed_takes: 1,
      has_pdf: true,
    });
  });
});
