"use client";

import { useEffect, useState } from "react";
import { LetterCircle, PersonCircle } from "../ChatList";
import { W } from "./hostSetupCopy";
import { FACE_COLORS, FACE_EMOJI, OWN_CHAT_EVENT, readOwnChat, saveOwnFace, type ChatFace } from "@/lib/willab/chatBuilder/ownChat";

/* The host picks the circle: a few emoji, a few colours, a photo, or the
   initial they already have. The choice stays on this device. */

function shrinkPhoto(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      const image = new Image();
      image.onerror = () => resolve(null);
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 96;
        canvas.height = 96;
        const pen = canvas.getContext("2d");
        if (!pen) return resolve(src.slice(0, 200_000) || null);
        pen.drawImage(image, 0, 0, 96, 96);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      image.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export function useOwnFace(): ChatFace {
  const [face, setFace] = useState<ChatFace>({ kind: "initial" });
  useEffect(() => {
    const read = () => setFace(readOwnChat().face);
    read();
    window.addEventListener(OWN_CHAT_EVENT, read);
    return () => window.removeEventListener(OWN_CHAT_EVENT, read);
  }, []);
  return face;
}

/** The circle's face. The initial is the locked letter circle. */
export function ChatFaceMark({ face, id, name, size }: { face: ChatFace; id: string; name: string; size: 24 | 36 | 48 }) {
  if (face.kind === "initial") return <LetterCircle id={id} name={name} size={size} />;
  const box = size === 48 ? "h-12 w-12 text-[22px]" : size === 36 ? "h-9 w-9 text-[16px]" : "size-6 text-xs";
  if (face.kind === "emoji") {
    return <span data-chat-face="emoji" aria-hidden className={`flex shrink-0 items-center justify-center rounded-full bg-muted ${box}`}>{face.emoji}</span>;
  }
  if (face.kind === "color") {
    return <span data-chat-face="color" aria-hidden className={`block shrink-0 rounded-full ${box}`} style={{ background: face.color }} />;
  }
  return (
    // The host's own photo, already on this device. next/image cannot load a data URL they just picked.
    // eslint-disable-next-line @next/next/no-img-element
    <img data-chat-face="photo" alt="" className={`shrink-0 rounded-full object-cover ${box}`} src={face.url} />
  );
}

export function OwnAvatar({ id, name, size }: { id: string; name: string; size: 24 | 36 | 48 }) {
  const face = useOwnFace();
  return <PersonCircle id={id} name={name} size={size} badge mark={<ChatFaceMark face={face} id={id} name={name} size={size} />} />;
}

export default function ChatIconPicker({ name }: { name: string }) {
  const face = useOwnFace();
  const pick = (next: ChatFace) => saveOwnFace(next);
  return (
    <div data-chat-icon="" className="flex flex-col gap-2">
      <p className="m-0 text-[15px]">{W.pickPicture}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" data-icon-initial="" aria-pressed={face.kind === "initial"} className="inline-flex h-11 min-w-11 items-center rounded-full border border-border px-3 text-[15px] font-medium" onClick={() => pick({ kind: "initial" })}>Your initial</button>
        {FACE_EMOJI.map((emoji) => (
          <button key={emoji} type="button" data-icon-emoji={emoji} aria-pressed={face.kind === "emoji" && face.emoji === emoji} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-[20px]" onClick={() => pick({ kind: "emoji", emoji })}>{emoji}</button>
        ))}
        {FACE_COLORS.map((swatch) => (
          <button key={swatch.color} type="button" data-icon-color={swatch.color} aria-label={swatch.name} aria-pressed={face.kind === "color" && face.color === swatch.color} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border" onClick={() => pick({ kind: "color", color: swatch.color })}>
            <span aria-hidden className="h-6 w-6 rounded-full" style={{ background: swatch.color }} />
          </button>
        ))}
        <label className="inline-flex h-11 min-w-11 cursor-pointer items-center rounded-full border border-border px-3 text-[15px] font-medium">
          Photo
          <input data-icon-photo="" aria-label="Photo" className="sr-only" type="file" accept="image/*" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void shrinkPhoto(file).then((url) => { if (url) pick({ kind: "photo", url }); });
          }} />
        </label>
      </div>
      <span className="sr-only">{name}</span>
    </div>
  );
}
