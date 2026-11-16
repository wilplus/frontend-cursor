"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fetchTrainings, type TrainingArc } from "@/services/api/trainings";
import LoadingState, { VoiceMark } from "../LoadingState";
import { useLoungeThreadMaybe } from "../LoungeThreadContext";
import { ChatListRow, WillMark } from "./ChatList";

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
  const thread = useLoungeThreadMaybe();
  const [projects, setProjects] = useState<TrainingArc[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
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
  }, [attempt]);

  // The provider is mounted before this component is painted. Treat a missing
  // provider defensively as not ready; it must never produce a stale home.
  const coachReady = thread !== null && !thread.loading;
  if (status === "loading" || !coachReady) {
    return (
      <div data-product-home data-product-home-loading className="flex min-h-0 flex-1">
        <LoadingState placement="surface" />
      </div>
    );
  }

  return (
    <div data-product-home className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-4xl flex-col px-[15px] pb-6 pt-2">
          <HomeRow
            id="speaking-coach"
            title="Speaking coach"
            circle={<WillMark size={48} />}
            onOpen={onOpenSpeaking}
          />
          {status === "error" ? (
            <HomeError onRetry={() => setAttempt((value) => value + 1)} />
          ) : (
            projects.map((project) => (
              <HomeRow
                key={project.arcId}
                id={project.arcId}
                title={project.topic}
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
            Start a new project
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeRow({
  id,
  title,
  circle,
  onOpen,
}: {
  id: string;
  title: string;
  circle?: ReactNode;
  onOpen: () => void;
}) {
  return (
    <div data-home-row={id} className="border-b border-[#F0F0F0]">
      <ChatListRow
        id={id}
        circle={circle ?? <span aria-hidden className="h-12 w-12 shrink-0 rounded-full bg-muted" />}
        title={title}
        onOpen={onOpen}
      />
    </div>
  );
}

function HomeError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 px-3 py-4">
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <VoiceMark size={20} />
        <span>Couldn&apos;t load your projects.</span>
      </div>
      <button type="button" onClick={onRetry} className="text-[13px] text-foreground underline underline-offset-2">
        Try again
      </button>
    </div>
  );
}
