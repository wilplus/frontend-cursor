/* Whether this device can add the app to its home screen right now, as the
 * Lounge's install offer knows it (useInstallOffer). The Take's summary asks
 * the backend with it, which may then make the home screen that Take's one
 * ask (founder 2026-10-20, one action at a time). */

let installable = false;

export function setInstallable(value: boolean): void {
  installable = value;
}

export function installableNow(): boolean {
  return installable;
}
