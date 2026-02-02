"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FlowBackLink } from "@/components/ui/flow-back-button";
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

const TOTAL_STEPS = 4;

export default function PreRecordingQuestionnaire() {
  const router = useRouter();
  const { submitQuestionnaire, abandonCurrentSession, loading } = useSessionStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [mood, setMood] = useState<"positive" | "negative" | null>(null);
  const [readiness, setReadiness] = useState<number | null>(null);
  const [themeCode, setThemeCode] = useState<ThemeCode | null>(null);
  const [inspirationNeeded, setInspirationNeeded] = useState<boolean | null>(null);

  const handleBackToDashboard = () => {
    abandonCurrentSession();
    router.push("/dashboard");
  };

  const goBack = useCallback(() => {
    if (currentStep === 0) {
      handleBackToDashboard();
    } else {
      setCurrentStep((s) => Math.max(0, s - 1));
    }
  }, [currentStep]);

  const canAdvance = (() => {
    switch (currentStep) {
      case 0:
        return mood !== null;
      case 1:
        return readiness !== null;
      case 2:
        return true;
      case 3:
        return inspirationNeeded !== null;
      default:
        return false;
    }
  })();

  const doSubmit = useCallback(async () => {
    if (mood === null || readiness === null || inspirationNeeded === null) {
      toast.error("Please answer all required questions");
      return;
    }
    await submitQuestionnaire({
      mood,
      readiness,
      inspiration_needed: inspirationNeeded,
      ...(themeCode ? { theme_code: themeCode } : {}),
    });
  }, [mood, readiness, inspirationNeeded, themeCode, submitQuestionnaire]);

  const goNext = useCallback(() => {
    if (currentStep === 3) {
      doSubmit();
    } else {
      setCurrentStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
    }
  }, [currentStep, doSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (canAdvance) goNext();
      }
    },
    [canAdvance, goNext]
  );

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Check in before the recording</h3>

        {/* Progress pills */}
        <div
          className="flex gap-1.5 sm:gap-2"
          role="progressbar"
          aria-valuenow={currentStep + 1}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-label={`Step ${currentStep + 1} of ${TOTAL_STEPS}`}
        >
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
            const completed = i < currentStep;
            const current = i === currentStep;
            return (
              <div
                key={i}
                className={`h-2.5 sm:h-3 flex-1 rounded-full transition-all duration-300 ${
                  completed
                    ? "bg-neutral-700 dark:bg-neutral-600"
                    : current
                      ? "bg-neutral-400 dark:bg-neutral-500"
                      : "bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600"
                }`}
              />
            );
          })}
        </div>

        <p className="text-sm text-muted-foreground">
          Question {currentStep + 1} of {TOTAL_STEPS}
        </p>

        <form onSubmit={(e) => { e.preventDefault(); goNext(); }} onKeyDown={handleKeyDown} className="space-y-6">
          <div className="min-h-[180px] sm:min-h-[200px]">
            {/* Step 0: Mood */}
            {currentStep === 0 && (
              <div key="mood" className="animate-question-in space-y-3">
                <label className="block text-base font-semibold text-foreground">
                  Do you feel more like:
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setMood("positive")}
                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                      mood === "positive"
                        ? "border-orange-500 shadow-md scale-105 ring-2 ring-orange-500/30"
                        : "border-border hover:border-orange-500/50"
                    }`}
                  >
                    <span className={`text-4xl block ${mood === "positive" ? "scale-125" : ""} transition-transform`}>
                      🙂
                    </span>
                    <p className={`text-sm mt-2 font-medium ${mood === "positive" ? "text-orange-600 dark:text-orange-400" : ""}`}>
                      Good
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMood("negative")}
                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                      mood === "negative"
                        ? "border-orange-500 shadow-md scale-105 ring-2 ring-orange-500/30"
                        : "border-border hover:border-orange-500/50"
                    }`}
                  >
                    <span className={`text-4xl block ${mood === "negative" ? "scale-125" : ""} transition-transform`}>
                      🙁
                    </span>
                    <p className={`text-sm mt-2 font-medium ${mood === "negative" ? "text-orange-600 dark:text-orange-400" : ""}`}>
                      Not great
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Readiness */}
            {currentStep === 1 && (
              <div key="readiness" className="animate-question-in space-y-3">
                <label className="block text-base font-semibold text-foreground">
                  How ready is your body and mind to speak?
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground w-full sm:w-auto">Not ready</span>
                  <div className="flex-1 flex gap-1 min-w-0">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setReadiness(num)}
                        className={`flex-1 aspect-square min-w-[2rem] rounded-lg border-2 transition-all ${
                          readiness === num
                            ? "border-orange-500 scale-110 ring-2 ring-orange-500/30"
                            : readiness !== null && readiness > num
                              ? "border-orange-500/50"
                              : "border-border hover:border-orange-500/50"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground w-full sm:w-auto">Very ready</span>
                </div>
                {readiness !== null && (
                  <p className="text-xs text-muted-foreground text-center">
                    {readiness}/10
                  </p>
                )}
              </div>
            )}

            {/* Step 2: Theme (optional) */}
            {currentStep === 2 && (
              <div key="theme" className="animate-question-in space-y-3">
                <label className="block text-base font-semibold text-foreground">
                  Theme (optional)
                </label>
                <select
                  value={themeCode ?? ""}
                  onChange={(e) => setThemeCode(e.target.value ? (e.target.value as ThemeCode) : null)}
                  className="w-full rounded-lg border-2 border-input bg-background px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="">Default</option>
                  {THEME_CODES.map((code) => (
                    <option key={code} value={code}>
                      {THEME_LABELS[code]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Step 3: Structure */}
            {currentStep === 3 && (
              <div key="structure" className="animate-question-in space-y-3">
                <label className="block text-base font-semibold text-foreground">
                  Do you want structure for this recording?
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setInspirationNeeded(true)}
                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                      inspirationNeeded === true
                        ? "border-orange-500 shadow-md scale-105 ring-2 ring-orange-500/30"
                        : "border-border hover:border-orange-500/50"
                    }`}
                  >
                    <span className={`text-4xl block ${inspirationNeeded === true ? "scale-125" : ""} transition-transform`}>
                      📋
                    </span>
                    <p className={`text-sm mt-2 font-medium ${inspirationNeeded === true ? "text-orange-600 dark:text-orange-400" : ""}`}>
                      YES – guide me
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspirationNeeded(false)}
                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                      inspirationNeeded === false
                        ? "border-orange-500 shadow-md scale-105 ring-2 ring-orange-500/30"
                        : "border-border hover:border-orange-500/50"
                    }`}
                  >
                    <span className={`text-4xl block ${inspirationNeeded === false ? "scale-125" : ""} transition-transform`}>
                      🎯
                    </span>
                    <p className={`text-sm mt-2 font-medium ${inspirationNeeded === false ? "text-orange-600 dark:text-orange-400" : ""}`}>
                      NO – I'll choose
                    </p>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Button
              type="submit"
              disabled={loading || !canAdvance}
              className="w-full rounded-lg bg-orange-200 py-6 text-base font-semibold text-orange-900 hover:bg-orange-300 dark:bg-orange-900/50 dark:text-orange-100 dark:hover:bg-orange-800/50"
            >
              {currentStep === 3
                ? (loading ? "Starting session..." : "Continue")
                : "Next"}
            </Button>
            <FlowBackLink onClick={goBack}>back</FlowBackLink>
          </div>
        </form>
      </div>
    </Card>
  );
}
