/* -------------------------------------------------------------------------- */
/*  The words for updating a project's slides (backend N257) and for one      */
/*  project at a time (backend N254), typed exactly as the founder signed     */
/*  them on 29 October 2026 (prototype                                        */
/*  https://claude.ai/artifact/8heRv4BC6fGg7EzuzuTo4A). Change a word only    */
/*  with sign-off.                                                            */
/* -------------------------------------------------------------------------- */

export const UPDATE_SLIDES_COPY = {
  /** The Ideal Text ⋯ item and its sheet's title, for a project with no deck. */
  add: "Add slides",
  /** The same, for a project that has one; also the chat card's title. */
  update: "Update slides",
  body: "Upload the new PDF. Your next Take uses it.",
  upload: "Upload PDF",
  cancel: "Cancel",
  ready: (take: number) => `New slides ready for Take ${take}.`,
} as const;

/** "Settings" in place of "Data & consent" since N260 (founder 2026-10-29). */
export const ONE_PROJECT_COPY = {
  title: "One project at a time",
  body: (current: string) =>
    `“${current}” will be archived. Its Takes and Ideal Text stay safe, and you can bring it back from Settings.`,
  continue: "Continue",
  cancel: "Cancel",
} as const;
