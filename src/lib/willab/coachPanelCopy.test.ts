

import { describe, expect, it } from "vitest";
import { COACH_PANEL_COPY, COACH_PANEL_COPY_SOURCES } from "./coachPanelCopy";

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

describe("COACH_PANEL_COPY", () => {

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

  it("no signed word carries a percentage or a score (AC-9)", () => {
    const all = JSON.stringify(SIGNED_CP2_A) + JSON.stringify(PROTOTYPE_Q_B4_A) + JSON.stringify(COACH_PANEL_COPY);
    expect(all).not.toMatch(/%|\bscore\b/i);
  });
});
