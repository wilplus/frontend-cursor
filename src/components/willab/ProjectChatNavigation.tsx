"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUiLocale } from "@/components/ui/UiLocaleProvider";
import { uiText } from "@/lib/uiLocale";
import type { TrainingArc } from "@/services/api/trainings";
import { LetterCircle, WillMark } from "./chats/ChatList";

export type ProjectNavigation = {
  projects: readonly TrainingArc[];
  onProject: (project: TrainingArc) => void;
  onCoach: () => void;
};

export function ProjectMenuToggle({ id, open, onClick }: {
  id: string; open: boolean; onClick: () => void;
}) {
  const locale = useUiLocale();
  const Arrow = open ? ChevronLeft : ChevronRight;
  return <button type="button" aria-expanded={open} aria-controls={id}
    aria-label={uiText(locale, open ? "hideProjects" : "showProjects")} onClick={onClick}
    className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted">
    <Arrow className="size-[17px]" aria-hidden />
  </button>;
}

export function ProjectChatNavigation({ id, active, projects, onProject, onCoach }: ProjectNavigation & {
  id: string; active: TrainingArc;
}) {
  const locale = useUiLocale();
  const choices = projects.filter((project) => !project.archived && !project.deletion);
  if (!choices.some((project) => project.arcId === active.arcId)) choices.unshift(active);
  return <nav id={id} aria-label={uiText(locale, "chooseProject")}
    className="max-h-[min(45dvh,20rem)] w-full shrink-0 overflow-y-auto border-b border-border bg-background px-2 py-2 md:max-h-none md:w-[208px] md:border-b-0 md:border-r">
    <button type="button" onClick={onCoach}
      className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium hover:bg-muted">
      <WillMark size={25} /> {uiText(locale, "speakingCoach")}
    </button>
    <ul className="ml-4 border-l border-border pl-1">
      {choices.map((project) => <li key={project.arcId}>
        <button type="button" aria-label={project.topic} aria-current={project.arcId === active.arcId ? "page" : undefined}
          onClick={() => onProject(project)}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted aria-[current=page]:bg-accent">
          <LetterCircle id={project.arcId} name={project.topic} size={24} />
          <span className="min-w-0 break-words">{project.topic}</span>
        </button>
      </li>)}
    </ul>
  </nav>;
}
