"use client";

import { useEffect, useId, useRef, useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { Archive, ChevronDown, Pencil, Plus, SquarePen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useBackDismiss } from "../useBackDismiss";
import { LetterCircle, WillMark } from "./ChatList";
import { OwnAvatar } from "./hostsetup/ChatIconPicker";
import ProjectRowMenu, { type RowMenuAction } from "../ProjectRowMenu";
import { OWN_CHAT_EVENT, ownChatTitle, readOwnChat, rememberOwnName, startOwnChat } from "@/lib/willab/chatBuilder/ownChat";
import { W } from "./hostsetup/hostSetupCopy";
import { clearTalkDraft, readTalkDraft, TALK_DRAFT_EVENT } from "@/lib/willab/chatBuilder/talkDraft";
import type { ChangeStructure, ChatStructure, Subchat } from "@/services/api/chatStructure";
import type { Chat } from "@/services/api/chats";
import { subchatActions } from "./BuilderSubchats";
import { subscribeToProjectTrainings } from "@/lib/willab/projectTrainings";
import { COACH_PANEL_COPY } from "@/lib/willab/coachPanelCopy";

type Status = "loading" | "ready" | "error";
type RenameStatus = "editing" | "saving" | "saved" | "error";

type RenameState = {
  projectId: string;
  value: string;
  status: RenameStatus;
};

const OWN_INTRO = W.ownChatSheet;

export default function ProductHome({
  onOpenSpeaking,
  coachActions,
  activeChat,
  structure,
  people = [],
  onOpenPerson,
  onOpenProject,
  onRemoveProject,
  onStartNewProject,
  onOpenOwnChat,
  onOpenOwnSection,
  knownProjects,
  onProjects,
}: {
  onOpenSpeaking: () => void;
  coachActions?: ReactNode;
  activeChat?: string;
  structure?: { layout: ChatStructure | null; change: (action: ChangeStructure) => Promise<boolean> };
  people?: readonly Chat[];
  onOpenPerson?: (chat: Chat) => void;
  onOpenProject: (project: TrainingArc) => void;
  onRemoveProject?: (arcId: string) => void;
  onStartNewProject: () => void;
  /** Yes on the info sheet opens Build. */
  onOpenOwnChat?: () => void;
  onOpenOwnSection?: (name: string, section: Subchat | "main") => void;
  /** A page that already has the project list. Absent: read it. */
  knownProjects?: TrainingArc[];
  onProjects?: (projects: TrainingArc[]) => void;
}) {
  const locale = useUiLocale();
  const [projects, setProjects] = useState<TrainingArc[]>(knownProjects ?? []);
  const [status, setStatus] = useState<Status>(knownProjects ? "ready" : "loading");
  const { layout = null, change = unavailableChange } = structure ?? {};
  const [attempt, setAttempt] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [own, setOwn] = useState(readOwnChat());
  const [rename, setRename] = useState<RenameState | null>(null);

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
    const unsubscribe = subscribeToProjectTrainings((list) => {
      active = false;
      setProjects(list.filter((project) => !project.archived));
      setStatus("ready");
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [attempt, knownProjects]);
  useEffect(() => { onProjects?.(projects); }, [onProjects, projects]);

  useEffect(() => {
    if (rename?.status !== "saved") return;
    const timer = window.setTimeout(() => setRename(null), 900);
    return () => window.clearTimeout(timer);
  }, [rename?.status]);

  const title = layout?.published_chat?.name || ownChatTitle();
  const showOwn = (own.started || layout?.published_chat) && (!layout || layout.builder === "active");
  const confirm = async () => {
    if (layout && layout.builder !== "active" && !await change({ action: "restore", section: "builder" })) return;
    startOwnChat();
    setSheet(false);
    onOpenOwnChat?.();
  };
  const startProject = async () => {
    if (layout?.coach === "deleted") {
      if (!await change({ action: "restore", section: "coach" })) return;
      setAttempt((n) => n + 1);
    }
    onStartNewProject();
  };
  const newProject = (
    <button type="button" data-start-new-project onClick={() => void startProject()}
      className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
      <Plus size={16} aria-hidden />{uiText(locale, "startNewProject")}
    </button>
  );

  return (
    <div data-product-home data-chat-sidebar-content className="flex min-h-0 flex-1 flex-col">
      <nav data-chat-list aria-label={uiText(locale, "chatsNavigation")} className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1">
          {showOwn ? <BuilderChatGroup title={title} layout={layout} change={change} activeChat={activeChat}
            onEdit={onOpenOwnChat} onOpenSection={onOpenOwnSection} /> : null}
          {!layout || layout.coach === "active" ? <>
          <HomeRow
            id="speaking-coach"
            title={uiText(locale, "speakingCoach")}
            circle={<WillMark size={24} />}
            active={activeChat === "coach"}
            actions={coachActions}
            onOpen={onOpenSpeaking}
          />
          <div data-product-projects className="ml-5 border-l border-border pl-2">
            {status === "loading" ? (
              <ProjectsLoading locale={locale} />
            ) : status === "error" ? (
              <HomeError locale={locale} onRetry={() => setAttempt((value) => value + 1)} />
            ) : (
              projects.map((project) => rename?.projectId === project.arcId ? (
                <ProjectEditRow
                  key={project.arcId}
                  project={project}
                  locale={locale}
                  value={rename.value}
                  status={rename.status}
                  onChange={(value) => setRename((current) => current ? { ...current, value, status: "editing" } : current)}
                  onCancel={() => setRename(null)}
                  onSave={() => void saveProjectName(project, rename.value, setProjects, setRename)}
                />
              ) : (
                <HomeRow
                  key={project.arcId}
                  id={project.arcId}
                  title={project.topic}
                  circle={<ProjectCircle project={project} />}
                  active={activeChat === `project:${project.arcId}`}
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
                            () => setRename({ projectId: project.arcId, value: project.topic, status: "editing" }),
                            onRemoveProject,
                          )}
                        />
                      )
                  }
                  onOpen={() => onOpenProject(project)}
                />
              ))
            )}
            {newProject}
          </div>
          </> : null}
          {layout?.coach === "deleted" ? newProject : null}
          {onOpenPerson ? people.map((chat) => <HomeRow key={chat.id} id={chat.id} title={chat.title}
            circle={<LetterCircle id={chat.id} name={chat.title} size={24} />}
            active={activeChat === `person:${chat.id}`} onOpen={() => onOpenPerson(chat)} />) : null}
          <ArchivedChats layout={layout} title={title} coachTitle={uiText(locale, "speakingCoach")} change={change} />
      </nav>
      <div data-chat-sidebar-setup className="shrink-0 space-y-0.5 border-t border-border px-2 py-1.5">
        <HomeRow id="start-own-chat" title={uiText(locale, showOwn ? "editOwnChat" : "startOwnChat")}
          circle={<SquarePen size={17} aria-hidden />} onOpen={() => showOwn ? onOpenOwnChat?.() : setSheet(true)} />
      </div>
      {sheet ? <OwnChatSheet title={uiText(locale, "startOwnChat")} onYes={confirm} onClose={() => setSheet(false)} /> : null}
    </div>
  );
}

