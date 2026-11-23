"use client";

import { useEffect } from "react";
import { loadRingState, subscribeRingState } from "@/services/api/rings";
import {
  Appearance,
  DARK_MODE_FEATURE,
  appearanceAvailable,
  applyStyle,
  chosenStyle,
  type Style,
} from "@/lib/phone/appearance";

/** Follows the iPhone's light or dark setting inside the app (backend N678
 *  item 2, N679), while the ring row `dark_mode` is on. Renders nothing. The
 *  website and an app without the Appearance plugin stay light, and never
 *  read the ring state for it. */
export default function NativeAppearance() {
  useEffect(() => {
    if (!appearanceAvailable()) return;
    let live = true;
    let ringOn = false;
    let system: Style | null = null;
    const show = () => {
      if (live) void applyStyle(chosenStyle({ ringOn, system }));
    };
    const handles: { remove: () => Promise<void> }[] = [];

    void loadRingState()
      .then((ring) => {
        ringOn = ring.featuresOn.has(DARK_MODE_FEATURE);
        show();
      })
      .catch(() => undefined);
    const unsubscribe = subscribeRingState((ring) => {
      ringOn = ring.featuresOn.has(DARK_MODE_FEATURE);
      show();
    });
    void Appearance.system()
      .then(({ style }) => {
        system = style;
        show();
      })
      .catch(() => undefined);
    void Appearance.addListener("systemChange", ({ style }) => {
      system = style;
      show();
    })
      .then((h) => (live ? handles.push(h) : void h.remove()))
      .catch(() => undefined);

    return () => {
      live = false;
      unsubscribe();
      handles.forEach((h) => void h.remove());
    };
  }, []);

  return null;
}
