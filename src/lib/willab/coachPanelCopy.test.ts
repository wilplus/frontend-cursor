import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { CHUNK_SHEET_COPY, WALK_COPY } from "@/components/willab/idealEditCopy";
import { STAGE_COST } from "@/services/api/trainingCorpus";
import { COACH_PANEL_COPY, COACH_PANEL_COPY_SOURCES } from "./coachPanelCopy";
import { COACH_WALK_COPY } from "./coachWalkCopy";

/* -------------------------------------------------------------------------- */
/*  THE COACH PANEL SAYS ONLY SIGNED WORDS (LIVE LOOP: copy needs the          */
/*  founder's sign-off).                                                       */
/*                                                                            */
/*  Every string in COACH_PANEL_COPY is either (a) on the lock's signed list  */
/*  below, pasted from FOUNDER-LOCK-coach-panel-redesign-2026-10-06 ("Words   */
/*  signed (CP2 A)"), (b) the very value an existing copy module exports,     */
/*  (c) one of the two buttons the lock's flow names, or (d) a word the       */
/*  locked prototype shows (docs/design/coach-panel-redesign-2026-10-06.html  */
/*  in the backend repo), signed with its design by the founder's Q-B4 A of   */
/*  2026-10-07 and listed below. And the panel's components carry no literal  */
/*  word of their own.                                                        */
/* -------------------------------------------------------------------------- */

/** Pasted verbatim from the lock, "Words signed (CP2 A)", `{p}` the speaker. */
const SIGNED_CP2_A = [
  "Queue: Your speakers · {n} moments waiting",
  "A speaker: Goal: … · {n} of {m} moments waiting · All moments answered · Answered · {n} moments",
  "All speakers: Your speakers",
  "What happened (title) · The machine heard",
  "What kind of error is it? · The machine heard this · Something else · Name a new error · I don't hear an error",
  "Name the error · A few words, as you would say it to another coach · e.g. trailing off · Your exercise goes to {p} now. The library offers it to other speakers once the machine can hear this error; every coach who names it brings that closer.",
  "Choose exercise (the founder's own title, 21:39 UTC) · What will you do? · Served: {exercise} · {n} more for {error} in the library · Your own words and video · Write your praise · Write a clearer version · Write a note",
  "Swap it: All treat {error} · shown in random order · Served now · Treats: {error} · Details",
  "An exercise's details: Treats: {error} · Back to the list",
  "Your words: As {p} will see it · the pencil edits every word",
  "Your video: Say the instruction in your own words · under a minute · Optional · under a minute",
  "What did {p} do well? · What kind of fix is it?",
  "Ready for {p} · Without a video it goes to {p} only, not to the library. · In the library under “{error}”, waiting until the machine can hear it.",
  "Summary: Your answer · Change my answer",
  "A word for this Take: Optional · it opens first in {p}’s feedback · As {p} will see it · Send without a video",
  "Training corpus: Import audio, label it, then judge its moments blind · {n} imports · {n} moments to judge · {n} of {m} moments to judge · One recording · it is cut into moments you judge blind · Choose a file · Audio or video, up to 30 minutes · Imported · {n} moments",
  "Training corpus set-up: Finish the set-up · Before its moments can be judged · Set-up not finished · finish it before judging · Set up · {n} moments",
  "Library (now in admin): One error · the library offers it when the machine hears it · As a speaker will see it · the pencil edits every word · An exercise needs its video · Bring it back · Retire it · Praise lines the library offers when the machine hears this · None yet. · Exercises that treat it",
] as const;

/** The lock's flow, step 1: "Two buttons pinned above the message box, with
 *  icons: **Speakers** … and **Training corpus**." */
const LOCK_FLOW_NAMES = ["Speakers", "Training corpus"] as const;

/** The words the locked prototype shows that no list carries, one line per
 *  screen as the prototype names it (Q-B4 A, 2026-10-07: "Every word a locked
 *  prototype shows is signed with its design. Where a signed list differs,
 *  the list wins"). The set-up fields are the corpus page's own words. */
