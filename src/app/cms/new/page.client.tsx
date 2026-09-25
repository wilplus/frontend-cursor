"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authoringReturnTo, withAttachedExercise } from "../interruptedDestination";
import { Loader2 } from "lucide-react";
import {
  adminCreatePost,
  adminListSpeakingErrors,
  adminPresign,
  adminSaveDiagnosticExercise,
  adminSetPublished,
  adminUpdatePost,
  uploadToStorage,
  type AdminSpeakingError,
} from "@/services/api/journalAdmin";
import type { JournalCategory, JournalCoverKind } from "@/services/api/journal";
import {
  blankDraft,
  clampStep,
  clearDraft,
  loadDraft,
  saveDraft,
  slugify,
  stepsFor,
  type Lane,
  type LaneDraft,
} from "./laneDraft";
import { LaneCta, LaneHeading, LaneQuiet, LaneShell } from "./LaneShell";
import { CoverDraw } from "./CoverDraw";
import {
  contentTypeFor,
  oversizeMessage,
  unsupportedMessage,
  type MediaKind,
} from "./laneMediaUpload";
import { RecordStep } from "./RecordStep";
import {
  BodyStep, CoverStep, DetailsStep, ExcerptStep, NameStep,
  ReviewStep, TagStep, TitleStep, WhereStep, WordsStep,
} from "./LaneSteps";

const PW_KEY = "willpower.journal.pw";

/** Presign, check the served cap, and PUT one cover file straight to R2.
 *  Returns the public URL, or the one sentence to show instead.
 *
 *  MODULE LEVEL, not a closure inside the lane component: the guards this
 *  needs (a served cap, a refused type, a dead presign, a PUT that did not
 *  finish) are four more branches in a component the complexity ratchet
 *  already holds at its ceiling, and none of them reads component state. */
async function putCoverFile(
  password: string,
  kind: MediaKind,
  contentType: string,
  file: File,
): Promise<{ url: string | null; message: string | null }> {
  const presigned = await adminPresign(password, {
    filename: file.name,
    contentType,
    kind: kind as JournalCoverKind,
  });
  if (!presigned.ok || !presigned.data) {
    return {
      url: null,
      message: presigned.ok ? "Could not prepare the upload." : presigned.message,
    };
  }
  // The only thing enforcing the cap: R2 takes whatever is PUT, because the
  // presign signs the key and the content type, not a length.
  const tooBig = oversizeMessage(file.size, presigned.data.maxBytes);
  if (tooBig) return { url: null, message: tooBig };
  const ok = await uploadToStorage(presigned.data, file);
  if (!ok) return { url: null, message: "The upload did not finish." };
  return { url: presigned.data.publicUrl, message: null };
}

/** The post id the cover generator draws for, saving the draft first if it has
 *  never been written. The generator briefs from a POST, not from a draft in
 *  sessionStorage, and the lane has written nothing until the author finishes —
 *  so the first draw saves it as an UNPUBLISHED post and keeps the id, which
 *  later steps update rather than duplicate.
 *
 *  Module level for the same reason as `putCoverFile`: four more branches in a
 *  component the ratchet holds at its ceiling. */
async function ensurePostId(
  draft: LaneDraft | null,
  save: (d: LaneDraft, publish: boolean) => Promise<{ id: string | null; message: string | null }>,
  onSaved: (id: string) => void,
): Promise<{ id: string | null; message: string | null }> {
  if (!draft) return { id: null, message: "Nothing to save yet." };
  if (draft.postId) return { id: draft.postId, message: null };
  const saved = await save(draft, false);
  if (saved.id) {
    onSaved(saved.id);
    return saved;
  }
  // The post lane has no address field, so "that slug is taken" is not
  // actionable as written. Say what the author can actually do.
  if (/slug|address/i.test(saved.message ?? "")) {
    return {
      id: null,
      message: "A post already lives at that address. Change the title, then draw again.",
    };
  }
  return saved;
}

