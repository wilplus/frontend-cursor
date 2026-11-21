"use client";

import { useEffect, useRef, useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { Archive, Pencil, Trash2 } from "lucide-react";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { uiText, uiTextWith, type UiLocale } from "@/lib/uiLocale";
import type { TrainingArc } from "@/services/api/trainings";
import { archiveProject } from "@/services/api/projectArchive";
import { requestProjectDeletion } from "@/services/api/projectDeletion";
import { renameProject } from "@/services/api/projectRename";
import { PROJECT_DELETION_COPY } from "@/lib/willab/projectDeletionCopy";
import { takeTrainings } from "@/services/api/bootPrefetch";
import { VoiceMark } from "../LoadingState";
import { PdfPage } from "../pdfSlides";
import { ChatListRow, PersonCircle, WillMark } from "./ChatList";
import { OwnAvatar } from "./hostsetup/ChatIconPicker";
import ProjectRowMenu, { type RowMenuAction } from "../ProjectRowMenu";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";
import { OWN_CHAT_EVENT, ownChatTitle, readOwnChat, rememberOwnName, startOwnChat } from "@/lib/willab/chatBuilder/ownChat";
import { W } from "./hostsetup/hostSetupCopy";
import { readTalkDraft, TALK_DRAFT_EVENT } from "@/lib/willab/chatBuilder/talkDraft";

/* -------------------------------------------------------------------------- */
/*  The speaking-coach home. The old people-chat list still reads its backend  */
/*  data for delivery and message side effects, but it is not this product's   */
/*  primary way into speaking practice.                                      */
/*                                                                            */
/*  The project index is an optional region: it loads inside its own stable    */
/*  slot so the Speaking coach row, existing chat, composer and primary        */
/*  recording action do not wait for it.                                      */
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
  const [projects, setProjects] = useState<TrainingArc[]>(knownProjects ?? []);
  const [status, setStatus] = useState<Status>(knownProjects ? "ready" : "loading");
  const [attempt, setAttempt] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [own, setOwn] = useState(readOwnChat());
  const [editingProject, setEditingProject] = useState<TrainingArc | null>(null);

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
    void takeTrainings().then((list) => {
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
          <div data-product-projects className="min-h-[56px]">
            {status === "loading" ? (
              <ProjectsLoading locale={locale} />
            ) : status === "error" ? (
              <HomeError locale={locale} onRetry={() => setAttempt((value) => value + 1)} />
            ) : (
              projects.map((project) => (
                <HomeRow
                  key={project.arcId}
                  id={project.arcId}
                  title={project.topic}
                  circle={<ProjectCircle project={project} />}
                  subtitle={project.deletion ? uiText(locale, "projectDeletionPending") : null}
                  disabled={Boolean(project.deletion)}
                  actions={
                    project.deletion
                      ? null
                      : (
                        <ProjectRowMenu
                          label={project.topic}
                          menuAriaLabel={uiTextWith(locale, "projectMoreOptions", { name: project.topic })}
                          actions={projectActions(
                            project,
                            locale,
                            setProjects,
                            setEditingProject,
                          )}
                        />
                      )
                  }
                  onOpen={() => onOpenProject(project)}
                />
              ))
            )}
          </div>
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
      {editingProject ? (
        <RenameProjectDialog
          project={editingProject}
          locale={locale}
          onCancel={() => setEditingProject(null)}
          onRenamed={(displayName) => {
            setProjects((list) => list.map((item) =>
              item.arcId === editingProject.arcId
                ? { ...item, topic: displayName }
                : item,
            ));
            setEditingProject(null);
          }}
        />
      ) : null}
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

function projectActions(
  project: TrainingArc,
  locale: UiLocale,
  setProjects: Dispatch<SetStateAction<TrainingArc[]>>,
  setEditingProject: Dispatch<SetStateAction<TrainingArc | null>>,
): RowMenuAction[] {
  return [
    {
      label: uiText(locale, "projectEdit"),
      icon: Pencil,
      failedLabel: uiText(locale, "projectEditFailed"),
      onRun: async () => {
        setEditingProject(project);
        return true;
      },
    },
    {
      label: uiText(locale, "projectArchive"),
      icon: Archive,
      failedLabel: uiText(locale, "projectArchiveFailed"),
      onRun: async () => {
        const ok = await archiveProject(project.arcId);
        if (ok) {
          setProjects((list) => list.filter((item) => item.arcId !== project.arcId));
        }
        return ok;
      },
    },
    {
      label: uiText(locale, "delete"),
      icon: Trash2,
      destructive: true,
      failedLabel: uiText(locale, "deleteFailed"),
      dismissConfirmationOnFailure: true,
      confirm: {
        title: PROJECT_DELETION_COPY.title(project.topic),
        body: PROJECT_DELETION_COPY.body,
        confirmLabel: PROJECT_DELETION_COPY.confirm,
        cancelLabel: uiText(locale, "cancel"),
        failedLabel: uiText(locale, "deleteFailed"),
      },
      onRun: async () => {
        const result = await requestProjectDeletion(project.arcId);
        if (result.ok) {
          setProjects((list) =>
            list.map((item) =>
              item.arcId === project.arcId
                ? {
                    ...item,
                    deletion: result.deletion ?? {
                      state: "pending",
                      dueAt: null,
                      cancellable: true,
                    },
                  }
                : item,
            ),
          );
        }
        return result.ok;
      },
    },
  ];
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
  subtitle = null,
  actions = null,
  disabled = false,
  onOpen,
}: {
  id: string;
  title: string;
  circle?: ReactNode;
  pinned?: boolean;
  subtitle?: string | null;
  actions?: ReactNode;
  disabled?: boolean;
  onOpen: () => void;
}) {
  return (
    <div data-home-row={id} className="border-b border-[#F0F0F0]">
      <ChatListRow
        id={id}
        pinned={pinned}
        circle={circle ?? <span aria-hidden className="h-12 w-12 shrink-0 rounded-full bg-muted" />}
        title={title}
        subtitle={subtitle}
        actions={actions}
        disabled={disabled}
        paddingClassName="pl-0"
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

function ProjectsLoading({ locale }: { locale: UiLocale }) {
  return (
    <div data-product-projects-loading role="status" className="flex min-h-[56px] items-center gap-2 px-3 text-[13px] text-muted-foreground">
      <VoiceMark size={20} />
      <span>{uiText(locale, "projectLoading")}</span>
    </div>
  );
}

function RenameProjectDialog({
  project,
  locale,
  onCancel,
  onRenamed,
}: {
  project: TrainingArc;
  locale: UiLocale;
  onCancel: () => void;
  onRenamed: (displayName: string) => void;
}) {
  const [value, setValue] = useState(project.topic);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/35 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-project-title"
    >
      <form
        className="w-full max-w-sm rounded-3xl bg-background p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || !value.trim()) return;
          setBusy(true);
          setFailed(false);
          void renameProject(project.arcId, value)
            .then((displayName) => {
              if (displayName) {
                onRenamed(displayName);
                return;
              }
              setFailed(true);
              setBusy(false);
            })
            .catch(() => {
              setFailed(true);
              setBusy(false);
            });
        }}
      >
        <h2 id="rename-project-title" className="text-[18px] font-semibold text-foreground">
          {uiText(locale, "projectEdit")}
        </h2>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label={`${uiText(locale, "projectEdit")} ${project.topic}`}
          className="mt-4 h-12 w-full rounded-2xl border border-border bg-background px-4 text-[16px] text-foreground outline-none focus:border-foreground"
          disabled={busy}
        />
        {failed ? (
          <p role="alert" className="mt-2 text-[13px] text-record">
            {uiText(locale, "projectEditFailed")}
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-11 rounded-full border border-border text-[14px] font-medium"
          >
            {uiText(locale, "cancel")}
          </button>
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="h-11 rounded-full bg-foreground text-[14px] font-semibold text-background disabled:opacity-50"
          >
            {uiText(locale, "projectEdit")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
