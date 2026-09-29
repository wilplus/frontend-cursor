"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminRings, type RingPerson } from "@/services/api/adminRings";
import { Chip, RingSelect, Toast, describeRefusal } from "./panelShared";

/* The People tab: search, attribute filters, per-person ring, multi-select
 * and bulk set. "Gets" is which rows REACH the person; a row with a consent
 * purpose is shown as asking on login, because the consent is theirs. */

const FILTER_KEYS = ["region", "plan", "language", "role"] as const;

function attribute(person: RingPerson, key: string): string {
  const value = person.attributes[key];
  return value === undefined || value === null ? "—" : String(value);
}

export default function PeopleTab() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [people, setPeople] = useState<RingPerson[]>([]);
  const [defaultRing, setDefaultRing] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkRing, setBulkRing] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    for (const key of FILTER_KEYS) if (filters[key]) query.set(key, filters[key]);
    query.set("limit", "100");
    const result = await adminRings.people(query);
    if (!result.ok) {
      setToast(describeRefusal(result.code));
      return;
    }
    setPeople(result.value.people);
    setDefaultRing(result.value.defaultRing);
  }, [filters, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const setRing = useCallback(
    async (person: RingPerson, ring: number) => {
      if (!person.principal_id) {
        setToast("This account has no owner principal yet; it gets one on first use.");
        return;
      }
      const result = await adminRings.setPerson(person.principal_id, { ring });
      setToast(result.ok ? `${person.email ?? person.user_id} is now ring ${ring}. Features needing consent will ask on their next login.` : describeRefusal(result.code));
      await load();
    },
    [load]
  );

  const applyBulk = useCallback(async () => {
    if (bulkRing === null) {
      setToast("Pick a ring first.");
      return;
    }
    const ids = [...selected];
    if (ids.length === 0) {
      setToast("Select people first.");
      return;
    }
    const result = await adminRings.bulk(ids, bulkRing);
    setToast(result.ok ? `${result.value} people moved to ring ${bulkRing}. One audit row each.` : describeRefusal(result.code));
    setSelected(new Set());
    await load();
  }, [bulkRing, load, selected]);

  const options = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const key of FILTER_KEYS) {
      out[key] = [...new Set(people.map((p) => attribute(p, key)).filter((v) => v !== "—"))].sort();
    }
    return out;
  }, [people]);

  const toggle = (principalId: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(principalId);
      else next.delete(principalId);
      return next;
    });

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <input
          aria-label="Search people"
          className="rounded-md border border-black/10 bg-background px-2 py-1 text-sm"
          placeholder="search name or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {FILTER_KEYS.map((key) => (
          <select
            key={key}
            aria-label={`Filter by ${key}`}
            className="rounded-md border border-black/10 bg-background px-2 py-1 text-sm"
            value={filters[key] ?? ""}
            onChange={(event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }))}
          >
            <option value="">any {key}</option>
            {(options[key] ?? []).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        ))}
        <span className="ml-auto text-foreground/60">
          selected: <b>{selected.size}</b>
        </span>
        <RingSelect label="Set ring for selected" value={bulkRing ?? (defaultRing ?? 0)} onChange={setBulkRing} />
        <button type="button" className="rounded-md bg-primary px-3 py-1 text-sm text-white" onClick={() => void applyBulk()}>
          Apply to selected
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-black/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-foreground/60">
              <th className="px-2 py-2" />
              <th className="px-2 py-2">Person</th>
              <th className="px-2 py-2">Ring</th>
              {FILTER_KEYS.map((key) => (
                <th key={key} className="px-2 py-2">
                  {key}
                </th>
              ))}
              <th className="px-2 py-2">bucket</th>
              <th className="px-2 py-2">Gets</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.user_id}>
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    aria-label={`select ${person.email ?? person.user_id}`}
                    disabled={!person.principal_id}
                    checked={person.principal_id ? selected.has(person.principal_id) : false}
                    onChange={(event) => person.principal_id && toggle(person.principal_id, event.target.checked)}
                  />
                </td>
                <td className="px-2 py-2">
                  {person.name ?? "—"}
                  <div className="font-mono text-[11px] text-foreground/60">{person.email ?? person.user_id}</div>
                </td>
                <td className="px-2 py-2">
                  <RingSelect label={`ring for ${person.email ?? person.user_id}`} value={person.ring} onChange={(ring) => void setRing(person, ring)} />
                  {!person.has_ring_row ? <div className="text-[11px] text-foreground/50">default</div> : null}
                </td>
                {FILTER_KEYS.map((key) => (
                  <td key={key} className="px-2 py-2 text-xs">
                    {attribute(person, key)}
                  </td>
                ))}
                <td className="px-2 py-2 font-mono text-xs">{attribute(person, "bucket")}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap gap-1">
                    {person.reaches.length === 0 ? <span className="text-xs text-foreground/50">defaults only</span> : null}
                    {person.reaches.map((item) => (
                      <Chip key={item.feature} tone={item.consent_purpose ? "hold" : "on"}>
                        {item.feature}
                        {item.consent_purpose ? " · asks on login" : ""}
                      </Chip>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Toast text={toast} />
    </div>
  );
}
