"use client";

import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { offersNextTake, type RecordingOffer } from "@/lib/willab/projectChat";
import { ChatLink, ChatLinks } from "../WillQuestion";

export default function RecordNextTakeLink({ offer, onRecord }: {
  offer?: RecordingOffer | null;
  onRecord: () => void;
}) {
  const locale = useUiLocale();
  if (!offersNextTake(offer)) return null;
  return <ChatLinks>
    <ChatLink label={locale === "pl" ? "Nagraj kolejne podejście" : "Record the next take"} onClick={onRecord} />
  </ChatLinks>;
}
