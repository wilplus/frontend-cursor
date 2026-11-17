"use client";

import { useEffect, useRef, useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";
import { Archive, Trash2 } from "lucide-react";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { uiText, uiTextWith, type UiLocale } from "@/lib/uiLocale";
import type { TrainingArc } from "@/services/api/trainings";
import { archiveProject } from "@/services/api/projectArchive";
import { requestProjectDeletion } from "@/services/api/projectDeletion";
import { PROJECT_DELETION_COPY } from "@/lib/willab/projectDeletionCopy";
import { takeTrainings } from "@/services/api/bootPrefetch";
import LoadingState, { VoiceMark } from "../LoadingState";
import { useLoungeThreadMaybe } from "../LoungeThreadContext";
import { PdfPage } from "../pdfSlides";
import { ChatListRow, WillMark } from "./ChatList";
import ProjectRowMenu, { type RowMenuAction } from "../ProjectRowMenu";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";

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

export default function ProductHome({
  onOpenSpeaking,
  onOpenProject,
  onStartNewProject,
}: {
  onOpenSpeaking: () => void;
  onOpenProject: (project: TrainingArc) => void;
  onStartNewProject: () => void;
}) {
  const locale = useUiLocale();
  const thread = useLoungeThreadMaybe();
  const [projects, setProjects] = useState<TrainingArc[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
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
  }, [attempt]);

  // The provider is mounted before this component is painted. Treat a missing
  // provider defensively as not ready; it must never produce a stale home.
  const coachReady = thread !== null && !thread.loading;
  if (status === "loading" || !coachReady) {
    return (
      <div data-product-home data-product-home-loading className="flex min-h-0 flex-1">
        <LoadingState placement="surface" label={uiText(locale, "loading")} />
      </div>
    );
  }

  return (
    <div data-product-home className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
        <div className={`${WILLAB_CONTENT_RAIL} flex flex-col px-[15px] pb-6 pt-2`}>
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
                subtitle={project.deletion ? uiText(locale, "projectDeletionPending") : null}
                disabled={Boolean(project.deletion)}
                actions={
                  project.deletion
                    ? null
                    : (
                      <ProjectRowMenu
                        label={project.topic}
                        menuAriaLabel={uiTextWith(locale, "projectMoreOptions", { name: project.topic })}
                        actions={projectActions(project, locale, setProjects)}
                      />
                    )
                }
                onOpen={() => onOpenProject(project)}
              />
            ))
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
    </div>
  );
}

function projectActions(
  project: TrainingArc,
  locale: UiLocale,
  setProjects: Dispatch<SetStateAction<TrainingArc[]>>,
): RowMenuAction[] {
  return [
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
  subtitle = null,
  actions = null,
  disabled = false,
  onOpen,
}: {
  id: string;
  title: string;
  circle?: ReactNode;
  subtitle?: string | null;
  actions?: ReactNode;
  disabled?: boolean;
  onOpen: () => void;
}) {
  return (
    <div data-home-row={id} className="border-b border-[#F0F0F0]">
      <ChatListRow
        id={id}
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
