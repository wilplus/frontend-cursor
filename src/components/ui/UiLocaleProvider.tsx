"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  currentUiLocale,
  persistUiLocale,
  type UiLocale,
} from "@/lib/uiLocale";

type UiLocaleContextValue = {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
};

const UiLocaleContext = createContext<UiLocaleContextValue | null>(null);

function applyUiLocale(locale: UiLocale): void {
  persistUiLocale(locale);
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dataset.uiLocale = locale;
}

/**
 * The app's one reactive UI-locale source.
 *
 * `initialLocale` is resolved by RootLayout from the request country/cookie,
 * so the first client render exactly matches the server HTML. Content language
 * (transcripts, feedback, and coaching) never enters this provider.
 */
export default function UiLocaleProvider({
  initialLocale,
  children,
}: PropsWithChildren<{ initialLocale: UiLocale }>) {
  const [locale, setLocaleState] = useState<UiLocale>(initialLocale);
  const setLocale = useCallback((next: UiLocale) => {
    applyUiLocale(next);
    setLocaleState(next);
  }, []);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <UiLocaleContext.Provider value={value}>{children}</UiLocaleContext.Provider>;
}

/** Mounted app surfaces subscribe here, so a manual choice updates in place. */
export function useUiLocale(): UiLocale {
  return useContext(UiLocaleContext)?.locale ?? currentUiLocale();
}

/**
 * LocaleSwitcher normally uses the shared provider. The local fallback keeps
 * isolated stories/tests usable without creating a second production source.
 */
export function useUiLocaleController(initialLocale?: UiLocale): UiLocaleContextValue {
  const shared = useContext(UiLocaleContext);
  const [standaloneLocale, setStandaloneLocale] = useState<UiLocale>(
    () => initialLocale ?? currentUiLocale(),
  );
  const setStandalone = useCallback((next: UiLocale) => {
    applyUiLocale(next);
    setStandaloneLocale(next);
  }, []);

  return shared ?? { locale: standaloneLocale, setLocale: setStandalone };
}
