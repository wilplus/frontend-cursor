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
 *  plan D-IT-2). It used to stop at ~10 characters and fade, so "Garage
 *  pitch" read "Garage pitc" with room to spare. Now it takes the room the
 *  header has and an ellipsis appears only when the name truly does not fit
 *  (`truncate` ellipsizes on real overflow and never otherwise). */
const TITLE_CLS =
  "block min-w-0 truncate text-[17px] font-semibold text-foreground";

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
  const headerTitle = title?.trim() || "Your ideal text";
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={TITLE_CLS} title={headerTitle}>
        {headerTitle}
      </span>
    </div>
  );
}
