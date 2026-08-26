import LoadingState from "@/components/willab/LoadingState";

/** Route-level wait: the one circular logo loader, fullscreen. The Journal
 *  index and posts are server-fetched (ISR), so a cold navigation here is the
 *  one public path that can actually stall. */
export default function Loading() {
  return <LoadingState placement="viewport" />;
}
