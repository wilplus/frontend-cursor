/** Copy for the post-Take wait. The document language is the app's active UI
 * language when the localized shell is present; the browser language is the
 * safe fallback for isolated screens and older shells. */
export type ProcessingUiLocale = "en" | "pl";

export const PROCESSING_WAIT_COPY: Record<ProcessingUiLocale, string> = {
  en: "Usually about a minute. You can close this screen; processing will continue in the background.",
  pl: "Zwykle trwa to około minuty. Możesz zamknąć ten ekran — przetwarzanie będzie trwało w tle.",
};

export function processingUiLocale(value?: string | null): ProcessingUiLocale {
  const raw =
    value ||
    (typeof document !== "undefined" ? document.documentElement.lang : "") ||
    (typeof navigator !== "undefined" ? navigator.language : "");
  return raw?.toLowerCase().startsWith("pl") ? "pl" : "en";
}

export function processingWaitCopy(value?: string | null): string {
  return PROCESSING_WAIT_COPY[processingUiLocale(value)];
}
