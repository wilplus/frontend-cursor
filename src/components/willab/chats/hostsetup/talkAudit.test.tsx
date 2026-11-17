// @vitest-environment jsdom
/*
STORY    The talk is scored by driving it. Finishing it writes the coach
         the screens read. A shop chat sets every field the builder has.
OUTCOME
  O1  Fifteen taps build the Speaking Coach, then Say go. The saved
      document matches the fixture, and the screens read it.
  O2  A shop chat sets all four sends, an assistant, price 1, a training
      machine, the hedge model, another model and a checked paste.
  O3  You decide, Just build it, a targeted edit, chips and Publish stay
      on this device.
  O4  The technical score is printed from the fixture and the shop fields.
PROVES   O1 -> "fifteen taps build the Speaking Coach"
         O2 -> "the shop chat sets price, model and paste, and the mic transcribes"
         O3 -> "express, you decide, a targeted edit, chips, and publish stay on this device"
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
  it("fifteen taps build the Speaking Coach", async () => {
    act(() => root.render(createElement("div", null, createElement(TalkBuild, { onList: () => undefined }), createElement(Probe))));
    expect(container.textContent).toContain("You decide");
    await tap("Speaking coach");
    expect(container.querySelector("[data-talk-version]")).toBeNull();
    await tap("Send");
    expect(readTalkDraft()?.definition.chat.spec).toBe("Speaking coach");
    for (const answer of ["Yes", "Yes", "No", "No", "Yes", "Yes", "Yes", "Yes", "No", "Yes", "No", "No"]) await tap(answer);
    expect(container.textContent).toContain("Say go?");
    await tap("Yes");
    expect(taps).toBe(15);
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
    expect(container.querySelector("[data-talk-step='Look']")?.className).toContain("font-semibold");
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
    await tap("Later");
    expect(snap().walk[0]).toBe("fix");
  });

  it("the shop chat sets price, model and paste, and the mic transcribes", async () => {
    const transcribe = vi.fn(async () => "A shop");
    class Rec {
      mimeType = "audio/webm";
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {}
      stop() {
        this.ondataavailable?.({ data: new Blob(["a"]) });
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", Rec);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
    act(() => root.render(createElement(TalkBuild, {
      onList: () => undefined,
      models: [{ id: "hedge", q: "Did they hedge?" }],
      transcribe,
    })));
    const mic = container.querySelector<HTMLButtonElement>("[data-talk-mic]")!;
    await act(async () => mic.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    await flush();
    expect(mic.getAttribute("data-recording")).toBe("");
    await act(async () => mic.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    await flush();
    expect(transcribe).toHaveBeenCalledOnce();
    expect(snap().spec).toBe("A shop");
    for (const answer of ["Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "No", "No"]) await tap(answer);
    await tap("Yes");
    await tap("No");
    await tap("Yes");
    await tap("Yes");
    await tap("Yes");
    await tap("Did they hedge?");
    await tap("Send");
    await tap("Yes");
    await type("A second one");
    await tap("Send");
    await tap("Yes");
    await tap("Write this for me");
    await tap("Keep");
    await tap("Yes");
    expect(taps).toBe(22);
    for (let n = 0; n < 10 && !snap().paste; n += 1) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    const saved = snap();
    expect(saved.send).toEqual(["rec", "text", "photo", "file"]);
    expect(saved.walk).toEqual(["best", "fix", "words"]);
    expect(saved.who).toBe("assistant");
    expect(saved.pay).toBe(true);
    expect(saved.price).toBe(1);
    expect(saved.machine).toBe(true);
    expect(saved.connect).toBe(true);
    expect(saved.model).toBe("hedge");
    expect(saved.paste).toContain("id: hedge");
    expect(saved.code).toBe(true);
    expect(saved.otherModels).toEqual(["A second one"]);
    const built = readTalkDraft();
    expect(built?.sends).toEqual(["rec", "text", "photo", "file"]);
    expect(built?.models).toEqual(["hedge"]);
    expect(built?.otherModels).toEqual(["A second one"]);
    expect(built?.pricing).toEqual({ pay: true, price: 1 });
    expect(built?.api).toBe(true);
    expect(built?.machine).toBe(true);
    expect(built?.code).toContain("id: hedge");
    expect(built?.interaction).toBe("assistant");
    expect(built?.definition.chat.hello).toBe("Your chat is ready.");
    expect(built?.definition.plugins[0]?.id).toBe("hedge");
    expect(built?.published).toBe(false);
    vi.unstubAllGlobals();
  });

  it("express, you decide, a targeted edit, chips, and publish stay on this device", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    act(() => root.render(createElement(TalkBuild, { onList: () => undefined })));
    expect([...container.querySelectorAll("[data-quote]")].map((b) => b.getAttribute("data-say"))).toEqual(["Speaking coach", "You decide"]);
    await tap("You decide");
    await tap("Send");
    expect(snap().spec).toBe("Speaking coach");
    await tap("Just build it");
    expect(container.textContent).toContain("Say go?");
    expect(container.querySelector("[data-talk-saved]")).toBeNull();
    await tap("Yes");
    expect(container.querySelector("[data-talk-greeting]")?.textContent).toContain("Record a short talk");
    expect(container.querySelector("[data-preview-keep]")).not.toBeNull();
    expect(container.querySelector("[data-preview-next]")).not.toBeNull();
    const fixture = JSON.parse(readFileSync("docs/chat-builder/arturs-chat-speaking-coach.json", "utf8"));
    expect(readTalkDraft()?.definition).toEqual(fixture);
    clearTalkDraft();
    act(() => root.render(createElement(TalkBuild, { onList: () => undefined })));
    await tap("Just build it");
    await tap("No");
    await tap("The price");
    await tap("Send");
    const before = snap().send.join(",");
    await tap("Yes");
    expect(snap().send.join(",")).toBe(before);
    expect(snap().price).toBe(2);
    expect(container.textContent).toContain("Say go?");
    await tap("No");
    await tap("The greeting");
    await tap("Send");
    await tap("Write this for me");
    expect(container.querySelector("textarea")!.value).toContain("Record a short talk");
    await tap("Rewrite");
    expect(container.querySelector("textarea")!.value).toBe("");
    await type("Hello there.");
    await tap("Send");
    expect(snap().hello).toBe("Hello there.");
    expect(snap().send.join(",")).toBe(before);
    await tap("Photo");
    expect(snap().send).toContain("photo");
    expect(snap().spec).toBe("Speaking coach");
    await tap("Yes");
    const edited = snap().hello === "Hello there.";
    const chipped = snap().send.includes("photo");
    await tap("Publish");
    const publishedLocal = readTalkDraft()?.published === true && fetchSpy.mock.calls.length === 0;
    expect(readTalkDraft()?.published).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    await tap("Undo");
    expect(container.querySelector("[data-talk-phase]")?.getAttribute("data-talk-phase")).not.toBe("look");
    const usability = [
      ["success", true],
      ["you decide on the brief", true],
      ["plan before build", true],
      ["express path", true],
      ["live preview keep and next", true],
      ["targeted edit", edited],
      ["write this for me, then rewrite", true],
      ["capability chips", chipped],
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
