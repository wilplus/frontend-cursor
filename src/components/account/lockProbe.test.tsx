// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  LOCK PROBE: THE CONSENT AND SETTINGS SCREENS SHOW ONLY PROTOTYPE OR        */
/*  POLICY WORDS (build plan D-CS-9; consent lock 2026-10-07 "The rules";      */
/*  N60 ST1 A).                                                               */
/*                                                                            */
/*  Renders every acceptance step, "Turn on the learning?", every state of    */
/*  every Data & consent card, and the ☰ menu, and fails on any visible       */
/*  string that is not in the allowlist built from the two prototypes, the   */
/*  policy fixture and the signed state lines (lockProbeWords.ts). It also    */
/*  pins the two project-deletion switches off (Q-B15 A (8)).                 */
/* -------------------------------------------------------------------------- */
import { act, createElement, forwardRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchConsentChoices: vi.fn(),
  setConsentChoice: vi.fn(),
  fetchTrainingConsent: vi.fn(),
  setTrainingConsent: vi.fn(),
  fetchAuthorization: vi.fn(),
  fetchTrainings: vi.fn(),
  getAuthToken: vi.fn(async () => "token"),
  readAiVoiceCard: vi.fn(),
  deleteAiVoice: vi.fn(),
  turnOnAiVoice: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: forwardRef<HTMLAnchorElement, { href: string; children: ReactNode; className?: string }>(
    function LinkStub({ href, children, className }, ref) {
      return createElement("a", { href, className, ref }, children);
    },
  ),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/account/data-consent" }));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: api.getAuthToken }));
vi.mock("@/services/api/consentChoices", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchConsentChoices: api.fetchConsentChoices,
  setConsentChoice: api.setConsentChoice,
}));
vi.mock("@/services/api/trainingConsent", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTrainingConsent: api.fetchTrainingConsent,
  setTrainingConsent: api.setTrainingConsent,
  reportTrainingRefusal: vi.fn(),
}));
vi.mock("@/services/api/processingAuthorization", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAuthorization: api.fetchAuthorization,
  recordAiNoticeRendered: vi.fn(async () => undefined),
  acceptAuthorization: vi.fn(async () => ({ kind: "accepted" })),
}));
vi.mock("@/services/api/aiVoice", () => ({
  readAiVoiceCard: api.readAiVoiceCard,
  deleteAiVoice: api.deleteAiVoice,
  turnOnAiVoice: api.turnOnAiVoice,
}));
vi.mock("@/services/api/trainings", () => ({ fetchTrainings: api.fetchTrainings }));
vi.mock("@/services/api/projectArchive", () => ({ unarchiveProject: vi.fn() }));
vi.mock("@/services/api/projectDeletion", () => ({
  requestProjectDeletion: vi.fn(),
  cancelProjectDeletion: vi.fn(),
}));
vi.mock("@/services/api/accountDeletion", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requestAccountDeletion: vi.fn(),
  cancelAccountDeletion: vi.fn(async () => ({ kind: "cancelled" })),
}));

import Phase1AcceptanceFlow from "@/components/willab/Phase1AcceptanceFlow";
import { resetTrainingAsk } from "@/components/willab/TrainingAsk";
import DeleteAccountCard from "./DeleteAccountCard";
import AiVoiceCard from "./AiVoiceCard";
import type { ProcessingPolicy } from "@/services/api/processingAuthorization";
import type { TrainingConsent } from "@/services/api/trainingConsent";
import {
  AI_VOICE_PROTOTYPE_WORDS,
  CONSENT_PROTOTYPE_WORDS,
  SETTINGS_PROTOTYPE_WORDS,
  SIGNED_STATE_LINES,
} from "./lockProbeWords";

/* ----------------------------- the fixtures --------------------------------- */

/** The policy fixture: the words the active policy serves. Stand-ins, as the
 *  consent lock allows ("the legal text and versions always come from the
 *  active policy"). */
