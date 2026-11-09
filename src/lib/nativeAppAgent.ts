/* -------------------------------------------------------------------------- */
/*  The iPhone app, told apart from Safari by the server (backend N561 item 1). */
/*  The app adds this word to its web view's user agent (`appendUserAgent` in  */
/*  capacitor.config.ts), so a request says it comes from the app before any   */
/*  script has run. Builds before N561 do not send it; they open on /login.    */
/*  In the browser, `isNativeApp()` (lib/auth/nativeSignIn.ts) is the check.   */
/* -------------------------------------------------------------------------- */

export const APP_USER_AGENT_MARK = "WillpowerLabApp";

/** Whether a request's User-Agent header is the iPhone app's. */
export function isAppUserAgent(userAgent: string | null): boolean {
  return (userAgent ?? "").split(/\s+/).includes(APP_USER_AGENT_MARK);
}
