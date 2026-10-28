"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type Country,
  countryByIso,
  countryOfFull,
  digitsOf,
  e164,
  fits,
  flag,
  grouped,
  nationalDigits,
  searchCountries,
  START_COUNTRY,
} from "@/lib/phone/countries";

/* -------------------------------------------------------------------------- */
/*  PhoneNumberField — a WhatsApp number with its country by flag (founder    */
/*  2026-10-28, backend N230, on the prototype                                */
/*  https://claude.ai/artifact/W9JkYyK3pkwcurNd4itZwR).                       */
/*                                                                            */
/*  The flag and the code first, Poland chosen at the start; one tap opens    */
/*  the list (Poland, the United States, then A to Z) with search by name,    */
/*  code or short name. A number pasted with + picks its country, a leading  */
/*  0 is dropped, spaces appear as you type. `onChange` gets the clean        */
/*  international number once it is long enough for its country, else null:  */
/*  the caller lights its Send code on it.                                    */
/* -------------------------------------------------------------------------- */

/** The words, signed (backend N230). */
export const PHONE_FIELD_COPY = {
  search: "Search country or code",
  noMatch: (text: string) => `No country matches “${text}”.`,
  tooLong: (country: string) => `That's too long for ${country}. Check the country.`,
  cancel: "Cancel",
  country: (name: string, dial: string) => `Country: ${name}, +${dial}`,
} as const;

/** The country and the number of an E.164 string, for a field that opens
 *  with a number already given. */
function split(initial: string | null | undefined): { country: Country; text: string } {
  const start = countryByIso(START_COUNTRY);
  const digits = digitsOf(initial ?? "");
  if (!initial?.trim().startsWith("+") || !digits) return { country: start, text: grouped(nationalDigits(initial ?? "")) };
  const country = countryOfFull(digits, start) ?? start;
  return { country, text: grouped(digits.slice(country.dial.length)) };
}