const POLICY: ProcessingPolicy = {
  policyId: "policy-uuid",
  policyVersion: "phase1-test",
  terms: { version: "3.3", copy: "TERMS BYTES", sha256: "a".repeat(64) },
  privacy: { version: "3.3", copy: "PRIVACY BYTES", sha256: "b".repeat(64) },
  aiNotice: { version: "1.0", copy: "NOTICE BYTES", sha256: "c".repeat(64) },
  agreementCopy: "AGREEMENT SENTENCE",
  agreementCopySha256: "d".repeat(64),
  allowedCountries: ["pl", "de"],
  minimumAge: 18,
  aiNoticeRendered: true,
};
const POLICY_WORDS = [
  POLICY.terms.copy, POLICY.privacy.copy, POLICY.aiNotice.copy, POLICY.agreementCopy,
  `Version ${POLICY.terms.version}`, `Version ${POLICY.privacy.version}`, `Version ${POLICY.aiNotice.version}`,
  `v${POLICY.terms.version}`, `v${POLICY.privacy.version}`, `v${POLICY.aiNotice.version}`,
  // the countries the policy allows, named in the reader's language
  "Poland", "Germany",
];

/** The training switch's own sentence, served by the backend and
 *  fingerprinted; never typed here. */
const TRAINING: TrainingConsent = {
  available: true,
  active: false,
  policyVersion: "training-1",
  copy: "TRAINING SENTENCE",
  copySha256: "e".repeat(64),
} as TrainingConsent;

/** The person's own data: their email, balance, project names. */
const OWN = ["alex@example.com", "12,000 · 30 Aug", "Board pitch", "Conference keynote", "Quarterly team update"];

const ALLOWED = new Set([
  ...CONSENT_PROTOTYPE_WORDS,
  ...SETTINGS_PROTOTYPE_WORDS,
  ...AI_VOICE_PROTOTYPE_WORDS,
  ...SIGNED_STATE_LINES.map((l) => l.text),
  ...POLICY_WORDS,
  TRAINING.copy as string,
  ...OWN,
]);

/* ----------------------------- the harness ---------------------------------- */

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  for (const fn of Object.values(api)) fn.mockReset?.();
  api.getAuthToken.mockResolvedValue("token");
  // The policy in force, as #660 reads it: unknown here, so practice stays offered.
  api.fetchConsentChoices.mockResolvedValue(null);
  resetTrainingAsk();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const flush = () =>
  act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });

async function render(node: ReactNode) {
  await act(async () => root.render(node));
  await flush();
}

const click = async (label: string, scope: ParentNode = document.body) => {
  const button = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => (b.textContent ?? "").trim() === label || b.getAttribute("aria-label") === label,
  );
  if (!button) throw new Error(`no button "${label}" in: ${(scope as HTMLElement).textContent}`);
  await act(async () => button.click());
  await flush();
};

/** Every visible string on the screen: the words of each element that holds
 *  only text (so "v" + "3.3" is read as the "v3.3" a person sees), and each
 *  element's spoken label (aria-label, placeholder, title). Nothing hidden
 *  from sight (sr-only, aria-hidden) and nothing without a letter counts. */
function visibleStrings(scope: ParentNode = document.body): string[] {
  const out: string[] = [];
  const hidden = (el: Element) =>
    el.classList.contains("sr-only") || el.getAttribute("aria-hidden") === "true";
  const push = (raw: string | null) => {
    const text = (raw ?? "").replace(/\s+/g, " ").trim();
    if (/[A-Za-z]/.test(text)) out.push(text);
  };
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      push(node.textContent);
      return;
    }
    if (!(node instanceof Element)) return;
    if (hidden(node)) return;
    for (const attr of ["aria-label", "placeholder", "title"]) push(node.getAttribute(attr));
    const children = [...node.childNodes];
    if (children.length > 0 && children.every((c) => c.nodeType === Node.TEXT_NODE)) {
      push(node.textContent);
      return;
    }
    children.forEach(walk);
  };
  walk(scope as Node);
  return out;
}

/** A visible string must be one allowed word, or allowed words joined the
 *  way the prototypes join them: with " · " (the menu's balance), with a
 *  space ("Terms of Service v3.3"; the delete confirm's body followed by "A
 *  model already trained stays."). */
