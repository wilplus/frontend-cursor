// @vitest-environment jsdom
/*
STORY    As a speaker, I want to add or change my project's slides from the
         Ideal Text page or the chat, and stay in the same project, so that my
         next Take uses the new deck without starting over.
OUTCOME
  O1  The Ideal Text ⋯ menu says "Add slides" when my project has no deck and
      "Update slides" when it has one.
  O2  Choosing a PDF there reads it, saves it as this project's deck
      (slides and the served PDF), says "New slides ready for Take 5." and
      leaves this device's copy of the deck on the new slides.
  O3  In the chat, Will's update_slides is never a button: a grey card with
      "Update slides" takes the message box's place; the upload ends with
      Will's line "New slides ready for Take 5." and the message box comes
      back. Cancel brings the message box back with nothing sent.
PROVES   O1 -> "the ⋯ item says Add slides without a deck and Update slides with one"
         O2 -> "a chosen PDF becomes the project's deck and the next Take's"
         O3 -> "the chat's card stands in for the message box until the upload or Cancel"
WHY      Founder 2026-10-29, backend N257; prototype
         https://claude.ai/artifact/8heRv4BC6fGg7EzuzuTo4A.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const extract = vi.hoisted(() => vi.fn());
vi.mock("@/services/api/presentationExtract", () => ({ extractPresentation: extract }));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "tok") }));
vi.mock("./useUserId", () => ({ useUserId: () => "owner-1" }));

import IdealTextMenu from "./IdealTextMenu";
import {
  SlidesAskComposer,
  SlidesAskSlot,
  offersUpdateSlides,
  useSlidesAsk,
  useUpdateSlides,
} from "./UpdateSlides";
import { coerceSuggestedActions } from "./loungePrompts";
import { readExploreArc, writeExploreArc } from "@/lib/willab/exploreArc";

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  localStorage.clear();
  extract.mockReset();
  extract.mockResolvedValue({
    status: "ok",
    deck: {
      presentationRef: "https://cdn.test/v2.pdf",
      slides: [{ title: "Hook", body: "" }, { title: "The ask", body: "Two hires" }],
      warnings: [],
    },
  });
  fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ project_id: "arc-1", next_take: 5 }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const flush = () =>
  act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
const button = (label: string) =>
  Array.from(document.body.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent?.trim() === label,
  );
async function choosePdf() {
  const input = document.body.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File(["%PDF"], "Q3 Board pitch v2.pdf", { type: "application/pdf" });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}

function IdealTextHeader({ hasDeck }: { hasDeck: boolean }) {
  const slides = useUpdateSlides("arc-1", { hasDeck, takeCount: 4 });
  return createElement(
    "div",
    null,
    createElement(IdealTextMenu, {
      arcId: "arc-1",
      saved: null,
      onSaved: () => undefined,
      slides: slides.item,
      onCopy: () => undefined,
      copied: false,
    }),
    slides.layer,
  );
}

async function openMenu(hasDeck: boolean) {
  act(() => root.render(createElement(IdealTextHeader, { hasDeck })));
  await act(async () => document.body.querySelector<HTMLButtonElement>('[aria-label="More"]')?.click());
}

describe("Update slides on the Ideal Text page", () => {
  it("the ⋯ item says Add slides without a deck and Update slides with one", async () => {
    await openMenu(false);
    expect(button("Add slides")).toBeDefined();
    expect(button("Update slides")).toBeUndefined();
    act(() => root.unmount());
    root = createRoot(container);
    await openMenu(true);
    expect(button("Update slides")).toBeDefined();
  });

  it("a chosen PDF becomes the project's deck and the next Take's", async () => {
    writeExploreArc("owner-1", "arc-1", 5, {
      topic: "Q3 Board pitch",
      presentationRef: "https://cdn.test/v1.pdf",
      slides: [{ title: "Why now", body: "" }],
    });
    await openMenu(true);
    await act(async () => button("Update slides")?.click());
    expect(document.body.textContent).toContain("Upload the new PDF. Your next Take uses it.");
    expect(button("Upload PDF")).toBeDefined();
    expect(button("Cancel")).toBeDefined();

    await choosePdf();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v2/projects/arc-1/deck");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({
      slides: [{ title: "Hook", body: "" }, { title: "The ask", body: "Two hires" }],
      presentation_ref: "https://cdn.test/v2.pdf",
    });
    expect(document.body.textContent).toContain("New slides ready for Take 5.");
    expect(button("Upload PDF")).toBeUndefined();
    const cached = readExploreArc("owner-1");
    expect(cached?.deck?.presentationRef).toBe("https://cdn.test/v2.pdf");
    expect(cached?.deck?.slides.map((s) => s.title)).toEqual(["Hook", "The ask"]);
    expect(cached?.deck?.topic).toBe("Q3 Board pitch");
  });
});

describe("Update slides in the chat", () => {
  function Chat({ onLine }: { onLine: (line: string) => void }) {
    const ask = useSlidesAsk();
    return createElement(
      "div",
      null,
      createElement("button", { type: "button", onClick: () => offersUpdateSlides(["update_slides"]) && ask.open() }, "Will answers"),
      createElement(SlidesAskSlot, { ask, onReady: onLine }, null),
      createElement(SlidesAskComposer, { ask }, createElement("textarea", { "aria-label": "Message Will" })),
    );
  }

  it("the chat's card stands in for the message box until the upload or Cancel", async () => {
    // Never a chip.
    expect(coerceSuggestedActions(["update_slides"])).toEqual([]);
    writeExploreArc("owner-1", "arc-1", 5, undefined);
    const onLine = vi.fn();
    act(() => root.render(createElement(Chat, { onLine })));
    const box = () => document.body.querySelector('[aria-label="Message Will"]');

    await act(async () => button("Will answers")?.click());
    expect(box()).toBeNull();
    expect(document.body.textContent).toContain("Update slides");
    expect(document.body.textContent).toContain("Upload the new PDF. Your next Take uses it.");
    await act(async () => button("Cancel")?.click());
    expect(box()).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => button("Will answers")?.click());
    expect(button("Upload PDF")).toBeDefined();
    await choosePdf();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onLine).toHaveBeenCalledWith("New slides ready for Take 5.");
    expect(box()).not.toBeNull();
  });
});
