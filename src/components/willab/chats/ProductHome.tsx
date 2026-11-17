"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { uiText, type UiLocale } from "@/lib/uiLocale";
import { fetchTrainings, type TrainingArc } from "@/services/api/trainings";
import LoadingState, { VoiceMark } from "../LoadingState";
import { useLoungeThreadMaybe } from "../LoungeThreadContext";
import { PdfPage } from "../pdfSlides";
import { ChatListRow, PersonCircle, WillMark } from "./ChatList";
import { OwnAvatar } from "./hostsetup/ChatIconPicker";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";
import { OWN_CHAT_EVENT, ownChatTitle, readOwnChat, rememberOwnName, startOwnChat } from "@/lib/willab/chatBuilder/ownChat";
import { W } from "./hostsetup/hostSetupCopy";
import { readTalkDraft, TALK_DRAFT_EVENT } from "@/lib/willab/chatBuilder/talkDraft";

/* -------------------------------------------------------------------------- */
/*  The speaking-coach home. The old people-chat list still reads its backend  */
/*  data for delivery and message side effects, but it is not this product's   */
/*  primary way into speaking practice.                                      */
/*                                                                            */
/*  The first paint waits for both durable sources: the project index and the  */
/*  Speaking coach thread. This prevents a previous project's shell or a       */
/*  half-loaded coach view from being presented as the current home.           */
/* -------------------------------------------------------------------------- */

type Status = "loading" | "ready" | "error";

const OWN_INTRO = W.ownChatSheet;

