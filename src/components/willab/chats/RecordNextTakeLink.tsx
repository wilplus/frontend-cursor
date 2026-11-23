"use client";

import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { ChatLink, ChatLinks } from "../WillQuestion";

type RecordingOffer = {
  suggested_action?: unknown;
  suggested_actions?: unknown;
};

export function offersNextTake(offer?: RecordingOffer | null): boolean {
  return offer?.suggested_action === "record_again" ||
    (Array.isArray(offer?.suggested_actions) && offer.suggested_actions.includes("record_again"));
}

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
