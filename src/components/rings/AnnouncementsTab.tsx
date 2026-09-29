"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRings, type FeatureRing, type RingAnnouncement } from "@/services/api/adminRings";
import { Chip, Toast, describeRefusal } from "./panelShared";

/* The Announcements tab. When a person's ring reaches a feature that needs
 * consent, the app shows this on their next login. The wording is
 * user-facing copy and is the founder's to write before it ships; every seed
 * is a "[founder copy]" placeholder. A feature without a consent purpose
 * announces nothing unless a row is added here. */

const PLACEHOLDER_PREFIX = "[founder copy]";

function AnnouncementCard({
  feature,
  existing,
  onSave,
}: {
  feature: FeatureRing;
  existing: RingAnnouncement | null;
  onSave: (body: { title: string; body: string; requires_consent: boolean; retired?: boolean }) => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? `${PLACEHOLDER_PREFIX} `);
  const [body, setBody] = useState(existing?.body ?? `${PLACEHOLDER_PREFIX} `);
  const requiresConsent = Boolean(feature.consent_purpose);
  const policyMissing = feature.counts?.consent_policy_available === false;
  return (
    <div className="rounded-lg border border-black/10 p-4">
      <h3 className="font-mono text-sm font-semibold">{feature.feature}</h3>
      <div className="mt-1 flex flex-wrap gap-1 text-xs">
        {feature.consent_purpose ? <Chip tone="hold">{feature.consent_purpose}</Chip> : <Chip tone="on">no consent</Chip>}
        {existing?.retired_at ? <Chip tone="off">retired</Chip> : null}
        {policyMissing ? <span className="text-foreground/60">policy not registered yet: the “yes” stays disabled on the sheet</span> : null}
      </div>
      <label className="mt-2 block text-xs text-foreground/60" htmlFor={`title-${feature.feature}`}>
        Title
      </label>
      <input
        id={`title-${feature.feature}`}
        className="w-full rounded-md border border-black/10 bg-background px-2 py-1 text-sm"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <label className="mt-2 block text-xs text-foreground/60" htmlFor={`body-${feature.feature}`}>
        Body
      </label>
      <textarea
        id={`body-${feature.feature}`}
        className="min-h-16 w-full rounded-md border border-black/10 bg-background px-2 py-1 text-sm"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      {!title.startsWith(PLACEHOLDER_PREFIX) || !body.startsWith(PLACEHOLDER_PREFIX) ? (
        <p className="mt-1 text-xs text-amber-700">This is user-facing copy: it ships only with founder sign-off.</p>
      ) : null}
      <div className="mt-2 flex gap-2">
        <button type="button" className="rounded-md bg-primary px-3 py-1 text-sm text-white" onClick={() => onSave({ title, body, requires_consent: requiresConsent })}>
          Save (re-announces)
        </button>
        {existing && !existing.retired_at ? (
          <button type="button" className="rounded-md border border-black/10 px-3 py-1 text-sm" onClick={() => onSave({ title, body, requires_consent: requiresConsent, retired: true })}>
            Retire
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function AnnouncementsTab() {
  const [features, setFeatures] = useState<FeatureRing[]>([]);
  const [announcements, setAnnouncements] = useState<Record<string, RingAnnouncement>>({});
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rows, list] = await Promise.all([adminRings.features(), adminRings.announcements()]);
    if (rows.ok) setFeatures(rows.value.features);
    else setToast(describeRefusal(rows.code));
    if (list.ok) setAnnouncements(Object.fromEntries(list.value.map((a) => [a.feature, a])));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (feature: string, body: { title: string; body: string; requires_consent: boolean; retired?: boolean }) => {
      const result = await adminRings.setAnnouncement(feature, body);
      setToast(result.ok ? (body.retired ? `Retired the announcement for ${feature}.` : `Saved ${feature}; it is pending again for everyone it reaches.`) : describeRefusal(result.code));
      await load();
    },
    [load]
  );

  const announced = features.filter((f) => announcements[f.feature]);
  const silent = features.filter((f) => !announcements[f.feature]);

  return (
    <div>
      <p className="mb-3 text-sm text-foreground/70">
        A feature announces itself on the person&apos;s next login once their ring reaches it. The feature turns on only after they say yes and, when it needs one, after their consent is recorded on its own screen; a no keeps them exactly where they were.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {announced.map((feature) => (
          <AnnouncementCard key={feature.feature} feature={feature} existing={announcements[feature.feature] ?? null} onSave={(body) => void save(feature.feature, body)} />
        ))}
      </div>
      {silent.length ? (
        <details className="mt-4 rounded-lg border border-black/10 p-3 text-sm">
          <summary className="cursor-pointer">Features without an announcement ({silent.length}): they just appear</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {silent.map((feature) => (
              <AnnouncementCard key={feature.feature} feature={feature} existing={null} onSave={(body) => void save(feature.feature, body)} />
            ))}
          </div>
        </details>
      ) : null}
      <Toast text={toast} />
    </div>
  );
}
