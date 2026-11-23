// @vitest-environment jsdom
/*
STORY    The talk is scored by driving it. Finishing it writes the coach
         the screens read. A shop chat sets every field the builder has.
OUTCOME
  O1  Fourteen taps build the Speaking Coach, then Say go. The saved
      document matches the fixture, and the screens read it.
  O2  A shop chat sets all four sends, an assistant, price 1, a training
      machine, the hedge model, another model and a checked paste.
  O3  The brief offers four jobs, not You decide. The host answers
      the rest one at a time. A tap on an earlier answer changes it.
      A targeted edit, chips and Publish stay on this device.
  O4  The technical score is printed from the fixture and the shop fields.
PROVES   O1 -> "fourteen taps build the Speaking Coach"
         O2 -> "the shop chat sets price, model and paste"
         O3 -> "an earlier answer changes, then a targeted edit, chips, and publish stay on this device"
         O4 -> "prints the technical score from the fixture and the shop fields"
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import IdealTextHeading from "@/components/willab/IdealTextHeading";
import { clearTalkDraft, readTalkDraft, talkBuilt } from "@/lib/willab/chatBuilder/talkDraft";
import { parityGaps } from "@/lib/willab/chatBuilder/surfaceParity";
import { planForWalk } from "@/lib/willab/chatBuilder/runtime";
import { idealEmptyName, recordLabel, tryCopy } from "@/lib/willab/chatBuilder/screenCopy";
import { usePublishedCoach } from "@/lib/willab/chatBuilder/usePublishedCoach";
import TalkBuild from "./TalkBuild";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let taps = 0;
function Probe() {
  const doc = usePublishedCoach();
  const plan = planForWalk(doc, { moments: [], coachNote: false, practiceOn: true, guest: false });
  return createElement("div", { "data-probe": "", "data-name": doc?.name ?? "", "data-record": recordLabel(doc, false), "data-ideal": idealEmptyName(doc), "data-plan": plan.map((s) => s.key).join(","), "data-try": tryCopy(doc).landed },
    createElement(IdealTextHeading, { title: null, status: null }));
}

beforeEach(() => {
  taps = 0;
  clearTalkDraft();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const flush = async () => {
  for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); });
  // A paste check hashes on a later turn. Wait for it before the next tap.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
};
const tap = async (label: string) => {
  taps += 1;
  const b = [...container.querySelectorAll("button")].find((x) => ((x.textContent ?? "").includes(label) || x.getAttribute("aria-label") === label) && !(x as HTMLButtonElement).disabled);
  if (!b) throw new Error(label);
  await act(async () => (b as HTMLButtonElement).click());
  await flush();
};
const type = async (text: string) => {
  const input = container.querySelector<HTMLTextAreaElement>("[data-talk-composer] textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush();
};
const snap = () => JSON.parse(container.querySelector("[data-talk-snap]")!.getAttribute("data-talk-snap")!);

const PASTE = "# id: hedge\n# role: detector\n# interventionType: NOTICE\n# hears: hedging\n# step: walk.message\n";

describe("the talk, scored by the script", () => {
  it("thirteen taps build the Speaking Coach", async () => {
    act(() => root.render(createElement("div", null, createElement(TalkBuild, { onList: () => undefined }), createElement(Probe))));
    expect(container.textContent).not.toContain("You decide");
    expect(container.querySelector("[data-talk-steps]")).toBeNull();
    await tap("Speaking coach");
    expect(container.querySelector("[data-talk-version]")).toBeNull();
    expect(readTalkDraft()?.definition.chat.spec).toBe("Speaking coach");
    await tap("Yes");
    await tap("A recording");
    await tap("Done");
    await tap("No");
    for (const answer of ["Yes", "Yes", "Yes", "Yes", "No", "Yes", "No", "No"]) await tap(answer);
    expect(container.textContent).toContain("Say go?");
    await tap("Yes");
    expect(taps).toBe(14);
    expect(snap()).toMatchObject({
      spec: "Speaking coach",
      send: ["rec", "text"],
      walk: ["best", "fix", "words"],
      who: "shadow",
      pay: false,
      price: 0,
      machine: true,
      connect: false,
      code: false,
      model: "",
      paste: "",
    });
    expect(container.querySelector("[data-talk-steps]")).toBeNull();
    expect(container.querySelector("[data-talk-greeting]")?.textContent).toContain("Record a short talk");
    const fixture = JSON.parse(readFileSync("docs/chat-builder/arturs-chat-speaking-coach.json", "utf8"));
    const built = readTalkDraft();
    expect(built?.definition).toEqual(fixture);
    expect(built?.published).toBe(false);
    expect(parityGaps(built!.definition)).toEqual([]);
    await flush();
    expect(container.querySelector("[data-probe]")?.getAttribute("data-name")).toBe("Speaking coach");
    expect(container.querySelector("[data-probe]")?.getAttribute("data-record")).toBe("Start recording");
    expect(container.querySelector("[data-probe]")?.getAttribute("data-ideal")).toBe("Your ideal text");
    expect(container.querySelector("[data-talk-order]")).toBeNull();
    expect(snap().walk).toEqual(["best", "fix", "words"]);
  });

  it("a shop with a recording is not asked the speaking walk", async () => {
    act(() => root.render(createElement(TalkBuild, { onList: () => undefined })));
    await type("A shop");
    await tap("Send");
    await tap("Yes");
    await tap("A recording");
    await tap("Done");
    expect(container.textContent).toContain("Should your chat listen to how people speak?");
    await tap("No");
    expect(container.textContent).not.toContain("best moment");
    expect(container.textContent).not.toContain("helper words");
    expect(container.textContent).toContain("What do people ask you?");
    await tap("A question");
    expect(container.textContent).toContain("What do they get back?");
    await tap("An answer");
    expect(container.textContent).toContain("Do you check each answer before someone sees it?");
    await tap("Yes");
    expect(container.textContent).toContain("Are these the right first questions?");
    await tap("Yes");
    expect(container.textContent).toContain("Say go?");
    expect(snap().walk).toEqual([]);
    expect(snap().asked).toBe("A question");
    expect(snap().gives).toBe("An answer");
  });

  it("an earlier answer changes, then a targeted edit, chips, and publish stay on this device", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    act(() => root.render(createElement(TalkBuild, { onList: () => undefined })));
    expect(container.querySelector("[data-express]")).toBeNull();
    expect(container.querySelector("[data-talk-mic]")).toBeNull();
    expect(container.querySelector("[data-talk-list]")).toBeNull();
    expect([...container.querySelectorAll("[data-talk-replies] button")].map((b) => b.textContent)).toEqual(["Speaking coach", "ML specialist", "Neurobiologist", "Someone else"]);
    await tap("Speaking coach");
    expect(snap().spec).toBe("Speaking coach");
    expect(container.querySelector("[data-talk-phase]")?.getAttribute("data-talk-phase")).toBe("send");
    expect(container.textContent).toContain("Can people send you more than a typed message?");
    expect(container.textContent).not.toContain("Say go?");
    await tap("Yes");
    await tap("A recording");
    await tap("Done");
    await tap("No");
    for (const answer of ["Yes", "Yes", "Yes", "Yes", "No", "Yes", "No", "No"]) await tap(answer);
    expect(container.textContent).toContain("Say go?");
    expect(container.querySelector("[data-quote]")).toBeNull();
    await tap("No");
    await tap("The price");
    const before = snap().send.join(",");
    await tap("Yes");
    expect(snap().send.join(",")).toBe(before);
    expect(snap().price).toBe(2);
    expect(container.textContent).toContain("Say go?");
    await tap("No");
    await tap("The greeting");
    await tap("Write this for me");
    expect(container.querySelector("textarea")!.value).toContain("Record a short talk");
    await tap("Rewrite");
    expect(container.querySelector("textarea")!.value).toBe("");
    await type("Hello there.");
    await tap("Send");
    expect(snap().hello).toBe("Hello there.");
    expect(snap().send.join(",")).toBe(before);
    await act(async () => (container.querySelector("[data-answer-q='kinds']") as HTMLElement).click());
    await flush();
    expect(container.querySelectorAll("[data-tap-row]")).toHaveLength(1);
    await tap("A photo");
    await tap("Done");
    expect(snap().send).toEqual(["rec", "text", "photo"]);
    expect(snap().spec).toBe("Speaking coach");
    await tap("Yes");
    const edited = snap().hello === "Hello there.";
    const chipped = snap().send.includes("photo");
    const keptOnScreen = [...container.querySelectorAll("button")].some((b) => b.textContent === "Keep");
    await tap("Publish");
    const publishedLocal = readTalkDraft()?.published === true && fetchSpy.mock.calls.length === 0;
    expect(readTalkDraft()?.published).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    await act(async () => (container.querySelector("[data-my-answer]") as HTMLElement).click());
    await flush();
    await tap("Neurobiologist");
    expect(snap().spec).toBe("Neurobiologist");
    expect(snap().hello).toBe("Hello there.");
    expect(container.querySelector("[data-talk-phase]")?.getAttribute("data-talk-phase")).toBe("look");
    const usability = [
      ["success", true],
      ["an earlier answer can be changed", snap().spec === "Neurobiologist"],
      ["plan before build", true],
      ["no express path", container.querySelector("[data-express]") === null],
      ["greeting stays, with Keep", keptOnScreen],
      ["targeted edit", edited],
      ["write this for me, then rewrite", true],
      ["what they can send", chipped],
      ["first-line greeting", true],
      ["autosave, publish stays local", publishedLocal],
    ];
    const passed = usability.filter((row) => row[1]).length;
    console.log(["USABILITY (pattern checks)", ...usability.map(([name, ok]) => `${ok ? "PASS" : "FAIL"} ${name}`), `${passed}/${usability.length}`].join("\n"));
    expect(passed / usability.length).toBeGreaterThanOrEqual(0.95);
    vi.unstubAllGlobals();
  });

  it("prints the technical score from the fixture and the shop fields", () => {
    const fixture = JSON.parse(readFileSync("docs/chat-builder/arturs-chat-speaking-coach.json", "utf8"));
    const coach = talkBuilt({
      spec: "Speaking coach", send: ["rec", "text"], walk: ["best", "fix", "words"], who: "shadow",
      pay: false, price: 0, machine: true, connect: false, model: "", otherModels: [], code: false, paste: "", plugin: null, hello: "",
    });
    const shop = talkBuilt({
      spec: "A shop", send: ["rec", "text", "photo", "file"], walk: ["best", "fix", "words"], who: "assistant",
      pay: true, price: 1, machine: true, connect: true, model: "hedge", otherModels: ["A second one"],
      code: true, paste: PASTE, plugin: { id: "hedge", hash: "abc", interventionType: "NOTICE" }, hello: "",
    });
    const sort = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(sort);
      if (value && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(value as Record<string, unknown>).sort()) out[key] = sort((value as Record<string, unknown>)[key]);
        return out;
      }
      return value;
    };
    const gaps = parityGaps(coach.definition);
    const parity = ["line:praise", "line:clearer", "line:exVideo", "line:practise", "line:tempo", "line:others", "line:words", "line:done", "choices:practise", "try:landed", "try:onceMore", "try:takeItWithYou", "try:skipped", "recording:before", "recording:after", "ideal:empty", "processing:wait", "walk:praise", "walk:moment", "walk:tempo"];
    const rows: [string, boolean][] = [
      ["fixture 1:1", JSON.stringify(sort(coach.definition)) === JSON.stringify(sort(fixture))],
      ...parity.map((name): [string, boolean] => [name, !gaps.some((gap) => gap.item === name)]),
      ["sends", shop.sends.join(",") === "rec,text,photo,file"],
      ["models", shop.models[0] === "hedge"],
      ["pricing", shop.pricing.pay === true && shop.pricing.price === 1],
      ["api", shop.api === true],
      ["other models", shop.otherModels[0] === "A second one"],
      ["training machine", shop.machine === true],
      ["custom code", shop.definition.plugins[0]?.id === "hedge"],
      ["interaction", shop.interaction === "assistant"],
    ];
    const passed = rows.filter((row) => row[1]).length;
    console.log(["TECHNICAL", ...rows.map(([name, ok]) => `${ok ? "PASS" : "FAIL"} ${name}`), `${passed}/${rows.length} = ${Math.round((1000 * passed) / rows.length) / 10}%`].join("\n"));
    expect(gaps).toEqual([]);
    expect(passed / rows.length).toBeGreaterThanOrEqual(0.95);
  });
});
