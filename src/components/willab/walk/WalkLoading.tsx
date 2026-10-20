import { TypingGlyph } from "../TypingDots";

/* -------------------------------------------------------------------------- */
/*  WalkLoading — the lens's one wait is the typing dots (founder 2026-10-20:  */
/*  "lock in only the bubble 3 dots as waiting, no other waiting animation in  */
/*  this view"): a grey bubble of the walk's size on the left, where the next  */
/*  bubble lands, while other speakers' moments, the summary or a try's check  */
/*  are on their way. No stage, no percentage, no progress (AC-9).            */
/* -------------------------------------------------------------------------- */

export default function WalkLoading() {
  return (
    <div data-walk-loading aria-hidden="true" className="flex">
      <span className="rounded-[22px] bg-muted px-[17px] py-[19px]">
        <TypingGlyph />
      </span>
    </div>
  );
}
