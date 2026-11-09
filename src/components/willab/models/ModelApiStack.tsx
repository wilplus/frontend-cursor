"use client";

import type { ShownKey } from "@/services/api/models";
import {
  ModelCardScreen,
  ModelCodeScreen,
  ModelDownloadScreen,
  ModelEarningsScreen,
  ModelKeyScreen,
  ModelPriceScreen,
  ModelTryScreen,
  ModelUsageScreen,
  ModelUseScreen,
} from "./ModelApiScreens";

/* -------------------------------------------------------------------------- */
/*  A model's API and money inside the AI models' one stack (ModelsOverlay):  */
/*                                                                            */
/*    card → Use it in your business → Create a key → the key, once           */
/*         → I copied it → the code → Done → Your usage → Back to the list    */
/*    card → Try it                                                           */
/*                                                                            */
/*  The key is held only by its own screen; "I copied it" swaps that screen   */
/*  for the code, so ‹ never shows it again (MOD-42).                         */
/* -------------------------------------------------------------------------- */

export type ApiScreen =
  | { at: "card"; id: string }
  | { at: "try"; id: string; name: string }
  | { at: "use"; id: string }
  | { at: "key"; id: string; shown: ShownKey }
  | { at: "code"; id: string }
  | { at: "usage"; id: string }
  | { at: "price"; id: string }
  | { at: "earnings" }
  | { at: "download"; id: string };

type Nav = { onBack?: () => void; onClose: () => void };

export default function ModelApiStack({ screen, nav, push, swap, onList }: {
  screen: ApiScreen;
  nav: Nav;
  push: (s: ApiScreen) => void;
  swap: (s: ApiScreen) => void;
  onList: () => void;
}) {
  switch (screen.at) {
    case "card":
      return <CardStep id={screen.id} nav={nav} push={push} />;
    case "try":
      return <ModelTryScreen {...nav} modelId={screen.id} name={screen.name} />;
    case "use":
      return (
        <ModelUseScreen
          {...nav}
          modelId={screen.id}
          onKey={(shown) => swap({ at: "key", id: screen.id, shown })}
          onUsage={() => swap({ at: "usage", id: screen.id })}
          onList={onList}
        />
      );
    case "key":
      return <ModelKeyScreen {...nav} shown={screen.shown} onCopied={() => swap({ at: "code", id: screen.id })} />;
    case "code":
      return <ModelCodeScreen {...nav} modelId={screen.id} onDone={() => swap({ at: "usage", id: screen.id })} />;
    case "usage":
      return <ModelUsageScreen {...nav} modelId={screen.id} onList={onList} />;
    case "price":
      return <ModelPriceScreen {...nav} modelId={screen.id} />;
    case "earnings":
      return <ModelEarningsScreen {...nav} onList={onList} />;
    default:
      return <ModelDownloadScreen {...nav} modelId={screen.id} onList={onList} />;
  }
}

function CardStep({ id, nav, push }: { id: string; nav: Nav; push: (s: ApiScreen) => void }) {
  return (
    <ModelCardScreen
      {...nav}
      modelId={id}
      onUse={() => push({ at: "use", id })}
      onTry={(name) => push({ at: "try", id, name })}
    />
  );
}
