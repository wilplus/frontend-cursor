/**
 * A tab can stay alive across a deployment. In that case Webpack can briefly
 * pair the new ProcessingWait chunk with the already-evaluated, older
 * waitingTips module, whose tree-shaken runtime did not expose WAITING_TIPS.
 * Treat imported collections like API data at this boundary: the waiting
 * screen must keep the recording pipeline mounted even during version skew.
 */
const FALLBACK_WAITING_TIP =
  "Focus on the value your audience needs, not on delivering every sentence perfectly.";

export function availableWaitingTips(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    const tips = value.filter(
      (tip): tip is string => typeof tip === "string" && tip.trim().length > 0
    );
    if (tips.length > 0) return tips;
  }
  return [FALLBACK_WAITING_TIP];
}
