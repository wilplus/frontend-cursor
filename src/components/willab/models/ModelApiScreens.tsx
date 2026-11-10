"use client";

import { useEffect, useRef, useState } from "react";
import WalkOverlay from "../walk/WalkOverlay";
import WalkFooter from "../walk/WalkFooter";
import WalkMessage from "../walk/WalkMessage";
import {
  createTestKey,
  deleteModelKey,
  getModelCard,
  getModelCode,
  getModelDownload,
  getModelDownloadRows,
  getModelEarnings,
  getModelPrice,
  getModelTerms,
  getModelUsage,
  PRICE_USES,
  sendUnsure,
  setModelPrice,
  switchModelKey,
  tryModel,
  type LabelRow,
  type ModelPrice,
  type ModelUsage,
  type ShownKey,
  type TryReply,
} from "@/services/api/models";
import { cn } from "@/lib/utils";
import { Card, Mini } from "./ModelBits";
import { useRead } from "./ModelScreens";

/* -------------------------------------------------------------------------- */
/*  A model's API and its money (backend N528 items 6, 7 and 12, N531, N566   */
/*  items 8 to 10, N577, N583; the locked prototype                           */
/*  docs/design/model-launchpad-2026-11-09/, version 8, screens card, try,   */
/*  use, key, code, usage, price, earnings and download; App Model MOD-39 to  */
/*  MOD-48 and MOD-51). Each is the Feedback walk's overlay, as the other    */
/*  models' screens are. Every word and every amount arrives from the        */
/*  backend's rules (services/model_api.py): prices are tokens, drawn there;  */
/*  these screens never count money themselves.                               */
/*                                                                            */
/*  No live key is offered: "Create a key" makes the free test key, and the  */
/*  usage screen leaves out "Make a live key" until live keys bill.          */
/* -------------------------------------------------------------------------- */

type Nav = { onBack?: () => void; onClose: () => void };

