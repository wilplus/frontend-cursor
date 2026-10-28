// @vitest-environment jsdom
/*
STORY    As someone signing up or in with WhatsApp, I want to give my number,
         type the code WhatsApp brings and, when I am new, my name, so that I
         am in without an email or a password.
OUTCOME
  O1  Signing up: Poland is chosen at the start and a number too short for
      it sends no code (backend N230); a wrong code says so; the right one asks a new account
      its name, keeps the number as the account's WhatsApp number, and lands.
  O2  Signing in never makes an account: a number no account signs in with
      says so and points to sign-up, and the number is not saved anywhere.
  O3  Signing in on the page that opens on the number: "Sign in with
      WhatsApp", the code, then straight in, with no name step (N232).
PROVES   O1 -> "signing up: number, code, name, and the number is kept"
         O2 -> "signing in with an unknown number says so and makes nothing"
         O3 -> "signing in from the first screen: the code, then in"
WHY      Founder 2026-10-27, backend N214; the first screen, 2026-10-28, N232.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  refreshSession: vi.fn(async () => ({ data: {}, error: null })),
}));
const saved = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));
vi.mock("@/services/api/projects", () => ({ claimGuestProjects: vi.fn(async () => true) }));
vi.mock("@/services/api/whatsapp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/api/whatsapp")>()),
  fetchWhatsAppPhone: saved.fetch,
  saveWhatsAppPhone: saved.save,
}));

import WhatsAppAuth, { WHATSAPP_AUTH_COPY } from "./WhatsAppAuth";

let container: HTMLDivElement;
let root: Root;

function type(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function submit() {
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.advanceTimersByTimeAsync(500);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.values(auth).forEach((fn) => fn.mockClear());
  saved.fetch.mockReset().mockResolvedValue(null);
  saved.save.mockReset().mockResolvedValue(true);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("WhatsApp sign-up and sign-in", () => {
  it("signing up: number, code, name, and the number is kept", async () => {
    const landed = vi.fn();
    auth.signInWithOtp.mockResolvedValue({ error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    act(() => root.render(createElement(WhatsAppAuth, { mode: "signup", onBack: vi.fn(), onSuccess: landed })));

    act(() => type("#wa-phone", "600 100"));
    await submit();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();

    act(() => type("#wa-phone", "600 100 200"));
    await submit();
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ phone: "+48600100200", options: { shouldCreateUser: true } });
    expect(container.textContent).toContain(WHATSAPP_AUTH_COPY.codeTitle);

    auth.verifyOtp.mockResolvedValueOnce({ data: { session: null, user: null }, error: { message: "Token has expired or is invalid" } });
    act(() => type("#wa-code", "111111"));
    await submit();
    expect(container.textContent).toContain(WHATSAPP_AUTH_COPY.wrongCode);

    auth.verifyOtp.mockResolvedValueOnce({ data: { session: { access_token: "t" }, user: { user_metadata: {} } }, error: null });
    act(() => type("#wa-code", "482916"));
    await submit();
    expect(auth.verifyOtp).toHaveBeenLastCalledWith({ phone: "+48600100200", token: "482916", type: "sms" });
    expect(saved.save).toHaveBeenCalledWith("+48600100200");
    expect(container.textContent).toContain(WHATSAPP_AUTH_COPY.nameTitle);

    act(() => type("#wa-name", "Ann"));
    await submit();
    expect(auth.updateUser).toHaveBeenCalledWith({ data: { name: "Ann", display_name: "Ann" } });
    expect(landed).toHaveBeenCalledTimes(1);
  });

  it("signing in with an unknown number says so and makes nothing", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: { code: "otp_disabled", message: "Signups not allowed for otp" } });
    act(() => root.render(createElement(WhatsAppAuth, { mode: "login", onBack: vi.fn() })));

    act(() => type("#wa-phone", "+44 7700 900123"));
    await submit();
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ phone: "+447700900123", options: { shouldCreateUser: false } });
    expect(container.textContent).toContain(WHATSAPP_AUTH_COPY.noAccount.trim());
    expect(container.querySelector('a[href="/signup?way=whatsapp"]')?.textContent).toBe(WHATSAPP_AUTH_COPY.noAccountLink);
    expect(container.querySelector("#wa-code")).toBeNull();
    expect(saved.save).not.toHaveBeenCalled();
  });

  it("signing in from the first screen: the code, then in", async () => {
    const landed = vi.fn();
    auth.signInWithOtp.mockResolvedValue({ error: null });
    act(() => root.render(createElement(WhatsAppAuth, { mode: "login", first: true, onSuccess: landed })));
    expect(container.textContent).toContain(WHATSAPP_AUTH_COPY.signIn);
    expect(container.textContent).not.toContain("Back");

    act(() => type("#wa-phone", "600 100 200"));
    await submit();
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ phone: "+48600100200", options: { shouldCreateUser: false } });

    auth.verifyOtp.mockResolvedValueOnce({ data: { session: { access_token: "t" }, user: { user_metadata: {} } }, error: null });
    act(() => type("#wa-code", "482916"));
    await submit();
    expect(container.textContent).not.toContain(WHATSAPP_AUTH_COPY.nameTitle);
    expect(landed).toHaveBeenCalledTimes(1);
  });
});
