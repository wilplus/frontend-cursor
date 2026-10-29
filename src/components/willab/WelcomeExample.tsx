"use client";

/* -------------------------------------------------------------------------- */
/*  WelcomeExample — "See an example" on the welcome (founder 2026-10-29,     */
/*  N273 item 1, on its prototype). One spoken sentence, the Ideal Text it    */
/*  becomes and the walk's own line for it, before anything is agreed or      */
/*  recorded: nothing here is sent anywhere. "Try it with your talk" does     */
/*  what Enter the lab does.                                                  */
/*                                                                            */
/*  THE CLIP WAITS FOR A RECORDING. The prototype plays what was said; no      */
/*  recording of this sentence exists yet, and a play button that plays       */
/*  nothing would be a lie. Set EXAMPLE_CLIP_SRC to a recording someone has    */
/*  agreed to share (a file under /public) and the player shows above the     */
/*  words.                                                                    */
/* -------------------------------------------------------------------------- */

/** The recording of the sentence below, once there is one. */
const EXAMPLE_CLIP_SRC: string | null = null;

export const WELCOME_EXAMPLE_COPY = {
  title: "An example",
  said: "What they said",
  ideal: "The Ideal Text",
  feedback: "The feedback",
  tryIt: "Try it with your talk",
  close: "Close",
} as const;

/** What was said, with the words the Ideal Text leaves out struck. */
const SAID: { text: string; cut?: boolean }[] = [
  { text: "“So, " },
  { text: "um", cut: true },
  { text: ", last quarter we, " },
  { text: "we basically", cut: true },
  { text: " doubled our growth, " },
  { text: "and it was, like,", cut: true },
  { text: " from two markets we went into in spring.”" },
];

const IDEAL = "Last quarter our growth doubled, and it came from two markets we entered in spring.";

/** The walk's praise line for a confident moment, and its why. */
const FEEDBACK = "This was your most confident moment. You opened with the number and let it sit.";

const label =
  "self-start text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground";

export default function WelcomeExample({
  onTry,
  onClose,
}: {
  onTry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between pl-6 pr-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {WELCOME_EXAMPLE_COPY.title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={WELCOME_EXAMPLE_COPY.close}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[26rem] flex-col gap-2.5 px-6 pb-6 pt-1">
          <p className={`${label} mt-2.5`}>{WELCOME_EXAMPLE_COPY.said}</p>
          {EXAMPLE_CLIP_SRC ? (
            <audio
              controls
              preload="none"
              src={EXAMPLE_CLIP_SRC}
              className="w-full"
            />
          ) : null}
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {SAID.map((part, i) =>
              part.cut ? (
                <s key={i} className="decoration-red-500">
                  {part.text}
                </s>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )}
          </p>

          <p className={`${label} mt-2.5`}>{WELCOME_EXAMPLE_COPY.ideal}</p>
          <p className="border-l-2 border-foreground pl-3 text-[17px] leading-relaxed text-foreground">
            {IDEAL}
          </p>

          <p className={`${label} mt-2.5`}>{WELCOME_EXAMPLE_COPY.feedback}</p>
          <p className="self-start rounded-[16px] bg-muted px-3.5 py-2.5 text-[15px] leading-normal text-foreground">
            {FEEDBACK}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 justify-center px-6 pb-5 pt-3">
        <button
          type="button"
          onClick={onTry}
          className="group inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-7 text-[14px] font-medium text-background transition hover:bg-foreground/90 active:scale-[0.98]"
        >
          {WELCOME_EXAMPLE_COPY.tryIt}
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full bg-primary transition-transform group-hover:translate-x-0.5"
          />
        </button>
      </div>
    </div>
  );
}
