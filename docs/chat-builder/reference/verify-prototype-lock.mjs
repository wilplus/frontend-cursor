import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "chat-continue-prototype.html"), "utf8");
const rendered = readFileSync(join(here, "chat-continue-prototype-rendered.html"), "utf8");
const lock = JSON.parse(readFileSync(join(here, "chat-continue-prototype.lock.json"), "utf8"));

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};
const section = (start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, `Missing source section: ${start}`);
  return from >= 0 && to > from ? source.slice(from, to) : "";
};
const count = (text, needle) => text.split(needle).length - 1;

const projectChat = section("function projectChat", "function listView");
const willChat = section("function willChat", "function projectChat");
const renderFlow = section("function render()", "function openPlanSheet");
const practicePicker = section("function renderPracticePicker", "function openPracticeRecording");
const recording = section("function renderPracticeRecording", "function savePracticeCheckpoint");
const projectAfterWalk = section("function openProjectConversationAfterWalk", "function renderPracticeFeedbackWalk");
const feedbackWalk = section("function renderPracticeFeedbackWalk", "function openOnboarding");
const idealDecision = section("function continueAfterIdeal", "function renderIdealText");
const idealText = section("function renderIdealText", "function openProjectSheet");

assert(count(projectChat, "data-open-walk") === 1, "Project chat must contain exactly one Feedback Walk surface.");
assert(count(projectChat, "data-open-ideal-text") === 1, "Project chat must contain exactly one Ideal Text surface.");
assert(!projectChat.includes("projectTakeBubble"), "A separate recording bubble was reintroduced.");
assert(projectChat.includes('hasPractice ? "Continue recording" : "Start recording"'), "Project CTA labels changed.");
assert(projectChat.includes("data-project-answer") && projectChat.includes("wlp-project-answer-form"), "Project-specific tap/text answers disappeared.");
assert(projectChat.includes("Who were you talking to?") && projectChat.includes("Does that match what you wanted?"), "Project-specific context questions moved out of the project.");
assert(!projectChat.includes("microphone"), "A voice composer was added to the project chat.");
assert(!projectChat.includes("Training paused") && !projectChat.includes("Choose training length"), "A removed paused/training card was reintroduced.");
assert(renderFlow.includes("projectResearch.decisionPending") && renderFlow.includes("openIdealText()"), "Project Continue recording no longer opens the Ideal Text decision after the questions.");

assert(willChat.includes("composer()"), "Will must retain the text composer.");
assert(!willChat.includes("data-practice-start") && !willChat.includes("wlp-record-dock-button"), "A recording action was added to Will.");
assert(willChat.includes("We spotted a pattern!") && willChat.includes("Across your recent projects"), "Will's weekly cross-project pattern disappeared.");
assert(source.includes("function renderSundayLens") && source.includes("What kind of error is it?") && source.includes("Did you have a principle in place already?") && source.includes("Reflections: what do you take from this?"), "The existing Principles investigation steps disappeared.");
assert(source.includes("Rushing") && source.includes("Ending compression") && source.includes("Hedging") && source.includes("Word compression") && source.includes("Filler words"), "The Speaking Errors library disappeared from Principles.");
assert(source.includes("Name the error") && source.includes("What is measured?") && source.includes("The single question it asks") && source.includes("routes no exercise until a detector"), "The complete observed-error form disappeared.");
assert(source.includes("data-sunday-accept") && source.includes("data-sunday-edit") && source.includes("data-sunday-decline"), "Principle confirmation must keep Accept, Edit and Not now.");
assert(source.includes("Noted. Added to your principles."), "Confirmed principles no longer land in the Principles mechanism.");
assert(!willChat.includes("Who were you talking to?") && !willChat.includes("Does that match what you wanted?"), "Project-specific Take questions leaked into Will.");

