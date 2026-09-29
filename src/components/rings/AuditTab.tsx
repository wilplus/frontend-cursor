"use client";

import { useEffect, useState } from "react";
import { adminRings, type RingChange } from "@/services/api/adminRings";
import { Toast, describeRefusal, formatWhen } from "./panelShared";

/* The Audit tab: the three append-only change tables, newest first. The same
 * rows the readiness monitor reads when it checks that only ring-eligible
 * people wrote canonical rows. */

function describe(change: RingChange): string {
  if (change.kind === "feature") {
    const rule = change.attribute_rule ? ` rule ${JSON.stringify(change.attribute_rule)}` : "";
    return `feature ${String(change.feature)} → ring ${String(change.min_ring)}${rule}${change.killed ? " · KILLED" : ""}${change.one_way ? " · one-way" : ""}`;
  }
  if (change.kind === "principal") {
    return `person ${String(change.principal_id)} → ring ${String(change.ring)} ${JSON.stringify(change.attributes ?? {})}`;
  }
  return `${String(change.key)} → ${JSON.stringify(change.value)}`;
}

export default function AuditTab() {
  const [changes, setChanges] = useState<RingChange[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void adminRings.audit(300).then((result) => {
      if (result.ok) setChanges(result.value);
      else setToast(describeRefusal(result.code));
    });
  }, []);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-black/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-foreground/60">
              <th className="px-2 py-2">When</th>
              <th className="px-2 py-2">Who</th>
              <th className="px-2 py-2">What</th>
            </tr>
          </thead>
          <tbody>
            {changes.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-2 py-3 text-xs text-foreground/50">
                  No changes recorded.
                </td>
              </tr>
            ) : null}
            {changes.map((change) => (
              <tr key={`${change.kind}-${change.id}`}>
                <td className="whitespace-nowrap px-2 py-1 font-mono text-xs">{formatWhen(change.changed_at)}</td>
                <td className="px-2 py-1 font-mono text-xs">{change.changed_by ?? "—"}</td>
                <td className="px-2 py-1 font-mono text-xs">{describe(change)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-foreground/60">Append-only. Every write in this panel is one row here.</p>
      <Toast text={toast} />
    </div>
  );
}
