"use client";

import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { offersNextTake, type RecordingOffer } from "@/lib/willab/projectChat";
import { ChatLink, ChatLinks } from "../WillQuestion";

/** The words of the link, also the project chat's "+" item. */
export function recordNextTakeLabel(locale: string) {
  return locale === "pl" ? "Nagraj kolejne podejście" : "Record the next take";
}

export default function RecordNextTakeLink({ offer, onRecord }: {
  offer?: RecordingOffer | null;
  onRecord: () => void;
}) {
  const locale = useUiLocale();
  if (!offersNextTake(offer)) return null;
  return <ChatLinks>
    <ChatLink label={recordNextTakeLabel(locale)} onClick={onRecord} />
  </ChatLinks>;
}
