/*
STORY    As a speaker, I want every way into a Take's Ideal Text or feedback
         to open that Take in its project chat, so that the text is a bubble
         of the chat and never a screen of its own (backend N691 item 2).
OUTCOME  O1  The Take a link or card names opens; else the Take at the
             version's index; else the project's newest Take.
PROVES   O1 -> "opens the Take named, else the one at its index, else the newest"
*/
import { expect, it } from "vitest";
import type { TrainingArc } from "@/services/api/trainings";
import { takeInProject } from "./takeInProject";

const project = {
  arcId: "arc-1",
  takes: [
    { sessionId: "take-2", takeIndex: 2 },
    { sessionId: "take-1", takeIndex: 1 },
    { sessionId: "take-3", takeIndex: 3 },
  ],
} as unknown as TrainingArc;

it("opens the Take named, else the one at its index, else the newest", () => {
  expect(takeInProject(project, { sessionId: "take-1", step: "feedback" })?.sessionId).toBe("take-1");
  expect(takeInProject(project, { takeIndex: 2, step: "ideal" })?.sessionId).toBe("take-2");
  expect(takeInProject(project, { sessionId: "gone", step: "ideal" })?.sessionId).toBe("take-3");
  expect(takeInProject({ ...project, takes: [] } as TrainingArc, { step: "ideal" })).toBeNull();
});
