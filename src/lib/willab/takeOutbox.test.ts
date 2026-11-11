// @vitest-environment jsdom
/*
STORY    As a speaker on the iPhone app, I want a Take I finished to stay on my
         phone until the server has it, and to go up again by itself when I
         next open the app or my connection comes back, so that closing the
         app or losing the connection never loses a Take, and it is never
         made twice or put over a newer one.
OUTCOME
  O1  A Take whose answer never came goes up again at the next open, with
      the same upload key, and shows as processing with its "Your
      Recording" line.
  O2  Once the server names the Take (accepted, a duplicate, a 504 with its
      session) its copy is deleted; no connection, 401, 429, 5xx or a 504
      without a session keeps it.
  O3  Discarding it, or a refusal for good (no speech, 400, 404, a project
      being deleted, too large, recording consent withdrawn), deletes it.
  O4  Signed in as someone else, or signed out, it is never sent.
  O5  A newer Take of the same project already on the server means the old
      copy is deleted, not sent. The server names each Take's upload key, so
      a later Take with another key is newer, and one with this copy's key is
      this very Take, which goes (the server answers duplicate). Where the
      server names no keys, a single later Take with no line yet may be this
      one, and goes.
  O6  Past 7 days it is deleted, not sent.
  O7  A save the device refuses never stops or delays the upload.
  O8  A Take recorded in a host's chat that takes Takes is tagged with that
      chat once the server has it, once per Take; a failed tag stops
      nothing; a Take made in the speaking chat posts no tag (N648 item 8).
PROVES   O1 -> "a Take whose answer never came is sent again at the next open, with the same key, and shows as processing"
         O2 -> "an accepted or duplicate answer deletes the copy, and a dropped connection keeps it"
         O3 -> "a discard and a refusal for good delete it"
         O4 -> "another signed-in person never sends it"
         O5 -> "a newer Take of the same project on the server deletes the old copy, unsent"
         O6 -> "past 7 days it is deleted"
         O7 -> "a failed save never stops or delays the upload"
         O8 -> "N648-8 a Take made in a host's chat is tagged with it once; a failed tag stops nothing; the speaking chat posts none"
WHY      Founder, the Claude Code chat, 9 November 2026 (backend N553 item 2,
         N556): "Ship B; line in next version", "At Finish only, for now",
         "Yes, all of them". Never 3 (record, process, Ideal Text, next Take)
         and Never 5 (an older Take never becomes the Ideal Text).
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Who the session token names: the person the server sees. */
const session = vi.hoisted(() => ({ sub: "user-ana" }));
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: () => Promise.resolve(`h.${btoa(JSON.stringify({ sub: session.sub }))}.s`),
}));

import type { LabUploadInput } from "@/services/api/labRecording";
import type { LoungeMessage, LoungeMessageDraft } from "@/services/api/loungeMessages";
import {
  __resetTakeOutboxForTests,
  isLive,
  keepTakeAtFinish,
  rememberTakeProject,
  sendTake,
  waitingTakes,
  type FinishedTake,
} from "./takeOutbox";
import { resendKeptTakes, type ResendDeps } from "./takeResend";
import { readProcessingTake } from "./processingTake";
import { setOpenChat } from "@/components/willab/chats/loungePlace";

const ANA = "user-ana";
const HOUR = 60 * 60 * 1000;

type Answer = { status: number; body?: unknown } | "offline";
let uploads: FormData[];
let uploadAnswer: Answer;
let arcs: unknown[];
let consent: Record<string, unknown>;
let tags: { path: string; body: unknown }[];
let tagStatus: number;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  session.sub = ANA;
  uploads = [];
  tags = [];
  tagStatus = 200;
  uploadAnswer = "offline";
  arcs = [];
  consent = { has_receipt: true, personalised_practice: true, sensitive_information: true };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url);
      if (path.endsWith("/lab/recordings")) {
        uploads.push(init?.body as FormData);
        if (uploadAnswer === "offline") throw new TypeError("Failed to fetch");
        return json(uploadAnswer.status, uploadAnswer.body ?? {});
      }
      if (path.includes("/api/v2/chats/") && path.endsWith("/take")) {
        tags.push({ path, body: JSON.parse(String(init?.body ?? "null")) });
        return json(tagStatus, tagStatus === 200 ? { message_id: "m-1", take: "s-1" } : { code: "NOT_FOUND" });
      }
      if (path.includes("/user/trainings")) return json(200, { trainings: arcs });
      if (path.includes("/processing-authorization/choices")) return json(200, consent);
      if (path.endsWith("/api/v2/projects")) return json(201, { project_id: "p-new" });
      return json(404, {});
    }),
  );
});

