"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, Pencil } from "lucide-react";
import {
  chatFileSrc,
  dropMyPhoto,
  getMyProfile,
  getTheirProfile,
  profilePhotoSrc,
  saveMyProfile,
  setMyPhoto,
  type Profile as ProfileData,
} from "@/services/api/chats";
import { photoForUpload } from "./photoForUpload";
import { SafetyRows, type Safety } from "./BlockReport";
import ProfileModels from "../models/ProfileModels";

/* -------------------------------------------------------------------------- */
/*  A person's profile, as on WhatsApp (backend N366; the locked prototype    */
/*  "One bar" v12; rules: docs/flows/customer-requests.md §1 C1). The other   */
/*  person's, from a chat's top bar; your own, from the ☰ menu (/profile).    */
/*  One page: the circle, the name and who they are; About; Photos; Files.   */
/*  On your own: tap the circle for your photo; the pencil, or Edit at the   */
/*  top right, to change your About (and, with Edit, your name and who you   */
/*  are). The one place in the app where a person types. At the foot of      */
/*  theirs, never yours nor Will's, Block and Report (N466, BlockReport.tsx). */
/* -------------------------------------------------------------------------- */

/** Signed (Never 4): backend N366 items 3, 4 and 6. */
const W = {
  about: "About",
  photos: "Photos",
  files: "Files",
  noPhotos: "No photos yet.",
  noFiles: "No files yet.",
  save: "Save",
  cancel: "Cancel",
  editedToday: "Edited today",
  edit: "Edit",
  done: "Done",
  takePhoto: "Take photo",
  choosePhoto: "Choose photo",
  deletePhoto: "Delete photo",
} as const;

const LIMIT = { name: 40, role: 60, about: 300 } as const;

const isToday = (at: string | null) => !!at && new Date(at).toDateString() === new Date().toDateString();

