"use client";

import { useCallback, useEffect, useState } from "react";
import SectionCard from "@/components/admin/SectionCard";
import { adminApi, type MetricLabel } from "@/lib/api/admin-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save } from "lucide-react";

const DEFAULT_METRICS: MetricLabel[] = [
  { code: "pace", left_label: "Too slow", right_label: "Too fast" },
  { code: "strength", left_label: "Weak", right_label: "Powerful" },
  { code: "fillers", left_label: "Many fillers", right_label: "Clean speech" },
  { code: "emotion", left_label: "Not achieved", right_label: "Fully achieved" },
  { code: "keywords", left_label: "Missing keywords", right_label: "All keywords" },
];

const METRIC_TITLES: Record<string, string> = {
  pace: "Pace",
  strength: "Strength",
  fillers: "Fillers",
  emotion: "Emotion Achieved",
  keywords: "Keywords Used",
};

export default function AdminMetricsPage() {
  const [metrics, setMetrics] = useState<MetricLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .getMetricLabels()
      .then((list) => {
        if (list.length > 0) setMetrics(list);
        else setMetrics(DEFAULT_METRICS);
      })
      .catch(() => setMetrics(DEFAULT_METRICS))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  const updateMetric = (code: string, field: "left_label" | "right_label", value: string) => {
    setMetrics((prev) =>
      prev.map((m) => (m.code === code ? { ...m, [field]: value } : m))
    );
  };

  const save = () => {
    setSaving(true);
    adminApi
      .putMetricLabels(metrics)
      .then(() => {
        toast.success("Metric labels saved");
        load();
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setSaving(false));
  };

  if (loading) return <p className="text-muted-foreground">Loading metrics…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Metrics</h1>
          <p className="text-muted-foreground mt-1">
            Configure the label pairs shown in biofeedback UI and reports
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> Save
        </Button>
      </div>

      <div className="rounded-lg border border-primary/30 bg-accent/30 px-4 py-3 text-sm text-foreground">
        Note: Label changes affect future sessions only. Past recordings keep their original label snapshot.
      </div>

      <SectionCard title="Metric label pairs" description="Left = low end, Right = high end of each metric spectrum.">
        <div className="space-y-4">
          {metrics.map((m) => (
            <div
              key={m.code}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <p className="font-semibold">{METRIC_TITLES[m.code] ?? m.code}</p>
              <p className="text-xs text-muted-foreground mb-3">Code: {m.code}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Left Label (Low)</label>
                  <Input
                    value={m.left_label}
                    onChange={(e) => updateMetric(m.code, "left_label", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Right Label (High)</label>
                  <Input
                    value={m.right_label}
                    onChange={(e) => updateMetric(m.code, "right_label", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
