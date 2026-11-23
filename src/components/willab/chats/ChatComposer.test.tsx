// @vitest-environment jsdom
/*
STORY    As a chat user, I want files, typing, and recording in the same
         composer so I can switch input without losing a draft.
OUTCOME
  O1  Recording keeps the mic position and restores the typed and file drafts.
  O2  A refusal leaves a draft available for retry and an in-flight send is not duplicated.
  O3  A queued attachment can be sent only in its original question scope.
PROVES   O1 -> "keeps a typed draft and an attachment during recording, then submits each once"
         O2 -> "keeps a refused message available and coalesces clicks while a send is pending"
         O3 -> "will only send an attachment in its original question scope"
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ChatComposer, { type ComposerFileAction } from "./ChatComposer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const field = () => host.querySelector<HTMLTextAreaElement>("[data-chat-input]")!;
const mic = () => host.querySelector<HTMLButtonElement>("[data-chat-mic]")!;
const send = () => host.querySelector<HTMLButtonElement>("[data-chat-send]");
const click = (node: HTMLButtonElement) => act(async () => node.click());

function type(words: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field(), words);
    field().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function attach(file: File) {
  await click(host.querySelector<HTMLButtonElement>("[data-chat-files]")!);
  await click([...host.querySelectorAll("button")].find((button) => button.textContent === "Attach notes")!);
  const input = host.querySelector<HTMLInputElement>("[data-chat-file-pick]")!;
  await act(async () => {
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

it("keeps a typed draft and an attachment during recording, then submits each once", async () => {
  const sendFile = vi.fn(async () => true);
  const onSend = vi.fn(async () => true);
  const start = vi.fn();
  const stop = vi.fn();
  const files: ComposerFileAction[] = [{ label: "Attach notes", sendFile }];
  const note = new File(["notes"], "notes.pdf");
  const draw = (voiceRequired = false, recording = false) => act(() => root.render(
    <ChatComposer {...{ files, onSend, voiceRequired }} mic={{ start }}
      recording={recording ? { elapsedMs: 1400, stop } : undefined} />,
  ));
  draw();
  const textSlot = field();
  const micSlot = mic();
  type("A note about my take");
  await attach(note);

  draw(true);
  expect(field().disabled).toBe(true);
  expect(field().value).toBe("");
  expect(host.textContent).toContain("For next message");
  expect(send()).toBeNull();
  await click(mic());
  expect(start).toHaveBeenCalledOnce();
  draw(true, true);
  expect(field()).toBe(textSlot);
  expect(field().hidden).toBe(true);
  expect(mic()).toBe(micSlot);
  expect(host.querySelector("[data-chat-capture]")?.textContent).toContain("0:01");
  await click(mic());
  expect(stop).toHaveBeenCalledOnce();

  draw();
  expect(field().value).toBe("A note about my take");
  await click(send()!);
  expect(sendFile).toHaveBeenCalledExactlyOnceWith(note);
  expect(onSend).not.toHaveBeenCalled();
  await click(send()!);
  expect(onSend).toHaveBeenCalledExactlyOnceWith("A note about my take");
  expect(field().value).toBe("");
});

it("keeps a refused message available and coalesces clicks while a send is pending", async () => {
  let fail: (result: boolean) => void = () => undefined;
  const onSend = vi.fn()
    .mockImplementationOnce(() => new Promise<boolean>((resolve) => { fail = resolve; }))
    .mockResolvedValueOnce(true);
  act(() => root.render(<ChatComposer onSend={onSend} />));
  type("Keep this draft");
  await click(send()!);
  await click(send()!);
  expect(onSend).toHaveBeenCalledOnce();
  expect(send()?.disabled).toBe(true);
  expect(field().disabled).toBe(false);
  await act(async () => fail(false));
  expect(host.querySelector("[role=alert]")?.textContent).toContain("Try again");
  expect(field().value).toBe("Keep this draft");
  await click(send()!);
  expect(onSend).toHaveBeenCalledTimes(2);
  expect(field().value).toBe("");
});

it("will only send an attachment in its original question scope", async () => {
  const first = vi.fn(() => true);
  const other = vi.fn(() => true);
  const draw = (scope: string, sendFile: () => boolean) => act(() => root.render(
    <ChatComposer files={[{ label: "Attach notes", scope, sendFile }]} />,
  ));
  draw("first", first);
  const file = new File(["notes"], "notes.pdf");
  await attach(file);
  draw("other", other);
  expect(send()).toBeNull();
  expect(other).not.toHaveBeenCalled();
  draw("first", first);
  await click(send()!);
  expect(first).toHaveBeenCalledExactlyOnceWith(file);
});
