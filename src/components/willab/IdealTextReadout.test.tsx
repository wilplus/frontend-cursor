// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  A GUEST'S TEXT SCROLLS (founder 2026-10-04)                                */
/*                                                                            */
/*  A guest's first Take on a phone: "I can not scroll it". The Lab band is    */
/*  overflow-hidden on the readout because the deck scrolls itself; a guest    */
/*  has no SD payload, so there is no deck, and the plain paragraphs need a    */
/*  scroller of their own or everything below the fold is cut off.            */
/* -------------------------------------------------------------------------- */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./LoungeThreadContext", () => ({
  useLoungeThreadCtx: () => ({ reload: vi.fn() }),
}));
vi.mock("./useArcDeckRef", () => ({ useArcDeckRef: () => null }));

import IdealTextReadout from "./IdealTextReadout";
import {
  GUEST_SIGN_UP_COPY,
  GUEST_SIGN_UP_DELAY_MS,
} from "./GuestSignUpDialog";
import type { ReadoutPayload } from "./readout";

const payload = {
  snippets: [],
  feedbackItems: [],
  overallMessage: null,
  presentationRef: null,
  slides: [],
  slideTranscripts: [],
  fullTranscriptChunks: [
    { transcript: "The first paragraph a guest said." },
    { transcript: "The last paragraph, far below the fold on a phone." },
  ],
  instantChunks: [],
  voiceMetricsAvailable: true,
  parentAudioRef: null,
  audience: null,
  auditPaid: true,
} as unknown as ReadoutPayload;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function paragraph(text: string): Element {
  const found = Array.from(host.querySelectorAll("p, span, div")).find(
    (el) => el.children.length === 0 && el.textContent?.includes(text)
  );
  if (!found) throw new Error(`no element holds "${text}"`);
  return found;
}

describe("IdealTextReadout — a guest's text (no SD payload)", () => {
  it("puts every paragraph inside one scroller of its own", () => {
    act(() => {
      root.render(
        createElement(IdealTextReadout, {
          payload,
          sessionId: null,
          signedIn: false,
          onAutoSent: () => {},
          onSignUp: () => {},
        })
      );
    });
    const scroller = paragraph("far below the fold").closest(
      '[data-testid="readout-plain-scroller"]'
    );
    expect(scroller).not.toBeNull();
    const classes = (scroller?.className ?? "").split(/\s+/);
    expect(classes).toContain("overflow-y-auto");
    expect(classes).toContain("min-h-0");
    expect(classes).toContain("flex-1");
    expect(
      paragraph("The first paragraph").closest(
        '[data-testid="readout-plain-scroller"]'
      )
    ).toBe(scroller);
  });
});

describe("IdealTextReadout — a guest is asked to sign up (founder 2026-10-04)", () => {
  function renderGuest(onSignUp: () => void) {
    act(() => {
      root.render(
        createElement(IdealTextReadout, {
          payload,
          sessionId: null,
          signedIn: false,
          onAutoSent: () => {},
          onSignUp,
        })
      );
    });
  }
  const dialog = () => host.querySelector('[role="dialog"]');
  const button = (label: string) =>
    Array.from(dialog()?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent === label
    );

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the text first, then opens the sign-up by itself", () => {
    vi.useFakeTimers();
    renderGuest(() => {});
    expect(host.textContent).toContain("far below the fold");
    expect(dialog()).toBeNull();
    act(() => {
      vi.advanceTimersByTime(GUEST_SIGN_UP_DELAY_MS);
    });
    expect(dialog()?.textContent).toContain(GUEST_SIGN_UP_COPY.title);
  });

  it("goes to sign-up from the dialog", () => {
    vi.useFakeTimers();
    const onSignUp = vi.fn();
    renderGuest(onSignUp);
    act(() => {
      vi.advanceTimersByTime(GUEST_SIGN_UP_DELAY_MS);
    });
    act(() => {
      button(GUEST_SIGN_UP_COPY.primary)?.click();
    });
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });

  it("'Not now' returns to the text and does not ask again", () => {
    vi.useFakeTimers();
    renderGuest(() => {});
    act(() => {
      vi.advanceTimersByTime(GUEST_SIGN_UP_DELAY_MS);
    });
    act(() => {
      button(GUEST_SIGN_UP_COPY.secondary)?.click();
    });
    expect(dialog()).toBeNull();
    expect(host.textContent).toContain("far below the fold");
    act(() => {
      vi.advanceTimersByTime(GUEST_SIGN_UP_DELAY_MS * 5);
    });
    expect(dialog()).toBeNull();
  });
});
