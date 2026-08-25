"use client";

import { ArrowUp, Image as ImageIcon, Mic, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { CeoProjectKey } from "@/lib/ceo/domain";
import {
  createCeoBug,
  type CeoAttachment,
} from "@/lib/ceo/workItems";

const MAX_IMAGE_DATA_URL = 400_000;

type RecognitionEvent = {
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
  const browser = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not read that image."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressImage(file: File): Promise<CeoAttachment> {
  const image = await loadImage(file);
  let maxSide = 1024;
  let quality = 0.76;
  let dataUrl = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_IMAGE_DATA_URL) break;
    maxSide = Math.round(maxSide * 0.8);
    quality = Math.max(0.48, quality - 0.08);
  }
  if (!dataUrl || dataUrl.length > MAX_IMAGE_DATA_URL) {
    throw new Error("That image is still too large after compression.");
  }
  return { kind: "image", data_url: dataUrl, name: file.name };
}

export default function CeoBugCapture({
  project,
  value,
  onChange,
}: {
  project: CeoProjectKey;
  value: string;
  onChange: (value: string) => void;
}) {
  const [attachments, setAttachments] = useState<CeoAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setAttachments([]);
    setNote(null);
    setError(null);
    recognitionRef.current?.stop();
  }, [project]);

  async function save() {
    if (saving || (!value.trim() && attachments.length === 0)) return;
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      await createCeoBug({ project, text: value, attachments });
      onChange("");
      setAttachments([]);
      setNote("Saved. Its task is being prepared.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the bug.");
    } finally {
      setSaving(false);
    }
  }

  async function addImages(files: FileList | null) {
    const selected = Array.from(files ?? []).filter((file) =>
      file.type.startsWith("image/")
    );
    if (!selected.length) return;
    setError(null);
    try {
      const room = Math.max(0, 4 - attachments.length);
      const compressed = await Promise.all(selected.slice(0, room).map(compressImage));
      setAttachments((current) => [...current, ...compressed].slice(0, 4));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not attach that image.");
    }
  }

  function toggleDictation() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setError("Voice dictation is not available in this browser.");
      return;
    }
    setError(null);
    const recognition = new Constructor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      let spoken = "";
      for (let index = 0; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) {
          spoken += `${event.results[index][0].transcript} `;
        }
      }
      if (spoken.trim()) {
        const next = [valueRef.current.trim(), spoken.trim()]
          .filter(Boolean)
          .join(" ");
        valueRef.current = next;
        onChange(next);
      }
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError("Voice dictation stopped before it could finish.");
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  return (
    <div className="mx-auto flex min-h-[58vh] max-w-3xl items-center justify-center">
      <div className="w-full">
        <div className="relative rounded-2xl border border-border bg-background shadow-sm focus-within:border-foreground/30 focus-within:shadow-md">
          <textarea
            aria-label={`${project} bug`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void save();
              }
            }}
            placeholder={`Note a ${project === "product" ? "Product" : "Research"} bug…`}
            rows={5}
            className="min-h-44 w-full resize-none rounded-2xl bg-transparent px-5 pb-14 pt-5 text-base outline-none placeholder:text-muted-foreground/60"
          />
          {attachments.length ? (
            <div className="flex gap-2 px-4 pb-2">
              {attachments.map((attachment, index) => (
                <div key={`${attachment.name}-${index}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachment.data_url}
                    alt="Bug attachment"
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                    aria-label="Remove attachment"
                    className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-foreground text-background"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="absolute bottom-3 right-3 flex gap-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => {
                void addImages(event.target.files);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={saving || attachments.length >= 4}
              aria-label="Attach images"
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-35"
            >
              <ImageIcon className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={toggleDictation}
              disabled={saving}
              aria-label={listening ? "Stop dictation" : "Dictate a bug"}
              aria-pressed={listening}
              className={cn(
                "grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                listening && "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              <Mic className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || (!value.trim() && attachments.length === 0)}
              aria-label="Save bug"
              className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-25"
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
        {note ? <p className="mt-3 text-center text-sm text-muted-foreground">{note}</p> : null}
        {error ? <p className="mt-3 text-center text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
