import type { Metadata } from "next";
import PrivateReviewPage from "./PrivateReviewPage";

export const metadata: Metadata = {
  title: "Private Take review",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page({ params }: { params: { reviewId: string } }) {
  return <PrivateReviewPage key={params.reviewId} reviewId={params.reviewId} />;
}
