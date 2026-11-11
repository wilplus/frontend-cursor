"use client";

import { useEffect, useState, type ReactNode } from "react";
import { readDev, type DevRead } from "@/services/api/hostSetup";
import { DEV } from "./hostsetup/hostSetupCopy";

/* -------------------------------------------------------------------------- */
/*  Developer mode in Build (backend N648; the pinned prototype's devPage()   */
/*  in docs/design/the-blank-setup-2026-11-10/the-blank-setup.html): a switch */
/*  under Build's two tabs and, on, five parts, each one screen. The numbers  */
/*  are the host's own, never a speaker's. Off the ring the read is 404 and   */
/*  nothing is drawn. A chart with no weeks is not counted, never zero; a     */
/*  hidden week reads "fewer than 5".                                         */
/* -------------------------------------------------------------------------- */

type Part = "close" | "notice" | "says" | "charts" | "data";

/** The read, once, null until read and off the ring. */
export function useDev(): DevRead | null {
  const [read, setRead] = useState<DevRead | null>(null);
  useEffect(() => {
    let alive = true;
    void readDev().then((got) => {
      if (alive) setRead(got);
    });
    return () => {
      alive = false;
    };
  }, []);
  return read;
}

export function DevSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div data-dev-row="" className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
      <span className="text-[15.5px] font-semibold text-foreground">{DEV.switch}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={DEV.switch}
        data-dev-switch=""
        onClick={onToggle}
        className={`flex h-7 w-12 items-center rounded-full border border-border p-0.5 ${on ? "justify-end bg-foreground" : "justify-start bg-background"}`}
      >
        <span className={`h-5 w-5 rounded-full ${on ? "bg-background" : "bg-foreground"}`} />
      </button>
    </div>
  );
}

const Say = ({ children }: { children: ReactNode }) => <p className="m-0 text-[15.5px] font-medium text-foreground">{children}</p>;
const Card = ({ children, ...rest }: { children: ReactNode; [data: `data-${string}`]: string }) => (
  <div {...rest} className="flex flex-col gap-1.5 rounded-2xl border border-border bg-background px-3.5 py-3 text-[15.5px] text-foreground">{children}</div>
);
const Bar = ({ pct }: { pct: number }) => (
  <div aria-hidden className="h-2 w-full overflow-hidden rounded-full bg-muted">
    <i className="block h-full bg-foreground" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
  </div>
);
const Row = ({ part, title, line, onOpen }: { part: Part; title: string; line: string; onOpen: (p: Part) => void }) => (
  <button type="button" data-dev-part={part} onClick={() => onOpen(part)}
    className="flex w-full flex-col rounded-2xl border border-border bg-background px-3.5 py-3 text-left text-[15.5px] text-foreground">
    <span className="font-normal">{title}</span>
    <b className="font-semibold">{line}</b>
  </button>
);

function need(n: DevRead["notice"][number]["need"]): string | null {
  if (!n) return null;
  if (n.step === "settle") return DEV.needSettle(n.more ?? 0);
  if (n.step === "check") return DEV.needCheck(n.have ?? 0, n.of ?? 0);
  if (n.step === "exam") return DEV.needExam(n.have ?? 0, n.of ?? 0);
  return null;
}

function Chart({ name, weeks }: { name: string; weeks: NonNullable<DevRead["charts"][number]["weeks"]> | null }) {
  const title = DEV.chartNames[name] ?? name;
  if (!weeks) {
    return <Card data-dev-chart={name} data-dev-uncounted=""><span>{title}</span><span>{DEV.notCounted}</span></Card>;
  }
  const ratio = name === "helped";
  const top = Math.max(1, ...weeks.map((w) => w.count ?? 0));
  const hidden = weeks.filter((w) => w.count === null);
  return (
    <a data-dev-chart={name} href={`/api/v2/chats/setup/dev/charts/${encodeURIComponent(name)}`} download={`${name}.csv`}
      className="flex flex-col gap-2 rounded-2xl border border-border bg-background px-3.5 py-3 text-[15.5px] text-foreground no-underline">
      <span>{title}</span>
      <span className="flex h-16 items-end gap-1.5">
        {weeks.map((w) => (
          <i key={w.week} title={w.count === null ? DEV.fewerThan(w.fewer_than ?? 5) : String(w.count)}
            className={`block flex-1 ${w.count === null ? "border border-dashed border-foreground" : "bg-foreground"}`}
            style={{ height: `${w.count === null ? 12 : Math.round(((w.count ?? 0) / (ratio ? Math.max(1, w.of ?? 0) : top)) * 100)}%` }} />
        ))}
      </span>
      {hidden.map((w) => <span key={w.week} data-dev-hidden="">{w.week}: {DEV.fewerThan(w.fewer_than ?? 5)}</span>)}
      <b className="font-semibold">{DEV.download}</b>
    </a>
  );
}

