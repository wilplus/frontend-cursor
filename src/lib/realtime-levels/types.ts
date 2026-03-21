export type RealtimeAxisMetric = "strength" | "pitch_baseline" | "pace";

export interface RealtimeAxisDefinition {
  metric: RealtimeAxisMetric;
  label: string;
  negativeHint: string;
  positiveHint: string;
}

export interface RealtimeTrainingStep {
  id: string;
  level: number;
  step: number;
  title: string;
  description: string;
  visualId: string;
  xAxis: RealtimeAxisDefinition;
  yAxis: RealtimeAxisDefinition;
}
