import LoadingState from "../LoadingState";

/* -------------------------------------------------------------------------- */
/*  WalkLoading — the walk's one loading animation is the app's own: the       */
/*  breathing voice mark at 64px (LoadingState), centred in the screen. No    */
/*  stage, no percentage, no progress (AC-9).                                 */
/* -------------------------------------------------------------------------- */

export default function WalkLoading() {
  return (
    <div data-walk-loading className="flex min-h-0 flex-1 items-center justify-center">
      <LoadingState placement="surface" />
    </div>
  );
}
