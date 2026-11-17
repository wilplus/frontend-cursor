// @vitest-environment jsdom
/*
STORY    The talk is scored by driving it. A Speaking Coach, a shop chat,
         a price, a model and a checked paste are set by taps and by the mic.
OUTCOME
  O1  Speaking coach is saved in 14 taps: a recording and a message, the
      three walk steps, the host checks first, no price, a training machine,
      no outside model, no paste.
  O2  A shop chat sets all four sends, an assistant, price 1, a training
      machine, the hedge model and a checked paste. The mic's transcript
      is sent on as the brief.
PROVES   O1 -> "fourteen taps build the Speaking Coach"
         O2 -> "the shop chat sets price, model and paste, and the mic transcribes"
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TalkBuild from "./TalkBuild";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let taps = 0;
beforeEach(() => {
  taps = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const flush = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); };
const tap = async (label: string) => {
  taps += 1;
  const b = [...container.querySelectorAll("button")].find((x) => (x.textContent ?? "").includes(label) && !(x as HTMLButtonElement).disabled);
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
  it("fourteen taps build the Speaking Coach", async () => {
    act(() => root.render(createElement(TalkBuild, { onList: () => undefined })));
    await tap("Speaking coach");
    expect(container.querySelector("[data-talk-version]")).toBeNull();
    await tap("Send");
    for (const answer of ["Yes", "Yes", "No", "No", "Yes", "Yes", "Yes", "Yes", "No", "Yes", "No", "No"]) await tap(answer);
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
    expect(container.querySelector("[data-talk-step='Look']")?.className).toContain("font-semibold");
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
    await type(PASTE);
    await tap("Send");
    expect(taps).toBe(18);
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
    vi.unstubAllGlobals();
  });
});
