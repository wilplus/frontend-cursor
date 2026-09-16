"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { RecordStep } from "./RecordStep";
import {
  BodyStep, CoverStep, DetailsStep, ExcerptStep, NameStep,
  ReviewStep, TagStep, TitleStep, WordsStep,
} from "./LaneSteps";

const PW_KEY = "willpower.journal.pw";

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
  const [said, setSaid] = useState<string | null>(null);
  const restored = useRef(false);

  const lane: Lane | null =
    path[0] === "exercise" ? "exercise" : path[0] === "post" ? "post" : null;
  const steps = lane ? stepsFor(lane) : [];
  const step = lane ? clampStep(lane, path[1] ?? 1) : 0;
  const current = steps[step - 1];

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(PW_KEY);
      if (saved) setPassword(saved);
      else router.replace("/cms");
    } catch {
      router.replace("/cms");
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
    setUploading(true);
    const kind = draft?.coverKind ?? "image";
    const presigned = await adminPresign(password, {
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      kind: kind as JournalCoverKind,
    });
    if (!presigned.ok || !presigned.data) {
      setUploading(false);
      setSaid(presigned.ok ? "Could not prepare the upload." : presigned.message);
      return;
    }
    const ok = await uploadToStorage(presigned.data, file);
    setUploading(false);
    if (!ok) { setSaid("The upload did not finish."); return; }
    patch({ coverUrl: presigned.data.publicUrl });
  }

  /** Write the post. The exercise lane needs one too — the founder kept the
   *  coupling, so an exercise is a published post plus a mapping. */
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
    const post = await savePost(draft, publish);
    if (!post.id) { setBusy(false); setSaid(post.message); return; }
    patch({ postId: post.id });

    if (draft.lane === "exercise") {
      const saved = await adminSaveDiagnosticExercise(password, {
        exerciseId: draft.exerciseId,
        journalPostId: post.id,
        title: draft.title,
        instruction: draft.instruction,
        introductionCopy: draft.opening,
        confidentIntroductionCopy: "",
        explanationVideoUrl: draft.videoUrl,
        acousticProblemTags: draft.tags,
        active: publish,
      });
      if (!saved.ok) { setBusy(false); setSaid(saved.message); return; }
    }
    setBusy(false);
    clearDraft();
    router.push("/cms");
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
      case "name": return <NameStep draft={draft} patch={patch} />;
      case "title": return <TitleStep draft={draft} patch={patch} idKeep="-" />;
      case "fixes": return <TagStep draft={draft} patch={patch} errors={errors} />;
      case "words": return <WordsStep draft={draft} patch={patch} />;
      case "writeup": return <BodyStep draft={draft} patch={patch} hint="Published to the journal." />;
      case "body": return <BodyStep draft={draft} patch={patch} />;
      case "excerpt": return <ExcerptStep draft={draft} patch={patch} />;
      case "cover":
        return <CoverStep draft={draft} patch={patch} onUpload={(f) => void uploadCover(f)} busy={uploading} />;
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
  }, [draft, current, errors, password, uploading, patch]);

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

  return (
    <LaneShell
      step={step}
      total={steps.length}
      dark={dark}
      onBack={() => (step > 1 ? go(step - 1) : router.push("/cms/new"))}
      onClose={() => router.push("/cms")}
      footer={
        <>
          {/* The camera screen carries the record ring and nothing else —
              a CTA beside it competes with the one thing the screen is for.
              It reappears the moment there is a clip to move on from. */}
          {dark ? null : (
            <LaneCta
              onClick={() => (last ? void finish(true) : next())}
              disabled={busy || uploading}
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
