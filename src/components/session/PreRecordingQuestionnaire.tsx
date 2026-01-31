"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSessionStore } from "@/store/session-store";
import { toast } from "sonner";
import type { ThemeCode } from "@/lib/api/types";

const THEME_LABELS: Record<ThemeCode, string> = {
  presence_grounding: "Presence & grounding",
  clarity_simplicity: "Clarity & simplicity",
  pacing_rhythm: "Pacing & rhythm",
  energy_conviction: "Energy & conviction",
  confidence_comfort: "Confidence & comfort",
  structure_organization: "Structure & organization",
  story_narrative: "Story & narrative",
};

const THEME_CODES: ThemeCode[] = [
  "presence_grounding",
  "clarity_simplicity",
  "pacing_rhythm",
  "energy_conviction",
  "confidence_comfort",
  "structure_organization",
  "story_narrative",
];

export default function PreRecordingQuestionnaire() {
  const { submitQuestionnaire, loading } = useSessionStore();
  const [mood, setMood] = useState<"positive" | "negative" | null>(null);
  const [readiness, setReadiness] = useState<number | null>(null);
  const [inspirationNeeded, setInspirationNeeded] = useState<boolean | null>(null);
  const [themeCode, setThemeCode] = useState<ThemeCode | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mood === null || readiness === null || inspirationNeeded === null) {
      toast.error("Please answer all questions");
      return;
    }

    await submitQuestionnaire({
      mood,
      readiness,
      inspiration_needed: inspirationNeeded,
      ...(themeCode ? { theme_code: themeCode } : {}),
    });
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Before recording, check in</h3>
          <p className="text-sm text-muted-foreground">
            Answer 3 quick questions to personalize your session
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Question 1: Mood */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              1) How do you feel right now?
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setMood("positive")}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  mood === "positive"
                    ? "border-primary bg-primary/20 shadow-md scale-105 ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <span className={`text-4xl ${mood === "positive" ? "scale-125" : ""} transition-transform`}>
                  🙂
                </span>
                <p className={`text-sm mt-2 font-medium ${mood === "positive" ? "text-primary" : ""}`}>
                  Good
                </p>
                {mood === "positive" && (
                  <div className="mt-1 text-xs text-primary font-semibold">✓ Selected</div>
                )}
              </button>
              <button
                type="button"
                onClick={() => setMood("negative")}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  mood === "negative"
                    ? "border-primary bg-primary/20 shadow-md scale-105 ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <span className={`text-4xl ${mood === "negative" ? "scale-125" : ""} transition-transform`}>
                  🙁
                </span>
                <p className={`text-sm mt-2 font-medium ${mood === "negative" ? "text-primary" : ""}`}>
                  Not great
                </p>
                {mood === "negative" && (
                  <div className="mt-1 text-xs text-primary font-semibold">✓ Selected</div>
                )}
              </button>
            </div>
          </div>

          {/* Question 2: Readiness */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              2) How ready is your body and mind to speak?
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Not ready</span>
              <div className="flex-1 flex gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setReadiness(num)}
                    className={`flex-1 aspect-square rounded-md border-2 transition-all ${
                      readiness === num
                        ? "border-primary bg-primary text-primary-foreground scale-110"
                        : readiness !== null && readiness > num
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">Very ready</span>
            </div>
            {readiness !== null && (
              <p className="text-xs text-muted-foreground text-center">
                Selected: {readiness}/10
              </p>
            )}
          </div>

          {/* Optional: Theme override */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Theme (optional)
            </label>
            <p className="text-xs text-muted-foreground">
              Leave unset to use the recommended theme, or pick one to override.
            </p>
            <select
              value={themeCode ?? ""}
              onChange={(e) => setThemeCode(e.target.value ? (e.target.value as ThemeCode) : null)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Use recommended</option>
              {THEME_CODES.map((code) => (
                <option key={code} value={code}>
                  {THEME_LABELS[code]}
                </option>
              ))}
            </select>
          </div>

          {/* Question 3: Structure */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              3) Do you want structure for this recording?
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setInspirationNeeded(true)}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  inspirationNeeded === true
                    ? "border-primary bg-primary/20 shadow-md scale-105 ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <span className={`text-4xl ${inspirationNeeded === true ? "scale-125" : ""} transition-transform`}>
                  📋
                </span>
                <p className={`text-sm mt-2 font-medium ${inspirationNeeded === true ? "text-primary" : ""}`}>
                  YES – guide me
                </p>
                {inspirationNeeded === true && (
                  <div className="mt-1 text-xs text-primary font-semibold">✓ Selected</div>
                )}
              </button>
              <button
                type="button"
                onClick={() => setInspirationNeeded(false)}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  inspirationNeeded === false
                    ? "border-primary bg-primary/20 shadow-md scale-105 ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <span className={`text-4xl ${inspirationNeeded === false ? "scale-125" : ""} transition-transform`}>
                  🎯
                </span>
                <p className={`text-sm mt-2 font-medium ${inspirationNeeded === false ? "text-primary" : ""}`}>
                  NO – I'll choose
                </p>
                {inspirationNeeded === false && (
                  <div className="mt-1 text-xs text-primary font-semibold">✓ Selected</div>
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || mood === null || readiness === null || inspirationNeeded === null}
          >
            {loading ? "Starting session..." : "Continue"}
          </Button>
        </form>
      </div>
    </Card>
  );
}
