"use client";

import { useEffect, useState } from "react";
import { getProfileModels, type ProfileModels as Section } from "@/services/api/models";
import { readSession } from "@/lib/supabase/session";
import { Badge, Bar } from "./ModelBits";

/* -------------------------------------------------------------------------- */
/*  The profile's "AI models" (backend N528 items 1 and 5, MOD-50; the        */
/*  locked prototype's p:2): under About, the models a person started, with   */
/*  "Make public", "Archive" and "Download its data", and the ones they      */
/*  teach, with their own answers counted this month (a count of their work, */
/*  not a verdict on them). The backend gives the actions to the owner alone. */
/*  Nothing at all when they started and teach none, and below ring 6.       */
/*                                                                            */
/*  The actions are drawn as the prototype draws them and wait for their      */
/*  routes (archive, make public, the download: MOD-51).                      */
/* -------------------------------------------------------------------------- */

/** Whose profile: a person's id, or none for your own (read from the session). */
async function sectionFor(userId: string | undefined): Promise<Section | null> {
  const id = userId ?? (await readSession().then((s) => s?.user?.id ?? null, () => null));
  return id ? getProfileModels(id) : null;
}

export default function ProfileModels({ userId }: { userId?: string }) {
  const [section, setSection] = useState<Section | null>(null);
  useEffect(() => {
    let alive = true;
    void sectionFor(userId).then((got) => {
      if (alive) setSection(got);
    });
    return () => {
      alive = false;
    };
  }, [userId]);
  if (!section) return null;
  return (
    <div data-profile-models className="bg-white px-[18px] py-3.5">
      <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#8A8A8A]">{section.title}</p>
      {section.models.map((m) => (
        <div key={m.name} data-profile-model className="flex flex-col gap-[5px] border-b border-[#F0F0F0] py-2 last:border-b-0">
          <div className="flex items-center justify-between gap-2">
            <b className="text-[15.5px] font-semibold">{m.name}</b>
            <Badge text={m.badge} />
          </div>
          <Bar line={m.line} />
          <small className="text-[13px] text-[#8A8A8A]">{m.line}</small>
          {m.actions.length ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              {m.actions.map((a) => (
                <button key={a} type="button" disabled className="text-[15px] font-semibold text-[#F26B21] disabled:cursor-default">
                  {a}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
