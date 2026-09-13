"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  publishCoachFeedbackLanguage,
  type CoachFeedbackLanguageTarget,
  type CoachGuidanceItem,
} from "@/services/api/coachGuidanceDelivery";

function titleFor(target: CoachFeedbackLanguageTarget): string {
  return target.allowedOutputKind === "rephrase" ? "Rephrase" : "Comment";
}

export default function CoachFeedbackLanguageEditor({
  item,
  target,
  autoFocus = false,
}: {
  item: CoachGuidanceItem;
  target: CoachFeedbackLanguageTarget;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [heads, setHeads] = useState({
    revision: target.expectedCurrentRevisionId,
    delivery: target.expectedCurrentDeliveryId,
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const idempotencyRef = useRef<string | null>(null);

  const submit = async () => {
    if (status === "saving" || !text.trim()) return;
    setStatus("saving");
    setError("");
    idempotencyRef.current ??= crypto.randomUUID();
    const result = await publishCoachFeedbackLanguage({
      item,
      target: {
        ...target,
        expectedCurrentRevisionId: heads.revision,
        expectedCurrentDeliveryId: heads.delivery,
      },
      revisionText: text,
      idempotencyKey: idempotencyRef.current,
    });
    if (!result.ok) {
      setStatus("idle");
      setError(result.error);
      return;
    }
    setHeads({
      revision: result.value.revisionId,
      delivery: result.value.deliveryId,
    });
    setStatus("saved");
  };

  return (
    <section
      className="grid gap-3 rounded-2xl border border-border bg-background p-4"
      aria-label={`${titleFor(target)} editor`}
    >
      <div className="grid gap-1">
        <h3 className="text-[15px] font-semibold text-foreground">
          {titleFor(target)}
        </h3>
        <blockquote className="border-l-2 border-primary/30 pl-3 text-[13px] leading-relaxed text-muted-foreground">
          {target.sourcePassage.text}
        </blockquote>
      </div>
      <label className="grid gap-1.5 text-[12px] font-medium text-muted-foreground">
        {titleFor(target)} for the user
        <textarea
          autoFocus={autoFocus}
          value={text}
          rows={target.allowedOutputKind === "rephrase" ? 4 : 3}
          maxLength={20000}
          onChange={(event) => {
            setText(event.target.value);
            setStatus("idle");
            setError("");
            idempotencyRef.current = null;
          }}
          className="resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-foreground/40"
        />
      </label>
      <button
        type="button"
        onClick={() => void submit()}
        disabled={status === "saving" || !text.trim()}
        className="inline-flex items-center justify-center justify-self-start rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-40"
      >
        {status === "saving" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : null}
        {status === "saved" ? "Saved" : "Save"}
      </button>
      {error ? (
        <p role="alert" className="text-[12px] text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
