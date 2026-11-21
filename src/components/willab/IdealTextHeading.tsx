/* -------------------------------------------------------------------------- */
/*  IdealTextHeading — what heads an ideal text, on every screen that is one.   */
/*                                                                            */
/*  Founder 2026-07-30. The ideal text has two mounts: the overlay you open    */
/*  from a project, and the post-recording readout you land on after a take    */
/*  (and park and RESUME into). They were the same document under two          */
/*  different heads — the overlay carried the project's title and its state    */
/*  in one bar, while the readout spent that band on nothing at all and put a  */
/*  lone badge on its own row underneath. The founder asked the resumed one    */
/*  to look like any other ideal text, so the head lives here and both mount   */
/*  it. One module, two mounts, not a copy — a copy is how they drifted.       */
/*                                                                            */
/*  The rules it carries are the overlay's, unchanged (founder 2026-07-27):    */
/*  the PROJECT's name heads the screen rather than a fixed label, and the     */
/*  verification state sits BESIDE it rather than on a row of its own.         */
/* -------------------------------------------------------------------------- */

/** THE WHOLE NAME (Ideal Text Final Screens: "Q3 Board pitch" in full; build
 *  plan D-IT-2). The navbar may wrap: a project name is part of the document
 *  identity, so it must not be shortened or clipped beside the controls.
 *  With no project name, a published coach document supplies its empty name. */
import { usePublishedCoach } from "@/lib/willab/chatBuilder/usePublishedCoach";
import { idealEmptyName } from "@/lib/willab/chatBuilder/screenCopy";

const TITLE_CLS =
  "block min-w-0 whitespace-normal break-words text-[17px] font-semibold leading-tight text-foreground";

export default function IdealTextHeading({
  title,
  status,
}: {
  /** The project's own name. Absent (served without one, or no document yet)
   *  → the generic label, which is still a name for what the screen is. */
  title: string | null | undefined;
  /** null → no badge at all. Not an "unknown" state to guess at: a screen with
   *  no served document has nothing to report the coach's position on. */
  status: "verified" | "unverified" | null;
}) {
  const coach = usePublishedCoach();
  const headerTitle = title?.trim() || idealEmptyName(coach);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={TITLE_CLS}>
        {headerTitle}
      </span>
    </div>
  );
}
