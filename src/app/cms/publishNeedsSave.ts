/**
 * Does pressing Publish/Unpublish on the editor have to save first?
 *
 * Yes when the post has no id yet (nothing to publish), and yes when it is
 * being PUBLISHED with unsaved edits: publishing means "what I see", and
 * publishing the stored row would leave the edits on screen only (founder,
 * 6 Oct 2026: a post published this way never reached the list).
 * Unpublishing hides the stored row and never needs a save.
 */
export function publishNeedsSave(args: {
  id: string | null | undefined;
  publishing: boolean;
  dirty: boolean;
}): boolean {
  return !args.id || (args.publishing && args.dirty);
}
