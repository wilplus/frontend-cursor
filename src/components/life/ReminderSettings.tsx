"use client";

import { useCallback, useState } from "react";
import { REMINDERS, STATUS } from "@/lib/life/copy";
import {
  deleteReminderSubscription,
  fetchReminders,
  saveReminderSettings,
  saveReminderSubscription,
  type LifeReminderSettings,
  type LifeReminderState,
} from "@/services/api/life";
import { PanelCard, Resource, usePanelResource } from "./primitives";

/* -------------------------------------------------------------------------- */
/*  ReminderSettings — the OPT-IN reminders (founder decision 2026-07-30)      */
/*                                                                            */
/*  THE ONE SANCTIONED EXCEPTION to "nothing pings" (L-4 / N3), and exactly    */
/*  as wide as the founder drew it: three slots, every default OFF, and the    */
/*  user flips each switch themselves. Turning the first slot on is what asks  */
/*  the browser for notification permission and registers the push            */
/*  subscription; turning the last one off removes the subscription again, so  */
/*  a fully-off account holds no push capability anywhere.                     */
/*                                                                            */
/*  When the server has no VAPID keys (`publicKey` null) the switches are      */
/*  HIDDEN behind a one-line hint, not shown disabled: a switch that cannot    */
/*  work is a question, and this surface answers questions plainly.            */
/* -------------------------------------------------------------------------- */

type Slot =
  | "morningEnabled"
  | "eveningEnabled"
  | "weeklyEnabled"
  | "monthlyEnabled"
  | "quarterlyEnabled"
  | "yearlyEnabled"
  | "fiveyearEnabled"
  | "tenyearEnabled";

const SLOTS: Array<{ key: Slot; label: string; hint: string }> = [
  { key: "morningEnabled", label: REMINDERS.morningLabel, hint: REMINDERS.morningHint },
  { key: "eveningEnabled", label: REMINDERS.eveningLabel, hint: REMINDERS.eveningHint },
  { key: "weeklyEnabled", label: REMINDERS.weeklyLabel, hint: REMINDERS.weeklyHint },
];

/** The checkout ladder (founder, extended 2026-07-30). Same switches, same
 *  defaults-off rule; each one deep-links to a surface that already exists. */
const CHECKOUT_SLOTS: Array<{ key: Slot; label: string; hint: string }> = [
  { key: "monthlyEnabled", label: REMINDERS.monthlyLabel, hint: REMINDERS.monthlyHint },
  { key: "quarterlyEnabled", label: REMINDERS.quarterlyLabel, hint: REMINDERS.quarterlyHint },
  { key: "yearlyEnabled", label: REMINDERS.yearlyLabel, hint: REMINDERS.yearlyHint },
  { key: "fiveyearEnabled", label: REMINDERS.fiveyearLabel, hint: REMINDERS.fiveyearHint },
  { key: "tenyearEnabled", label: REMINDERS.tenyearLabel, hint: REMINDERS.tenyearHint },
];

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Backed by an explicit ArrayBuffer so the DOM's BufferSource typing (which
  // excludes SharedArrayBuffer) accepts it as an applicationServerKey.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export default function ReminderSettings() {
  const load = useCallback(() => fetchReminders(), []);
  const resource = usePanelResource(load);

  return (
    <PanelCard>
      <h2 className="text-[15px] font-medium text-foreground">
        {REMINDERS.title}
      </h2>
      <Resource resource={resource}>
        {(state) => <ReminderBody state={state} />}
      </Resource>
    </PanelCard>
  );
}

function ReminderBody({ state }: { state: LifeReminderState }) {
  const [settings, setSettings] = useState<LifeReminderSettings>(state.settings);
  const [busySlot, setBusySlot] = useState<Slot | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Hidden with a hint, never a dead switch (publicKey null ⇒ the backend
  // cannot sign a push, so there is nothing to offer yet).
  if (!state.publicKey) {
    return (
      <p className="mt-1 text-sm text-muted-foreground">
        {REMINDERS.unavailable}
      </p>
    );
  }
  const publicKey = state.publicKey;

  async function ensureSubscription(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) ||
        !("Notification" in window)) {
      setNote(REMINDERS.unsupported);
      return false;
    }
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      setNote(REMINDERS.permissionDenied);
      return false;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      setNote(STATUS.error);
      return false;
    }
    await saveReminderSubscription({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
    return true;
  }

  async function dropSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await deleteReminderSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      } else {
        await deleteReminderSubscription();
      }
    } catch {
      // The switches are already off, so nothing can be sent either way; a
      // failed cleanup is retried the next time a slot is toggled off.
    }
  }

  async function toggle(slot: Slot, next: boolean) {
    if (busySlot) return;
    setBusySlot(slot);
    setNote(null);
    const previous = settings;
    try {
      if (next && !(await ensureSubscription())) {
        return;
      }
      const updated = { ...settings, [slot]: next };
      setSettings(updated);
      const saved = await saveReminderSettings({
        [slot]: next,
        // The local day is what a reminder is idempotent against, so the
        // offset rides along on every change and stays current.
        tzOffsetMinutes: -new Date().getTimezoneOffset(),
      });
      setSettings(saved);
      const anyOn = [...SLOTS, ...CHECKOUT_SLOTS].some(
        ({ key }) => saved[key]
      );
      if (!anyOn) {
        // All off, every rung of the ladder ⇒ no push capability left
        // anywhere for this browser.
        await dropSubscription();
      }
    } catch {
      setSettings(previous);
      setNote(STATUS.error);
    } finally {
      setBusySlot(null);
    }
  }

  return (
    <div className="mt-1">
      <p className="text-sm text-muted-foreground">{REMINDERS.offNote}</p>
      <p className="mt-1 text-sm text-muted-foreground">{REMINDERS.intro}</p>

      <div className="mt-4 space-y-3">
        {SLOTS.map(({ key, label, hint }) => (
          <SlotRow
            key={key}
            label={label}
            hint={hint}
            checked={settings[key]}
            busy={busySlot === key}
            onChange={(next) => void toggle(key, next)}
          />
        ))}
      </div>

      <p className="mt-5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {REMINDERS.checkoutsLabel}
      </p>
      <div className="mt-3 space-y-3">
        {CHECKOUT_SLOTS.map(({ key, label, hint }) => (
          <SlotRow
            key={key}
            label={label}
            hint={hint}
            checked={settings[key]}
            busy={busySlot === key}
            onChange={(next) => void toggle(key, next)}
          />
        ))}
      </div>

      {note ? (
        <p className="mt-3 text-sm text-muted-foreground">{note}</p>
      ) : null}
    </div>
  );
}

function SlotRow({
  label,
  hint,
  checked,
  busy,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[15px] text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <SlotSwitch
        label={label}
        checked={checked}
        busy={busy}
        onChange={onChange}
      />
    </div>
  );
}

/** A small switch in the panel's neutral palette — foreground when on, muted
 *  when off. Orange stays reserved for live-action signals, and a settings
 *  toggle is not one. */
function SlotSwitch({
  label,
  checked,
  busy,
  onChange,
}: {
  label: string;
  checked: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={busy}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition disabled:opacity-40 ${
        checked
          ? "border-foreground bg-foreground"
          : "border-border bg-muted"
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all ${
          checked ? "left-6 bg-background" : "left-1 bg-muted-foreground/60"
        }`}
      />
    </button>
  );
}
