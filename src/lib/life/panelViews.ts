/* -------------------------------------------------------------------------- */
/*  panelViews — the one list of what each panel view reads                    */
/*                                                                            */
/*  The shell's warm-up and the views themselves must agree on these keys, or  */
/*  the warm-up fetches into slots nobody reads. A test pins the keys to       */
/*  LIFE_VIEWS, so a view added to the menu without a loader here fails the    */
/*  suite instead of silently staying slow.                                    */
/*                                                                            */
/*  Zero-argument loaders only. A parametrised read (the principle DETAIL, a   */
/*  filtered list) has no stable identity to cache under one key, so those     */
/*  stay uncached and load as they always did.                                 */
/* -------------------------------------------------------------------------- */

import {
  fetchDay,
  fetchGoals,
  fetchItems,
  fetchPrinciples,
  fetchStrategy,
  fetchTimeline,
  fetchWeek,
} from "@/services/api/life";

export const PANEL_VIEW_LOADERS: Record<string, () => Promise<unknown>> = {
  principles: () => fetchPrinciples(),
  wins: () => fetchItems("win"),
  phrases: () => fetchItems("phrase"),
  today: () => fetchDay(),
  week: () => fetchWeek(),
  goals: () => fetchGoals(),
  timeline: () => fetchTimeline(),
  distractions: () => fetchItems("distraction"),
  strategy: () => fetchStrategy(),
};