function Screen({ part, read }: { part: Part; read: DevRead }) {
  if (part === "close") {
    const { done, of, items } = read.close;
    return (
      <>
        <Say>{DEV.closeSay(done, of)}</Say>
        <Bar pct={of ? Math.round((done / of) * 100) : 0} />
        <Card>{items.map((i) => <div key={i.key} className="flex gap-2"><b>{DEV.marks[i.status]}</b><span>{i.label}</span></div>)}</Card>
        <Say>{DEV.legend}</Say>
      </>
    );
  }
  if (part === "notice") {
    return (
      <>
        <Say>{DEV.noticeSay}</Say>
        {read.notice.map((n) => (
          <Card key={n.model_id ?? n.cue ?? n.q} data-dev-notice="">
            <b>{n.q}</b>
            <span>{DEV.next(n.level_name, n.next_name)}</span>
            <Bar pct={n.pct} />
            {need(n.need) ? <span>{need(n.need)}</span> : null}
            <span>{[DEV.segments(n.segments), n.experiments === null ? null : `${n.experiments} ${n.experiments === 1 ? "experiment" : "experiments"} run`, n.agreed ? DEV.agreed(n.agreed.a, n.agreed.b) : null].filter(Boolean).join(" · ")}</span>
          </Card>
        ))}
      </>
    );
  }
  if (part === "says") {
    return (
      <>
        <Say>{DEV.saysSay}</Say>
        {read.says.map((s) => (
          <Card key={s.model_id} data-dev-say="">
            <b>{s.says}</b>
            {s.helped ? <><span>{DEV.helped(s.helped.a, s.helped.b)}</span><Bar pct={s.helped.b ? Math.round((s.helped.a / s.helped.b) * 100) : 0} /></> : null}
            <span>{s.more_to_tell ? DEV.more(s.more_to_tell) : DEV.enough}</span>
          </Card>
        ))}
      </>
    );
  }
  if (part === "charts") {
    return (
      <>
        <Say>{DEV.chartsSay}</Say>
        {read.charts.map((c) => <Chart key={c.name} name={c.name} weeks={c.weeks} />)}
      </>
    );
  }
  return (
    <>
      {DEV.dataSay.map((l) => <Say key={l}>{l}</Say>)}
      {read.data.map((d) => (
        <Card key={d.model_id} data-dev-data={d.model_id}>
          <span>{d.q}</span>
          <span>{DEV.dataRow}</span>
          <span className="flex gap-4">
            {(["jsonl", "csv"] as const).map((f) => (
              <a key={f} href={`/api${d.files[f]}`} download className="font-semibold text-foreground underline">{f.toUpperCase()}</a>
            ))}
          </span>
        </Card>
      ))}
    </>
  );
}

/** Developer mode's five rows and the screen each opens (inside Build, under the switch). */
export function DevParts({ read }: { read: DevRead }) {
  const [part, setPart] = useState<Part | null>(null);
  if (part) {
    const title = DEV[part];
    return (
      <div data-dev-screen={part} className="flex flex-col gap-3 px-4 py-3">
        <button type="button" aria-label={DEV.back} data-dev-back="" onClick={() => setPart(null)} className="self-start text-[22px] leading-none text-foreground">‹</button>
        <b className="text-[17px] font-semibold text-foreground">{title}</b>
        <Screen part={part} read={read} />
      </div>
    );
  }
  const shown = read.charts.filter((c) => c.weeks).length;
  const ex = read.notice.some((n) => n.experiments !== null) ? read.notice.reduce((a, n) => a + (n.experiments ?? 0), 0) : null;
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3">
      <Say>{DEV.home}</Say>
      <Row part="close" title={DEV.close} line={DEV.closeCount(read.close.done, read.close.of)} onOpen={setPart} />
      <Row part="notice" title={DEV.notice} line={DEV.noticeCount(read.notice.length, ex)} onOpen={setPart} />
      <Row part="says" title={DEV.says} line={DEV.saysCount(read.says.length)} onOpen={setPart} />
      <Row part="charts" title={DEV.charts} line={DEV.chartsCount(shown)} onOpen={setPart} />
      <Row part="data" title={DEV.data} line={DEV.dataCount} onOpen={setPart} />
    </div>
  );
}