export default function PhoneNumberField({
  id,
  initial,
  onChange,
  disabled,
  autoFocus,
  label,
}: {
  id: string;
  /** A number to open with (E.164, or what the person typed elsewhere). */
  initial?: string | null;
  onChange: (phone: string | null) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** The visible label's id, when the caller draws one. */
  label?: string;
}) {
  const [{ country, text }, setState] = useState(() => split(initial));
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const national = nationalDigits(text);
  const tooLong = national.length > country.max;

  const report = (c: Country, t: string) => {
    const n = nationalDigits(t);
    onChange(fits(c, n) ? e164(c, n) : null);
  };

  // The number the field opens with counts as given.
  useEffect(() => {
    report(country, text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const type = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
      const digits = digitsOf(trimmed).replace(/^00/, "");
      const found = countryOfFull(digits, country);
      if (found) {
        const next = grouped(digits.slice(found.dial.length));
        setState({ country: found, text: next });
        report(found, next);
        return;
      }
      setState({ country, text: trimmed });
      report(country, "");
      return;
    }
    const lead = digitsOf(trimmed).startsWith("0") ? "0" : "";
    const next = lead + grouped(nationalDigits(trimmed).slice(0, country.max + 2));
    setState({ country, text: next });
    report(country, next);
  };

  const choose = (c: Country) => {
    const next = grouped(national);
    setState({ country: c, text: next });
    report(c, next);
    setOpen(false);
    window.requestAnimationFrame(() => input.current?.focus());
  };

  const sample = grouped("0".repeat(country.min));

  return (
    <div>
      <div
        className={`flex h-12 items-stretch rounded-lg border bg-background transition-colors focus-within:border-primary ${
          tooLong ? "border-destructive" : "border-border"
        }`}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={PHONE_FIELD_COPY.country(country.name, country.dial)}
          className="flex shrink-0 items-center gap-1.5 rounded-l-lg border-r border-border pl-3 pr-2.5 text-[15px] text-foreground hover:bg-muted disabled:opacity-60"
        >
          <span className="text-xl leading-none" aria-hidden>{flag(country.iso)}</span>
          <span className="font-semibold tabular-nums">+{country.dial}</span>
          <svg className="h-2.5 w-2.5 text-muted-foreground" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M2 3.5 5 6.5 8 3.5" />
          </svg>
        </button>
        <input
          ref={input}
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-labelledby={label}
          aria-invalid={tooLong ? true : undefined}
          placeholder={sample}
          value={text}
          disabled={disabled}
          autoFocus={autoFocus}
          onChange={(e) => type(e.target.value)}
          className="min-w-0 flex-1 rounded-r-lg bg-transparent px-3 text-base tabular-nums tracking-[0.02em] text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
        />
      </div>
      {tooLong ? (
        <p role="alert" className="mt-2 text-sm text-destructive">{PHONE_FIELD_COPY.tooLong(country.name)}</p>
      ) : null}
      {open ? <CountrySheet current={country} onPick={choose} onClose={() => { setOpen(false); input.current?.focus(); }} /> : null}
    </div>
  );
}

function CountrySheet({ current, onPick, onClose }: {
  current: Country;
  onPick: (country: Country) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const list = useRef<HTMLDivElement>(null);
  const found = searchCountries(query);
  const searching = query.trim() !== "";

  useEffect(() => {
    setActive(searching ? 0 : -1);
  }, [query, searching]);

  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const keys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { setActive((i) => Math.min(found.length - 1, i + 1)); e.preventDefault(); }
    else if (e.key === "ArrowUp") { setActive((i) => Math.max(0, i - 1)); e.preventDefault(); }
    else if (e.key === "Enter") { if (found[active]) onPick(found[active]); e.preventDefault(); }
    else if (e.key === "Escape") onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-start sm:pt-[10vh]">
      <button type="button" aria-label={PHONE_FIELD_COPY.cancel} tabIndex={-1} onClick={onClose}
        className="absolute inset-0 bg-black/40" />
      <div role="dialog" aria-modal="true" aria-label={PHONE_FIELD_COPY.search}
        className="relative flex h-[85vh] w-full max-w-[440px] flex-col rounded-t-2xl bg-background shadow-xl sm:h-[70vh] sm:rounded-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
        <div className="flex items-center gap-2 px-4 pb-2 pt-3">
          <div className="relative min-w-0 flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <circle cx="7" cy="7" r="5" /><path d="m11 11 3.5 3.5" />
            </svg>
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={keys}
              placeholder={PHONE_FIELD_COPY.search}
              aria-label={PHONE_FIELD_COPY.search}
              autoComplete="off"
              className="h-11 w-full rounded-lg border border-border bg-muted pl-9 pr-3 text-base text-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <button type="button" onClick={onClose} className="min-h-[44px] px-1 text-[15px] font-semibold text-foreground">
            {PHONE_FIELD_COPY.cancel}
          </button>
        </div>
        <div ref={list} role="listbox" className="flex-1 overflow-y-auto px-2 pb-3">
          {found.length === 0 ? (
            <p className="px-4 py-8 text-center text-muted-foreground">{PHONE_FIELD_COPY.noMatch(query.trim())}</p>
          ) : found.map((c, i) => (
            <div key={c.iso}>
              {!searching && i === 2 ? <div className="mx-3 my-1.5 h-px bg-border" aria-hidden /> : null}
              <button
                type="button"
                role="option"
                aria-selected={c.iso === current.iso}
                data-index={i}
                onClick={() => onPick(c)}
                className={`flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] text-foreground hover:bg-muted ${i === active ? "bg-muted" : ""}`}
              >
                <span className="text-xl leading-none" aria-hidden>{flag(c.iso)}</span>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="tabular-nums text-muted-foreground">+{c.dial}</span>
                <span className="w-4 text-primary" aria-hidden>{c.iso === current.iso ? "✓" : ""}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
