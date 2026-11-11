// @vitest-environment jsdom
/*
STORY    As someone with the chat builder's ring, the one Lounge is three
         chats: Will (the model, the chat's setup, what needs me) with the
         text field always; the speaking chat with my Takes and the record
         button; Principles with its rows and the text field. Without the
         ring it is one chat, as it was (backend N635, N636 items 1 to 5).
OUTCOME
  O1  The speaking chat has "Start your first recording", then "Record
      Take 2", its Take rows and the plan's dock; Will's chat has the text
      field and none of them; Principles its own rows and the text field.
  O2  What I type or tap in a chat says which chat it is, so it lands there.
  O3  "Copy my link ›" and "Your questions for people who join ›" leave the
      way in's "You're set." row in the speaking chat and show in Will's.
  O4  A typed turn tells the backend its chat, so both its rows stay there.
  O5  A plan row's "See your plan", "Change" or a call to book, tapped in
      Will's chat or Principles, opens the speaking chat first, where its
      sheet is drawn, so the tap never looks dead; in the speaking chat, and
      without the ring, it only opens the sheet. (The door's side, that it
      opens the chat asked for: chats.test.tsx "N636-1".)
PROVES   O1, O2 -> "N636-2"; O3 -> "N636-3"; O4 -> "N636-4"; O5 -> "N636-5"
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => null) }));
import { WillBarMiddle } from "../plan/PlanDock";
import { wayInRowFor } from "../plan/WayIn";
import OwnChatLinks from "./OwnChatLinks";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { postChatQuery } from "@/services/api/chatQuery";
import { PlaceOnly, onAskedPlace, placeOf, rememberPlace, shownIn, speakingFirst, typedHint, wordsShow, type LoungePlace } from "./loungePlace";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Row = { client_id: string; body: string; metadata: Record<string, unknown> | null; place?: string };

/** The Lounge as it wires the places: its rows of the chat open, what needs
 *  you in Will's, the plan's dock in the speaking chat, and the bar. */
function Lounge({ place, rows, next }: { place: LoungePlace | null; rows: Row[]; next: { arcId: string; takeIndex: number } | null }) {
  return (
    <div>
      <div data-thread="">{rows.filter((r) => shownIn(r, place)).map((r) => <p key={r.client_id}>{r.body}</p>)}</div>
      <PlaceOnly place={place} in={["will"]}>
        <div data-needs-you="">This needs you:</div>
      </PlaceOnly>
      <PlaceOnly place={place} in={["speaking"]}>
        <div data-plan-dock="" />
      </PlaceOnly>
      <form data-bar="">
        <PlaceOnly place={place} in={["speaking"]}>
          <button type="button" aria-label="Your projects" />
        </PlaceOnly>
        {wordsShow(place, false) ? (
          <textarea aria-label="Message Will" />
        ) : (
          <WillBarMiddle hear={null} next={next} held={false} onRecord={() => undefined} onFirst={() => undefined} />
        )}
      </form>
    </div>
  );
}

const ROWS: Row[] = [
  { client_id: "t1", body: "Your feedback is ready.", metadata: { arc_id: "a1" }, place: "speaking" },
  { client_id: "w1", body: "Your chat is saved.", metadata: null, place: "will" },
  { client_id: "p1", body: "We spotted a strength!", metadata: { offer: "strengths" }, place: "principles" },
];

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const draw = (place: LoungePlace | null, rows: Row[], next: { arcId: string; takeIndex: number } | null = null) =>
  act(() => root.render(<Lounge place={place} rows={rows} next={next} />));
const thread = () => host.querySelector("[data-thread]")!.textContent;
const recordButton = () => host.querySelector("[data-bar] [data-start-first], [data-bar] [data-record-next]")?.textContent ?? null;

