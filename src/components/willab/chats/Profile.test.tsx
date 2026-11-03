// @vitest-environment jsdom
/*
STORY    As someone in a chat, I want to open the other person's profile and
         my own, as on WhatsApp, and change mine, so that we know who we are
         talking to (backend N366).
OUTCOME
  O1  Their profile shows their name, who they are, their About, and the
      photos and files we shared; with none, "No photos yet." and "No files
      yet."; no pencil and no Edit.
  O2  On mine, the pencil opens my About to type in; Save keeps it and says
      "Edited today".
  O3  On mine, Edit turns my name and who I am into fields; Done keeps them.
PROVES   O1 -> "their profile shows who they are and what we shared, and cannot be edited"
         O2 -> "the pencil edits my About and Save keeps it"
         O3 -> "Edit changes my name and role, Done keeps them"
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile as ProfileData } from "@/services/api/chats";

const api = vi.hoisted(() => ({
  getMyProfile: vi.fn(),
  getTheirProfile: vi.fn(),
  saveMyProfile: vi.fn(),
  setMyPhoto: vi.fn(),
  dropMyPhoto: vi.fn(),
}));
vi.mock("@/services/api/chats", () => ({
  ...api,
  chatFileSrc: (c: string, m: string) => `/f/${c}/${m}`,
  profilePhotoSrc: () => "/p",
}));

import Profile from "./Profile";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const base: ProfileData = { name: "Piotr Kowalski", role: "Senior editor", about: "I wrote our AI guidelines.", about_edited_at: null, has_photo: false, photos: [], files: [] };

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () => act(async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); });
const tap = (sel: string) => act(async () => (container.querySelector(sel) as HTMLElement).click());
const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

describe("a person's profile", () => {
  it("their profile shows who they are and what we shared, and cannot be edited", async () => {
    api.getTheirProfile.mockResolvedValue({ ...base, files: [{ id: "m1", chat_id: "c1", name: "Guidelines.pdf", created_at: "" }] });
    await act(async () => root.render(createElement(Profile, { chatId: "c1", onBack: () => {} })));
    await flush();
    const text = container.textContent ?? "";
    for (const w of ["Piotr Kowalski", "Senior editor", "I wrote our AI guidelines.", "Guidelines.pdf", "No photos yet."]) expect(text).toContain(w);
    expect(container.querySelector("[data-profile-pencil]")).toBeNull();
    expect(container.querySelector("[data-profile-edit]")).toBeNull();
  });

  it("the pencil edits my About and Save keeps it", async () => {
    api.getMyProfile.mockResolvedValue({ ...base, name: "Tomek" });
    api.saveMyProfile.mockImplementation(async (c: { about: string }) => ({ ...base, name: "Tomek", about: c.about, about_edited_at: new Date().toISOString() }));
    await act(async () => root.render(createElement(Profile, { onBack: () => {} })));
    await flush();
    await tap("[data-profile-pencil]");
    await type(container.querySelector("[data-profile-about]") as HTMLTextAreaElement, "I help colleagues use AI.");
    await tap("[data-profile-save]");
    await flush();
    expect(api.saveMyProfile).toHaveBeenCalledWith({ about: "I help colleagues use AI." });
    expect(container.textContent).toContain("I help colleagues use AI.");
    expect(container.textContent).toContain("Edited today");
  });

  it("Edit changes my name and role, Done keeps them", async () => {
    api.getMyProfile.mockResolvedValue({ ...base, name: "Tomek", role: null });
    api.saveMyProfile.mockImplementation(async (c: { name: string; role: string }) => ({ ...base, name: c.name, role: c.role }));
    await act(async () => root.render(createElement(Profile, { onBack: () => {} })));
    await flush();
    await tap("[data-profile-edit]");
    expect(container.querySelector("[data-profile-edit]")?.textContent).toBe("Done");
    await type(container.querySelector('input[aria-label="Name"]') as HTMLInputElement, "Tomasz");
    await type(container.querySelector('input[aria-label="Role"]') as HTMLInputElement, "AI ambassador");
    await tap("[data-profile-edit]");
    await flush();
    expect(api.saveMyProfile).toHaveBeenCalledWith(expect.objectContaining({ name: "Tomasz", role: "AI ambassador" }));
    expect(container.querySelector("[data-profile-name]")?.textContent).toBe("Tomasz");
  });
});
