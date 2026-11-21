import LoadingState from "../LoadingState";

/* -------------------------------------------------------------------------- */
/*  WalkLoading — the walk's page/step wait uses the shared centered loader.   */
/*  In-conversation AI replies still use TypingDots; this is the empty surface  */
/*  shown while a route or walk step itself is not ready.                       */
/* -------------------------------------------------------------------------- */

export default function WalkLoading() {
  return (
    <div data-walk-loading className="flex min-h-0 flex-1">
      <LoadingState placement="surface" />
    </div>
  );
}
