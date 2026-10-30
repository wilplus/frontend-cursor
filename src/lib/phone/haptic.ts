/** A light tick under the finger, as WhatsApp gives when its mic starts.
 *  Android: the Vibration API. iPhone Safari has none, but toggling a
 *  switch checkbox (Safari 17.4+) plays the system's light haptic. Only
 *  works inside the tap itself; anywhere else it quietly does nothing. */
export function tapHaptic(): void {
  if (typeof navigator === "undefined" || typeof document === "undefined") return;
  try {
    if (navigator.vibrate?.(12)) return;
  } catch {
    /* unsupported: try the iPhone's way */
  }
  try {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    label.style.display = "none";
    label.appendChild(input);
    document.body.appendChild(label);
    label.click();
    label.remove();
  } catch {
    /* no haptic on this device */
  }
}