const unavailableChange = async () => false;

function OwnChatSheet({ title, onYes, onClose }: { title: string; onYes: () => Promise<void>; onClose: () => void }) {
  const titleId = useId();
  const descriptionId = useId();
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const yesButton = useRef<HTMLButtonElement>(null);
  const [opening, setOpening] = useState(false);
  useBackDismiss(onClose, () => opening);

  useEffect(() => {
    const opener = document.activeElement;
    closeButton.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  const confirm = async () => {
    if (opening) return;
    panel.current?.focus();
    setOpening(true);
    try {
      await onYes();
    } finally {
      setOpening(false);
    }
  };

  return createPortal(
    <div
      data-own-chat-sheet=""
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 sm:items-center sm:bg-foreground/35 sm:p-4"
      onClick={(event) => {
        if (!opening && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panel}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={opening}
        className="flex max-h-full w-full flex-col gap-3 overflow-y-auto overscroll-contain rounded-t-3xl bg-background px-[18px] pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2.5 focus:outline-none sm:max-w-sm sm:rounded-3xl sm:p-5 sm:shadow-xl"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !opening) {
            event.stopPropagation();
            onClose();
          }
          if (event.key === "Tab") {
            event.preventDefault();
            const next = document.activeElement === closeButton.current ? yesButton : closeButton;
            next.current?.focus();
          }
        }}
      >
        <span aria-hidden className="h-[5px] w-10 shrink-0 self-center rounded-full bg-[#E0E0E0] dark:bg-white/15 sm:hidden" />
        <h2 id={titleId} className="text-[21px] font-bold leading-tight text-foreground sm:text-[18px] sm:font-semibold">{title}</h2>
        <p id={descriptionId} className="text-[15px] leading-snug text-muted-foreground sm:text-sm">{OWN_INTRO}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button ref={closeButton} type="button" variant="outline" data-own-chat-close="" onClick={onClose}
            disabled={opening} className="h-11 rounded-full text-[15px]">Close</Button>
          <Button ref={yesButton} type="button" data-own-chat-yes="" onClick={() => void confirm()}
            disabled={opening} className="h-11 rounded-full bg-foreground text-[15px] text-background hover:bg-foreground/90">Yes</Button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function projectActions(
  project: TrainingArc,
  locale: UiLocale,
  setProjects: Dispatch<SetStateAction<TrainingArc[]>>,
  onEdit: () => void,
  onRemove?: (arcId: string) => void,
): RowMenuAction[] {
  return [
    {
      label: uiText(locale, "projectEdit"),
      icon: Pencil,
      failedLabel: uiText(locale, "projectEditFailed"),
      onRun: async () => {
        onEdit();
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
          onRemove?.(project.arcId);
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
          onRemove?.(project.arcId);
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
      className="relative size-6 shrink-0 overflow-hidden rounded-full"
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

function ArchivedChats({ layout, title, coachTitle, change }: {
  layout: ChatStructure | null; title: string; coachTitle: string; change: (action: ChangeStructure) => Promise<boolean>;
}) {
  if (!layout) return null;
  const children = layout.builder === "active" ? layout.subchats.filter((item) => item.archived) : [];
  if (layout.coach !== "archived" && layout.builder !== "archived" && children.length === 0) return null;
  const restore = (section: string) => void change({ action: "restore", section });
  return <details className="py-2 text-sm">
    <summary className="min-h-10 cursor-pointer">Archived chats</summary>
    {layout.coach === "archived" ? <HomeRow id="archived-speaking" title={coachTitle}
      circle={<WillMark size={24} />} onOpen={() => restore("coach")} subtitle="Restore" /> : null}
    {layout.builder === "archived" ? <HomeRow id="archived-own" title={title}
      circle={<OwnAvatar id="own-chat" name={title} size={24} />} onOpen={() => restore("builder")} subtitle="Restore" /> : null}
    {children.map((child) => <HomeRow key={child.id} id={child.id} title={child.title} subtitle="Restore"
      actions={<ProjectRowMenu label={child.title} actions={subchatActions(child, change)} />}
      onOpen={() => restore(child.id)} />)}
  </details>;
}

function BuilderChatGroup({ title, layout, change, activeChat, onEdit, onOpenSection }: {
  title: string; layout: ChatStructure | null; change: (action: ChangeStructure) => Promise<boolean>;
  activeChat?: string;
  onEdit?: () => void; onOpenSection?: (name: string, section: Subchat | "main") => void;
}) {
  const groupId = useId();
  const [expanded, setExpanded] = useState(true);
  const children = layout?.subchats.filter((item) => !item.archived) ?? [];
  const openMain = () => {
    if (layout && (layout.published_chat || readTalkDraft()?.ready || children.length) && onOpenSection) {
      onOpenSection(title, "main");
    } else onEdit?.();
  };
  const actions: RowMenuAction[] = [
    { label: "Edit", icon: Pencil, onRun: async () => { onEdit?.(); return true; } },
    { label: "Archive", icon: Archive, onRun: () => change({ action: "archive", section: "builder" }) },
    { label: "Delete", icon: Trash2, destructive: true,
      confirm: { title: `Delete ${title}?`, body: "This deletes the main conversation and all of its subchats and saved conversations.", confirmLabel: "Delete" },
      onRun: async () => {
        const deleted = await change({ action: "delete", section: "builder" });
        if (deleted) clearTalkDraft();
        return deleted;
      } },
  ];
  return <>
    <HomeRow id="own-chat" title={title} circle={<OwnAvatar id="own-chat" name={title} size={24} />} onOpen={openMain}
      active={activeChat === "builder" || activeChat === "built:main"}
      actions={layout ? <div className="flex items-center">
        {children.length ? <button type="button" aria-label={expanded ? "Hide subchats" : "Show subchats"}
          aria-controls={groupId} aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}
          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent">
          <ChevronDown aria-hidden className={`h-4 w-4 ${expanded ? "" : "-rotate-90"}`} />
        </button> : null}
        <ProjectRowMenu label={title} actions={actions} />
      </div> : null} />
    <div id={groupId} hidden={!expanded} className="ml-5 border-l border-border pl-2">
      {children.map((child) => <HomeRow key={child.id} id={child.id} title={child.title}
        circle={<LetterCircle id={child.id} name={child.title} size={24} />}
        active={activeChat === `built:${child.id}`}
        actions={<ProjectRowMenu label={child.title} actions={subchatActions(child, change)} />}
        onOpen={() => onOpenSection?.(title, child)} />)}
    </div>
  </>;
}

function HomeRow({
  id,
  title,
  circle,
  active = false,
  subtitle = null,
  actions = null,
  disabled = false,
  onOpen,
}: {
  id: string;
  title: string;
  circle?: ReactNode;
  active?: boolean;
  subtitle?: string | null;
  actions?: ReactNode;
  disabled?: boolean;
  onOpen: () => void;
}) {
  return (
    <div data-home-row={id} className={`flex min-w-0 items-center rounded-lg pr-1 ${active ? "bg-[#f8f1ea] dark:bg-[#3c3028]" : "hover:bg-accent"}`}>
      <button type="button" data-chat-row={id} aria-current={active ? "page" : undefined}
        title={title} disabled={disabled} onClick={onOpen}
        className="flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 text-left text-[13.5px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60">
        {circle}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{title}</span>
          {subtitle ? <span className="block text-xs font-normal text-muted-foreground">{subtitle}</span> : null}
        </span>
      </button>
      {actions}
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

function ProjectEditRow({
  project,
  locale,
  value,
  status,
  onChange,
  onCancel,
  onSave,
}: {
  project: TrainingArc;
  locale: UiLocale;
  value: string;
  status: RenameStatus;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const busy = status === "saving" || status === "saved";

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div data-project-edit-row={project.arcId} className="flex min-w-0 flex-col gap-1.5 py-1">
      <div className="min-w-0">
        <label htmlFor={`project-name-${project.arcId}`} className="sr-only">
          {uiText(locale, "projectEdit")} {project.topic}
        </label>
        <input
          ref={inputRef}
          id={`project-name-${project.arcId}`}
          data-project-name-input=""
          aria-label={`${uiText(locale, "projectEdit")} ${project.topic}`}
          value={value}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSave();
            } else if (event.key === "Escape" && !busy) {
              onCancel();
            }
          }}
          className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-[16px] text-foreground outline-none focus:border-foreground disabled:opacity-60"
        />
        {status === "saving" ? <span role="status" className="text-[12px] text-muted-foreground">{uiText(locale, "loading")}</span> : null}
        {status === "saved" ? <span role="status" className="text-[12px] text-muted-foreground">{COACH_PANEL_COPY.saved}</span> : null}
        {status === "error" ? <span role="alert" className="text-[12px] text-record">{uiText(locale, "projectEditFailed")}</span> : null}
      </div>
      {!busy ? (
        <div className="flex flex-wrap justify-end gap-1">
          <button type="button" onClick={onCancel} className="min-h-9 rounded-lg border border-border px-2 text-xs font-medium">
            {uiText(locale, "cancel")}
          </button>
          <button type="button" onClick={onSave} disabled={!value.trim()} className="min-h-9 rounded-lg bg-foreground px-2 text-xs font-semibold text-background disabled:opacity-50">
            {uiText(locale, "projectEdit")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

async function saveProjectName(
  project: TrainingArc,
  value: string,
  setProjects: Dispatch<SetStateAction<TrainingArc[]>>,
  setRename: Dispatch<SetStateAction<RenameState | null>>,
) {
  const nextName = value.trim();
  if (!nextName) {
    setRename({ projectId: project.arcId, value, status: "error" });
    return;
  }
  setRename({ projectId: project.arcId, value: nextName, status: "saving" });
  const displayName = await renameProject(project.arcId, nextName).catch(() => null);
  if (!displayName) {
    setRename({ projectId: project.arcId, value: nextName, status: "error" });
    return;
  }
  setProjects((list) => list.map((item) => item.arcId === project.arcId ? { ...item, topic: displayName } : item));
  setRename({ projectId: project.arcId, value: displayName, status: "saved" });
}
