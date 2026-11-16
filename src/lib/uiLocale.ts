/**
 * UI locale only. This is deliberately separate from the language used by a
 * speaker's coaching content, transcript, or feedback.
 */

export const UI_LOCALE_COOKIE = "willab-ui-locale";
export const UI_LOCALE_STORAGE_KEY = "willab.uiLocale";

export const UI_LOCALES = ["en", "pl"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

export type UiCopyKey =
  | "footerAbout"
  | "footerBlog"
  | "footerPrivacy"
  | "footerBrand"
  | "localeControl"
  | "localeEnglish"
  | "localePolish";

/**
 * Polish is intentionally empty until each proposed string has founder
 * approval. `uiText` therefore makes an incomplete translation safe by
 * falling back to the English source string.
 */
const UI_COPY: Record<UiLocale, Partial<Record<UiCopyKey, string>>> = {
  en: {
    footerAbout: "About us",
    footerBlog: "Blog",
    footerPrivacy: "Privacy",
    footerBrand: "WillpowerLab 2026",
    localeControl: "Language",
    localeEnglish: "Use English",
    localePolish: "Use Polish",
  },
  pl: {},
};

export function uiText(locale: UiLocale, key: UiCopyKey): string {
  return UI_COPY[locale][key] ?? UI_COPY.en[key] ?? key;
}

export function normalizeUiLocale(value: string | null | undefined): UiLocale | null {
  const normalized = value?.trim().toLowerCase();
  return normalized === "en" || normalized === "pl" ? normalized : null;
}

/** Country headers used by the supported edge/server deployments. */
const COUNTRY_HEADERS = [
  "x-vercel-ip-country",
  "cf-ipcountry",
  "x-country",
] as const;

type HeaderReader = { get(name: string): string | null };

function normalizeCountry(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

export function countryFromRequestHeaders(headers: HeaderReader): string | null {
  for (const name of COUNTRY_HEADERS) {
    const country = normalizeCountry(headers.get(name));
    if (country) return country;
  }
  return null;
}

export function resolveUiLocale({
  persistedOverride,
  country,
}: {
  persistedOverride?: string | null;
  country?: string | null;
}): UiLocale {
  const override = normalizeUiLocale(persistedOverride);
  if (override) return override;
  return normalizeCountry(country) === "PL" ? "pl" : "en";
}

export function resolveUiLocaleFromRequest(
  headers: HeaderReader,
  persistedOverride?: string | null,
): UiLocale {
  return resolveUiLocale({
    persistedOverride,
    country: countryFromRequestHeaders(headers),
  });
}

export function storedUiLocale(): UiLocale | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeUiLocale(window.localStorage.getItem(UI_LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function persistUiLocale(locale: UiLocale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, locale);
  } catch {
    // Private browsing and locked-down web views can deny localStorage.
  }
  document.cookie = `${UI_LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
