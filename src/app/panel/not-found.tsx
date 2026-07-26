import PanelNotFound from "@/components/life/PanelNotFound";

/** A /panel URL with no matching route. Same dead end the shell renders when
 *  the gate says there is nothing here, so the two are indistinguishable. */
export default function PanelRouteNotFound() {
  return <PanelNotFound />;
}
