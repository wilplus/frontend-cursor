import NewContentClient from "../page.client";

/**
 * /cms/new — the authoring subpage.
 *
 *   /cms/new                 the fork: Post or Exercise
 *   /cms/new/post/<step>     the post lane
 *   /cms/new/exercise/<step> the exercise lane
 *
 * A catch-all rather than nested routes because all three are one flow with
 * one draft; the segments only say where in it the author is. The step being
 * in the URL is what makes back and refresh land where they were, and what
 * lets the coach's review panel link straight to /cms/new/exercise/1 without
 * ever showing the fork.
 *
 * No Supabase gate here: the CMS is password-gated in the request body, and
 * the client bounces to /cms when the tab has no password.
 */
export const dynamic = "force-dynamic";

export default async function NewContentPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  return <NewContentClient path={path ?? []} />;
}
