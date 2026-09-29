"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRings } from "@/services/api/adminRings";
import { Toast, describeRefusal } from "./panelShared";

/* The Defaults tab: the default ring for people with no row, your own ring,
 * and the attributes people can carry. */

const ATTRIBUTE_HELP: Record<string, string> = {
  region: "from the account country (the edge's country header at sign-up, the Phase-1 acceptance after)",
  plan: "free · pro · founder",
  language: "from Accept-Language at sign-up",
  role: "speaker · coach",
  bucket: "0–99, a stable hash of the id, for percentages",
};

function Stepper({ label, value, onChange, hint }: { label: string; value: number | null; onChange: (next: number) => void; hint: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-4">
      <h3 className="text-sm font-semibold">{label}</h3>
      <div className="my-2 text-3xl font-semibold tabular-nums">{value ?? "—"}</div>
      <div className="flex gap-2">
        <button type="button" className="rounded-md border border-black/10 px-3 py-1" disabled={value === null || value <= 0} onClick={() => value !== null && onChange(value - 1)} aria-label={`${label} down`}>
          −
        </button>
        <button type="button" className="rounded-md border border-black/10 px-3 py-1" disabled={value === null} onClick={() => value !== null && onChange(value + 1)} aria-label={`${label} up`}>
          +
        </button>
      </div>
      <p className="mt-2 text-xs text-foreground/60">{hint}</p>
    </div>
  );
}

export default function DefaultsTab() {
  const [defaultRing, setDefaultRing] = useState<number | null>(null);
  const [attributeKeys, setAttributeKeys] = useState<string[]>([]);
  const [me, setMe] = useState<{ principalId: string | null; ring: number | null; featuresOn: string[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [defaults, mine] = await Promise.all([adminRings.getDefault(), adminRings.me()]);
    if (defaults.ok) {
      setDefaultRing(defaults.value.defaultRing);
      setAttributeKeys(defaults.value.attributeKeys);
    } else setToast(describeRefusal(defaults.code));
    if (mine.ok) setMe(mine.value);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const changeDefault = useCallback(
    async (ring: number) => {
      const result = await adminRings.setDefault(ring);
      setToast(result.ok ? `Default ring is now ${ring} for everyone without a row.` : describeRefusal(result.code));
      await load();
    },
    [load]
  );

  const changeMine = useCallback(
    async (ring: number) => {
      if (!me?.principalId) {
        setToast("Your account has no owner principal yet.");
        return;
      }
      const result = await adminRings.setPerson(me.principalId, { ring });
      setToast(result.ok ? `Your ring is now ${ring}.` : describeRefusal(result.code));
      await load();
    },
    [load, me]
  );

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-3">
        <Stepper
          label="Default ring for new accounts"
          value={defaultRing}
          onChange={(ring) => void changeDefault(ring)}
          hint="Applies to everyone without a row of their own, at their next request. Move a person in People to give them a row."
        />
        <Stepper
          label="Your own ring"
          value={me?.ring ?? null}
          onChange={(ring) => void changeMine(ring)}
          hint="Set it to a feature's ring to test; set it back to feel what a default person feels."
        />
        <div className="rounded-lg border border-black/10 p-4">
          <h3 className="text-sm font-semibold">Attributes people can carry</h3>
          <ul className="mt-2 space-y-1 text-xs text-foreground/70">
            {(attributeKeys.length ? attributeKeys : Object.keys(ATTRIBUTE_HELP)).map((key) => (
              <li key={key}>
                <code className="rounded bg-black/5 px-1">{key}</code> {ATTRIBUTE_HELP[key] ?? ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-foreground/60">Rules are an AND of “key is in list”. Nothing else.</p>
        </div>
      </div>
      {me ? (
        <p className="mt-3 text-xs text-foreground/60">
          On for you now: {me.featuresOn.length ? me.featuresOn.join(", ") : "nothing beyond the defaults"}
        </p>
      ) : null}
      <Toast text={toast} />
    </div>
  );
}