export default function Profile({
  chatId = null,
  onBack,
  safety,
}: {
  chatId?: string | null;
  onBack: () => void;
  /** Their profile, from a person's chat: Block and Report at its foot
   *  (N466). Never given for your own, nor for Will, whose chat opens none. */
  safety?: Safety | null;
}) {
  const mine = chatId === null;
  const [p, setP] = useState<ProfileData | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<null | "about" | "all">(null);
  const [draft, setDraft] = useState({ name: "", role: "", about: "" });
  const [photoV, setPhotoV] = useState(1);
  const [sheet, setSheet] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const pick = useRef<HTMLInputElement>(null);
  const take = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void (mine ? getMyProfile() : getTheirProfile(chatId)).then((got) => {
      if (!alive) return;
      if (got) setP(got);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [chatId, mine]);

  const startEdit = (what: "about" | "all") => {
    if (!p) return;
    setDraft({ name: p.name, role: p.role ?? "", about: p.about ?? "" });
    setEditing(what);
  };
  const save = async () => {
    if (!p) return;
    const change = editing === "all" ? draft : { about: draft.about };
    const got = await saveMyProfile(change);
    if (got) setP(got);
    setEditing(null);
  };
  const upload = async (file: File | undefined) => {
    setSheet(false);
    if (!file) return;
    const { blob, name } = await photoForUpload(file);
    if (await setMyPhoto(blob, name)) {
      setP((x) => (x ? { ...x, has_photo: true } : x));
      setPhotoV((v) => v + 1);
    }
  };
  const remove = async () => {
    setSheet(false);
    if (await dropMyPhoto()) setP((x) => (x ? { ...x, has_photo: false } : x));
  };

  const letter = (Array.from((p?.name ?? "").trim())[0] ?? "").toUpperCase();
  const circle = p?.has_photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profilePhotoSrc(chatId, photoV)} alt="" className="h-28 w-28 rounded-full object-cover" />
  ) : (
    <span className="flex h-28 w-28 items-center justify-center rounded-full bg-[#9FC1AE] text-[44px] font-semibold text-white">{letter}</span>
  );

  return (
    <div data-profile className="absolute inset-0 z-40 flex flex-col bg-[#F4F4F4] text-[#121212]">
      <div className="box-content flex h-14 shrink-0 items-center justify-between bg-white px-1 pt-[env(safe-area-inset-top)]">
        <button type="button" onClick={onBack} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full">
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        {mine && p ? (
          <button
            type="button"
            data-profile-edit=""
            onClick={() => (editing === "all" ? void save() : startEdit("all"))}
            className="px-3 py-2 text-[16px] font-semibold text-[#F26B21]"
          >
            {editing === "all" ? W.done : W.edit}
          </button>
        ) : null}
      </div>
      {p ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pb-6">
          <div className="flex flex-col items-center gap-1.5 bg-white px-5 pb-5 pt-1.5">
            {mine ? (
              <button type="button" data-profile-photo="" onClick={() => setSheet(true)} aria-label={W.choosePhoto} className="relative rounded-full">
                {circle}
                <span className="absolute bottom-0.5 right-0.5 flex h-[34px] w-[34px] items-center justify-center rounded-full border-[3px] border-white bg-[#121212] text-white">
                  <Camera className="h-4 w-4" aria-hidden />
                </span>
              </button>
            ) : (
              circle
            )}
            {editing === "all" ? (
              <>
                <input
                  aria-label="Name"
                  maxLength={LIMIT.name}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="mt-1.5 w-full max-w-[300px] border-b-[1.5px] border-[#F26B21] bg-transparent py-1.5 text-center text-[22px] font-bold outline-none"
                />
                <input
                  aria-label="Role"
                  maxLength={LIMIT.role}
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  className="w-full max-w-[300px] border-b-[1.5px] border-[#F26B21] bg-transparent py-1.5 text-center text-[15px] outline-none"
                />
              </>
            ) : (
              <>
                <h2 data-profile-name className="mt-1.5 text-[24px] font-bold leading-tight">
                  {p.name}
                </h2>
                {p.role ? <span className="text-[15px] text-[#737373]">{p.role}</span> : null}
              </>
            )}
          </div>
          {p.about || mine ? (
            <div className="bg-white px-[18px] py-3.5">
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#8A8A8A]">{W.about}</p>
              {editing ? (
                <div className="relative">
                  <textarea
                    data-profile-about=""
                    aria-label={W.about}
                    maxLength={LIMIT.about}
                    value={draft.about}
                    onChange={(e) => setDraft({ ...draft, about: e.target.value })}
                    className="min-h-[110px] w-full resize-y rounded-xl border-[1.5px] border-[#121212] py-2.5 pl-3 pr-9 text-[15.5px] leading-normal outline-none focus:outline-2 focus:outline-[#F26B21]"
                  />
                  <Pencil aria-hidden className="pointer-events-none absolute right-2.5 top-2.5 h-[18px] w-[18px] text-[#F26B21]" />
                  {editing === "about" ? (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="flex-1 text-[12.5px] tabular-nums text-[#8A8A8A]">{LIMIT.about - draft.about.length}</span>
                      <button type="button" onClick={() => setEditing(null)} className="h-[38px] rounded-full border border-[#E5E5E5] px-4 text-[14px] font-semibold">
                        {W.cancel}
                      </button>
                      <button type="button" data-profile-save="" onClick={() => void save()} className="h-[38px] rounded-full bg-[#121212] px-4 text-[14px] font-semibold text-white">
                        {W.save}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex items-start gap-2.5">
                  <p className="min-w-0 flex-1 whitespace-pre-line text-[15.5px] leading-normal">
                    {p.about}
                    {mine && isToday(p.about_edited_at) ? <span className="mt-1.5 block text-[12.5px] text-[#8A8A8A]">{W.editedToday}</span> : null}
                  </p>
                  {mine ? (
                    <button
                      type="button"
                      data-profile-pencil=""
                      onClick={() => startEdit("about")}
                      aria-label={W.edit}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF1E7] text-[#F26B21]"
                    >
                      <Pencil className="h-[18px] w-[18px]" aria-hidden />
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
          {/* The AI models you started and teach, under About (backend N528,
              MOD-50): on your own profile, and on another person's once the
              backend names whose it is; nothing below ring 6. */}
          <ProfileModels mine={mine} userId={p.user_id} />
          <div className="bg-white px-[18px] py-3.5">
            <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#8A8A8A]">{W.photos}</p>
            {p.photos.length ? (
              <div className="grid grid-cols-3 gap-1">
                {p.photos.map((x) => (
                  <button key={x.id} type="button" onClick={() => setViewing(chatFileSrc(x.chat_id, x.id))} className="aspect-square overflow-hidden rounded-lg bg-[#E5E5E5]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={chatFileSrc(x.chat_id, x.id)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-[#8A8A8A]">{W.noPhotos}</p>
            )}
          </div>
          <div className="bg-white px-[18px] py-3.5">
            <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#8A8A8A]">{W.files}</p>
            {p.files.length ? (
              <div className="flex flex-col">
                {p.files.map((x) => (
                  <a key={x.id} href={chatFileSrc(x.chat_id, x.id)} className="flex items-center gap-3 border-b border-[#F0F0F0] py-2.5 last:border-b-0">
                    <span className="flex h-10 w-[34px] shrink-0 items-center justify-center rounded-md bg-[#E5484D] text-[9px] font-bold text-white">
                      {(x.name.split(".").pop() || "").slice(0, 4).toUpperCase()}
                    </span>
                    <span className="min-w-0 truncate text-[15px]">{x.name}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-[#8A8A8A]">{W.noFiles}</p>
            )}
          </div>
          {safety ? <SafetyRows safety={safety} /> : null}
        </div>
      ) : failed ? null : (
        <div className="flex-1" />
      )}
      {sheet ? (
        <div className="absolute inset-0 z-10 flex flex-col justify-end bg-black/30" onClick={() => setSheet(false)}>
          <div className="flex flex-col gap-1 rounded-t-3xl bg-white px-4 pb-6 pt-2.5" onClick={(e) => e.stopPropagation()}>
            <span aria-hidden className="mb-1 h-[5px] w-10 self-center rounded-full bg-[#E0E0E0]" />
            <button type="button" onClick={() => take.current?.click()} className="rounded-xl px-2.5 py-3 text-left text-[15px] font-medium">
              {W.takePhoto}
            </button>
            <button type="button" onClick={() => pick.current?.click()} className="rounded-xl px-2.5 py-3 text-left text-[15px] font-medium">
              {W.choosePhoto}
            </button>
            {p?.has_photo ? (
              <button type="button" onClick={() => void remove()} className="rounded-xl px-2.5 py-3 text-left text-[15px] font-medium text-[#B42318]">
                {W.deletePhoto}
              </button>
            ) : null}
            <button type="button" onClick={() => setSheet(false)} className="h-10 text-[15px] font-medium text-[#737373]">
              {W.cancel}
            </button>
          </div>
        </div>
      ) : null}
      <input ref={pick} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0])} />
      <input ref={take} type="file" accept="image/*" capture="user" hidden onChange={(e) => void upload(e.target.files?.[0])} />
      {viewing ? (
        <div className="absolute inset-0 z-20 flex flex-col bg-black">
          <div className="box-content flex h-14 items-center px-1 pt-[env(safe-area-inset-top)]">
            <button type="button" onClick={() => setViewing(null)} aria-label="Back" className="flex h-11 w-11 items-center justify-center text-white">
              <ChevronLeft className="h-6 w-6" aria-hidden />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewing} alt="" className="min-h-0 flex-1 object-contain" />
        </div>
      ) : null}
    </div>
  );
}
