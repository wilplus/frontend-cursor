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
import {
  GUEST_SIGN_UP_COPY,
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
});
