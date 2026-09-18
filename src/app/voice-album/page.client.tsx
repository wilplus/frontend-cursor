"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import LoadingState from "@/components/willab/LoadingState";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import VoiceAlbumMoment from "@/components/willab/VoiceAlbumMoment";
import PracticeNewQueue from "@/components/willab/PracticeNewQueue";
import {
  fetchVoiceAlbum,
  type VoiceAlbumProject,
} from "@/services/api/voiceAlbum";

/* -------------------------------------------------------------------------- */
/*  The Voice Album (founder 2026-09-18).                                      */
/*                                                                            */
/*  "the voices should be stored by project ... practice yours is the list of  */
/*  your projects and it looks like every other list in the app ... you click   */
/*  one of them and the audio recordings open associated to that project ...   */
/*  and then when the project ends there is a thicker line showing the title    */
/*  of the next project and its confident moments."                            */
/*                                                                            */
/*  So the list is the way IN and the scroll is the whole album: opening a      */
/*  project jumps to its band, and scrolling past the end of it crosses a       */
/*  thick rule into the next project rather than dead-ending. Going back is a   */
/*  way to re-enter somewhere else, not the only way to keep reading.           */
/*                                                                            */
/*  The rows are the app's own roster row — same border, radius, 15px name,     */
/*  12px meta line, count pill and chevron as Your students — because the       */
/*  founder asked for "every other list in the app", and a bespoke list here    */
/*  would read as a different product.                                          */
/*                                                                            */
/*  ONE MOMENT OPEN AT A TIME: opening another closes the last, so the page     */
/*  never becomes a wall of expanded threads to scroll past.                    */
/* -------------------------------------------------------------------------- */

type Status = "loading" | "ready" | "empty" | "error";
type Mode = "yours" | "new";

export default function VoiceAlbumPageClient({
  initialProjectId,
}: {
  /** ?arc=<id> opens the feed straight at that project. */
  initialProjectId: string | null;
}) {
  const router = useRouter();
  /* The navbar toggle (founder 2026-09-18). Two halves of one product: the
     moments that made it in, and the clips still waiting on your answer. */
  const [mode, setMode] = useState<Mode>("yours");
  const [projects, setProjects] = useState<VoiceAlbumProject[] | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [openProjectId, setOpenProjectId] = useState<string | null>(initialProjectId);
  const [openMoment, setOpenMoment] = useState<string | null>(null);
  const bandRefs = useRef(new Map<string, HTMLElement>());
  const jumpTo = useRef<string | null>(initialProjectId);

  useEffect(() => {
    let active = true;
    void fetchVoiceAlbum().then((result) => {
      if (!active) return;
      setProjects(result);
      setStatus(result === null ? "error" : result.length === 0 ? "empty" : "ready");
    });
    return () => {
      active = false;
    };
  }, []);

  // Jump AFTER the bands are laid out, not inside the click handler — the
  // feed does not exist yet at the moment a project row is tapped.
  useLayoutEffect(() => {
    const target = jumpTo.current;
    if (!target || status !== "ready" || openProjectId === null) return;
    jumpTo.current = null;
    const band = bandRefs.current.get(target);
    if (band) band.scrollIntoView({ block: "start" });
  }, [status, openProjectId, projects]);

  const shell = {
    onClose: () => router.push("/chat"),
    mode,
    onMode: (next: Mode) => {
      setMode(next);
      window.scrollTo(0, 0);
    },
  };

  if (mode === "new") {
    return (
      <Shell {...shell}>
        <PracticeNewQueue />
      </Shell>
    );
  }

  if (status === "loading") {
    return (
      <Shell {...shell}>
        <LoadingState placement="surface" />
      </Shell>
    );
  }

  if (status === "error") {
    return (
      <Shell {...shell}>
        <Centered>We couldn&apos;t load your Voice Album just now.</Centered>
      </Shell>
    );
  }

  if (status === "empty" || !projects || projects.length === 0) {
    return (
      <Shell {...shell}>
        <Centered>
          Your Voice Album is empty. Moments appear here only after the machine,
          you, and your coach independently hear confident delivery.
        </Centered>
      </Shell>
    );
  }

  if (openProjectId === null) {
    return (
      <Shell {...shell}>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 py-5">
          {projects.map((project) => (
            <li key={project.projectId}>
              <button
                type="button"
                onClick={() => {
                  jumpTo.current = project.projectId;
                  setOpenProjectId(project.projectId);
                  setOpenMoment(null);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium text-foreground">
                    {project.title ?? "Untitled project"}
                  </span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {project.entries.length === 1 ? "1 moment" : `${project.entries.length} moments`}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  return (
    <Shell
      {...shell}
      onBack={() => {
        setOpenProjectId(null);
        setOpenMoment(null);
        window.scrollTo(0, 0);
      }}
    >
      <div className="pb-24">
        {projects.map((project, index) => (
          <section key={project.projectId}>
            <div
              ref={(node) => {
                if (node) bandRefs.current.set(project.projectId, node);
                else bandRefs.current.delete(project.projectId);
              }}
              /* The thick rule IS the project boundary the founder asked for.
                 The first band has nothing above it to separate from. */
              className={
                index === 0
                  ? "px-1 pb-1.5 pt-5"
                  : "mt-8 border-t-[3px] border-foreground px-1 pb-1.5 pt-4"
              }
            >
              <h2 className="m-0 font-heading text-[26px] font-normal leading-tight tracking-tight text-foreground">
                {project.title ?? "Untitled project"}
              </h2>
            </div>
            <div className="flex flex-col gap-2.5 pt-2.5">
              {project.entries.map((entry) => (
                <VoiceAlbumMoment
                  key={entry.momentKey}
                  projectId={project.projectId}
                  entry={entry}
                  open={openMoment === entry.momentKey}
                  onToggle={() =>
                    setOpenMoment((current) =>
                      current === entry.momentKey ? null : entry.momentKey
                    )
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}

function Shell({
  children,
  onClose,
  onBack,
  mode,
  onMode,
}: {
  children: React.ReactNode;
  onClose: () => void;
  onBack?: () => void;
  mode: Mode;
  onMode: (next: Mode) => void;
}) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col bg-background px-5">
      <header className="sticky top-0 z-10 shrink-0 bg-background pb-3 pt-4">
        <div className="flex items-center gap-2 pb-2.5">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to your projects"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          <h1 className="flex-1 text-[17px] font-semibold text-foreground">Voice Album</h1>
          <OverlayCloseButton onClick={onClose} />
        </div>

        {/* The two halves of the Album. A segment, not tabs: there is no
            hierarchy between them — one is what you keep, the other is what
            is still waiting on you. */}
        <div className="flex gap-0.5 rounded-full bg-muted p-[3px]" role="tablist" aria-label="Voice Album mode">
          {(
            [
              ["yours", "Practice yours"],
              ["new", "Practice new"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => onMode(value)}
              className={
                mode === value
                  ? "flex-1 rounded-full bg-background px-2.5 py-2.5 text-[13.5px] font-semibold tracking-tight text-foreground shadow-sm"
                  : "flex-1 rounded-full px-2.5 py-2.5 text-[13.5px] font-semibold tracking-tight text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      {children}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center py-16 text-center text-[15px] leading-relaxed text-muted-foreground">
      <p className="max-w-sm">{children}</p>
    </div>
  );
}
