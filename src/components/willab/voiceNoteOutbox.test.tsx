// @vitest-environment jsdom
/*
STORY    As a speaker, I want a voice note left on the phone to go only to my own account, and not to be lost when my sign-in runs out, so that nobody else gets my words and none of mine are lost.
OUTCOME
  O1  A note waiting on a phone goes only under the person who said it: while another person is signed in it is neither shown nor sent, and it stays on the phone for its owner. A note saved before notes named their owner goes only under a sign-in that began before it was said.
  O2  A note refused because the sign-in ran out (401) stays on the phone, under its clock, and goes after the next sign-in.
  O3  A note refused for good (422: no words heard) leaves the phone.
PROVES   O1 -> A's note is never sent while B is signed in
         O2 -> a note survives a 401 and is sent after signing in again
         O3 -> a 422 still deletes it
WHY      2026-11-09: the phone kept one outbox for everyone and sent whatever waited under whoever was signed in, and any refusal but 429 threw the note away, a sign-in run out included (backend N194: only delete throws a note away).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The session's token, as every call sends it; null signed out.
const auth = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => auth.token }));
const net = vi.hoisted(() => ({ bffFetch: vi.fn() }));
vi.mock("@/lib/api/bffFetch", () => net);

import { useVoiceNotebook, VoiceNoteThread } from "./useVoiceNotebook";
import { dropNote, keepNote, ownerOf, waitingNotes } from "@/lib/willab/voiceNoteOutbox";

const NOW = Date.parse("2026-11-09T10:00:00Z");
const MINUTE = 60_000;

/** A session token for `sub`, signed in at `signedInAt`. */
function token(sub: string, signedInAt: number): string {
  return `h.${btoa(JSON.stringify({ sub, amr: [{ method: "oauth", timestamp: Math.floor(signedInAt / 1000) }] }))}.s`;
}

/** Each note the backend received, and whose account it came under. */
let received: { key: string; as: string | null }[] = [];
/** The backend's answers to the next notes, in order; then 200. */
let answers: number[] = [];

let container: HTMLDivElement;
let root: Root;
const reload = vi.fn(async () => undefined);

function Harness({ userId }: { userId: string | null }) {
  const notebook = useVoiceNotebook({
    signedIn: userId !== null, userId, threadLoading: false, held: false, drawn: [], openOffer: () => {}, reload,
  });
  return createElement(VoiceNoteThread, { notebook });
}

async function show(userId: string | null) {
  await act(async () => root.render(createElement(Harness, { userId })));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
}

async function note(key: string, words: string, at: number, owner?: string) {
  await keepNote({ key, audio: new Blob(["a"], { type: "audio/webm" }), durationMs: 4000, words, open: false, at, ...(owner ? { owner } : {}) });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  received = [];
  answers = [];
  net.bffFetch.mockImplementation(async (path: string, init: { body?: FormData }) => {
    if (!auth.token) return { kind: "unauthenticated" };
    if (path.startsWith("/api/v2/notebook/state")) {
      return { kind: "response", ok: true, status: 200, body: { enabled: true, consented: true, max_seconds: 300 } };
    }
    if (path === "/api/v2/notebook/notes") {
      const key = String(init.body?.get("key"));
      received.push({ key, as: ownerOf(auth.token)?.id ?? null });
      const status = answers.shift() ?? 200;
      const body = status === 200 ? { messages: [{ role: "user", client_id: `row-${key}` }] } : { code: "REFUSED" };
      return { kind: "response", ok: status === 200, status, body };
    }
    return { kind: "response", ok: false, status: 404, body: null };
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  for (const key of ["a-note", "old-note"]) await dropNote(key);
  auth.token = null;
  vi.useRealTimers();
});

describe("a note left on a shared phone", () => {
  it("A's note is never sent while B is signed in", async () => {
    await note("a-note", "call Marta about the venue", NOW - 50 * MINUTE, "a");
    // Said before notes named their owner.
    await note("old-note", "the slides need a story", NOW - 40 * MINUTE);

    // B signed in after both were said.
    auth.token = token("b", NOW - 30 * MINUTE);
    await show("b");
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(received).toEqual([]);
    expect(container.textContent).not.toContain("Marta");
    expect(container.textContent).not.toContain("slides");

    // A, whose sign-in began before both were said: both go, under A.
    auth.token = token("a", NOW - 60 * MINUTE);
    await show("a");
    expect(received).toEqual([
      { key: "a-note", as: "a" },
      { key: "old-note", as: "a" },
    ]);
  });
});

describe("a refusal", () => {
  it("a note survives a 401 and is sent after signing in again", async () => {
    auth.token = token("a", NOW - 60 * MINUTE);
    await note("a-note", "call Marta about the venue", NOW - 10 * MINUTE, "a");
    answers = [401];
    await show("a");
    expect(received).toHaveLength(1);
    expect(container.querySelector('[aria-label="Waiting to send"]')).not.toBeNull();
    expect(container.textContent).toContain("call Marta about the venue");
    expect(reload).not.toHaveBeenCalled();

    // The sign-in ran out; the person signs in again.
    auth.token = null;
    await show(null);
    auth.token = token("a", NOW);
    await show("a");

    expect(received).toEqual([
      { key: "a-note", as: "a" },
      { key: "a-note", as: "a" },
    ]);
    expect(reload).toHaveBeenCalled();
    expect(container.querySelector('[aria-label="Waiting to send"]')).toBeNull();
    expect(await waitingNotes(ownerOf(auth.token))).toEqual([]);
  });

  it("a 422 still deletes it", async () => {
    auth.token = token("a", NOW - 60 * MINUTE);
    await note("a-note", "um", NOW - 10 * MINUTE, "a");
    answers = [422];
    await show("a");
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(received).toHaveLength(1);
    expect(container.querySelector('[data-testid="voice-note-waiting"]')).toBeNull();
    expect(await waitingNotes(ownerOf(auth.token))).toEqual([]);
  });
});
