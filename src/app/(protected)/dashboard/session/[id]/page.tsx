import type { Metadata } from "next";
import SessionRevealClient from "./SessionRevealClient";

export const metadata: Metadata = {
  title: "Your voice analysis | Willab",
};

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SessionRevealClient sessionId={id} />;
}
