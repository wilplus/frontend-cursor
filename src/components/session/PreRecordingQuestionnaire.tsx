"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FlowBackLink } from "@/components/ui/flow-back-button";
import { ProgressPillBar } from "@/components/ui/progress-pill-bar";
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

        <ProgressPillBar
          total={TOTAL_STEPS}
          currentIndex={currentStep}
          aria-label={`Step ${currentStep + 1} of ${TOTAL_STEPS}`}
        />

        <p className="text-muted-foreground text-sm text-center mb-4">
          1.{currentStep + 1} of 1.{TOTAL_STEPS}
        </p>

        <form onSubmit={(e) => { e.preventDefault(); goNext(); }} onKeyDown={handleKeyDown} className="space-y-6">
          <div className="relative min-h-[200px] overflow-hidden flex flex-col justify-center">
            {/* Step 0: Mood */}
            {currentStep === 0 && (
              <div key="0" className="animate-fade-in absolute inset-0 w-full space-y-3 pr-1 flex flex-col justify-center">
                <label className="block text-lg sm:text-xl font-bold text-foreground text-center">
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
              <div key="1" className="animate-fade-in absolute inset-0 w-full space-y-3 pr-1 flex flex-col justify-center">
                <label className="block text-lg sm:text-xl font-bold text-foreground text-center">
                  How ready is your body and mind to present?
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

            {/* Step 2: Theme */}
            {currentStep === 2 && (
              <div key="2" className="animate-fade-in absolute inset-0 w-full space-y-3 pr-1 flex flex-col justify-center">
                <label className="block text-lg sm:text-xl font-bold text-foreground text-center">
                  Theme
                </label>
                <select
                  value={themeCode ?? ""}
                  onChange={(e) => setThemeCode(e.target.value ? (e.target.value as ThemeCode) : null)}
                  className="w-full px-4 py-4 bg-card border border-input rounded-xl text-foreground text-lg text-center focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Choose a theme for me</option>
                  {THEME_CODES.map((code) => (
                    <option key={code} value={code}>
                      {THEME_LABELS[code]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Step 3: Guided */}
            {currentStep === 3 && (
              <div key="3" className="animate-fade-in absolute inset-0 w-full space-y-3 pr-1 flex flex-col justify-center">
                <label className="block text-lg sm:text-xl font-bold text-foreground text-center">
                  Do you want to be guided?
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
            {canAdvance && (
              <p className="animate-fade-in text-muted-foreground text-sm text-center mt-3">
                Press <span className="font-medium">Enter ↵</span> or click to continue
              </p>
            )}
            <Button
              type="submit"
              disabled={loading || !canAdvance}
              className="w-full rounded-xl bg-primary py-6 text-base font-semibold text-white hover:opacity-90"
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
