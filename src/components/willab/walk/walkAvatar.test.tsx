// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WalkMessage, { WalkAvatar } from "./WalkMessage";

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
const draw = (el: ReactElement) => act(() => root.render(el));

describe("WalkAvatar", () => {
  it("renders the grey silhouette and never a photo", () => {
    draw(createElement(WalkAvatar));
    const avatar = host.querySelector("[data-walk-avatar]")!;
    expect(avatar.querySelector("svg")).not.toBeNull();
    expect(avatar.className).toContain("bg-foreground/15");
    expect(avatar.className).toContain("rounded-full");
    expect(host.innerHTML).not.toContain("background-image");
    expect(host.querySelector("img")).toBeNull();
  });

  it("shows the message text only, with a decorative avatar", () => {
    draw(<WalkMessage>Keep that pause.</WalkMessage>);
    expect(host.textContent).toBe("Keep that pause.");
    expect(host.textContent).not.toMatch(/Your coach|What you said|WillpowerLab|Coach|App/);
    const avatar = host.querySelector("[data-walk-avatar]")!;
    expect(avatar.getAttribute("aria-label")).toBeNull();
    expect(avatar.getAttribute("title")).toBeNull();
  });

  it("source has no photo path", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/willab/walk/WalkMessage.tsx"),
      "utf8",
    );
    expect(source).not.toContain("avatarSrc");
    expect(source).not.toContain("backgroundImage");
    expect(source).not.toContain("src=");
  });
});