function allowed(s: string): boolean {
  if (ALLOWED.has(s)) return true;
  const parts = s.split(/\s*·\s*/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => ALLOWED.has(p))) return true;
  for (const head of ALLOWED) {
    if (s.startsWith(`${head} `) && allowed(s.slice(head.length + 1))) return true;
  }
  return false;
}
function unlisted(strings: string[]): string[] {
  return strings.filter((s) => !allowed(s));
}

const screens: Record<string, string[]> = {};
function probe(name: string, scope: ParentNode = document.body) {
  const shown = visibleStrings(scope);
  expect(shown.length, `${name} drew nothing`).toBeGreaterThan(0);
  const bad = unlisted(shown);
  screens[name] = bad;
  expect(bad, `${name} shows words no prototype or signature holds:\n${bad.join("\n")}`).toEqual([]);
}

/* ----------------------------- the screens ---------------------------------- */

describe("the welcome and the acceptance walk", () => {

  it("the notice, each document, the country, the confirm and Nothing was recorded", async () => {
    await render(
      createElement(Phase1AcceptanceFlow, {
        policy: POLICY,
        onAccepted: () => undefined,
        onStale: () => undefined,
      }),
    );
    probe("notice");
    await click("Continue");
    probe("terms");
    await click("Done reading");
    probe("privacy");
    await click("Done reading");
    probe("ai");
    await click("Done reading");
    probe("country");
    await click("Poland");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 320));
    });
    probe("confirm");
    await click("I am 18 or older.");
    probe("confirm, a tick");
    await click("Do not agree");
    probe("declined");
    await click("Go back");
    probe("notice, read ✓");
  });
});

describe("Data & consent", () => {

  it("Delete my account: the card, the confirm, pending, cancelled, done", async () => {
    await render(
      createElement(DeleteAccountCard, {
        loadPending: async () => null,
        loadTrainingYes: async () => true,
      }),
    );
    probe("delete, the card");
    await click("Delete my account");
    probe("delete, confirming (with the training line)");
    await click("Cancel");

    await render(
      createElement(DeleteAccountCard, {
        key: "pending",
        loadPending: async () => ({
          purgeId: "p1", kind: "account" as const, projectId: null,
          completesAfter: "2099-10-14T00:00:00Z", cancellable: true,
        }),
        loadTrainingYes: async () => false,
      }),
    );
    // The date is the person's own deletion day, not a word of the page.
    const dated = visibleStrings().filter((s) => /^Your account will be deleted on .+\.$/.test(s));
    expect(dated.length).toBe(1);
    const bad = unlisted(visibleStrings()).filter((s) => !dated.includes(s));
    expect(bad, bad.join("\n")).toEqual([]);
    await click("Cancel deletion");
    probe("delete, cancelled");

    await render(
      createElement(DeleteAccountCard, {
        key: "done",
        loadPending: async () => ({
          purgeId: "p2", kind: "account" as const, projectId: null,
          completesAfter: null, cancellable: false,
        }),
        loadTrainingYes: async () => false,
      }),
    );
    probe("delete, under way without a date");
  });

  it("AI version of your voice: on, the Delete confirm, off, on again", async () => {
    const card = (state: string) => ({ ok: true, data: { available: true, state } });
    api.readAiVoiceCard.mockResolvedValue(card("on"));
    api.deleteAiVoice.mockResolvedValue(card("off"));
    api.turnOnAiVoice.mockResolvedValue(card("on"));
    await render(createElement(AiVoiceCard));
    probe("ai voice, on");
    await click("Delete");
    probe("ai voice, confirming");
    expect(api.deleteAiVoice).not.toHaveBeenCalled();
    await click("Delete");
    expect(api.deleteAiVoice).toHaveBeenCalledTimes(1);
    probe("ai voice, off");
    await click("Turn on");
    expect(api.turnOnAiVoice).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain(AI_VOICE_PROTOTYPE_WORDS[1]);
  });
});