describe("three chats over the one Lounge (N636)", () => {
  it("N636-2: the record button and the Takes in the speaking chat; Will's and Principles' chats in words; without the ring, one chat", () => {
    draw("speaking", []);
    expect(recordButton()).toBe("Start your first recording");
    draw("speaking", ROWS, { arcId: "a1", takeIndex: 1 });
    expect(recordButton()).toBe("Record Take 2");
    expect(thread()).toBe("Your feedback is ready.");
    expect(host.querySelector("[data-plan-dock]")).not.toBeNull();
    expect(host.querySelector("[data-needs-you]")).toBeNull();

    draw("will", ROWS, { arcId: "a1", takeIndex: 1 });
    expect(recordButton()).toBeNull();
    expect(host.querySelector("[aria-label='Your projects']")).toBeNull();
    expect(host.querySelector("textarea")?.getAttribute("aria-label")).toBe("Message Will");
    expect(host.querySelector("[data-plan-dock]")).toBeNull();
    expect(thread()).toBe("Your chat is saved.");
    expect(host.querySelector("[data-needs-you]")).not.toBeNull();

    draw("principles", ROWS, { arcId: "a1", takeIndex: 1 });
    expect(recordButton()).toBeNull();
    expect(host.querySelector("textarea")).not.toBeNull();
    expect(thread()).toBe("We spotted a strength!");

    // Without the ring: every row, the record button, the dock, as it was.
    draw(null, ROWS, { arcId: "a1", takeIndex: 1 });
    expect(thread()).toBe("Your feedback is ready.Your chat is saved.We spotted a strength!");
    expect(recordButton()).toBe("Record Take 2");
    expect(host.querySelector("[data-plan-dock]")).not.toBeNull();

    // What is typed or tapped says its chat; drawn there until the backend's copy.
    expect(typedHint("speaking", "a1")).toEqual({ place: "speaking", arc_id: "a1" });
    expect(typedHint("principles", null)).toEqual({ place: "principles" });
    expect(typedHint("will", "a1")).toEqual({ place: "will" });
    expect(typedHint(null, "a1")).toBeNull();
    rememberPlace("u1", "principles");
    expect(placeOf({ client_id: "u1", metadata: null })).toBe("principles");
    expect(placeOf({ client_id: "u1", metadata: null, place: "will" })).toBe("will");
  });

  it("N636-3: the links about one's own chat leave the speaking chat's row and show in Will's chat", () => {
    const set = {
      client_id: "y1", role: "bot", kind: "text", body: "You're set.", place: "speaking",
      metadata: { way_in: "set", plan: "p1", links: ["Copy my link ›", "Your questions for people who join ›", "Open your feedback ›"] },
      client_created_at: "2026-11-10T10:00:00Z",
    } as unknown as LoungeMessage;
    const links = () => [...host.querySelectorAll("button, a")].map((b) => b.textContent?.replace("›", "").trim());
    // In the speaking chat: the row keeps its other links only.
    act(() => root.render(<>{wayInRowFor(set, { ownChatLinks: false })}</>));
    expect(links()).toEqual(["Open your feedback"]);
    // Without the ring, the row as it was.
    act(() => root.render(<>{wayInRowFor(set, {})}</>));
    expect(links()).toEqual(["Copy my link", "Your questions for people who join", "Open your feedback"]);
    // In Will's chat, the two of them, once the row has offered them.
    act(() => root.render(<OwnChatLinks place="will" messages={[set]} onJoinQuestions={() => undefined} />));
    expect(links()).toEqual(["Copy my link", "Your questions for people who join"]);
    act(() => root.render(<OwnChatLinks place="speaking" messages={[set]} onJoinQuestions={() => undefined} />));
    expect(links()).toEqual([]);
    act(() => root.render(<OwnChatLinks place="will" messages={[]} onJoinQuestions={() => undefined} />));
    expect(links()).toEqual([]);
  });

  it("N636-4: a turn typed in one of the three chats tells the chat query which, typed or spoken; without a place, nothing", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ answer: "Noted." }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await postChatQuery({ question: "# a note", place: "principles" });
      await postChatQuery({ question: "How was it?", place: "speaking", audioBlob: new Blob(["x"]) });
      await postChatQuery({ question: "Hi" });
      const [json, form, none] = (fetchMock.mock.calls as unknown as [string, RequestInit][]).map(([, init]) => init.body);
      expect(JSON.parse(String(json)).place).toBe("principles");
      expect((form as FormData).get("place")).toBe("speaking");
      expect("place" in JSON.parse(String(none))).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("N636-5: a plan row's sheet, tapped outside the speaking chat, opens the speaking chat first", () => {
    const seen: string[] = [];
    const stop = onAskedPlace((place) => seen.push(`open ${place}`));
    const rows = {
      onSeePlan: () => seen.push("see"),
      onChangePlan: () => seen.push("change"),
      onBook: (which: string) => seen.push(`book ${which}`),
    };
    try {
      for (const place of ["will", "principles"] as const) {
        const tapped = speakingFirst(rows, place)!;
        tapped.onSeePlan();
        tapped.onChangePlan();
        tapped.onBook("kickoff");
      }
      expect(seen).toEqual([
        "open speaking", "see", "open speaking", "change", "open speaking", "book kickoff",
        "open speaking", "see", "open speaking", "change", "open speaking", "book kickoff",
      ]);
      seen.length = 0;
      expect(speakingFirst(rows, "speaking")).toBe(rows);
      expect(speakingFirst(rows, null)).toBe(rows);
      expect(speakingFirst(undefined, "will")).toBeUndefined();
    } finally {
      stop();
    }
  });
});
