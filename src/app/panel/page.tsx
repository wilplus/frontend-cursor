import { redirect } from "next/navigation";

/** /panel has no page of its own. Principles is the tab that owns first run,
 *  setup and results, so it is the entrance (spec §6.2). */
export default function PanelIndex() {
  redirect("/panel/principles");
}
