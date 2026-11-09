"use client";

import WalkOverlay from "../walk/WalkOverlay";
import WalkFooter from "../walk/WalkFooter";
import { cn } from "@/lib/utils";
import { Ring } from "./ModelScreens";

/* -------------------------------------------------------------------------- */
/*  Release, the model's founder's choice (backend N566 item 5, N563 item 5,  */
/*  MOD-22; the locked prototype's q:8). Drawn from the backend's             */
/*  release_screen exactly: "Version 2 is ready", the exam's three counts,    */
/*  the verdict, and only when the gap is clearly not luck, the choice and    */
/*  "Release version 2" with "Not yet". A close result says "Not clearly      */
/*  better yet" and has no Release button.                                    */
/*                                                                            */
/*  The backend has no release route yet; the owner's page will hand this     */
/*  screen its answer once it does.                                           */
/* -------------------------------------------------------------------------- */

export type ReleaseScreenData = {
  title: string;
  line: string;
  exam: { intro: string; better: number; worse: number; same: number; labels: string[] };
  release: boolean;
  verdict: string;
  choice?: string;
  actions: string[];
};

export default function ModelRelease({ model, release, onRelease, onNotYet, onBack, onClose }: {
  model: string;
  release: ReleaseScreenData;
  onRelease: () => void;
  onNotYet: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const counts = [release.exam.better, release.exam.worse, release.exam.same];
  const footer =
    release.release && release.actions.length ? (
      <WalkFooter pill={{ label: release.actions[0], onClick: onRelease }} links={release.actions[1] ? [{ label: release.actions[1], onClick: onNotYet }] : []} />
    ) : null;
  return (
    <WalkOverlay onBack={onBack} backLabel={model} title={release.title} onClose={onClose} footer={footer} testId="model-release">
      <div className="flex items-center gap-3.5">
        <Ring percent={100} />
        <p className="m-0 text-[15px] leading-snug">{release.line}</p>
      </div>
      <p className="m-0 text-[15px]">{release.exam.intro}</p>
      <div className="grid grid-cols-3 gap-2">
        {counts.map((n, i) => (
          <span
            key={release.exam.labels[i]}
            className={cn("flex flex-col gap-0.5 rounded-[14px] bg-muted p-2.5 text-[12.5px] leading-tight text-muted-foreground", i === 0 && release.release && "bg-[#E2F4EB]")}
          >
            <b className={cn("text-[22px] font-extrabold text-foreground", i === 0 && release.release && "text-[#1F7A55]")}>{n}</b>
            {release.exam.labels[i]}
          </span>
        ))}
      </div>
      <p data-release-verdict className="m-0 text-[16px] font-bold">{release.verdict}</p>
      {release.choice ? <p className="m-0 px-[17px] text-[16px]">{release.choice}</p> : null}
    </WalkOverlay>
  );
}
