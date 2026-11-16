/** The one public door into the early speaking-coach release (founder,
 *  2026-11-15). Keeping the path in one place prevents another join page
 *  from quietly becoming a second admission route. */
export const EARLY_COACH_ADMISSION_TOKEN = "xLl2I4B-u14RY5yZd1JSR-4K";

export const EARLY_COACH_ADMISSION_PATH = `/c/${EARLY_COACH_ADMISSION_TOKEN}`;

export function isEarlyCoachAdmissionToken(token: string): boolean {
  return token === EARLY_COACH_ADMISSION_TOKEN;
}
