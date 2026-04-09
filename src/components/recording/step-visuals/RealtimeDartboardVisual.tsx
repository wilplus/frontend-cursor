"use client";

import type { UseRealtimeStrengthPaceResult } from "@/hooks/useRealtimeStrengthPace";
import { RealtimeMetricDartboard, type RealtimeMetricDartboardHandle } from "@/components/recording/StrengthPaceDartboard";
import type { RealtimeTrainingStep } from "@/lib/realtime-levels";

interface RealtimeDartboardVisualProps {
  activeStep: RealtimeTrainingStep;
  realtimeStrengthPace: UseRealtimeStrengthPaceResult;
  dartboardRef: React.RefObject<RealtimeMetricDartboardHandle | null>;
  sniperMode?: boolean;
}

export default function RealtimeDartboardVisual({
  activeStep,
  realtimeStrengthPace,
  dartboardRef,
  sniperMode = false,
}: RealtimeDartboardVisualProps) {
  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <div className="flex justify-center w-full">
        <div className={sniperMode ? "w-[55%] min-w-[190px] max-w-[340px]" : "w-[clamp(420px,60vw,680px)]"}>
          <RealtimeMetricDartboard
            ref={dartboardRef}
            xScore={realtimeStrengthPace.xScore}
            yScore={realtimeStrengthPace.yScore}
            xDirection={realtimeStrengthPace.xDirection}
            yDirection={realtimeStrengthPace.yDirection}
            xAxisLabel={activeStep.xAxis.label}
            yAxisLabel={activeStep.yAxis.label}
            xNegativeHint={activeStep.xAxis.negativeHint}
            xPositiveHint={activeStep.xAxis.positiveHint}
            yNegativeHint={activeStep.yAxis.negativeHint}
            yPositiveHint={activeStep.yAxis.positiveHint}
          />
        </div>
      </div>
      {realtimeStrengthPace.isActive ? (
        <p className="text-sm text-muted-foreground text-center">
          {activeStep.xAxis.metric === "pitch_baseline"
            ? `Pitch: ${
                realtimeStrengthPace.pitchDeltaSt == null
                  ? "warming up"
                  : `${realtimeStrengthPace.pitchDeltaSt >= 0 ? "+" : ""}${realtimeStrengthPace.pitchDeltaSt.toFixed(1)} st`
              }`
            : `Strength: ${realtimeStrengthPace.strengthDb.toFixed(0)} dB`}{" "}
          Pace: {Math.round(realtimeStrengthPace.wpmEstimate)} WPM
        </p>
      ) : null}
    </div>
  );
}