const PROTOTYPE_Q_B4_A = [
  "lounge: Library · Lounge",
  "summary: Summary",
  "reveal: — · nothing",
  "kind: confident read · opened strong · landed the ending · kept moving · settled pitch · no hesitation · full volume · wide range",
  "speakers: All answered · {n} Takes",
  "corpushome: Import audio · No speaker label · All {n} labelled",
  "corpusimport: Import · What the talk is about · The topic · Whose voice this is · Speaker name · Optional, but it is the only way the corpus can tell whose voice a piece is. Worth filling in per batch. · What language it is in · Choose… · Required — auto-detect is a choice, not a default. Whisper is primed with an English prompt, so a talk left on auto-detect can come back translated into English rather than transcribed: the audio is right, the words are not, and nothing says so. · Where it came from · 2019 conference, YouTube · What to run · Confidence · Always on — this is what produces the pieces and the label queue, i.e. the corpus itself. · Analytics · Ideal text",
  "corpusanalyse: Analysing on the server…",
  "video: Camera · Recording · Stop",
  "library: New · {n} praise lines · Retired · Back in the library",
  "words: Edit · Done editing · Your words",
  "errors: Speaking errors · The patterns coaches name in moments. A pattern routes exercises only once a detector can hear it. · Detected in audio · routes exercises · Being tested · routes nothing yet · Named only · waiting on a detector · Detected · Being tested silently · Observed",
  "error: Coaches heard it on {n} of {m} checked moments.",
] as const;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Each signed fragment as a pattern: a placeholder is any number or name. */
function fragmentsOf(lines: readonly string[]): RegExp[] {
  return lines
    .flatMap((line) => {
      const parts = line.split(" · ");
      // The first fragment may carry the screen's name ("Queue: "); keep both.
      const first = parts[0];
      const colon = first.indexOf(": ");
      if (colon > 0) parts.push(first.slice(colon + 2));
      return parts;
    })
    .map((fragment) => {
      const pattern = escape(fragment.replace(/\s*\((the )?title\)|\s*\(the founder's own title.*\)/, ""))
        .replace(/\\\{n\\\}|\\\{m\\\}/g, "\\d+")
        .replace(/\\\{[a-z]+\\\}/g, ".+")
        // "Goal: …" on the list: the speaker's own goal follows.
        .replace(/…/g, ".+");
      return new RegExp(`^${pattern}$`);
    });
}
const FRAGMENTS: RegExp[] = fragmentsOf(SIGNED_CP2_A);
/** The prototype's group labels carry " · " themselves ("Detected in audio ·
 *  routes exercises"), so a whole line is a fragment too. */
const PROTOTYPE_FRAGMENTS: RegExp[] = [
  ...fragmentsOf(PROTOTYPE_Q_B4_A),
  ...PROTOTYPE_Q_B4_A.map((line) => line.slice(line.indexOf(": ") + 2)).flatMap((rest) => {
    const pairs: string[] = [];
    const parts = rest.split(" · ");
    for (let i = 0; i + 1 < parts.length; i += 1) pairs.push(`${parts[i]} · ${parts[i + 1]}`);
    return pairs;
  }).map((pair) => new RegExp(`^${escape(pair).replace(/\\\{n\\\}|\\\{m\\\}/g, "\\d+")}$`)),
];

/** A rendered string is signed when every " · " piece is a signed fragment;
 *  a count of one may read in the singular ("1 moment waiting"). */
function isSigned(text: string, fragments: RegExp[] = FRAGMENTS): boolean {
  if (fragments.some((re) => re.test(text))) return true;
  return text.split(" · ").every((piece) => {
    const plural = piece
      .replace(/^(.*\b1 )(moment|import|Take|praise line)\b/, "$1$2s")
      .replace(/^1 (moment|import|Take|praise line)\b/, "1 $1s");
    return fragments.some((re) => re.test(piece) || re.test(plural));
  });
}
const isPrototype = (text: string) => isSigned(text, PROTOTYPE_FRAGMENTS);

/** Every value an existing copy module exports, by identity. */
function exportedValues(value: unknown): unknown[] {
  if (value && typeof value === "object") return [value, ...Object.values(value).flatMap(exportedValues)];
  return [value];
}
const EXISTING = new Set<unknown>([
  ...exportedValues(COACH_WALK_COPY), ...exportedValues(CHUNK_SHEET_COPY), ...exportedValues(WALK_COPY),
  ...exportedValues(STAGE_COST),
]);

describe("COACH_PANEL_COPY", () => {
  it("reuses existing words by reference, never by retyping", () => {
    for (const key of COACH_PANEL_COPY_SOURCES.reused) {
      if (key === "take") continue; // composed below
      const value = COACH_PANEL_COPY[key as keyof typeof COACH_PANEL_COPY];
      expect(EXISTING.has(value), key).toBe(true);
    }
  });

  it("composes 'Take N' from the signed coach-card word (L6)", () => {
    expect(COACH_PANEL_COPY.take(2)).toBe(`${CHUNK_SHEET_COPY.historyTake} 2`);
    expect(COACH_PANEL_COPY.take(null)).toBe(CHUNK_SHEET_COPY.historyTake);
  });

  it("every new word is on the lock's signed list", () => {
    const C = COACH_PANEL_COPY;
    const samples: Record<string, string[]> = {
      yourSpeakers: [C.yourSpeakers],
      momentsWaiting: [C.momentsWaiting(1), C.momentsWaiting(4)],
      goal: [C.goal("Sound calm and sure in the board meeting.")],
      takeWaiting: [C.takeWaiting(2, 4)],
      allMomentsAnswered: [C.allMomentsAnswered],
      answered: [C.answered],
      answeredMoments: [C.answeredMoments(1), C.answeredMoments(3)],
      whatHappened: [C.whatHappened],
      machineHeard: [C.machineHeard],
      whatKindOfError: [C.whatKindOfError],
      machineHeardThis: [C.machineHeardThis],
      somethingElse: [C.somethingElse],
      nameANewError: [C.nameANewError],
      noError: [C.noError],
      nameTheError: [C.nameTheError],
      nameTheErrorHint: [C.nameTheErrorHint],
      nameTheErrorPlaceholder: [C.nameTheErrorPlaceholder],
      nameTheErrorNote: [C.nameTheErrorNote("Quiet Heron")],
      chooseExercise: [C.chooseExercise],
      whatWillYouDo: [C.whatWillYouDo],
      served: [C.served("Land the last word")],
      moreInLibrary: [C.moreInLibrary(2, "rushing")],
      yourOwnWordsAndVideo: [C.yourOwnWordsAndVideo],
      writeYourPraise: [C.writeYourPraise],
      writeAClearerVersion: [C.writeAClearerVersion],
      writeANote: [C.writeANote],
      allTreat: [C.allTreat("ending compression")],
      shownInRandomOrder: [C.shownInRandomOrder],
      servedNow: [C.servedNow],
      treats: [C.treats("rushing")],
      details: [C.details],
      backToTheList: [C.backToTheList],
      asWillSeeIt: [C.asWillSeeIt("Quiet Heron")],
      pencilEditsEveryWord: [C.pencilEditsEveryWord],
      sayTheInstruction: [C.sayTheInstruction],
      underAMinute: [C.underAMinute],
      optional: [C.optional],
      whatDidDoWell: [C.whatDidDoWell("Quiet Heron")],
      whatKindOfFix: [C.whatKindOfFix],
      readyFor: [C.readyFor("Quiet Heron")],
      withoutAVideo: [C.withoutAVideo("Quiet Heron")],
      inTheLibraryUnder: [C.inTheLibraryUnder("trailing off")],
      yourAnswer: [C.yourAnswer],
      changeMyAnswer: [C.changeMyAnswer],
      opensFirstIn: [C.opensFirstIn("Quiet Heron")],
      sendWithoutAVideo: [C.sendWithoutAVideo],
      corpusCaption: [C.corpusCaption],
      imports: [C.imports(1), C.imports(3)],
      momentsToJudge: [C.momentsToJudge(1), C.momentsToJudge(5)],
      momentsToJudgeOf: [C.momentsToJudgeOf(2, 5)],
      oneRecording: [C.oneRecording],
      cutIntoMoments: [C.cutIntoMoments],
      chooseAFile: [C.chooseAFile],
      audioOrVideo: [C.audioOrVideo],
      imported: [C.imported],
      moments: [C.moments(1), C.moments(8)],
      finishTheSetUp: [C.finishTheSetUp],
      beforeItsMomentsCanBeJudged: [C.beforeItsMomentsCanBeJudged],
      setUpNotFinished: [C.setUpNotFinished],
      finishItBeforeJudging: [C.finishItBeforeJudging],
      setUp: [C.setUp],
      oneError: [C.oneError],
      libraryOffersIt: [C.libraryOffersIt],
      asASpeakerWillSeeIt: [C.asASpeakerWillSeeIt],
      anExerciseNeedsItsVideo: [C.anExerciseNeedsItsVideo],
      bringItBack: [C.bringItBack],
      retireIt: [C.retireIt],
      praiseLinesCaption: [C.praiseLinesCaption],
      noneYet: [C.noneYet],
      exercisesThatTreatIt: [C.exercisesThatTreatIt],
    };
    expect(Object.keys(samples).sort()).toEqual([...COACH_PANEL_COPY_SOURCES.signed].sort());
    for (const [key, texts] of Object.entries(samples)) {
      for (const text of texts) expect(isSigned(text), `${key}: ${text}`).toBe(true);
    }
  });

  it("the list wins where the prototype differs: 'Choose a file', not 'Choose files' (Q-B4 A)", () => {
    expect(COACH_PANEL_COPY.chooseAFile).toBe("Choose a file");
    expect(isSigned("Choose files")).toBe(false);
    expect(JSON.stringify(COACH_PANEL_COPY)).not.toContain("Choose files");
  });

  it("every prototype-only word is one the locked prototype shows (Q-B4 A)", () => {
    const C = COACH_PANEL_COPY;
    const samples: Record<string, string[]> = {
      library: [C.library],
      lounge: [C.lounge],
      summary: [C.summary],
      noAnswer: [C.noAnswer],
      heardNothing: [C.heardNothing],
      cue: Object.values(C.cue),
      allAnsweredTakes: [C.allAnsweredTakes(1), C.allAnsweredTakes(3)],
      importAudio: [C.importAudio],
      importPill: [C.importPill],
      noSpeakerLabel: [C.noSpeakerLabel],
      allLabelled: [C.allLabelled(8)],
      analysing: [C.analysing],
      whatTheTalkIsAbout: [C.whatTheTalkIsAbout],
      topicPlaceholder: [C.topicPlaceholder],
      whoseVoiceThisIs: [C.whoseVoiceThisIs],
      speakerPlaceholder: [C.speakerPlaceholder],
      speakerHint: [C.speakerHint],
      whatLanguageItIsIn: [C.whatLanguageItIsIn],
      chooseLanguage: [C.chooseLanguage],
      languageHint: [C.languageHint],
      whereItCameFrom: [C.whereItCameFrom],
      sourcePlaceholder: [C.sourcePlaceholder],
      whatToRun: [C.whatToRun],
      runConfidence: [C.runConfidence],
      runConfidenceHint: [C.runConfidenceHint],
      runAnalytics: [C.runAnalytics],
      runIdealText: [C.runIdealText],
      camera: [C.camera],
      recording: [C.recording],
      stop: [C.stop],
      newNav: [C.newNav],
      praiseLines: [C.praiseLines(1), C.praiseLines(3)],
      toastRetired: [C.toastRetired],
      toastBackInTheLibrary: [C.toastBackInTheLibrary],
      edit: [C.edit],
      doneEditing: [C.doneEditing],
      yourWords: [C.yourWords],
      speakingErrors: [C.speakingErrors],
      errorsCaption: [C.errorsCaption],
      groupDetected: [C.groupDetected],
      groupBeingTested: [C.groupBeingTested],
      groupNamedOnly: [C.groupNamedOnly],
      stateDetected: [C.stateDetected],
      stateBeingTested: [C.stateBeingTested],
      stateObserved: [C.stateObserved],
      coachesHeardIt: [C.coachesHeardIt(9, 10)],
    };
    expect(Object.keys(samples).sort()).toEqual([...COACH_PANEL_COPY_SOURCES.prototype].sort());
    for (const [key, texts] of Object.entries(samples)) {
      for (const text of texts) expect(isPrototype(text), `${key}: ${text}`).toBe(true);
    }
  });

  it("the words the lock took off the screens are not reused", () => {
    const all = JSON.stringify(COACH_PANEL_COPY);
    for (const gone of [
      "Your diagnosis first", "Your diagnosis:", "nothing in the library treats it yet",
      "You don't hear an error", "So the library can offer it to the next speaker",
    ]) expect(all, gone).not.toContain(gone);
  });

  it("every key of the copy is accounted for by one source", () => {
    const sources = [
      ...COACH_PANEL_COPY_SOURCES.reused, ...COACH_PANEL_COPY_SOURCES.signed,
      ...COACH_PANEL_COPY_SOURCES.named, ...COACH_PANEL_COPY_SOURCES.prototype,
    ];
    expect(sources.length).toBe(new Set(sources).size);
    expect(Object.keys(COACH_PANEL_COPY).sort()).toEqual([...sources].sort());
  });

  it("the pinned buttons are the lock's own names", () => {
    expect([COACH_PANEL_COPY.speakers, COACH_PANEL_COPY.trainingCorpus]).toEqual([...LOCK_FLOW_NAMES]);
    expect([...COACH_PANEL_COPY_SOURCES.named].sort()).toEqual(["speakers", "trainingCorpus"]);
  });

  it("reuses the corpus page's stage hints, not a retyped copy", () => {
    expect(COACH_PANEL_COPY.runAnalyticsHint).toBe(STAGE_COST.analytics);
    expect(COACH_PANEL_COPY.runIdealTextHint).toBe(STAGE_COST.ideal_text);
  });

  it("the checker itself refuses an unsigned word", () => {
    expect(isSigned("3 speakers to judge")).toBe(false);
    expect(isSigned("Your score")).toBe(false);
    expect(isSigned("Your speakers")).toBe(true);
    expect(isSigned("2 of 4 moments waiting")).toBe(true);
    expect(isPrototype("Your score")).toBe(false);
    expect(isPrototype("Detected in audio · routes exercises")).toBe(true);
  });

  it("no signed word carries a percentage or a score (AC-9)", () => {
    const all = JSON.stringify(SIGNED_CP2_A) + JSON.stringify(PROTOTYPE_Q_B4_A) + JSON.stringify(COACH_PANEL_COPY);
    expect(all).not.toMatch(/%|\bscore\b/i);
  });
});

/* ── the panel's components carry no literal word ─────────────────────── */

const DIR = "src/components/willab/coachpanel";
const FILES = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
const SPOKEN_ATTRS = new Set(["aria-label", "title", "placeholder", "alt", "label", "aria-description"]);

function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(" ");
  return null;
}

function spoken(file: string): string[] {
  const text = readFileSync(join(DIR, file), "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && node.text.trim()) out.push(node.text.trim());
    if (ts.isJsxExpression(node) && node.expression && ts.isJsxElement(node.parent)) {
      const t = literalText(node.expression);
      if (t !== null) out.push(t);
    }
    if (ts.isJsxAttribute(node) && SPOKEN_ATTRS.has(node.name.getText(source)) && node.initializer) {
      const init = node.initializer;
      const t = ts.isStringLiteral(init)
        ? init.text
        : ts.isJsxExpression(init) && init.expression
          ? literalText(init.expression)
          : null;
      if (t !== null) out.push(t);
    }
    if (ts.isPropertyAssignment(node) && ["label", "title", "subtitle", "lead", "message"].includes(node.name.getText(source))) {
      const t = literalText(node.initializer);
      if (t !== null) out.push(t);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out.filter((t) => /[A-Za-z]/.test(t));
}

describe("the coach panel's components", () => {
  it("exist", () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it.each(FILES)("%s says no word of its own", (file) => {
    expect(spoken(file)).toEqual([]);
  });
});