assert(!practicePicker.includes("data-practice-time") && !recording.includes("data-practice-time"), "Practice duration became configurable again.");
assert(source.includes("Do you have a time limit?") && source.includes("No time limit") && source.includes("data-setup-other") && source.includes("wlp-setup-custom-minutes"), "The whole-presentation time-limit question is incomplete.");
assert(source.includes("practiceDurationSeconds = 300") && source.includes("chat.timeLimitMinutes = targetMinutes"), "The five-minute practice maximum is no longer separate from the presentation limit.");
assert(practicePicker.includes("data-practice-start"), "The Continue from slide CTA disappeared.");
assert(practicePicker.includes("wlp-helper-words"), "Saved helper words disappeared.");
assert(!practicePicker.includes('type="range"') && !source.includes('type="range"'), "The removed slide range bar was reintroduced.");

assert(recording.includes("wlp-practice-recording-strip"), "The source recording clock/progress strip disappeared.");
assert(recording.includes("data-practice-back") && recording.includes("data-practice-next"), "The source recording navigation changed.");
assert(recording.includes("data-practice-finish"), "The source finish control disappeared.");
assert(recording.includes("openPracticeFeedbackWalk(true)") && recording.includes("openPracticeFeedbackWalk(false)"), "Finishing or leaving no longer opens Feedback Walk immediately.");

assert(feedbackWalk.includes("wlp-walk-audio") && feedbackWalk.includes("Lesson done."), "The real orange-audio Feedback Walk thread disappeared.");
assert(feedbackWalk.includes("These are your helper words") && feedbackWalk.includes("like a diamond. Like"), "Feedback Walk no longer produces the helper words.");
assert(feedbackWalk.includes("openProjectConversationAfterWalk") && !feedbackWalk.includes("openIdealText"), "Feedback Walk Next must return to the project conversation, not Ideal Text.");
assert(!feedbackWalk.includes("Great so far") && !feedbackWalk.includes("Lenses feedback"), "The invented grey feedback-summary screen returned.");
assert(projectAfterWalk.includes("projectResearch =") && projectAfterWalk.includes("current = chat.id"), "Feedback Walk no longer starts the same project's contextual conversation.");

assert(idealText.includes("wlp-ideal-copy"), "Ideal Text no longer shows the practised text.");
assert(idealText.includes("visibleFragments.map") && idealText.includes("wlp-ideal-fragment"), "Ideal Text no longer renders every slide in a multi-slide fragment.");
assert(idealText.includes("continueAfterIdeal(chat, fragmentStart)") && idealText.includes("continueAfterIdeal(chat, fragmentEnd + 1)"), "Multi-slide repeat/continue no longer uses the fragment boundaries.");
assert(idealText.includes("if (canContinue)") && idealText.includes("projectResearch.decisionPending = false") && idealText.includes("render();"), "Finishing the last fragment no longer returns to the project chat.");
assert(idealText.includes("Continue to next fragment") && idealText.includes("Repeat this fragment"), "The Ideal Text repeat/continue decision changed.");
assert(!idealText.includes("PRACTISED SO FAR"), "The removed Ideal Text progress label returned.");
assert(!idealText.includes("You have practised this fragment with helper words"), "The removed Ideal Text recommendation returned.");
assert(!idealText.includes('class="wlp-walk-link" data-ideal-close'), "The removed bottom Close action returned.");
assert(idealText.includes('data-ideal-close aria-label="Close"'), "The top-right Ideal Text close control disappeared.");
assert(!idealDecision.includes("openPracticePicker") && idealDecision.includes("renderPracticeRecording") && idealDecision.includes("decisionPending = false"), "Ideal Text no longer acts as the single decision screen before recording.");

for (const removed of ["Real-code mapping", "Training paused", "Saved · ready to continue", "PICK UP WHERE YOU LEFT OFF"]) {
  assert(!source.includes(removed), `Removed prototype-only copy returned: ${removed}`);
}

assert(source.includes("--wlp-canvas-width: 1080px") && source.includes("width: min(100%, var(--wlp-canvas-width))"), "The shared responsive app canvas changed.");
assert(rendered.includes('prototypeFrame.src = "chat-continue-prototype.html"'), "The rendered wrapper no longer loads the current prototype.");
assert(Array.isArray(lock.lockedContracts) && lock.lockedContracts.length >= 12, "The lock manifest is incomplete.");

if (failures.length) {
  console.error("Prototype lock failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`Prototype lock verified: ${lock.lockedContracts.length} approved contracts.`);
