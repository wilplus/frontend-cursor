"use client";

import { useEffect, useState } from "react";
import WalkOverlay from "../walk/WalkOverlay";
import WalkFooter from "../walk/WalkFooter";
import { archiveModel, getModelDownload, getProfileModels, makeModelPublic, type ProfileModelRow, type ProfileModels as Section } from "@/services/api/models";
import { getSetup, type SetupScreen } from "@/services/api/modelSetup";
import { readSession } from "@/lib/supabase/session";
import { Badge, Bar } from "./ModelBits";
import { ModelDownloadScreen } from "./ModelApiScreens";
import { MODELS_WORDS as W } from "./modelsCopy";
import { Said } from "./SetupParts";

/* -------------------------------------------------------------------------- */
/*  The profile's "AI models" (backend N528 items 1 and 5, MOD-50, MOD-51;    */
/*  the locked prototype's p:2 and p:3): under About, the models a person     */
/*  started, with "Make public", "Archive" and "Download its data", and the   */
/*  ones they teach, with their own answers counted this month (a count of    */
/*  their work, not a verdict on them). The backend gives the actions to the  */
/*  owner alone, and a row its id (#1869) only where those routes are there.  */
/*  Nothing at all when they started and teach none, and below ring 6.       */
/*                                                                            */
/*  "Make public" first shows the setup's own disclaimer (MOD-34), read from  */
/*  the model's setup, and goes public only on "Make it public"; it shows    */
/*  only once that disclaimer answers. "Archive" hides the model from every  */
/*  list and deletes nothing. "Download its data" opens ModelApiScreens'     */
/*  download (MOD-51).                                                       */
/* -------------------------------------------------------------------------- */

/** Whose profile: a person's id, or none for your own (read from the session). */
async function sectionFor(userId: string | undefined): Promise<Section | null> {
  const id = userId ?? (await readSession().then((s) => s?.user?.id ?? null, () => null));
  return id ? getProfileModels(id) : null;
}

type Open = { at: "public"; id: string; screen: SetupScreen } | { at: "download"; id: string } | null;

function Disclaimer({ screen, onYes, onNo }: { screen: SetupScreen; onYes: () => void; onNo: () => void }) {
  return (
    <WalkOverlay
      caption={screen.caption}
      onClose={onNo}
      footer={<WalkFooter pill={{ label: screen.actions[0], onClick: onYes }} links={[{ label: screen.actions[1], onClick: onNo }]} />}
      testId="profile-model-public"
    >
      {screen.lines.map((line) => (
        <Said key={line}>{line}</Said>
      ))}
    </WalkOverlay>
  );
}

type Ways = { disclaimer?: SetupScreen; download: boolean };

/** What each owned model's actions open, probed on their own routes: the
 *  disclaimer "Make public" first shows (the setup's public step) and the
 *  download's screen. A way whose route answers 404 is not drawn. */
function useOwnerWays(section: Section | null): Record<string, Ways> {
  const [found, setFound] = useState<Record<string, Ways>>({});
  const ids = (section?.models ?? []).filter((m) => m.id && m.actions.length).map((m) => m.id as string);
  const key = ids.join(",");
  useEffect(() => {
    if (!ids.length) return;
    let alive = true;
    const probe = async (id: string): Promise<Ways> => {
      const [state, download] = await Promise.all([getSetup(id, "public"), getModelDownload(id)]);
      return { disclaimer: state?.screen.step === "public" ? state.screen : undefined, download: Boolean(download && !download.refused) };
    };
    void Promise.all(ids.map(probe)).then((got) => {
      if (alive) setFound(Object.fromEntries(ids.map((id, i) => [id, got[i]])));
    });
    return () => {
      alive = false;
    };
    // `ids` is read anew each render; `key` says when it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return found;
}

function Actions({ row, ways: probed, onOpen, onArchive }: {
  row: ProfileModelRow;
  ways: Ways | undefined;
  onOpen: (open: Open) => void;
  onArchive: (id: string) => void;
}) {
  const id = row.id;
  if (!id) return null;
  const ways: Record<string, (() => void) | undefined> = {
    [W.make_public]: probed?.disclaimer ? () => onOpen({ at: "public", id, screen: probed.disclaimer! }) : undefined,
    [W.archive]: () => onArchive(id),
    [W.download_data]: probed?.download ? () => onOpen({ at: "download", id }) : undefined,
  };
  const shown = row.actions.filter((a) => ways[a]);
  if (!shown.length) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
      {shown.map((a) => (
        <button key={a} type="button" onClick={ways[a]} className="text-[15px] font-semibold text-[#F26B21]">
          {a}
        </button>
      ))}
    </div>
  );
}

export default function ProfileModels({ userId, mine = true }: {
  /** Whose profile, when the backend names it: read on another person's
   *  profile; your own is read by the session's id. */
  userId?: string | null;
  /** Your own profile (the id read from the session). */
  mine?: boolean;
}) {
  const [section, setSection] = useState<Section | null>(null);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<Open>(null);
  const whose = mine ? undefined : userId ?? undefined;
  const shows = mine || Boolean(whose);
  useEffect(() => {
    if (!shows) return;
    let alive = true;
    void sectionFor(whose).then((got) => {
      if (alive) setSection(got);
    });
    return () => {
      alive = false;
    };
  }, [whose, shows, version]);
  const ownerWays = useOwnerWays(section);
  if (!section || !shows) return null;
  const again = () => {
    setOpen(null);
    setVersion((v) => v + 1);
  };
  return (
    <div data-profile-models className="bg-white px-[18px] py-3.5">
      <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#8A8A8A]">{section.title}</p>
      {section.models.map((m) => (
        <div key={m.id ?? m.name} data-profile-model className="flex flex-col gap-[5px] border-b border-[#F0F0F0] py-2 last:border-b-0">
          <div className="flex items-center justify-between gap-2">
            <b className="text-[15.5px] font-semibold">{m.name}</b>
            <Badge text={m.badge} />
          </div>
          <Bar line={m.line} />
          <small className="text-[13px] text-[#8A8A8A]">{m.line}</small>
          <Actions
            row={m}
            ways={m.id ? ownerWays[m.id] : undefined}
            onOpen={setOpen}
            onArchive={(id) => {
              void archiveModel(id).then((done) => {
                if (done) again();
              });
            }}
          />
        </div>
      ))}
      {open ? (
        <div data-profile-model-overlay className="fixed inset-0 z-50 flex flex-col bg-background">
          {open.at === "public" ? (
            <Disclaimer
              screen={open.screen}
              onYes={() => {
                void makeModelPublic(open.id).then((done) => (done ? again() : setOpen(null)));
              }}
              onNo={() => setOpen(null)}
            />
          ) : (
            <ModelDownloadScreen modelId={open.id} onClose={() => setOpen(null)} onList={() => setOpen(null)} />
          )}
        </div>
      ) : null}
    </div>
  );
}
