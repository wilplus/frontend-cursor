import { PENDING_SHORT, REVIEWED } from "@/lib/willab/verificationCopy";

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

/** ~10 characters, then a FADE. A hard clip reads as a rendering bug and an
 *  ellipsis spends a character saying "there is more"; the fade says the same
 *  without taking room, and being a mask to transparency rather than a
 *  gradient in a hard-coded colour it works on whatever the head sits on, in
 *  either theme. Applied ONLY when the title actually overflows — on a short
 *  one it would fade the last real letters of a title that fits. */
const TITLE_CLS =
  "block shrink-0 max-w-[10ch] overflow-hidden whitespace-nowrap text-[17px] font-semibold text-foreground";
const FADE_CLS =
  " [-webkit-mask-image:linear-gradient(to_right,#000_60%,transparent_100%)] [mask-image:linear-gradient(to_right,#000_60%,transparent_100%)]";

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
      <span
        className={
          headerTitle.length > 10 ? TITLE_CLS + FADE_CLS : TITLE_CLS
        }
        title={headerTitle}
      >
        {headerTitle}
      </span>
      {status ? (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium ${
            status === "verified"
              ? "bg-success/10 text-success"
              : "bg-background text-muted-foreground"
          }`}
        >
          {/* PENDING_SHORT is the named exception to the one-wording rule, and
              its condition is exactly this: the badge sitting beside the
              title, where the context already says what is being verified. */}
          {status === "verified" ? REVIEWED : PENDING_SHORT}
        </span>
      ) : null}
    </div>
  );
}
