/* -------------------------------------------------------------------------- */
/*  pwa — installed-app (standalone) detection + a PWA-origin OAuth marker      */
/* -------------------------------------------------------------------------- */

/** True when running as an installed / standalone PWA rather than a browser tab
 *  (iOS home-screen app, Android/desktop installed PWA). */
export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

const PWA_OAUTH_COOKIE = "willab_oauth_from_pwa";

/** Mark that an OAuth trip was started from the installed PWA. A COOKIE, not
 *  localStorage: query strings on Supabase's redirectTo can be dropped by the
 *  redirect allow-list (see the OAuth buttons), and a same-origin cookie rides
 *  the callback chain instead. Short-lived; cleared on read. The callback page
 *  (which can land in a separate browser tab) uses it to tell PWA users they can
 *  head back to the app — and ONLY them, so the plain web sign-in flow is
 *  unaffected. If the cookie can't cross contexts (a fully separate browser), it
 *  simply never fires and the normal auto-redirect stands. */
export function markOAuthFromPwa(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${PWA_OAUTH_COOKIE}=1; max-age=600; path=/; samesite=lax`;
}

/** Read + clear the PWA-origin OAuth marker. */
export function consumeOAuthFromPwa(): boolean {
  if (typeof document === "undefined") return false;
  const present = document.cookie
    .split("; ")
    .some((c) => c === `${PWA_OAUTH_COOKIE}=1`);
  if (present) {
    document.cookie = `${PWA_OAUTH_COOKIE}=; max-age=0; path=/`;
  }
  return present;
}
