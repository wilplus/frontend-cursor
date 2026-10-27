// @vitest-environment jsdom
/*
STORY    As a speaker, I want to change my email and my password on Data &
         consent, and get a link when I forgot the password, so that I keep
         my account when I lose an address or a password (backend N190).
OUTCOME
  O1  Change email sends the new address and my current password; the card
      then says the link went and the email changes when I open it. A wrong
      password says "That password isn’t right." and keeps the form.
  O2  An account that signs in with Google reads "You sign in with Google.",
      asks no password to change the email, and Set a password says where
      the link went.
  O3  Change password sends nothing while the two new passwords differ; a
      change says "Password updated."; Forgot password? says where the reset
      link went.
  O4  Back from the email's link the card says "Your email is now …" and
      refreshes the session, so the menu shows the new address; a link that
      failed says the page's "Couldn’t save that. Try again."
  O5  When the account can't be read, there is no card.
  O6  Adding WhatsApp as a way in: a number without its country code is
      refused before any code goes; the code goes to the number, a wrong
      code says so, and the right one makes the row say "You can sign in
      with WhatsApp at {number}."
  O7  A WhatsApp account with no email has no email row and no password
      row: the card says where it signs in with WhatsApp.
PROVES   O1 -> "sends the change and says the link went; a wrong password keeps the form"
         O2 -> "a Google account sets a password with a link"
         O3 -> "checks the new password twice, then updates; Forgot password? sends the link"
         O4 -> "back from the link it says the new email and refreshes the session"
         O5 -> "no card when the account can't be read"
         O6 -> "adds WhatsApp as a way in with the code"
         O7 -> "a WhatsApp account without email has only the WhatsApp row"
WHY      WIL-95, founder 2026-10-26 (backend N190; rules in
         docs/flows/consent-screens.md §1, "Amended 2026-10-26"); the
         WhatsApp row, founder 2026-10-27 (backend N214 item 5).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  changeEmail: vi.fn(),
  changePassword: vi.fn(),
  sendPasswordLink: vi.fn(),
  refreshSession: vi.fn(),
  updateUser: vi.fn(),
  verifyOtp: vi.fn(),
}));
vi.mock("@/services/api/accountSignIn", () => ({
  fetchSignIn: vi.fn(),
  changeEmail: api.changeEmail,
  changePassword: api.changePassword,
  sendPasswordLink: api.sendPasswordLink,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { refreshSession: api.refreshSession, updateUser: api.updateUser, verifyOtp: api.verifyOtp },
  }),
}));
vi.mock("@/components/auth/WhatsAppAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/auth/WhatsAppAuth")>()),
  WHATSAPP_SIGNIN: true,
}));

import AccountSignInCard from "./AccountSignInCard";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";
import { WHATSAPP_AUTH_COPY } from "@/components/auth/WhatsAppAuth";
import { WHATSAPP_COPY } from "@/components/willab/WillabWhatsAppPrompt";
import type { SignIn } from "@/services/api/accountSignIn";

const ALEX: SignIn = { email: "alex@example.com", hasPassword: true, provider: null };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // jsdom has no scrolling; the link's landing scrolls to the card.
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  for (const fn of Object.values(api)) fn.mockReset();
  window.history.replaceState(null, "", "/account/data-consent");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () => act(async () => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
});
const button = (label: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((b) => b.textContent?.trim() === label);
const input = (label: string) => {
  const forLabel = Array.from(container.querySelectorAll("label"))
    .find((l) => l.textContent?.trim() === label);
  return forLabel ? container.querySelector<HTMLInputElement>(`#${forLabel.htmlFor}`) : null;
};
const type = (label: string, value: string) => {
  const field = input(label);
  expect(field, label).not.toBeNull();
  field!.value = value;
};
const said = () => container.textContent ?? "";

async function show(account: SignIn | null, phone: string | null = null) {
  act(() => root.render(createElement(AccountSignInCard, {
    load: async () => account, loadPhone: async () => phone,
  })));
  await flush();
}
async function press(label: string) {
  const target = button(label);
  expect(target, label).toBeDefined();
  await act(async () => target!.click());
  await flush();
}

describe("Email and password", () => {
  it("sends the change and says the link went; a wrong password keeps the form", async () => {
    await show(ALEX);
    expect(said()).toContain(COPY.accountTitle);
    expect(said()).toContain("alex@example.com");

    await press(COPY.accountChange);
    type(COPY.accountNewEmail, "Alex@NewCo.com");
    type(COPY.accountCurrentPassword, "nope");
    api.changeEmail.mockResolvedValueOnce({ ok: false, code: "WRONG_PASSWORD" });
    await press(COPY.accountSendLink);
    expect(said()).toContain(COPY.accountWrongPassword);
    expect(input(COPY.accountNewEmail)).not.toBeNull();

    type(COPY.accountCurrentPassword, "practice");
    api.changeEmail.mockResolvedValueOnce({ ok: true, sentTo: "alex@newco.com" });
    await press(COPY.accountSendLink);
    expect(api.changeEmail).toHaveBeenLastCalledWith("alex@newco.com", "practice");
    expect(said()).toContain(COPY.accountEmailSent("alex@newco.com"));
    expect(input(COPY.accountNewEmail)).toBeNull();
  });

  it("a Google account sets a password with a link", async () => {
    await show({ email: "alex@example.com", hasPassword: false, provider: "Google" });
    expect(said()).toContain(COPY.accountProvider("Google"));

    await press(COPY.accountChange);
    expect(input(COPY.accountCurrentPassword)).toBeNull();
    type(COPY.accountNewEmail, "alex@newco.com");
    api.changeEmail.mockResolvedValueOnce({ ok: true, sentTo: "alex@newco.com" });
    await press(COPY.accountSendLink);
    expect(api.changeEmail).toHaveBeenLastCalledWith("alex@newco.com", undefined);

    api.sendPasswordLink.mockResolvedValueOnce({ ok: true, kind: "set", sentTo: "alex@example.com" });
    await press(COPY.accountSetPassword);
    expect(said()).toContain(COPY.accountSetSent("alex@example.com"));
  });

  it("checks the new password twice, then updates; Forgot password? sends the link", async () => {
    await show(ALEX);
    const passwordChange = () => Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .filter((b) => b.textContent?.trim() === COPY.accountChange)[1];  // the email row's comes first
    await act(async () => passwordChange().click());
    await flush();

    type(COPY.accountCurrentPassword, "practice");
    type(COPY.accountNewPassword, "longer-one");
    type(COPY.accountConfirmPassword, "longer-two");
    await press(COPY.accountUpdatePassword);
    expect(said()).toContain(COPY.accountNoMatch);
    expect(api.changePassword).not.toHaveBeenCalled();

    type(COPY.accountConfirmPassword, "longer-one");
    api.changePassword.mockResolvedValueOnce({ ok: true });
    await press(COPY.accountUpdatePassword);
    expect(api.changePassword).toHaveBeenCalledWith("practice", "longer-one");
    expect(said()).toContain(COPY.accountPasswordDone);

    await act(async () => passwordChange().click());
    await flush();
    api.sendPasswordLink.mockResolvedValueOnce({ ok: true, kind: "reset", sentTo: "alex@example.com" });
    await press(COPY.accountForgot);
    expect(said()).toContain(COPY.accountResetSent("alex@example.com"));
  });

  it("back from the link it says the new email and refreshes the session", async () => {
    window.history.replaceState(null, "", "/account/data-consent?email=changed");
    api.refreshSession.mockResolvedValue({});
    await show({ ...ALEX, email: "alex@newco.com" });
    expect(said()).toContain(COPY.accountEmailDone("alex@newco.com"));
    expect(api.refreshSession).toHaveBeenCalled();
    expect(window.location.search).toBe("");

    act(() => root.unmount());
    root = createRoot(container);
    window.history.replaceState(null, "", "/account/data-consent?email=failed");
    await show(ALEX);
    expect(said()).toContain(COPY.failed);
  });

  it("no card when the account can't be read", async () => {
    await show(null);
    expect(container.innerHTML).toBe("");
  });

  it("adds WhatsApp as a way in with the code", async () => {
    await show(ALEX);
    expect(said()).toContain(COPY.accountWhatsAppOff);
    await press(COPY.accountWhatsAppAdd);

    type(WHATSAPP_AUTH_COPY.numberLabel, "600 100 200");
    await press(WHATSAPP_AUTH_COPY.sendCode);
    expect(said()).toContain(WHATSAPP_COPY.invalid);
    expect(api.updateUser).not.toHaveBeenCalled();

    type(WHATSAPP_AUTH_COPY.numberLabel, "+48 600 100 200");
    api.updateUser.mockResolvedValueOnce({ data: { user: { phone: "" } }, error: null });
    await press(WHATSAPP_AUTH_COPY.sendCode);
    expect(api.updateUser).toHaveBeenCalledWith({ phone: "+48600100200" });

    type(WHATSAPP_AUTH_COPY.codeTitle, "111111");
    api.verifyOtp.mockResolvedValueOnce({ data: { user: null }, error: { message: "Token has expired or is invalid" } });
    await press(WHATSAPP_AUTH_COPY.continue);
    expect(said()).toContain(WHATSAPP_AUTH_COPY.wrongCode);

    type(WHATSAPP_AUTH_COPY.codeTitle, "482916");
    api.verifyOtp.mockResolvedValueOnce({ data: { user: { phone: "48600100200" } }, error: null });
    await press(WHATSAPP_AUTH_COPY.continue);
    expect(api.verifyOtp).toHaveBeenLastCalledWith({ phone: "+48600100200", token: "482916", type: "phone_change" });
    expect(said()).toContain(COPY.accountWhatsAppOn("+48600100200"));
    expect(button(COPY.accountWhatsAppAdd)).toBeUndefined();
  });

  it("a WhatsApp account without email has only the WhatsApp row", async () => {
    await show({ email: "", hasPassword: false, provider: "WhatsApp" }, "+48600100200");
    expect(said()).toContain(COPY.accountWhatsAppOn("+48600100200"));
    expect(button(COPY.accountChange)).toBeUndefined();
    expect(button(COPY.accountSetPassword)).toBeUndefined();
  });
});
