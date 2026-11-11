"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { readSetup, type SetupRead } from "@/services/api/hostSetup";
import { useUserProfile } from "../../useUserProfile";
import HostSetup from "./HostSetup";
import HostDrafts from "./HostDrafts";
import HostCheck from "./HostCheck";
import ModelsOverlay, { type ModelsScreen } from "../../models/ModelsOverlay";
import { getModelsChatRows } from "@/services/api/models";
import { MODELS_WORDS } from "../../models/modelsCopy";
import { refreshHostWork } from "./hostWork";
import { W } from "./hostSetupCopy";
import { OPEN_EVENT, knowSetup, type OpenDetail } from "./hostSetupDoor";
import { CoverSiteBar } from "../siteBarCover";
import { BarBackContext, EdgeBack, OneBarBack, OneBarContext } from "../../OneTopBar";
import { FrameTitle } from "./SetupBits";

/* -------------------------------------------------------------------------- */
/*  The blank setup in the list of chats (backend N616, N618 item 8): the     */
/*  setup over the list, as wide as Will's chat, when a way in opens it       */
/*  (hostSetupDoor.ts); once set up, the host's own chat is a row like any    */
/*  chat, under their name, and opens it as their people meet it. Behind the  */
/*  ring row `chat_builder`: below it the read is 404, nothing is drawn and   */
/*  no way in opens anything.                                                 */
/* -------------------------------------------------------------------------- */

/** `overWill`: opened from Will's chat (his lines, "I want to edit my
 *  chat"), so it opens over his chat and Back comes back to it (N639). */
type Open = { at: "setup"; detail: OpenDetail; overWill?: boolean };

/** Over Will's chat: the column his chat fills, over all of it (as the coach
 *  panel, backend N627); the chats' front is put away while he is open. */
const OVER_WILL = "fixed inset-0 z-50 bg-background";
const WILL_COLUMN = "relative flex h-full w-full flex-col md:mx-auto md:max-w-3xl";

function useWillColumn() {
  const mark = useRef<HTMLSpanElement | null>(null);
  const [column, setColumn] = useState<Element | null | undefined>(undefined);
  useLayoutEffect(() => setColumn(mark.current?.closest("[data-chats-front]") ?? null), []);
  return { mark, column };
}

