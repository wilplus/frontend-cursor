"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, AudioLines, CalendarDays, ChevronLeft, ChevronRight, FileText, LockKeyhole, Mail, MessagesSquare } from "lucide-react";
import { dayKey, fmtDay, fmtTime, money } from "@/lib/booking/time";
import {
  bookCoachCall, HumanCoachError, readCoachCalendar, readCoachReviewPreview, sendCoachReview,
  type CoachCalendar, type HumanCoachOffer, type ReviewPreview,
} from "@/services/api/humanCoach";
import { useLoungeThreadMaybe } from "../LoungeThreadContext";

export const COACH_REVIEW_CHANGED = "willab:coach-review-changed";

const ACTION = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium leading-snug text-foreground hover:bg-muted disabled:opacity-50";
const PRIMARY = "min-h-11 shrink-0 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40";
const FIELD = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base text-foreground";
const SUBTLE = "text-[13px] text-muted-foreground";
const DATES_PER_PAGE = 4;

export default function HumanCoachHandoff({ offer, insideProject }: { offer: HumanCoachOffer; insideProject: boolean }) {
  const [opened, setOpened] = useState<"book" | "send" | null>(null);
  const [booked, setBooked] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const thread = useLoungeThreadMaybe();
  const close = () => setOpened(null);
  const canSend = offer.send && offer.project_id && offer.take_session_id;

  return <div className="mt-3 whitespace-normal">
    <div className="flex flex-wrap gap-2">
      {offer.book && <button type="button" className={ACTION} onClick={() => setOpened("book")} disabled={booked !== null}>
        <CalendarDays className="size-4 text-primary" aria-hidden />Book a call
      </button>}
      {canSend && <button type="button" className={ACTION} onClick={() => setOpened("send")} disabled={sent}>
        <Mail className="size-4 text-primary" aria-hidden />Send Take to Artur
      </button>}
    </div>
    {booked && !thread ? <p className={"mt-2 " + SUBTLE} role="status">Call booked with Artur · {booked}</p> : null}
    {sent && !insideProject ? <p className={"mt-2 " + SUBTLE} role="status">Take sent to Artur. His feedback will come back to the project chat.</p> : null}
    {opened === "book" && <HandoffDialog title="Book a call with Artur" onClose={close} subheading="Video call">
      <BookingSheet project={insideProject ? offer.project_id : null} onBooked={(when) => {
        setBooked(when);
        close();
        void thread?.reload();
      }} />
    </HandoffDialog>}
    {opened === "send" && offer.project_id && offer.take_session_id && <HandoffDialog title="Send Take to Artur" onClose={close}>
      <ReviewSheet project={offer.project_id} take={offer.take_session_id} onSent={() => {
        setSent(true);
        window.dispatchEvent(new CustomEvent(COACH_REVIEW_CHANGED, { detail: offer.project_id }));
        close();
      }} />
    </HandoffDialog>}
  </div>;
}

function HandoffDialog({ title, subheading, onClose, children }: {
  title: string;
  subheading?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute("open", "");
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background p-5 text-foreground shadow-xl backdrop:bg-black/30 sm:p-7">
    <button type="button" onClick={onClose} className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden />Back to chat
    </button>
    <div className="mb-5 flex items-center gap-3">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">A</span>
      <div>
        <h2 id={titleId} className="text-[21px] font-semibold leading-tight tracking-tight">{title}</h2>
        {subheading && <p className={"mt-1 " + SUBTLE}>{subheading}</p>}
      </div>
    </div>
    {children}
  </dialog>;
}

function message(error: unknown): string {
  return error instanceof HumanCoachError ? error.message : "Please try again.";
}

function useHandoffData<T>(load: () => Promise<T>) {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void load().then((result) => { if (active) setValue(result); }, (err) => { if (active) setError(message(err)); });
    return () => { active = false; };
  }, [load, revision]);
  return { value, error, retry: () => { setValue(null); setError(""); setRevision((n) => n + 1); } };
}

function Loading({ error, retry }: { error: string; retry: () => void }) {
  return error ? <div role="alert" className="space-y-2">
    <p>{error}</p><button type="button" className={ACTION} onClick={retry}>Try again</button>
  </div> : <p className={SUBTLE} role="status">Loading…</p>;
}

function BookingSheet({ project, onBooked }: { project: string | null; onBooked: (when: string) => void }) {
  const { value, error, retry } = useHandoffData(readCoachCalendar);
  if (!value) return <Loading error={error} retry={retry} />;
  if (error) return <Loading error={error} retry={retry} />;
  return <BookAvailable key={value.slots.join(",")} calendar={value} project={project} refresh={retry} onBooked={onBooked} />;
}

