"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IMPORT_LANGUAGES } from "@/services/api/trainingCorpus";
import { saveUserProfile } from "@/services/api/userProfile";
import LoadingState from "./LoadingState";
import OverlayCloseButton from "./OverlayCloseButton";
import { useUserProfile } from "./useUserProfile";

const ISO_LANGUAGE = /^[a-z]{2}$/;
const COMMON_LANGUAGES = IMPORT_LANGUAGES.filter(({ code }) => code !== "");

/**
 * One canonical setup gate for every blind-rating entry point.
 *
 * Language comprehension decides which clips reach the queue. It is not a
 * confidence answer, a user attribute inferred from locale, or a model input.
 */
export default function RaterLanguageGate({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose?: () => void;
}) {
  const { profile, loading, isCoach } = useUserProfile();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const customCode = custom.trim().toLowerCase();
  const values = useMemo(() => {
    const out = new Set(selected);
    if (ISO_LANGUAGE.test(customCode)) out.add(customCode);
    return Array.from(out).sort();
  }, [customCode, selected]);

  if (saved || (isCoach && (profile?.proficient_languages?.length ?? 0) > 0)) {
    return <>{children}</>;
  }

  if (loading) {
    return <LoadingState placement="viewport" />;
  }

  // The containing coach surface remains responsible for its role fence.
  // This component only adds the language-routing contract for actual coaches.
  if (!isCoach) return <>{children}</>;

  if (profile?.proficient_languages === undefined) {
    return (
      <main className="fixed inset-0 z-[60] flex items-center justify-center bg-background px-6">
        {onClose && (
          <OverlayCloseButton
            onClick={onClose}
            className="absolute right-4 top-4"
          />
        )}
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Language setup is not available yet. Refresh after the latest update
          has finished deploying.
        </p>
      </main>
    );
  }

  const toggle = (code: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    setError("");
  };

  const submit = async () => {
    if (values.length === 0) {
      setError("Choose at least one language.");
      return;
    }
    if (custom.length > 0 && !ISO_LANGUAGE.test(customCode)) {
      setError("Use a two-letter language code, such as en or pl.");
      return;
    }
    setSaving(true);
    setError("");
    const ok = await saveUserProfile({ proficient_languages: values });
    setSaving(false);
    if (ok) setSaved(true);
    else setError("We could not save this yet. Please try again.");
  };

  return (
    <main className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-background px-5 py-8">
      {onClose && (
        <OverlayCloseButton
          onClick={onClose}
          className="absolute right-4 top-4"
        />
      )}
      <section className="w-full max-w-xl rounded-2xl border border-border bg-background p-5 sm:p-7">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          One-time setup
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Which languages do you understand well enough to judge vocal confidence?
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This only decides which audio reaches your queue. It never changes a
          label or guesses from your location.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {COMMON_LANGUAGES.map(({ code, label }) => {
            const active = selected.has(code);
            return (
              <button
                key={code}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(code)}
                className={
                  "rounded-xl border px-3 py-3 text-left text-sm transition " +
                  (active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-foreground hover:bg-muted")
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        <label className="mt-5 block">
          <span className="text-xs text-muted-foreground">
            Another language (two-letter code)
          </span>
          <input
            value={custom}
            maxLength={2}
            onChange={(event) => {
              setCustom(event.target.value);
              setError("");
            }}
            placeholder="e.g. ja"
            className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm uppercase outline-none focus:border-foreground/40"
          />
        </label>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <Button
          type="button"
          size="lg"
          className="mt-6 w-full rounded-full"
          disabled={saving}
          onClick={() => void submit()}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save and continue
        </Button>
      </section>
    </main>
  );
}
