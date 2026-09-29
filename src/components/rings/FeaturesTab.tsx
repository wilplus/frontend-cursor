"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRings, parseRule, type FeatureRing } from "@/services/api/adminRings";
import { Chip, RingSelect, Toast, describeRefusal } from "./panelShared";

/* The Features tab: rows are features; ring is a dropdown, the rule a small
 * editor, kill a switch. A killed one-way row is greyed and says so. */

function RuleEditor({ row, onSave }: { row: FeatureRing; onSave: (rule: Record<string, string[]> | null) => void }) {
  const [text, setText] = useState(row.attribute_rule ? JSON.stringify(row.attribute_rule) : "");
  const [error, setError] = useState<string | null>(null);
  const locked = row.one_way && row.killed;
  return (
    <div>
      <input
        aria-label={`rule for ${row.feature}`}
        className="w-44 rounded-md border border-black/10 bg-background px-2 py-1 font-mono text-xs"
        placeholder="none"
        value={text}
        disabled={locked}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const parsed = parseRule(text);
          setError(parsed.error);
          if (!parsed.error) onSave(parsed.rule);
        }}
      />
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}

function FeatureRow({
  row,
  onChange,
  onKill,
}: {
  row: FeatureRing;
  onChange: (body: Partial<FeatureRing>) => void;
  onKill: (killed: boolean) => void;
}) {
  const locked = row.one_way && row.killed;
  const counts = row.counts ?? null;
  return (
    <tr className={row.killed ? "opacity-60" : ""}>
      <td className="px-2 py-2 font-mono text-xs">
        {row.feature} {row.one_way ? <Chip tone="one">one-way</Chip> : null}
        {locked ? (
          <div className="text-[11px] text-rose-700">killed, cannot reopen</div>
        ) : null}
      </td>
      <td className="px-2 py-2">
        <RingSelect
          label={`ring for ${row.feature}`}
          value={row.min_ring}
          disabled={locked}
          onChange={(ring) => onChange({ min_ring: ring })}
        />
      </td>
      <td className="px-2 py-2">
        <RuleEditor row={row} onSave={(rule) => onChange({ attribute_rule: rule })} />
      </td>
      <td className="px-2 py-2">
        {row.consent_purpose ? <Chip tone="hold">{row.consent_purpose}</Chip> : <span className="text-xs text-foreground/50">none</span>}
        {row.consent_purpose && counts && counts.consent_policy_available === false ? (
          <div className="text-[11px] text-foreground/50">policy not registered yet</div>
        ) : null}
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-sm">
        {counts ? (
          <>
            {counts.on}
            {counts.reaches > counts.on ? (
              <span className="text-xs text-foreground/50"> (+{counts.reaches - counts.on} waiting for consent)</span>
            ) : null}
            {counts.default_ring_reaches ? <div className="text-[11px] text-foreground/50">+ everyone on the default ring</div> : null}
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-2 py-2">
        <label className="inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            aria-label={`kill ${row.feature}`}
            checked={row.killed}
            disabled={locked}
            onChange={(event) => onKill(event.target.checked)}
          />
          {row.killed ? "killed" : "live"}
        </label>
      </td>
      <td className="px-2 py-2 text-xs text-foreground/60">
        <input
          aria-label={`note for ${row.feature}`}
          className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-black/10"
          defaultValue={row.note}
          disabled={locked}
          onBlur={(event) => {
            if (event.target.value !== row.note) onChange({ note: event.target.value });
          }}
        />
      </td>
    </tr>
  );
}

export default function FeaturesTab() {
  const [rows, setRows] = useState<FeatureRing[]>([]);
  const [defaultRing, setDefaultRing] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newFeature, setNewFeature] = useState("");

  const load = useCallback(async () => {
    const result = await adminRings.features();
    if (!result.ok) {
      setToast(describeRefusal(result.code));
      return;
    }
    setRows(result.value.features);
    setDefaultRing(result.value.defaultRing);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const change = useCallback(
    async (row: FeatureRing, body: Partial<FeatureRing>) => {
      const result = await adminRings.setFeature(row.feature, {
        min_ring: row.min_ring,
        attribute_rule: row.attribute_rule,
        consent_purpose: row.consent_purpose,
        note: row.note,
        one_way: row.one_way,
        ...body,
      });
      setToast(result.ok ? `Saved ${row.feature}. One audit row.` : describeRefusal(result.code));
      await load();
    },
    [load]
  );

  const kill = useCallback(
    async (row: FeatureRing, killed: boolean) => {
      const result = await adminRings.kill(row.feature, killed);
      if (!result.ok) setToast(describeRefusal(result.code));
      else if (killed && row.one_way) setToast(`Killed ${row.feature}. One-way: the pipe goes to killed and never back.`);
      else setToast(killed ? `Killed ${row.feature}. The next request from anyone is refused; no deploy.` : `Reopened ${row.feature}.`);
      await load();
    },
    [load]
  );

  const create = useCallback(async () => {
    const feature = newFeature.trim();
    if (!feature) return;
    const result = await adminRings.setFeature(feature, { min_ring: 99, attribute_rule: null, consent_purpose: null, note: "", one_way: false });
    setToast(result.ok ? `Created ${feature} at ring 99 (nobody). Move it when ready.` : describeRefusal(result.code));
    setNewFeature("");
    await load();
  }, [load, newFeature]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-sm text-foreground/60">
        <span>{rows.length} rows</span>
        {defaultRing !== null ? <span>· default ring for people with no row: {defaultRing}</span> : null}
        <span className="ml-auto flex items-center gap-2">
          <input
            aria-label="new feature name"
            className="rounded-md border border-black/10 bg-background px-2 py-1 font-mono text-xs"
            placeholder="new_feature_name"
            value={newFeature}
            onChange={(event) => setNewFeature(event.target.value)}
          />
          <button type="button" className="rounded-md border border-black/10 px-2 py-1 text-xs" onClick={() => void create()}>
            Add row
          </button>
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-black/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-foreground/60">
              <th className="px-2 py-2">Feature</th>
              <th className="px-2 py-2">Ring</th>
              <th className="px-2 py-2">Attribute rule</th>
              <th className="px-2 py-2">Consent needed</th>
              <th className="px-2 py-2 text-right">People on</th>
              <th className="px-2 py-2">Kill</th>
              <th className="px-2 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <FeatureRow key={row.feature} row={row} onChange={(body) => void change(row, body)} onKill={(killed) => void kill(row, killed)} />
            ))}
          </tbody>
        </table>
      </div>
      <Toast text={toast} />
    </div>
  );
}
