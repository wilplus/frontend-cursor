/**
 * UI locale only. This is deliberately separate from the language used by a
 * speaker's coaching content, transcript, or feedback.
 */

export const UI_LOCALE_COOKIE = "willab-ui-locale";
export const UI_LOCALE_STORAGE_KEY = "willab.uiLocale";

export const UI_LOCALES = ["en", "pl"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

export type UiCopyKey =
  | "practiceRepeatFragment"
  | "practiceWholePresentation"
  | "footerAbout"
  | "footerBlog"
  | "footerPrivacy"
  | "footerBrand"
  | "localeControl"
  | "localeEnglish"
  | "localePolish"
  | "loading"
  | "close"
  | "cancel"
  | "delete"
  | "deleteFailed"
  | "tryAgain"
  | "speakingCoach"
  | "showProjects"
  | "hideProjects"
  | "chooseProject"
  | "startOwnChat"
  | "startNewProject"
  | "createNewProject"
  | "startFirstProject"
  | "startFirstRecording"
  | "projectPickerTitle"
  | "projectLoading"
  | "projectLoadFailed"
  | "projectAnotherTake"
  | "projectUntitledDraft"
  | "projectDraft"
  | "projectDeletionPending"
  | "projectArchive"
  | "projectArchiveFailed"
  | "projectEdit"
  | "projectEditFailed"
  | "projectMoreOptions"
  | "projectDeleteDraftTitle"
  | "projectDeleteDraftBody"
  | "setupCancel"
  | "setupTopicQuestion"
  | "setupTopicPlaceholder"
  | "setupTimeLimitQuestion"
  | "setupOther"
  | "setupMinutes"
  | "setupNoTimeLimit"
  | "setupSlidesQuestion"
  | "setupNext"
  | "setupStartRecording"
  | "setupSkipForNow"
  | "setupDeckAttached"
  | "setupDeckReading"
  | "setupDeckUpload"
  | "setupDeckReplace"
  | "setupDeckPdfOnly"
  | "setupDeckTooLarge"
  | "setupDeckReadTimeout"
  | "setupDeckReachFailed"
  | "setupDeckProxyTooLarge"
  | "setupDeckUnsupported"
  | "setupDeckUnreadable"
  | "setupDeckReadFailed"
  | "feelingsQuestion"
  | "feelingsHelper"
  | "feelingNervous"
  | "feelingExcited"
  | "feelingCalm"
  | "feelingUnsure"
  | "skip"
  | "recordTokensEmpty"
  | "samePresentationAsTake"
  | "sameStandInPresentationAsTakeOne"
  | "newSlides";

/**
 * Polish stays partial until each proposed string has founder approval.
 * `uiText` therefore makes an incomplete translation safe by falling back to
 * the English source string. The project/recording setup entries below were
 * founder-approved for the fixed UI scope on 2026-11-16.
 */
const UI_COPY: Record<UiLocale, Partial<Record<UiCopyKey, string>>> = {
  en: {
    practiceRepeatFragment: "Repeat this fragment",
    practiceWholePresentation: "Rehearse whole presentation",
    footerAbout: "About us",
    footerBlog: "Blog",
    footerPrivacy: "Privacy",
    footerBrand: "WillpowerLab 2026",
    localeControl: "Language",
    localeEnglish: "Use English",
    localePolish: "Use Polish",
    loading: "Loading",
    close: "Close",
    cancel: "Cancel",
    delete: "Delete",
    deleteFailed: "Couldn't delete. Try again.",
    tryAgain: "Try again",
    speakingCoach: "Speaking coach",
    showProjects: "Show projects",
    hideProjects: "Hide projects",
    chooseProject: "Projects",
    startOwnChat: "Start your own chat",
    startNewProject: "Start a new project",
    createNewProject: "Create new project",
    startFirstProject: "Start your first project",
    startFirstRecording: "Start your first recording",
    projectPickerTitle: "What are you recording?",
    projectLoading: "Looking for your projects…",
    projectLoadFailed: "Couldn't load your projects.",
    projectAnotherTake: "Or another take of:",
    projectUntitledDraft: "Untitled draft",
    projectDraft: "Draft",
    projectDeletionPending: "Deletion pending",
    projectArchive: "Archive",
    projectArchiveFailed: "Couldn't archive. Try again.",
    projectEdit: "Edit",
    projectEditFailed: "Couldn't edit. Try again.",
    projectMoreOptions: "More options for {name}",
    projectDeleteDraftTitle: "Delete this draft?",
    projectDeleteDraftBody: "Your unfinished setup answers will be removed.",
    setupCancel: "Cancel setup",
    setupTopicQuestion: "What is the topic?",
    setupTopicPlaceholder: "e.g. my Q3 results pitch",
    setupTimeLimitQuestion: "Do you have a time limit?",
    setupOther: "Other",
    setupMinutes: "Minutes",
    setupNoTimeLimit: "No time limit",
    setupSlidesQuestion: "Have slides to go with it?",
    setupNext: "Next",
    setupStartRecording: "Start recording",
    setupSkipForNow: "Skip for now",
    setupDeckAttached: "Deck attached",
    setupDeckReading: "Reading your deck…",
    setupDeckUpload: "Upload your deck (PDF)",
    setupDeckReplace: "Replace the deck",
    setupDeckPdfOnly: "Upload a PDF. Export your slides to PDF first if they aren't already.",
    setupDeckTooLarge: "That file is over {limit} MB. Try a smaller export.",
    setupDeckReadTimeout: "Reading the deck took too long. Add your slides below.",
    setupDeckReachFailed: "Couldn't reach the lab to read your deck. Add your slides below.",
    setupDeckProxyTooLarge: "That deck is too large to send right now. Export a lighter PDF (a few MB) or add your slides below.",
    setupDeckUnsupported: "That file type isn't supported. Export your slides to PDF and upload that.",
    setupDeckUnreadable: "We couldn't read that deck. Add your slides below.",
    setupDeckReadFailed: "We couldn't read that deck just now. Add your slides below.",
    feelingsQuestion: "How do you feel?",
    feelingsHelper: "Before you step on stage",
    feelingNervous: "Nervous",
    feelingExcited: "Excited",
    feelingCalm: "Calm",
    feelingUnsure: "Not sure",
    skip: "Skip",
    recordTokensEmpty: "You're out of tokens.",
    samePresentationAsTake: "Same presentation as Take {take}",
    sameStandInPresentationAsTakeOne: "Same stand-in presentation as Take 1",
    newSlides: "New slides",
  },
  pl: {
    practiceRepeatFragment: "Powtórz ten fragment",
    practiceWholePresentation: "Przećwicz całą prezentację",
    loading: "Wczytywanie",
    close: "Zamknij",
    cancel: "Anuluj",
    delete: "Usuń",
    deleteFailed: "Nie udało się usunąć. Spróbuj ponownie.",
    tryAgain: "Spróbuj ponownie",
    speakingCoach: "Trener wystąpień",
    showProjects: "Pokaż projekty",
    hideProjects: "Ukryj projekty",
    chooseProject: "Projekty",
    startNewProject: "Rozpocznij nowy projekt",
    createNewProject: "Utwórz nowy projekt",
    startFirstProject: "Rozpocznij pierwszy projekt",
    startFirstRecording: "Rozpocznij pierwsze nagranie",
    projectPickerTitle: "Co nagrywasz?",
    projectLoading: "Szukamy Twoich projektów…",
    projectLoadFailed: "Nie udało się wczytać Twoich projektów.",
    projectAnotherTake: "Lub kolejne nagranie projektu:",
    projectUntitledDraft: "Wersja robocza bez tytułu",
    projectDraft: "Wersja robocza",
    projectDeletionPending: "Oczekuje na usunięcie",
    projectArchive: "Archiwizuj",
    projectArchiveFailed: "Nie udało się zarchiwizować. Spróbuj ponownie.",
    projectMoreOptions: "Więcej opcji dla: {name}",
    projectDeleteDraftTitle: "Usunąć tę wersję roboczą?",
    projectDeleteDraftBody: "Twoje niedokończone odpowiedzi konfiguracyjne zostaną usunięte.",
    setupCancel: "Anuluj konfigurację",
    setupTopicQuestion: "Jaki jest temat?",
    setupTopicPlaceholder: "np. prezentacja wyników za trzeci kwartał",
    setupTimeLimitQuestion: "Czy masz limit czasu?",
    setupOther: "Inny",
    setupMinutes: "Minuty",
    setupNoTimeLimit: "Bez limitu czasu",
    setupSlidesQuestion: "Czy masz do tego slajdy?",
    setupNext: "Dalej",
    setupStartRecording: "Rozpocznij nagrywanie",
    setupSkipForNow: "Pomiń na razie",
    setupDeckAttached: "Prezentacja załączona",
    setupDeckReading: "Wczytujemy prezentację…",
    setupDeckUpload: "Prześlij prezentację (PDF)",
    setupDeckReplace: "Zastąp prezentację",
    setupDeckPdfOnly: "Prześlij plik PDF. Jeśli slajdy nie są jeszcze w formacie PDF, najpierw je wyeksportuj.",
    setupDeckTooLarge: "Ten plik ma ponad {limit} MB. Wyeksportuj mniejszy plik.",
    setupDeckReadTimeout: "Wczytywanie prezentacji trwało zbyt długo. Dodaj slajdy poniżej.",
    setupDeckReachFailed: "Nie udało się połączyć z usługą odczytu prezentacji. Dodaj slajdy poniżej.",
    setupDeckProxyTooLarge: "Ta prezentacja jest teraz zbyt duża do przesłania. Wyeksportuj lżejszy plik PDF (kilka MB) albo dodaj slajdy poniżej.",
    setupDeckUnsupported: "Ten typ pliku nie jest obsługiwany. Wyeksportuj slajdy do PDF i prześlij ten plik.",
    setupDeckUnreadable: "Nie udało się odczytać tej prezentacji. Dodaj slajdy poniżej.",
    setupDeckReadFailed: "Nie udało się teraz odczytać tej prezentacji. Dodaj slajdy poniżej.",
    feelingsQuestion: "Jak się czujesz?",
    feelingsHelper: "Zanim zaczniesz mówić",
    feelingNervous: "Czuję stres",
    feelingExcited: "Czuję ekscytację",
    feelingCalm: "Czuję spokój",
    feelingUnsure: "Nie wiem",
    skip: "Pomiń",
    recordTokensEmpty: "Nie masz już tokenów.",
    samePresentationAsTake: "Ta sama prezentacja co w nagraniu {take}",
    sameStandInPresentationAsTakeOne: "Ta sama prezentacja zastępcza co w nagraniu 1",
    newSlides: "Nowe slajdy",
  },
};

export function uiText(locale: UiLocale, key: UiCopyKey): string {
  return UI_COPY[locale][key] ?? UI_COPY.en[key] ?? key;
}

export function uiTextWith(
  locale: UiLocale,
  key: UiCopyKey,
  values: Readonly<Record<string, string | number>>,
): string {
  return uiText(locale, key).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
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

/** The already-resolved app locale in a browser. Manual choice wins, then the
 * server-rendered html locale. Content language is deliberately not read. */
export function currentUiLocale(): UiLocale {
  const stored = storedUiLocale();
  if (stored) return stored;
  if (typeof document === "undefined") return "en";
  return (
    normalizeUiLocale(document.documentElement.lang) ??
    normalizeUiLocale(document.documentElement.dataset.uiLocale) ??
    "en"
  );
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