function BookAvailable({ calendar, project, refresh, onBooked }: {
  calendar: CoachCalendar;
  project: string | null;
  refresh: () => void;
  onBooked: (when: string) => void;
}) {
  const days = useMemo(() => {
    const grouped = new Map<string, string[]>();
    for (const iso of calendar.slots) {
      const date = dayKey(Date.parse(iso), calendar.timezone);
      const list = grouped.get(date) ?? [];
      list.push(iso);
      grouped.set(date, list);
    }
    return [...grouped.values()];
  }, [calendar]);
  const [day, setDay] = useState(0);
  const [page, setPage] = useState(0);
  const [slot, setSlot] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const row = days[day] ?? [];
  const first = page * DATES_PER_PAGE;
  const priced = calendar.price_cents > 0;
  const tz = calendar.timezone;

  function choosePage(next: number) {
    setPage(next);
    setDay(next * DATES_PER_PAGE);
    setSlot("");
  }

  async function book() {
    if (!row.includes(slot) || busy) return;
    setBusy(true);
    setError("");
    try {
      const booked = await bookCoachCall({
        project_id: project, start: slot, name, email,
        price_cents: calendar.price_cents, duration_min: calendar.duration_min, currency: calendar.currency,
      });
      onBooked(booked.when);
    } catch (err) {
      setBusy(false);
      setError(message(err));
      if (err instanceof HumanCoachError && ["OFFER_CHANGED", "SLOT_TAKEN"].includes(err.code)) refresh();
    }
  }

  if (!days.length) return <p className={SUBTLE}>No times are available right now.</p>;
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void book(); }}>
    <p className={SUBTLE}>
      {calendar.duration_min} min
      {priced && " · " + money(calendar.price_cents, calendar.currency) + " due after the call"}
    </p>
    <fieldset className="min-w-0" disabled={busy}>
      <legend className="mb-2 text-sm font-medium">Choose a day</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {days.slice(first, first + DATES_PER_PAGE).map((items, offset) => {
          const index = first + offset;
          return <button type="button" className={ACTION + " aria-pressed:border-primary/40 aria-pressed:bg-primary/10"}
            key={items[0]} aria-pressed={day === index} onClick={() => { setDay(index); setSlot(""); }}>
            {fmtDay(Date.parse(items[0]), tz)}
          </button>;
        })}
      </div>
      {days.length > DATES_PER_PAGE && <div className="mt-1 flex gap-1">
        <button type="button" className={ACTION} aria-label="Earlier days" disabled={!page} onClick={() => choosePage(page - 1)}><ChevronLeft className="size-4" aria-hidden /></button>
        <button type="button" className={ACTION} aria-label="Later days" disabled={first + DATES_PER_PAGE >= days.length} onClick={() => choosePage(page + 1)}><ChevronRight className="size-4" aria-hidden /></button>
      </div>}
    </fieldset>
    <fieldset className="min-w-0" disabled={busy}>
      <legend className="mb-2 text-sm font-medium">Available times <span className={SUBTLE}>· {tz.replaceAll("_", " ")}</span></legend>
      <div className="grid grid-cols-3 gap-2">
        {row.map((iso) => <button type="button" className={ACTION + " aria-pressed:border-primary/40 aria-pressed:bg-primary/10"}
          key={iso} aria-pressed={iso === slot} onClick={() => setSlot(iso)}>{fmtTime(Date.parse(iso), tz, false)}</button>)}
      </div>
    </fieldset>
    {calendar.needs_name && <label className="block text-sm">Name
      <input name="name" className={"mt-1 " + FIELD} required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
    </label>}
    {calendar.needs_email && <label className="block text-sm">Email for your calendar invite
      <input name="email" type="email" className={"mt-1 " + FIELD} required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
    </label>}
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <p className={SUBTLE}>Your calendar invite will include a video link.</p>
      <button type="submit" className={PRIMARY} disabled={!slot || busy}>{busy ? "Booking…" : "Book call"}</button>
    </div>
  </form>;
}

function ReviewSheet({ project, take, onSent }: { project: string; take: string; onSent: () => void }) {
  const load = useMemo(() => () => readCoachReviewPreview(project, take), [project, take]);
  const { value, error, retry } = useHandoffData(load);
  if (!value) return <Loading error={error} retry={retry} />;
  if (value.sent) return <p role="status">This Take was sent to Artur.</p>;
  return <ReviewForm review={value} project={project} take={take} onSent={onSent} />;
}

function ReviewForm({ review, project, take, onSent }: {
  review: ReviewPreview; project: string; take: string; onSent: () => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const seconds = Math.round(Math.max(review.duration_seconds ?? 0, 0));
  const duration = seconds ? [Math.floor(seconds / 60) + " min", seconds % 60 + " sec"].join(" ") : "";

  async function send() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await sendCoachReview(project, take, note);
      onSent();
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }

  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void send(); }}>
    <p className={SUBTLE}>{[review.project_title, review.take_index && "Take " + review.take_index].filter(Boolean).join(" · ")}</p>
    <ul className="divide-y divide-border border-y border-border text-sm">
      <ReviewItem icon={<AudioLines className="size-4" aria-hidden />} title="Full recording" description={duration} />
      <ReviewItem icon={<FileText className="size-4" aria-hidden />} title="Ideal Text" description="Slides and their text" />
      <ReviewItem icon={<MessagesSquare className="size-4" aria-hidden />} title="Feedback walk" description="The full exchange and saved practice" />
    </ul>
    <label className="block text-sm">
      <span className="mb-1.5 flex flex-wrap justify-between gap-1 font-medium">
        <span>Message to Artur <span className={"font-normal " + SUBTLE}>· Optional</span></span>
        <span aria-hidden className={SUBTLE}>{note.length} / 300</span>
      </span>
      <textarea className={FIELD} rows={2} maxLength={300} value={note} disabled={busy}
        placeholder="What would you like Artur to focus on?" onChange={(event) => setNote(event.target.value)} />
    </label>
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <p className={"flex max-w-xs items-start gap-2 " + SUBTLE}>
        <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden />
        Artur receives your note and a private link by email. For his review only.
      </p>
      <button type="submit" className={PRIMARY} disabled={busy}>{busy ? "Sending…" : "Send Take"}</button>
    </div>
  </form>;
}

function ReviewItem({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <li className="flex items-start gap-2.5 py-2.5">
    <span className="mt-0.5 text-primary">{icon}</span>
    <div><strong className="font-medium">{title}</strong>{description && <p className={SUBTLE}>{description}</p>}</div>
  </li>;
}