function Rows({ rows }: { rows: LabelRow[] }) {
  return (
    <dl data-model-rows className="m-0 flex flex-col gap-2.5">
      {rows.map((row, i) => (
        <div key={`${row.label}${i}`} className="flex flex-col">
          <dt className="text-[13px] font-semibold text-muted-foreground">{row.label}</dt>
          <dd className="m-0 text-[16px] leading-snug">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const Line = ({ text, quiet = false }: { text: string; quiet?: boolean }) => (
  <p className={cn("m-0 text-[15px] leading-[1.45]", quiet && "text-muted-foreground")}>{text}</p>
);

/* ── The card (mod.b-1; MOD-39) ──────────────────────────────────────────── */

export function ModelCardScreen({ modelId, onBack, onClose, onUse, onTry }: Nav & { modelId: string; onUse: () => void; onTry: (name: string) => void }) {
  const card = useRead(() => getModelCard(modelId), `card${modelId}`);
  const footer = card ? (
    <WalkFooter
      pill={{ label: card.actions[0], onClick: onUse, disabled: !card.for_sale }}
      links={card.actions.slice(1).map((label) => ({ label, onClick: () => onTry(card.title) }))}
    />
  ) : null;
  return (
    <WalkOverlay onBack={onBack} backLabel={card?.title} title={card?.title} onClose={onClose} footer={footer} testId="model-api-card">
      {card ? (
        <>
          <Line text={card.line} />
          {card.description ? <Line text={card.description} quiet /> : null}
          <Rows rows={card.rows} />
          <Line text={card.foot} quiet />
        </>
      ) : null}
    </WalkOverlay>
  );
}

/* ── Try it (mod.b-2, mod.u-1; MOD-40, MOD-45) ───────────────────────────── */

type Said = { mine: boolean; text: string; mark?: string };

function Bubble({ said }: { said: Said }) {
  return (
    <div className={cn("flex flex-col gap-1", said.mine ? "items-end" : "items-start")}>
      <p
        data-try-said={said.mine ? "me" : "model"}
        className={cn("m-0 max-w-[85%] whitespace-pre-wrap rounded-[18px] px-3.5 py-2.5 text-[16px] leading-[1.45]", said.mine ? "bg-foreground text-background" : "bg-muted")}
      >
        {said.text}
      </p>
      {said.mark ? <small data-try-unsure className="text-[12.5px] font-semibold text-[#C2410C]">{said.mark}</small> : null}
    </div>
  );
}

export function ModelTryScreen({ modelId, name, onBack, onClose }: Nav & { modelId: string; name: string }) {
  const [said, setSaid] = useState<Said[]>([]);
  const [sub, setSub] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const message = typed.trim();
    if (!message || busy) return;
    setBusy(true);
    setTyped("");
    setSaid((was) => [...was, { mine: true, text: message }]);
    const reply: TryReply | null = await tryModel(modelId, message);
    if (reply) {
      setSub(reply.sub);
      setSaid((was) => [...was, { mine: false, text: reply.text, mark: reply.sure ? undefined : reply.mark }]);
    } else {
      setTyped(message);
      setSaid((was) => was.slice(0, -1));
    }
    setBusy(false);
  };
  const composer = (
    <form
      data-try-composer
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <textarea
        aria-label={name}
        rows={1}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        className="min-h-[44px] flex-1 resize-none rounded-[22px] border border-border bg-background px-4 py-2.5 text-[16px] leading-snug outline-none focus:border-primary"
      />
      <button type="submit" aria-label="Send" disabled={busy || !typed.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-30">
        ↑
      </button>
    </form>
  );
  return (
    <WalkOverlay onBack={onBack} backLabel={name} title={name} subtitle={sub} onClose={onClose} footer={composer} landing={false} testId="model-api-try">
      {said.map((s, i) => (
        <Bubble key={i} said={s} />
      ))}
    </WalkOverlay>
  );
}

/* ── Use it in your business: the terms (mod.b-3, mod.u-4; MOD-41, MOD-48) ─ */

export function ModelUseScreen({ modelId, onBack, onClose, onKey, onUsage, onList }: Nav & {
  modelId: string;
  onKey: (shown: ShownKey) => void;
  /** When no key could be made (one test key per model, ever): the keys there are. */
  onUsage: () => void;
  onList: () => void;
}) {
  const terms = useRead(() => getModelTerms(modelId), `use${modelId}`);
  const [limit, setLimit] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = limit ?? terms?.limit?.default_units ?? null;
  const create = async () => {
    setBusy(true);
    const shown = await createTestKey(modelId, chosen);
    setBusy(false);
    if (shown) onKey(shown);
    else onUsage();
  };
  const footer = !terms ? null : terms.refused ? (
    <WalkFooter pill={{ label: terms.actions[0], onClick: onList }} />
  ) : (
    <WalkFooter pill={{ label: terms.actions[0], onClick: () => void create(), disabled: busy }} links={[{ label: terms.actions[1], onClick: onBack ?? onClose }]} />
  );
  return (
    <WalkOverlay onBack={onBack} backLabel={terms?.title} title={terms?.title} onClose={onClose} footer={footer} testId="model-api-use">
      {terms?.refused ? <Line text={terms.refused} /> : null}
      {terms && !terms.refused ? (
        <>
          {terms.own_product ? <p data-own-product className="m-0 text-[17px] font-semibold">{terms.own_product}</p> : null}
          {terms.lines?.map((line) => <Line key={line} text={line} />)}
          <Card>
            <b data-model-price className="text-[19px]">{terms.price}</b>
            <small className="text-[13.5px] text-muted-foreground">{terms.price_line}</small>
          </Card>
          {terms.test_key ? (
            <Card>
              <b className="text-[16px]">{terms.test_key.label}</b>
              <small className="text-[14px] text-muted-foreground">{terms.test_key.line}</small>
            </Card>
          ) : null}
          {terms.limit ? (
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 text-[16px] font-bold">{terms.limit.label}</legend>
              {terms.limit.options.map((o) => (
                <label key={o.units} className="flex items-center gap-2.5 text-[15px]">
                  <input type="radio" name="model-limit" checked={chosen === o.units} onChange={() => setLimit(o.units)} />
                  <span>{o.line}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
          {terms.training ? <Line text={terms.training} quiet /> : null}
        </>
      ) : null}
    </WalkOverlay>
  );
}

/* ── The key, shown once (mod.b-4; MOD-42, MOD-48) ───────────────────────── */

/** The key lives only in this screen's props: "I copied it" swaps this screen
 *  for the code, and ‹ leaves it, so it is never shown again. */
export function ModelKeyScreen({ shown, onBack, onClose, onCopied }: Nav & { shown: ShownKey; onCopied: () => void }) {
  const copy = () => {
    void navigator.clipboard?.writeText(shown.key).catch(() => undefined);
  };
  return (
    <WalkOverlay
      onBack={onBack}
      backLabel={shown.title}
      title={shown.title}
      onClose={onClose}
      footer={<WalkFooter pill={{ label: shown.actions[1], onClick: onCopied }} />}
      testId="model-api-key"
    >
      <Line text={shown.line} />
      <div className="flex items-center gap-2 rounded-2xl bg-muted px-3.5 py-3">
        <code data-model-key className="min-w-0 flex-1 break-all font-mono text-[14px]">{shown.key}</code>
        <Mini label={shown.actions[0]} onClick={copy} />
      </div>
      <WalkMessage>{shown.note}</WalkMessage>
    </WalkOverlay>
  );
}

/* ── The code (mod.b-5; MOD-43) ──────────────────────────────────────────── */

export function ModelCodeScreen({ modelId, onBack, onClose, onDone }: Nav & { modelId: string; onDone: () => void }) {
  const code = useRead(() => getModelCode(modelId), `code${modelId}`);
  const [tab, setTab] = useState(0);
  const shown = code?.tabs[tab] ?? code?.tabs[0];
  const share = () => {
    if (!code || !shown) return;
    const text = `${code.line}\n\n${shown.code}\n\n${code.sure}`;
    if (typeof navigator.share === "function") void navigator.share({ title: code.title, text }).catch(() => undefined);
    else void navigator.clipboard?.writeText(text).catch(() => undefined);
  };
  const footer = code ? <WalkFooter pill={{ label: code.actions[0], onClick: onDone }} links={[{ label: code.actions[1], onClick: share }]} /> : null;
  return (
    <WalkOverlay onBack={onBack} backLabel={code?.title} title={code?.title} onClose={onClose} footer={footer} testId="model-api-code">
      {code && shown ? (
        <>
          <Line text={code.line} />
          <div role="tablist" className="flex gap-2">
            {code.tabs.map((t, i) => (
              <button
                key={t.lang}
                type="button"
                role="tab"
                aria-selected={t === shown}
                onClick={() => setTab(i)}
                className={cn("rounded-full border-[1.5px] px-3.5 py-1.5 text-[14px] font-semibold", t === shown ? "border-foreground bg-foreground text-background" : "border-border")}
              >
                {t.label}
              </button>
            ))}
          </div>
          <pre data-model-code className="m-0 overflow-x-auto rounded-2xl bg-muted px-3.5 py-3 font-mono text-[13px] leading-[1.5]">{shown.code}</pre>
          <WalkMessage>{code.sure}</WalkMessage>
        </>
      ) : null}
    </WalkOverlay>
  );
}

/* ── Your usage (mod.b-6; MOD-44) ────────────────────────────────────────── */

function UsageBody({ usage, onChanged }: { usage: ModelUsage; onChanged: () => void }) {
  const each = async (act: (keyId: string) => Promise<unknown>) => {
    await Promise.all(usage.keys.map((k) => act(k.id)));
    onChanged();
  };
  const unsure = usage.send_unsure;
  return (
    <>
      <Line text={usage.line} />
      {usage.alerts.map((a) => (
        <div key={a.title} data-usage-alert className="flex flex-col gap-1 rounded-2xl bg-[#FFF4D6] px-3.5 py-3">
          <b className="text-[16px]">{a.title}</b>
          <span className="text-[14.5px]">{a.line}</span>
        </div>
      ))}
      <Rows rows={usage.rows} />
      <Line text={usage.pays_teachers} quiet />
      <label className="flex items-start gap-3 rounded-2xl border-[1.5px] border-border px-3.5 py-3">
        <input type="checkbox" role="switch" checked={unsure.on} onChange={() => void each((id) => sendUnsure(id, !unsure.on))} className="mt-1" />
        <span className="flex flex-col">
          <b className="text-[15.5px]">{unsure.label}</b>
          <small className="text-[13.5px] text-muted-foreground">{unsure.line}</small>
        </span>
      </label>
      {usage.keys.map((k) => (
        <div key={k.id} data-usage-key className="flex items-center justify-between gap-2">
          <code className="min-w-0 truncate font-mono text-[14px]">{k.label}</code>
          <Mini label={usage.actions[1]} quiet onClick={() => void deleteModelKey(k.id).then(onChanged)} />
        </div>
      ))}
      <div data-usage-version className="flex flex-col gap-1.5">
        {usage.version.title ? <b className="text-[16px]">{usage.version.title}</b> : null}
        <Line text={usage.version.line} quiet={!usage.version.title} />
        {usage.version.action ? (
          <span>
            <Mini label={usage.version.action} onClick={() => void each(switchModelKey)} />
          </span>
        ) : null}
      </div>
    </>
  );
}

export function ModelUsageScreen({ modelId, onBack, onClose, onList }: Nav & { modelId: string; onList: () => void }) {
  const [version, setVersion] = useState(0);
  const usage = useRead(() => getModelUsage(modelId), `usage${modelId}${version}`);
  const footer = usage ? <WalkFooter pill={{ label: usage.actions[0], onClick: onList }} /> : null;
  return (
    <WalkOverlay onBack={onBack} backLabel={usage?.title} title={usage?.title} onClose={onClose} footer={footer} testId="model-api-usage">
      {usage ? <UsageBody usage={usage} onChanged={() => setVersion((v) => v + 1)} /> : null}
    </WalkOverlay>
  );
}

/* ── Set your price (mod.u-2; MOD-46) ────────────────────────────────────── */

/** Each − , + , suggestion and the uses a month only preview: the backend
 *  draws the split for the proposed price (floored to the running cost,
 *  rounded down to the step) and saves nothing. Only "Use {price}" saves,
 *  then closes. A preview that fails keeps the last split on screen. */
function usePrice(modelId: string) {
  const [screen, setScreen] = useState<ModelPrice | null | undefined>(undefined);
  const uses = useRef<number>(PRICE_USES.start);
  const units = useRef<number | undefined>(undefined);
  const timer = useRef<number | null>(null);
  const asked = useRef(0);
  const saving = useRef(false);
  const preview = () => {
    const ask = (asked.current += 1);
    void getModelPrice(modelId, uses.current, units.current).then((got) => {
      if (got && ask === asked.current) setScreen(got);
    });
  };
  useEffect(() => {
    let alive = true;
    void getModelPrice(modelId, uses.current).then((got) => {
      if (alive) setScreen(got);
    });
    return () => {
      alive = false;
      asked.current += 1;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [modelId]);
  const set = (next: number) => {
    units.current = next;
    preview();
  };
  const setUses = (n: number) => {
    uses.current = n;
    setScreen((was) => (was ? { ...was, uses: n } : was));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(preview, 250);
  };
  /** True once the shown price is the saved one. */
  const save = async (): Promise<boolean> => {
    if (!screen || saving.current) return false;
    if (screen.price_units === screen.saved_units) return true;
    saving.current = true;
    const saved = await setModelPrice(modelId, screen.price_units);
    saving.current = false;
    return Boolean(saved);
  };
  return { screen, set, setUses, save };
}

function Stepper({ p, onSet }: { p: ModelPrice; onSet: (units: number) => void }) {
  const step = "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[1.5px] border-foreground text-[24px] font-semibold disabled:opacity-25";
  return (
    <div className="flex items-center justify-between gap-3">
      <button type="button" aria-label="−" className={step} disabled={!p.minus_enabled} onClick={() => onSet(Math.max(p.floor_units, p.price_units - p.step_units))}>
        −
      </button>
      <span className="flex flex-col items-center">
        <b data-model-price className="text-[26px]">{p.price}</b>
        <small className="text-[13.5px] text-muted-foreground">{p.unit}</small>
      </span>
      <button type="button" aria-label="+" className={step} onClick={() => onSet(p.price_units + p.step_units)}>
        +
      </button>
    </div>
  );
}

function PriceBody({ p, onSet, onUses }: { p: ModelPrice; onSet: (units: number) => void; onUses: (n: number) => void }) {
  return (
    <>
      <Line text={p.intro} />
      <Stepper p={p} onSet={onSet} />
      <div className="flex flex-wrap justify-center gap-2">
        {p.suggestions.map((s) => (
          <Mini key={s.units} label={s.label} quiet={s.units !== p.price_units} onClick={() => onSet(s.units)} />
        ))}
      </div>
      <Line text={p.similar} quiet />
      <label className="flex flex-col gap-1.5">
        <span className="text-[14.5px] font-semibold">{p.uses_line}</span>
        <input
          type="range"
          min={PRICE_USES.min}
          max={PRICE_USES.max}
          step={PRICE_USES.step}
          value={p.uses}
          onChange={(e) => onUses(Number(e.target.value))}
        />
      </label>
      <Line text={p.month} />
      <div data-model-split className="flex flex-col gap-2">
        {p.split.map((row) => (
          <div key={row.part} data-split={row.part} className="flex items-start justify-between gap-3 rounded-2xl border-[1.5px] border-border px-3.5 py-2.5">
            <span className="flex flex-col">
              <b className="text-[15px]">{row.label}</b>
              {row.line ? <small className="text-[13px] text-muted-foreground">{row.line}</small> : null}
            </span>
            <b className="shrink-0 text-[15px]">{row.amount}</b>
          </div>
        ))}
      </div>
    </>
  );
}

export function ModelPriceScreen({ modelId, onBack, onClose }: Nav & { modelId: string }) {
  const { screen, set, setUses, save } = usePrice(modelId);
  const use = () => {
    void save().then((done) => {
      if (done) (onBack ?? onClose)();
    });
  };
  const footer = screen ? <WalkFooter pill={{ label: screen.action, onClick: use }} /> : null;
  return (
    <WalkOverlay onBack={onBack} backLabel={screen?.title} title={screen?.title} onClose={onClose} footer={footer} testId="model-api-price">
      {screen ? <PriceBody p={screen} onSet={set} onUses={setUses} /> : null}
    </WalkOverlay>
  );
}

/* ── Your earnings (mod.u-3; MOD-47) ─────────────────────────────────────── */

export function ModelEarningsScreen({ onBack, onClose, onList }: Nav & { onList: () => void }) {
  const earnings = useRead(getModelEarnings, "earnings");
  const footer = earnings ? <WalkFooter pill={{ label: earnings.actions[0], onClick: onList }} /> : null;
  return (
    <WalkOverlay onBack={onBack} backLabel={earnings?.title} title={earnings?.title} onClose={onClose} footer={footer} testId="model-api-earnings">
      {earnings ? (
        <>
          <Line text={earnings.line} />
          <Rows rows={earnings.rows} />
          {earnings.fixed ? <Line text={earnings.fixed} quiet /> : null}
          {earnings.minimum ? <Line text={earnings.minimum} quiet /> : null}
        </>
      ) : null}
    </WalkOverlay>
  );
}

/* ── Downloading its data (mod.p-3; MOD-51) ──────────────────────────────── */

function saveJson(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^\w-]+/g, "-").toLowerCase() || "model"}.json`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ModelDownloadScreen({ modelId, onBack, onClose, onList }: Nav & { modelId: string; onList: () => void }) {
  const screen = useRead(() => getModelDownload(modelId), `download${modelId}`);
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    const data = await getModelDownloadRows(modelId);
    setBusy(false);
    if (data) saveJson(data.model, data.rows);
  };
  const footer = !screen ? null : screen.refused ? (
    <WalkFooter pill={{ label: screen.actions[0], onClick: onList }} />
  ) : (
    <WalkFooter pill={{ label: screen.actions[0], onClick: () => void download(), disabled: busy }} links={[{ label: screen.actions[1], onClick: onBack ?? onClose }]} />
  );
  return (
    <WalkOverlay onBack={onBack} backLabel={screen?.title} title={screen?.title} onClose={onClose} footer={footer} testId="model-api-download">
      {screen?.refused ? <Line text={screen.refused} /> : null}
      {screen?.lines?.map((line) => <Line key={line} text={line} />)}
    </WalkOverlay>
  );
}
