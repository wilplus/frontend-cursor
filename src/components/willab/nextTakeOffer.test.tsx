// @vitest-environment jsdom
/*
STORY    A speaker can start the next Take when a chat reply offers it.
OUTCOME  O1  The offered link uses the interface language.
         O2  A subsequent Take starts private.
PROVES   O1 -> "uses the UI language and shows a single link on an explicit next Take offer"
         O2 -> "starts private regardless of earlier recipients and bounds the sharing lookup"
WHY      Founder, 23 November 2026, N682. N626 governs sharing.
*/
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import UiLocaleProvider from "@/components/ui/UiLocaleProvider";
import { readPrivateTakeShare } from "@/lib/willab/nextTakeShare";
import RecordNextTakeLink from "./chats/RecordNextTakeLink";

const send = vi.hoisted(() => ({
  fetchSendPeople: vi.fn(),
  fetchLastSend: vi.fn(),
}));
vi.mock("@/services/api/takeSends", () => send);

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

it("uses the UI language and shows a single link on an explicit next Take offer", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  const onRecord = vi.fn();
  const draw = (offer: { suggested_action?: string; suggested_actions?: string[] }) => act(() =>
    root.render(createElement(UiLocaleProvider, { initialLocale: "pl" },
      createElement(RecordNextTakeLink, { offer, onRecord }),
    )),
  );
  try {
    draw({ suggested_action: "trainings" });
    expect(host.querySelector("button")).toBeNull();
    draw({ suggested_action: "record_again", suggested_actions: ["record_again", "trainings"] });
    expect(host.querySelectorAll("button")).toHaveLength(1);
    expect(host.textContent).toContain("Nagraj kolejne podejście");
    expect(onRecord).not.toHaveBeenCalled();
    act(() => host.querySelector("button")!.click());
    expect(onRecord).toHaveBeenCalledTimes(1);
  } finally {
    act(() => root.unmount());
  }
});

it("starts private regardless of earlier recipients and bounds the sharing lookup", async () => {
  send.fetchSendPeople.mockResolvedValue({ enabled: true, people: [{ userId: "a" }] });
  send.fetchLastSend.mockResolvedValue({ enabled: true, choice: { all: true, userIds: [] } });
  expect(await readPrivateTakeShare()).toEqual({ kind: "people", all: false, user_ids: [], names: [] });
  send.fetchSendPeople.mockResolvedValue({ enabled: true, people: [] });
  expect(await readPrivateTakeShare()).toBeNull();

  vi.useFakeTimers();
  send.fetchSendPeople.mockReturnValue(new Promise(() => {}));
  const pending = readPrivateTakeShare();
  await vi.advanceTimersByTimeAsync(1500);
  expect(await pending).toMatchObject({ none: true, general: false, community_ids: [] });
});