export default function HostSetupRows() {
  const [read, setRead] = useState<SetupRead | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [version, setVersion] = useState(0);
  const { profile, isCoach } = useUserProfile();
  const { mark, column } = useWillColumn();
  const [queueTitle, setQueueTitle] = useState("");
  const wantsQueue = open?.at === "setup" && open.detail.open === "teach";
  useEffect(() => {
    if (!wantsQueue) return;
    void getModelsChatRows().then((rows) => {
      const queue = (rows ?? []).find((r) => r.name !== MODELS_WORDS.row_models);
      if (queue) setQueueTitle(queue.name);
    });
  }, [wantsQueue]);
  useEffect(() => {
    let alive = true;
    void readSetup().then((got) => {
      if (!alive) return;
      knowSetup(got);
      setRead(got);
    });
    return () => {
      alive = false;
    };
  }, [version]);
  useEffect(() => () => knowSetup(null), []);
  const columnRef = useRef(column);
  columnRef.current = column;
  // Closed by its own arrow or by the phone's Back: once (OneBarBack).
  const closing = useRef(false);
  useEffect(() => {
    const on = (e: Event) => {
      closing.current = false;
      // Will's chat open: the chats' front stands put away (data-chats-away).
      const overWill = !!columnRef.current?.hasAttribute("data-chats-away");
      setOpen({ at: "setup", detail: (e as CustomEvent<OpenDetail>).detail ?? {}, overWill });
    };
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, []);
  const name = profile?.first_name ?? read?.own_chat?.title ?? "";
  const close = () => {
    closing.current = true;
    setOpen(null);
    setVersion((v) => v + 1);
    // What needs the person is read again once their work is done (N629).
    void refreshHostWork(isCoach);
  };
  const recipe = read?.recipe ?? null;
  const kind = open?.at === "setup" ? open.detail.open : undefined;
  const overWill = open?.at === "setup" && open.overWill === true;
  // Over Will's chat, drawn over the whole of it; else over the list, in the
  // column the list fills.
  const place = (node: ReactNode) =>
    overWill ? createPortal(<div data-over-will="" className={OVER_WILL}><div className={WILL_COLUMN}>{node}</div></div>, document.body)
      : column !== undefined ? (column ? createPortal(node, column) : node) : null;
  // The AI models draw their own overlay, in the same column (N629 item 1),
  // and their own Back; the edge swipe in the iPhone app is that Back.
  if (kind === "models" || kind === "teach" || kind === "start") {
    const detail = open?.at === "setup" ? open.detail : {};
    // From Build's AI models (N642 item 3): a model's own page, or a model
    // of one's own in blocks; Back from there comes back to Build.
    const start: ModelsScreen = kind === "teach" ? { at: "queue" } : kind === "start" ? { at: "blocks" } : detail.modelId ? { at: "page", id: detail.modelId } : { at: "list" };
    const models = (
      <>
        <OneBarContext.Provider value>
          <ModelsOverlay start={start} queueTitle={queueTitle} blocks onClose={close} />
        </OneBarContext.Provider>
        <EdgeBack />
      </>
    );
    return (
      <>
        <span ref={mark} hidden />
        {overWill ? place(models) : models}
      </>
    );
  }
  // Everything that opens over the list opens like a chat: the one bar with
  // its back arrow, and no site bar above it (N632 item 6, N639). The
  // phone's Back is the arrow of the screen on show (OneBarBack).
  const frame = open ? (
    <div data-host-setup="" className="absolute inset-0 z-40 flex flex-col bg-background">
      <CoverSiteBar />
      <SurfaceBack closing={closing} onClose={close}>
        <OverList open={open} read={read} name={name} onClose={close} />
      </SurfaceBack>
    </div>
  ) : null;
  return (
    <>
      {/* One's own chat is the pinned row now, not a row of its own here
          (backend N642 item 2; ChatList). */}
      <span ref={mark} hidden />
      {frame ? place(frame) : null}
    </>
  );
}

/** What opens over the list: the drafted answers, one model's check, the
 *  host's own chat, or the setup (its parts). */
function OverList({ open, read, name, onClose }: { open: Open; read: SetupRead | null; name: string; onClose: () => void }) {
  const recipe = read?.recipe ?? null;
  const detail = open.at === "setup" ? open.detail : {};
  if (detail.open === "drafts") {
    return (
      <FrameTitle.Provider value={W.answersToSendTitle}>
        <HostDrafts onClose={onClose} />
      </FrameTitle.Provider>
    );
  }
  if (detail.open === "check" && detail.modelId) {
    const checked = (recipe?.models ?? []).find((m) => m.model_id === detail.modelId);
    return (
      <FrameTitle.Provider value={W.modelsToCheckTitle}>
        <HostCheck modelId={detail.modelId} question={checked?.q ?? ""} onBack={onClose} onDone={onClose} />
      </FrameTitle.Provider>
    );
  }
  return (
    <FrameTitle.Provider value={W.yourChatTitle}>
    <HostSetup
      name={name}
      recipe={recipe}
      parts={detail.parts ? detail.parts : recipe ? { line: null, parts: read?.parts ?? [] } : null}
      cost={read?.cost ?? null}
      ownChat={read?.own_chat ?? null}
      guess={read?.spec_guess ?? null}
      part={detail.part ?? null}
      onClose={onClose}
    />
    </FrameTitle.Provider>
  );
}

/** The phone's Back over what is open: the arrow of the screen on show, one
 *  step; on the first screen it closes, once. */
function SurfaceBack({ closing, onClose, children }: { closing: { current: boolean }; onClose: () => void; children: ReactNode }) {
  const slot = useRef<(() => boolean) | null>(null);
  const step = () => {
    closing.current = false;
    const went = slot.current?.() ?? false;
    return went && !closing.current;
  };
  return (
    <BarBackContext.Provider value={slot}>
      <OneBarBack step={step} onClose={() => {
        if (!closing.current) onClose();
      }} />
      {children}
    </BarBackContext.Provider>
  );
}