export default function ProductHome({
  onOpenSpeaking,
  onOpenProject,
  onStartNewProject,
  onOpenOwnChat,
  knownProjects,
}: {
  onOpenSpeaking: () => void;
  onOpenProject: (project: TrainingArc) => void;
  onStartNewProject: () => void;
  /** Yes on the info sheet opens Build. */
  onOpenOwnChat?: () => void;
  /** A page that already has the project list. Absent: read it. */
  knownProjects?: TrainingArc[];
}) {
  const locale = useUiLocale();
  const thread = useLoungeThreadMaybe();
  const [projects, setProjects] = useState<TrainingArc[]>(knownProjects ?? []);
  const [status, setStatus] = useState<Status>(knownProjects ? "ready" : "loading");
  const [attempt, setAttempt] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [own, setOwn] = useState(readOwnChat());

  useEffect(() => {
    const sync = () => {
      const draft = readTalkDraft();
      const named = draft?.definition.chat?.name || draft?.definition.name || "";
      if (named) rememberOwnName(named);
      setOwn(readOwnChat());
    };
    sync();
    window.addEventListener(OWN_CHAT_EVENT, sync);
    window.addEventListener(TALK_DRAFT_EVENT, sync);
    return () => {
      window.removeEventListener(OWN_CHAT_EVENT, sync);
      window.removeEventListener(TALK_DRAFT_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (knownProjects) return;
    let active = true;
    setStatus("loading");
    void fetchTrainings().then((list) => {
      if (!active) return;
      if (list === null) {
        setStatus("error");
        return;
      }
      setProjects(list.filter((project) => !project.archived));
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, [attempt, knownProjects]);

  // The provider is mounted before this component is painted. Treat a missing
  // provider defensively as not ready; it must never produce a stale home.
  // A dev page that passes the project list has no Lounge thread.
  const coachReady = knownProjects !== undefined || (thread !== null && !thread.loading);
  if (status === "loading" || !coachReady) {
    return (
      <div data-product-home data-product-home-loading className="flex min-h-0 flex-1">
        <LoadingState placement="surface" label={uiText(locale, "loading")} />
      </div>
    );
  }

  const title = ownChatTitle();
  const confirm = () => {
    startOwnChat();
    setSheet(false);
    onOpenOwnChat?.();
  };
  return (
    <div data-product-home className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
        <div className={`${WILLAB_CONTENT_RAIL} flex flex-col px-[15px] pb-6 pt-2`}>
          {own.started ? (
            <HomeRow
              id="own-chat"
              title={title}
              pinned
              circle={<OwnAvatar id="own-chat" name={title} size={48} />}
              onOpen={() => onOpenOwnChat?.()}
            />
          ) : null}
          <HomeRow
            id="speaking-coach"
            title={uiText(locale, "speakingCoach")}
            circle={<WillMark size={48} />}
            onOpen={onOpenSpeaking}
          />
          {status === "error" ? (
            <HomeError locale={locale} onRetry={() => setAttempt((value) => value + 1)} />
          ) : (
            projects.map((project) => (
              <HomeRow
                key={project.arcId}
                id={project.arcId}
                title={project.topic}
                circle={<ProjectCircle project={project} />}
                onOpen={() => onOpenProject(project)}
              />
            ))
          )}
          {own.started ? null : (
            <HomeRow
              id="start-own-chat"
              title={uiText(locale, "startOwnChat")}
              circle={<PersonCircle id="start-own-chat" name={uiText(locale, "startOwnChat")} size={48} />}
              onOpen={() => setSheet(true)}
            />
          )}
          <button
            type="button"
            data-start-new-project
            onClick={onStartNewProject}
            className="mt-2 flex min-h-[56px] w-full items-center px-3 text-left text-[16px] font-semibold text-foreground"
          >
            {uiText(locale, "startNewProject")}
          </button>
        </div>
      </div>
      {sheet ? <OwnChatSheet onYes={confirm} onClose={() => setSheet(false)} /> : null}
    </div>
  );
}

function OwnChatSheet({ onYes, onClose }: { onYes: () => void; onClose: () => void }) {
  return (
    <div data-own-chat-sheet="" className="absolute inset-0 z-30 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div role="dialog" aria-label="Start your own chat" className="flex flex-col gap-3 rounded-t-3xl bg-background px-[18px] pb-6 pt-2.5" onClick={(e) => e.stopPropagation()}>
        <span aria-hidden className="h-[5px] w-10 self-center rounded-full bg-[#E0E0E0]" />
        <p className="m-0 text-[16px] leading-snug text-foreground">{OWN_INTRO}</p>
        <button type="button" data-own-chat-yes="" onClick={onYes} className="flex h-11 items-center justify-center rounded-full bg-foreground text-[15px] font-semibold text-background">Yes</button>
        <button type="button" data-own-chat-close="" onClick={onClose} className="flex h-11 items-center justify-center rounded-full border border-border text-[15px] font-semibold text-foreground">Close</button>
      </div>
    </div>
  );
}

const PROJECT_ICON_TONES = ["#244FC5", "#FF6A14", "#E8A317"] as const;

function projectIconTone(identity: string): (typeof PROJECT_ICON_TONES)[number] {
  let hash = 0;
  for (let index = 0; index < identity.length; index += 1) {
    hash = (hash * 31 + identity.charCodeAt(index)) >>> 0;
  }
  return PROJECT_ICON_TONES[hash % PROJECT_ICON_TONES.length];
}

/** True after an enabled element first enters the viewport. Browsers without
 * IntersectionObserver keep the compatible eager behaviour after mount. */
function useVisibleOnce(ref: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (visible || !enabled) return;
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setVisible(true);
      observer.disconnect();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, ref, visible]);
  return visible;
}

/** A project keeps one palette colour for its identity. An uploaded deck uses
 * page one from the already-served `coverRef`; PdfPage shares its document
 * cache across every preview of that URL and only mounts when its row enters
 * the viewport. The colour stays underneath while the PDF waits, loads and if
 * it cannot be drawn, so the row never returns to an empty grey placeholder. */
function ProjectCircle({ project }: { project: Pick<TrainingArc, "arcId" | "coverRef"> }) {
  const tone = projectIconTone(project.arcId);
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const showSlide = useVisibleOnce(iconRef, project.coverRef !== null);
  return (
    <span
      ref={iconRef}
      aria-hidden
      data-project-icon={project.arcId}
      data-project-icon-source={project.coverRef ? "slide" : "palette"}
      className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full"
      style={{ backgroundColor: tone }}
    >
      {project.coverRef && showSlide ? (
        <span
          data-project-icon-slide=""
          className="absolute -inset-0.5 scale-110 overflow-hidden blur-[1.25px] saturate-75"
        >
          <PdfPage
            url={project.coverRef}
            pageIndex={0}
            fit
            className="h-full w-full [&>div]:hidden [&>canvas]:!h-full [&>canvas]:!w-full [&>canvas]:!rounded-none [&>canvas]:!object-cover"
          />
        </span>
      ) : null}
      <span className="pointer-events-none absolute inset-0 bg-black/[0.06]" />
    </span>
  );
}

function HomeRow({
  id,
  title,
  circle,
  pinned = false,
  onOpen,
}: {
  id: string;
  title: string;
  circle?: ReactNode;
  pinned?: boolean;
  onOpen: () => void;
}) {
  return (
    <div data-home-row={id} className="border-b border-[#F0F0F0]">
      <ChatListRow
        id={id}
        pinned={pinned}
        circle={circle ?? <span aria-hidden className="h-12 w-12 shrink-0 rounded-full bg-muted" />}
        title={title}
        onOpen={onOpen}
      />
    </div>
  );
}

function HomeError({ locale, onRetry }: { locale: UiLocale; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 px-3 py-4">
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <VoiceMark size={20} />
        <span>{uiText(locale, "projectLoadFailed")}</span>
      </div>
      <button type="button" onClick={onRetry} className="text-[13px] text-foreground underline underline-offset-2">
        {uiText(locale, "tryAgain")}
      </button>
    </div>
  );
}
