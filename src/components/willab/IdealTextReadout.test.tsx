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
vi.mock("@/services/api/idealText", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/api/idealText")>();
  const pending = () => Promise.resolve({ kind: "pending" as const });
  return {
    ...actual,
    fetchIdealTextCore: vi.fn(pending),
    fetchIdealTextForDisplay: vi.fn(pending),
  };
});

import IdealTextReadout from "./IdealTextReadout";
import {
  GUEST_SIGN_UP_COPY,
  GuestGateContext,
  useGuestBlock,
  useGuestGate,
} from "./GuestSignUpDialog";
import {
  fetchIdealTextCore,
  fetchIdealTextForDisplay,
} from "@/services/api/idealText";
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
  localStorage.clear();
  vi.mocked(fetchIdealTextCore).mockClear();
  vi.mocked(fetchIdealTextForDisplay).mockClear();
});

const GUEST_TOKEN = "3f1c2a54-9b7e-4c1d-8a2f-6e5d4c3b2a10." + "s".repeat(43);

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

describe("A guest reads the whole page (founder 2026-10-04, Phase 0.6)", () => {
  it("reads the full document for a guest that holds its identity", async () => {
    localStorage.setItem("willab_guest_owner:v1", GUEST_TOKEN);
    await act(async () => {
      root.render(
        createElement(IdealTextReadout, {
          payload,
          sessionId: "take-1",
          arcId: "arc-1",
          signedIn: false,
          onAutoSent: () => {},
          onSignUp: () => {},
        })
      );
    });
    // The first read is the display read (or the core read when the bundle
    // flag is on); either way the guest's page is read, not skipped.
    const reads = [
      ...vi.mocked(fetchIdealTextCore).mock.calls,
      ...vi.mocked(fetchIdealTextForDisplay).mock.calls,
    ];
    expect(reads.map((call) => call[0])).toContain("arc-1");
  });

  it("opens nothing by itself", async () => {
    localStorage.setItem("willab_guest_owner:v1", GUEST_TOKEN);
    await act(async () => {
      root.render(
        createElement(IdealTextReadout, {
          payload,
          sessionId: "take-1",
          arcId: "arc-1",
          signedIn: false,
          onAutoSent: () => {},
          onSignUp: () => {},
        })
      );
    });
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it("without a guest identity, a signed-out reader keeps the plain text", async () => {
    await act(async () => {
      root.render(
        createElement(IdealTextReadout, {
          payload,
          sessionId: null,
          arcId: "arc-1",
          signedIn: false,
          onAutoSent: () => {},
          onSignUp: () => {},
        })
      );
    });
    expect(fetchIdealTextCore).not.toHaveBeenCalled();
    expect(fetchIdealTextForDisplay).not.toHaveBeenCalled();
  });
});

describe("useGuestGate — sign-up stands in front of the steps that need an account", () => {
  type Probe = {
    run: () => string;
    ask: () => void;
    block: () => boolean;
  };
  let probe: Probe | null = null;
  const onSignUp = vi.fn();
  const step = vi.fn(() => "done");

  function Harness(props: { signedIn: boolean | null; arcId: string | null }) {
    const gate = useGuestGate({ ...props, onSignUp });
    probe = { run: gate.gate(step, "refused"), ask: gate.ask, block: gate.block };
    return createElement("div", null, gate.dialog);
  }

  function mount(signedIn: boolean | null, arcId: string | null) {
    act(() => {
      root.render(createElement(Harness, { signedIn, arcId }));
    });
  }
  const dialog = () => host.querySelector('[role="dialog"]');
  const button = (label: string) =>
    Array.from(dialog()?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent === label
    );

  beforeEach(() => {
    onSignUp.mockClear();
    step.mockClear();
  });

  it("ask opens the dialog and its Create an account is the plain sign-up", () => {
    localStorage.setItem("willab_guest_owner:v1", GUEST_TOKEN);
    mount(false, "arc-1");
    act(() => probe?.ask());
    expect(dialog()?.textContent).toContain(GUEST_SIGN_UP_COPY.title);
    act(() => button(GUEST_SIGN_UP_COPY.primary)?.click());
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });

  it("practise inside a sheet is stopped for a guest and the dialog opens", () => {
    localStorage.setItem("willab_guest_owner:v1", GUEST_TOKEN);
    mount(false, "arc-1");
    let blocked = false;
    act(() => {
      blocked = probe?.block() ?? false;
    });
    expect(blocked).toBe(true);
    expect(dialog()?.textContent).toContain(GUEST_SIGN_UP_COPY.title);
    act(() => button(GUEST_SIGN_UP_COPY.primary)?.click());
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });

  it("an account's practise is never stopped", () => {
    mount(true, "arc-1");
    expect(probe?.block()).toBe(false);
  });

  it("an account's step runs untouched", () => {
    mount(true, "arc-1");
    expect(probe?.run()).toBe("done");
    expect(step).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });

  it("a guest's step asks to sign up and never runs", () => {
    localStorage.setItem("willab_guest_owner:v1", GUEST_TOKEN);
    mount(false, "arc-1");
    let answer = "";
    act(() => {
      answer = probe?.run() ?? "";
    });
    expect(answer).toBe("refused");
    expect(step).not.toHaveBeenCalled();
    expect(dialog()?.textContent).toContain(GUEST_SIGN_UP_COPY.title);
  });

  it("Create an account goes to sign-up; Not now returns to the page", () => {
    localStorage.setItem("willab_guest_owner:v1", GUEST_TOKEN);
    mount(false, "arc-1");
    act(() => probe?.ask());
    act(() => button(GUEST_SIGN_UP_COPY.primary)?.click());
    expect(onSignUp).toHaveBeenCalledTimes(1);
    act(() => button(GUEST_SIGN_UP_COPY.secondary)?.click());
    expect(dialog()).toBeNull();
  });

  it("is not a guest without the guest identity or a project", () => {
    mount(false, "arc-1");
    expect(probe?.run()).toBe("done");
    localStorage.setItem("willab_guest_owner:v1", GUEST_TOKEN);
    mount(false, null);
    expect(probe?.run()).toBe("done");
  });
});

describe("useGuestBlock — the gate as the sheets see it", () => {
  let seen: (() => boolean) | null = null;
  function Reader() {
    seen = useGuestBlock();
    return null;
  }

  it("is never blocked outside a guest's page (no provider)", () => {
    act(() => {
      root.render(createElement(Reader));
    });
    expect(seen?.()).toBe(false);
  });

  it("asks the page's gate when one is provided", () => {
    const block = vi.fn(() => true);
    act(() => {
      root.render(
        createElement(GuestGateContext.Provider, { value: block },
          createElement(Reader)),
      );
    });
    expect(seen?.()).toBe(true);
    expect(block).toHaveBeenCalledTimes(1);
  });
});