/* -------------------------------------------------------------------------- */
/*  /cms/new — one action per screen (founder 2026-09-16).                     */
/*                                                                            */
/*  Its own route, not a panel inside the editor, for one reason that is not   */
/*  cosmetic: the coach's review panel links straight to                       */
/*  /cms/new/exercise/1 and must never see the fork. A step in the URL also    */
/*  means back and refresh land where the author was.                         */
/*                                                                            */
/*  CREATE ONLY. Opening something that already exists goes to the two-column  */
/*  editor, untouched — the founder's call, and the reason nothing here has to */
/*  survive being walked backwards over existing content.                     */
/* -------------------------------------------------------------------------- */

export default function NewContentClient({ path }: { path: string[] }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState<LaneDraft | null>(null);
  const [errors, setErrors] = useState<AdminSpeakingError[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const restored = useRef(false);

  const lane: Lane | null =
    path[0] === "exercise" ? "exercise" : path[0] === "post" ? "post" : null;
  // Draft-aware: the `where` ticks decide how long this lane is, so the step
  // list has to be read off the draft rather than the lane name. Before the
  // draft is restored a fresh lane is the right assumption — it publishes.
  const shape = draft ?? lane;
  const steps = shape ? stepsFor(shape) : [];
  const step = shape ? clampStep(shape, path[1] ?? 1) : 0;
  const current = steps[step - 1];

  /* THE PASSWORD GATE USED TO EAT THE DEEP LINK (founder 2026-09-24: from the
     judgement card "you should be already further down the path of recording
     the exercise").

     The coach's review hands off to /cms/new/exercise/1 — step 1 of the
     exercise lane IS the record screen, so the link was right. But the CMS
     password lives in sessionStorage, which is per-tab, and a coach judging
     takes has not opened the CMS in that tab. So this bounced to /cms and
     dropped the lane, the step and the returnTo with it: they typed the
     password, clicked through to new, and landed on the Post-or-Exercise fork
     — two screens behind where they were sent, with no way back to the piece
     they came from.

     The destination now rides the bounce and /cms resumes it after unlocking. */
  useEffect(() => {
    const here = () =>
      `/cms?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    try {
      const saved = window.sessionStorage.getItem(PW_KEY);
      if (saved) setPassword(saved);
      else router.replace(here());
    } catch {
      router.replace(here());
    }
  }, [router]);

  useEffect(() => {
    if (!password) return;
    void adminListSpeakingErrors(password).then((r) => {
      if (r.ok) setErrors(r.data);
    });
  }, [password]);

  // Restore once. A lane is eight screens long and a stray back-swipe must not
  // cost the author everything they have typed.
  useEffect(() => {
    if (!lane || restored.current) return;
    restored.current = true;
    const saved = loadDraft();
    setDraft(saved && saved.lane === lane ? saved : blankDraft(lane));
  }, [lane]);

  const patch = useCallback((next: Partial<LaneDraft>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...next };
      saveDraft(merged);
      return merged;
    });
    setSaid(null);
  }, []);

  const go = useCallback(
    (to: number) => {
      if (!lane) return;
      router.push(`/cms/new/${lane}/${to}`);
    },
    [lane, router],
  );

  async function uploadCover(file: File) {
    const kind = draft?.coverKind ?? "image";
    const contentType = contentTypeFor(file);
    // Refused before any request goes out, and before the spinner: a file of
    // the wrong type is not an upload that failed.
    const wrongType = unsupportedMessage(contentType, kind);
    if (wrongType) { setSaid(wrongType); return; }
    setUploading(true);
    const done = await putCoverFile(password, kind, contentType, file);
    setUploading(false);
    if (done.url) patch({ coverUrl: done.url });
    else setSaid(done.message);
  }

  /** The cover generator draws for a POST — it reads the title to write the
   *  brief and attaches the result server-side. The lane has written nothing
   *  yet, so the first draw saves the draft as an UNPUBLISHED post and keeps
   *  its id, which later steps then update rather than duplicate. */
  const ensurePost = useCallback(
    () => ensurePostId(draft, savePost, (id) => patch({ postId: id })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, patch],
  );

  /** Write the post. The exercise lane no longer NEEDS one — since 2026-09-23
   *  an exercise stands on its video and instruction — so `finish` calls this
   *  only when the author kept the write-up tick. */
  async function savePost(d: LaneDraft, publish: boolean) {
    const fields = {
      slug: d.slug || slugify(d.title),
      title: d.title,
      excerpt: d.excerpt,
      category: d.category as JournalCategory,
      read_time_min: d.readMinutes ? Number(d.readMinutes) : null,
      cover_kind: d.coverKind as JournalCoverKind,
      cover_image_url: d.coverKind === "image" ? d.coverUrl || null : null,
      cover_alt: d.coverAlt || null,
      media_url: d.coverKind === "image" ? null : d.coverUrl || null,
      media_duration_sec: null,
      body: d.body,
      author_name: d.author,
      published_at: d.publishedAt || null,
    };
    const written = d.postId
      ? await adminUpdatePost(password, d.postId, fields)
      : await adminCreatePost(password, fields);
    if (!written.ok || !written.data) {
      return { id: null, message: written.ok ? "The post was not returned." : written.message };
    }
    const id = written.data.id;
    if (publish && written.data.status !== "published") {
      const flipped = await adminSetPublished(password, id, true);
      if (!flipped.ok) return { id: null, message: flipped.message };
    }
    return { id, message: null as string | null };
  }

  async function finish(publish: boolean) {
    if (!draft || busy) return;
    setBusy(true);
    setSaid(null);

    // NO POST UNLESS THE AUTHOR ASKED FOR ONE. An exercise that declined the
    // write-up has no title page, no cover and no address — writing an empty
    // one anyway would put a blank entry on the public journal, which is worse
    // than the missing explanation it was meant to stand in for.
    const wantsPost = draft.lane !== "exercise" || draft.publishPost;
    let postId: string | null = null;
    if (wantsPost) {
      const post = await savePost(draft, publish);
      if (!post.id) { setBusy(false); setSaid(post.message); return; }
      postId = post.id;
      patch({ postId });
    }

    if (draft.lane === "exercise") {
      const saved = await adminSaveDiagnosticExercise(password, {
        exerciseId: draft.exerciseId,
        journalPostId: postId,
        title: draft.title,
        instruction: draft.instruction,
        introductionCopy: draft.opening,
        confidentIntroductionCopy: "",
        explanationVideoUrl: draft.videoUrl,
        acousticProblemTags: draft.tags,
        active: publish,
        avatarTrainingEligible: draft.avatarEligible,
        avatarSetupLabel: draft.avatarSetupLabel.trim(),
      });
      if (!saved.ok) { setBusy(false); setSaid(saved.message); return; }
    }
    setBusy(false);
    clearDraft();
    // Back where they came from, when they came from somewhere. The coach's
    // review sends `?returnTo=` so the queue reopens on the exact piece; the
    // catalogue is only the right destination for an author who started here.
    // An exercise that came from a moment also sends its own id back, so that
    // moment opens with it already chosen. A post has nothing to attach, and
    // an author who started in the catalogue has no moment to return to.
    const back = authoringReturnTo() ?? "/cms";
    const cameFromAMoment = back !== "/cms";
    router.push(
      draft.lane === "exercise" && cameFromAMoment
        ? withAttachedExercise(back, draft.exerciseId)
        : back,
    );
  }

  function next() {
    if (!draft || !current) return;
    const problem = current.problem(draft);
    if (problem) { setSaid(problem); return; }
    if (step < steps.length) go(step + 1);
  }

  const body = useMemo(() => {
    if (!draft || !current) return null;
    switch (current.id) {
      case "record":
        return (
          <RecordStep
            password={password}
            videoUrl={draft.videoUrl}
            onVideo={(url, seconds) => patch({ videoUrl: url, videoSeconds: seconds })}
            onBusyChange={setUploading}
          />
        );
      case "where": return <WhereStep draft={draft} patch={patch} />;
      case "name": return <NameStep draft={draft} patch={patch} />;
      case "title": return <TitleStep draft={draft} patch={patch} idKeep="-" />;
      case "fixes": return <TagStep draft={draft} patch={patch} errors={errors} />;
      case "words": return <WordsStep draft={draft} patch={patch} />;
      case "writeup": return <BodyStep draft={draft} patch={patch} hint="Published to the journal." />;
      case "body": return <BodyStep draft={draft} patch={patch} />;
      case "excerpt": return <ExcerptStep draft={draft} patch={patch} />;
      case "cover":
        return (
          <CoverStep
            draft={draft}
            patch={patch}
            onUpload={(f) => void uploadCover(f)}
            busy={uploading}
            draw={
              <CoverDraw
                password={password}
                ensurePost={ensurePost}
                onDrawn={(imageUrl, altText) =>
                  patch({
                    coverKind: "image",
                    coverUrl: imageUrl,
                    // The model writes alt text FOR the image it just drew, so
                    // it replaces whatever described the previous one.
                    ...(altText ? { coverAlt: altText } : {}),
                  })
                }
                onBusyChange={setDrawing}
              />
            }
          />
        );
      case "details": return <DetailsStep draft={draft} patch={patch} />;
      case "community":
        return (
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Community prompts are drawn from the body in the editor, after this.
          </p>
        );
      case "publish": return <ReviewStep draft={draft} />;
      default: return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, current, errors, password, uploading, patch, ensurePost]);

  if (!lane) return <Fork onPick={(picked) => router.replace(`/cms/new/${picked}/1`)} />;
  if (!draft || !current) {
    return (
      <main className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      </main>
    );
  }

  const dark = current.id === "record" && !draft.videoUrl;
  const last = step === steps.length;
  /** The lane is mid-write. Holding BOTH the CTA and Enter on one value is
   *  what stops the two drifting apart the next time a slow lane is added. */
  const laneBusy = busy || uploading || drawing;
  /** The one thing the CTA does, so Enter does exactly it and not a copy. */
  const advance = () => (last ? void finish(true) : next());

  return (
    <LaneShell
      step={step}
      total={steps.length}
      dark={dark}
      onBack={() => (step > 1 ? go(step - 1) : router.push("/cms/new"))}
      onClose={() => router.push("/cms")}
      // The camera screen deliberately has no CTA, so Enter has nothing to do
      // there. Everywhere else Enter is the CTA — literally the same call, so
      // the two can never drift — including Publish on the last screen, which
      // is what the button under the thumb does too.
      onEnter={dark || laneBusy ? undefined : advance}
      footer={
        <>
          {/* The camera screen carries the record ring and nothing else —
              a CTA beside it competes with the one thing the screen is for.
              It reappears the moment there is a clip to move on from. */}
          {dark ? null : (
            <LaneCta
              onClick={advance}
              disabled={laneBusy}
              dark={dark}
            >
              {busy ? "Saving…" : last ? "Publish" : "Next"}
            </LaneCta>
          )}
          {last ? (
            <LaneQuiet onClick={() => void finish(false)}>Save as draft</LaneQuiet>
          ) : current.skippable ? (
            <LaneQuiet onClick={() => go(step + 1)} dark={dark}>Skip</LaneQuiet>
          ) : null}
          {said ? (
            <p className={`text-center text-[13px] ${dark ? "text-[#e0908a]" : "text-destructive"}`}>
              {said}
            </p>
          ) : null}
        </>
      }
    >
      {dark ? null : <LaneHeading small={current.id === "writeup" || current.id === "body"}>{current.heading}</LaneHeading>}
      {dark ? <LaneHeading>{current.heading}</LaneHeading> : null}
      {body}
    </LaneShell>
  );
}

function Fork({ onPick }: { onPick: (lane: Lane) => void }) {
  return (
    <main className="flex h-full flex-col bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-16">
        <LaneHeading>What are you adding?</LaneHeading>
        <div className="flex flex-col gap-3">
          {([
            ["post", "Post", "Writing for the journal"],
            ["exercise", "Exercise", "Something a speaker practises"],
          ] as const).map(([id, name, what]) => (
            <button
              key={id}
              type="button"
              onClick={() => onPick(id)}
              className="flex w-full flex-col items-start gap-1.5 rounded-2xl border border-border bg-background px-5 py-6 text-left"
            >
              <span className="text-[17px] font-semibold">{name}</span>
              <span className="text-[14px] text-muted-foreground">{what}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
