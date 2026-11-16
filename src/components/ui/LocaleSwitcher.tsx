"use client";

import { Check, Globe2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  normalizeUiLocale,
  persistUiLocale,
  storedUiLocale,
  UI_LOCALES,
  type UiLocale,
  uiText,
} from "@/lib/uiLocale";

export default function LocaleSwitcher({
  initialLocale,
}: {
  initialLocale: UiLocale;
}) {
  const [locale, setLocale] = useState(initialLocale);

  useEffect(() => {
    const stored = normalizeUiLocale(storedUiLocale());
    if (stored && stored !== initialLocale) {
      setLocale(stored);
      persistUiLocale(stored);
    }
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function choose(next: UiLocale) {
    setLocale(next);
    persistUiLocale(next);
  }

  return (
    <div className="flex items-center gap-1" aria-label={uiText(locale, "localeControl")}>
      <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
      <div className="flex items-center gap-0.5" role="group" aria-label={uiText(locale, "localeControl")}>
        {UI_LOCALES.map((option) => {
          const active = option === locale;
          const label = option === "en" ? uiText(locale, "localeEnglish") : uiText(locale, "localePolish");
          return (
            <button
              key={option}
              type="button"
              aria-label={label}
              aria-pressed={active}
              className="inline-flex min-h-6 items-center gap-0.5 rounded px-1.5 font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={() => choose(option)}
            >
              <span>{option.toUpperCase()}</span>
              {active ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
