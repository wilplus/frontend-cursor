// @vitest-environment jsdom
/*
STORY    I want to book a call or ask Artur to review this Take privately.
OUTCOME  I see the selected time or Take before I confirm the handoff.
PROVES   "books a selected slot and sends only the confirmed Take to Artur"
WHY      N688, offer and confirmation in the same chat.
*/
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  bookCoachCall: vi.fn(), readCoachCalendar: vi.fn(),
  readCoachReviewPreview: vi.fn(), sendCoachReview: vi.fn(),
}));
vi.mock("@/services/api/humanCoach", async (load) => ({
  ...await load<typeof import("@/services/api/humanCoach")>(), ...api,
}));
vi.mock("../LoungeThreadContext", () => ({ useLoungeThreadMaybe: () => null }));

import HumanCoachHandoff from "./HumanCoachHandoff";

it("books a selected slot and sends only the confirmed Take to Artur", async () => {
  const slot = "2026-11-26T12:30:00Z";
  api.readCoachCalendar.mockResolvedValue({
    slots: [slot], timezone: "Europe/Warsaw", duration_min: 30,
    price_cents: 3500, currency: "eur", needs_email: false, needs_name: false,
  });
  api.bookCoachCall.mockResolvedValue({ when: "Thu 26 Nov, 13:30" });
  api.readCoachReviewPreview.mockResolvedValue({
    project_title: "Pitch to partners", take_index: 4, duration_seconds: 168, sent: false,
  });
  api.sendCoachReview.mockResolvedValue({ email_sent_at: "2026-11-24T11:00:00Z" });

  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  const click = async (label: string) => {
    const button = [...host.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === label);
    expect(button).toBeDefined();
    await act(async () => button!.click());
  };
  try {
    await act(async () => root.render(createElement(HumanCoachHandoff, {
      offer: { project_id: "project-4", take_session_id: "take-4", book: true, send: true }, insideProject: true,
    })));
    await click("Book a call");
    expect(api.bookCoachCall).not.toHaveBeenCalled();
    expect(host.textContent).toContain("due after the call");
    await click("13:30");
    await click("Book call");
    expect(api.bookCoachCall).toHaveBeenCalledWith(expect.objectContaining({ start: slot, project_id: "project-4", price_cents: 3500 }));
    expect(host.textContent).toContain("Call booked with Artur");

    await click("Send Take to Artur");
    expect(host.textContent).toContain("Pitch to partners · Take 4");
    for (const label of ["Full recording", "Ideal Text", "Feedback walk"]) expect(host.textContent).toContain(label);
    expect(api.sendCoachReview).not.toHaveBeenCalled();
    await click("Send Take");
    expect(api.sendCoachReview).toHaveBeenCalledWith("project-4", "take-4", "");
    expect(host.querySelector("dialog")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