afterEach(() => {
  setOpenChat(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  __resetTakeOutboxForTests();
  localStorage.clear();
});

function finished(over: Partial<FinishedTake> = {}): FinishedTake {
  return {
    blob: new Blob(["take audio"], { type: "audio/webm" }),
    key: "key-1",
    ownerId: ANA,
    answer: null,
    picked: false,
    context: {
      topic: "Board update",
      audience: "",
      target_length_seconds: null,
      domain_vocabulary: [],
      slides: [],
      presentationRef: null,
    },
    slides: [{ title: "Where we are", body: "" }],
    deckless: true,
    projectId: "p-1",
    takeIndex: 3,
    durationSec: 42,
    slideAdvances: [{ index: 0, tMs: 0 }],
    slideClockOffsetMs: 120,
    feeling: "calm",
    ...over,
  };
}

/** The first try, as the Lab sends it. */
function firstTry(take: FinishedTake): LabUploadInput {
  return {
    audioBlob: take.blob,
    projectId: take.projectId ?? "p-new",
    uploadIdempotencyKey: take.key,
    durationSec: take.durationSec,
    topic: take.context.topic,
  };
}

function lounge(ownerId: string | null = ANA, messages: Pick<LoungeMessage, "kind" | "metadata">[] = []) {
  const appended: LoungeMessageDraft[] = [];
  const deps: ResendDeps = {
    ownerId,
    labOpen: () => false,
    messages: () => messages,
    append: async (draft) => {
      appended.push(draft);
    },
    onSending: () => undefined,
    onKept: () => undefined,
  };
  return { deps, appended };
}

const accepted = (sessionId: string, take = 3) => ({
  status: 202,
  body: { state: "processing", session_id: sessionId, project_id: "p-1", arc_id: "p-1", take_index: take },
});

async function keys(): Promise<string[]> {
  return (await waitingTakes()).map((t) => t.key);
}

/** The first try's answer is in, and its copy settled. */
async function settled(key: string): Promise<void> {
  await vi.waitFor(() => expect(isLive(key)).toBe(false));
}

describe("a Take kept on the device until the server has it (backend N556)", () => {
  it("a Take whose answer never came is sent again at the next open, with the same key, and shows as processing", async () => {
    const take = finished();
    keepTakeAtFinish(take);
    await sendTake(firstTry(take)); // the connection dropped: no answer
    await settled("key-1");
    expect(await keys()).toEqual(["key-1"]);

    uploadAnswer = accepted("s-3");
    const { deps, appended } = lounge();
    await resendKeptTakes(deps);

    expect(uploads).toHaveLength(2);
    expect(uploads[1].get("upload_idempotency_key")).toBe("key-1");
    expect(uploads[1].get("upload_idempotency_key")).toBe(uploads[0].get("upload_idempotency_key"));
    expect(uploads[1].get("project_id")).toBe("p-1");
    expect(readProcessingTake(ANA)).toMatchObject({ sessionId: "s-3", arcId: "p-1", takeIndex: 3, status: "processing" });
    expect(appended).toEqual([
      expect.objectContaining({
        kind: "recording_summary",
        metadata: expect.objectContaining({ session_id: "s-3", arc_id: "p-1", take_index: 3 }),
      }),
    ]);
    await vi.waitFor(async () => expect(await keys()).toEqual([]));
  });

  it("an accepted or duplicate answer deletes the copy, and a dropped connection keeps it", async () => {
    const answers: [Answer, "kept" | "gone"][] = [
      ["offline", "kept"],
      [{ status: 401, body: { code: "INVITE_ONLY" } }, "kept"],
      [{ status: 429 }, "kept"],
      [{ status: 503 }, "kept"],
      [{ status: 504, body: { code: "PROCESSING_TIMEOUT", session_id: null } }, "kept"],
      [accepted("s-3"), "gone"],
      [{ status: 200, body: { duplicate: true, session_id: "s-3", project_id: "p-1", arc_id: "p-1" } }, "gone"],
      [{ status: 201, body: { session_id: "s-3", project_id: "p-1", arc_id: "p-1", readout: {} } }, "gone"],
      [{ status: 504, body: { code: "PROCESSING_TIMEOUT", session_id: "s-3", project_id: "p-1" } }, "gone"],
      [
        {
          status: 200,
          body: { state: "failed_ideal_text_unconfirmed", session_id: "s-3", project_id: "p-1", arc_id: "p-1" },
        },
        "gone",
      ],
    ];
    for (const [answer, fate] of answers) {
      __resetTakeOutboxForTests();
      const take = finished({ blob: new Blob(["take audio"], { type: "audio/webm" }) });
      keepTakeAtFinish(take);
      uploadAnswer = answer;
      await sendTake(firstTry(take));
      await settled("key-1");
      expect({ answer, kept: await keys() }).toEqual({ answer, kept: fate === "kept" ? ["key-1"] : [] });
    }
  });

  it("a discard and a refusal for good delete it", async () => {
    const discarded = finished();
    keepTakeAtFinish(discarded);
    const abort = new AbortController();
    abort.abort();
    await sendTake(firstTry(discarded), { signal: abort.signal });
    await settled("key-1");
    expect(await keys()).toEqual([]);

    const silent = finished({ key: "key-silent", blob: new Blob([], { type: "audio/webm" }) });
    keepTakeAtFinish(silent);
    await sendTake(firstTry(silent)); // the no-speech guard: nothing in it
    await settled("key-silent");
    expect(await keys()).toEqual([]);

    const refusals: Answer[] = [
      { status: 422, body: { code: "RECORDING_REJECTED" } },
      { status: 400, body: { code: "INVALID_INPUT" } },
      { status: 404, body: { code: "PROJECT_NOT_FOUND" } },
      { status: 409, body: { code: "PROJECT_DELETION_PENDING" } },
      { status: 413 },
      { status: 403, body: { code: "PROCESSING_RECORDING_WITHDRAWN" } },
    ];
    for (const answer of refusals) {
      const take = finished({ blob: new Blob(["take audio"], { type: "audio/webm" }) });
      keepTakeAtFinish(take);
      uploadAnswer = answer;
      await sendTake(firstTry(take));
      await settled("key-1");
      expect({ answer, kept: await keys() }).toEqual({ answer, kept: [] });
    }
  });

  it("another signed-in person never sends it", async () => {
    keepTakeAtFinish(finished());
    uploadAnswer = accepted("s-3");
    session.sub = "user-ben";
    await resendKeptTakes(lounge("user-ben").deps);
    // The screen still thinks Ana, but the session now names Ben.
    await resendKeptTakes(lounge(ANA).deps);
    await resendKeptTakes(lounge(null).deps);
    expect(uploads).toEqual([]);
    expect(await keys()).toEqual(["key-1"]);
    session.sub = ANA;

    // Ana signs back in on this phone: it goes, as hers.
    await resendKeptTakes(lounge(ANA).deps);
    expect(uploads).toHaveLength(1);
  });

  it("a newer Take of the same project on the server deletes the old copy, unsent", async () => {
    keepTakeAtFinish(finished());
    const later = new Date(Date.now() + HOUR).toISOString();
    arcs = [{ arc_id: "p-1", takes: [{ session_id: "s-4", take_index: 4, created_at: later }] }];
    // Take 4 came in from the laptop, and its own "Your Recording" line is in the thread.
    const line = { kind: "recording_summary" as const, metadata: { session_id: "s-4", arc_id: "p-1", take_index: 4 } };
    uploadAnswer = accepted("s-5", 5);
    await resendKeptTakes(lounge(ANA, [line]).deps);
    expect(uploads).toEqual([]);
    expect(await keys()).toEqual([]);

    // One later Take with no line yet may be this one, whose answer was lost: it goes.
    keepTakeAtFinish(finished({ key: "key-2", blob: new Blob(["again"], { type: "audio/webm" }) }));
    uploadAnswer = { status: 200, body: { duplicate: true, session_id: "s-4", project_id: "p-1", arc_id: "p-1" } };
    await resendKeptTakes(lounge(ANA).deps);
    expect(uploads.map((u) => u.get("upload_idempotency_key"))).toEqual(["key-2"]);
    await settled("key-2");

    // The server names each Take's upload key: a single later Take with
    // another key is newer, even with no line in this thread (another device).
    keepTakeAtFinish(finished({ key: "key-3", blob: new Blob(["third"], { type: "audio/webm" }) }));
    arcs = [{ arc_id: "p-1", takes: [{ session_id: "s-4", take_index: 4, created_at: later, upload_key: "key-laptop" }] }];
    await resendKeptTakes(lounge(ANA).deps);
    expect(uploads).toHaveLength(1);
    expect(await keys()).toEqual([]);

    // One whose key is this copy's is this very Take: it goes, and the server answers duplicate.
    keepTakeAtFinish(finished({ key: "key-4", blob: new Blob(["fourth"], { type: "audio/webm" }) }));
    arcs = [{ arc_id: "p-1", takes: [
      { session_id: "s-4", take_index: 4, created_at: later, upload_key: "key-4" },
      { session_id: "s-0", take_index: 1, created_at: later, upload_key: null },
    ] }];
    uploadAnswer = { status: 200, body: { duplicate: true, session_id: "s-4", project_id: "p-1", arc_id: "p-1" } };
    await resendKeptTakes(lounge(ANA).deps);
    expect(uploads.map((u) => u.get("upload_idempotency_key"))).toEqual(["key-2", "key-4"]);
    await settled("key-4");

    // On this phone: a newer Take of the project reached the server, so an older copy goes.
    const older = finished({ key: "key-old", blob: new Blob(["older"], { type: "audio/webm" }) });
    keepTakeAtFinish(older);
    await vi.waitFor(async () => expect(await keys()).toContain("key-old"));
    const newer = finished({ key: "key-new", blob: new Blob(["newer"], { type: "audio/webm" }) });
    await new Promise((resolve) => setTimeout(resolve, 2));
    keepTakeAtFinish(newer);
    uploadAnswer = accepted("s-6", 6);
    await sendTake(firstTry(newer));
    await settled("key-new");
    expect(await keys()).toEqual([]);
  });

  it("past 7 days it is deleted", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T09:00:00Z"));
    keepTakeAtFinish(finished());
    vi.setSystemTime(new Date("2026-11-08T09:00:01Z"));
    uploadAnswer = accepted("s-3");
    await resendKeptTakes(lounge().deps);
    expect(uploads).toEqual([]);
    expect(await keys()).toEqual([]);
  });

  it("a failed save never stops or delays the upload", async () => {
    // The device refuses to store anything (a full disk, a locked store).
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      },
    });
    // No clock runs: anything that waited on a timer would never finish here.
    vi.useFakeTimers();
    const take = finished({ projectId: null });
    keepTakeAtFinish(take);
    await rememberTakeProject(take.key, "p-new");
    uploadAnswer = { status: 202, body: { state: "processing", session_id: "s-1", project_id: "p-new" } };
    const result = await sendTake(firstTry(take));
    expect(result.kind).toBe("processing");
    expect(uploads).toHaveLength(1);
    expect(uploads[0].get("upload_idempotency_key")).toBe("key-1");
  });

  it("N648-8 a Take made in a host's chat is tagged with it once; a failed tag stops nothing; the speaking chat posts none", async () => {
    // Recorded in Artur's chat, which takes Takes.
    setOpenChat("c-artur");
    const take = finished();
    uploadAnswer = accepted("s-1");
    expect((await sendTake(firstTry(take))).kind).toBe("processing");
    await vi.waitFor(() => expect(tags).toHaveLength(1));
    expect(tags[0]).toEqual({ path: "/api/v2/chats/c-artur/take", body: { take: "s-1" } });
    // Sent again (the server answers duplicate): no second tag.
    uploadAnswer = { status: 200, body: { state: "duplicate", session_id: "s-1", project_id: "p-1" } };
    await sendTake(firstTry(take));
    await settled(take.key);
    expect(tags).toHaveLength(1);

    // The tag refused: the Take is the server's all the same.
    tagStatus = 404;
    const second = finished({ key: "key-2" });
    uploadAnswer = accepted("s-2", 4);
    expect((await sendTake(firstTry(second))).kind).toBe("processing");
    await vi.waitFor(() => expect(tags).toHaveLength(2));
    await settled(second.key);
    expect(await keys()).not.toContain("key-2");

    // In the speaking chat no chat is open: nothing is tagged.
    setOpenChat(null);
    const third = finished({ key: "key-3" });
    uploadAnswer = accepted("s-3", 5);
    await sendTake(firstTry(third));
    await settled(third.key);
    expect(tags).toHaveLength(2);
  });
});
