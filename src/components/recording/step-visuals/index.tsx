"use client";

import type { UseRealtimeStrengthPaceResult } from "@/hooks/useRealtimeStrengthPace";
import type { RealtimeTrainingStep } from "@/lib/realtime-levels";
import type { RealtimeMetricDartboardHandle } from "@/components/recording/StrengthPaceDartboard";
import RealtimeDartboardVisual from "./RealtimeDartboardVisual";

interface StepVisualRendererProps {
  activeStep: RealtimeTrainingStep;
  realtimeStrengthPace: UseRealtimeStrengthPaceResult;
  dartboardRef: React.RefObject<RealtimeMetricDartboardHandle | null>;
  sniperMode?: boolean;
}

const STEP_VISUALS = {
  "realtime-dartboard": RealtimeDartboardVisual,
} satisfies Record<string, React.ComponentType<StepVisualRendererProps>>;

export function StepVisualRenderer(props: StepVisualRendererProps) {
  const VisualComponent =
    STEP_VISUALS[props.activeStep.visualId as keyof typeof STEP_VISUALS] ??
    RealtimeDartboardVisual;

  return <VisualComponent {...props} />;
}
