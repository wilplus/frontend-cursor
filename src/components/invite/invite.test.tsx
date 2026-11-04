// @vitest-environment jsdom
/*
STORY    As someone a member invited, I want to paste the link they sent me on
         the first page and land on their join page; and as someone without a
         link, I want to wait on the waitlist instead of walking in (N471).
OUTCOME
  O1  A pasted link, its path, or the token alone opens the join page; a
      link that opens nothing says so in the signed words, under the field.
  O2  The app is members only: signed out it goes to the first page, a
      waiting account sees "You’re on the waitlist", a member gets the app.
PROVES   O1 -> "a pasted link opens the join page; a wrong one says so"
         O2 -> "the app is for members: signed out goes home, waiting waits, a member gets in"
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();
let signedIn: boolean | null = true;
let access: "member" | "waiting" = "member";
let opens = true;
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));
vi.mock("@/components/willab/useSignedIn", () => ({ useSignedIn: () => signedIn }));
vi.mock("@/services/api/access", () => ({ getAccess: vi.fn(async () => access) }));
vi.mock("@/services/api/chats", () => ({ joinLinkOpens: vi.fn(async () => opens) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { email: "maria.k@example.com" } } }) } }),
}));
vi.mock("@/components/willab/LoadingState", () => ({ default: () => null }));

import LinkField from "./LinkField";
import MembersOnly from "./MembersOnly";
import { INVITE_COPY, inviteToken } from "./inviteCopy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx";
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  signedIn = true;
  access = "member";
  opens = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function paste(text: string) {
  await act(async () => root.render(createElement(LinkField, { key: text })));
  const input = container.querySelector("input") as HTMLInputElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("the link field", () => {
  it("a pasted link opens the join page; a wrong one says so", async () => {
    expect(inviteToken(`https://www.willpowerlab.com/c/${TOKEN}`)).toBe(TOKEN);
    expect(inviteToken(`/c/${TOKEN}?join=1`)).toBe(TOKEN);
    expect(inviteToken(TOKEN)).toBe(TOKEN);
    expect(inviteToken("hello")).toBeNull();

    await paste(`https://www.willpowerlab.com/c/${TOKEN}`);
    expect(push).toHaveBeenCalledWith(`/c/${TOKEN}`);

    opens = false;
    await paste(`willpowerlab.com/c/${TOKEN}`);
    expect(container.textContent).toContain(INVITE_COPY.wrongLink);
    expect(push).toHaveBeenCalledTimes(1);
  });
});

describe("members only", () => {
  const app = () => createElement(MembersOnly, null, createElement("p", null, "the app"));

  it("the app is for members: signed out goes home, waiting waits, a member gets in", async () => {
    signedIn = false;
    await act(async () => root.render(app()));
    expect(replace).toHaveBeenCalledWith("/");
    expect(container.textContent).not.toContain("the app");

    signedIn = true;
    access = "waiting";
    await act(async () => root.render(createElement("div", { key: "w" }, app())));
    expect(container.textContent).toContain(INVITE_COPY.waitingTitle);
    expect(container.textContent).toContain(INVITE_COPY.waitingLine("maria.k@example.com"));
    expect(container.textContent).not.toContain("the app");

    access = "member";
    await act(async () => root.render(createElement("div", { key: "m" }, app())));
    expect(container.textContent).toContain("the app");
  });
});
