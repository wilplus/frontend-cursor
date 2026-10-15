"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Phase1AcceptanceFlow from "./Phase1AcceptanceFlow";
import SymmetricPair from "./SymmetricPair";
import {
  acceptAuthorization,
  fetchAuthorization,
  recordAiNoticeRendered,
  type AuthorizationStatus,
  type PolicyDocument,
  type ProcessingPolicy,
} from "@/services/api/processingAuthorization";
import { fetchConsentChoices } from "@/services/api/consentChoices";
import { prefilledCountry, safeLocale } from "@/lib/legal/acceptanceSteps";

/* -------------------------------------------------------------------------- */
/*  The policy update prompt (founder 2026-10-15, prototype                    */
/*  https://claude.ai/artifact/GPRRXaivyrZE2UjrRZY93K, "yeah approved").       */
/*                                                                            */
/*  WHY. When a new Terms and Privacy Policy went live, someone who had the   */
/*  app open met "Current processing authorization is required for this       */
/*  action." after recording, and had to sign out and in to see the consent   */
/*  screens again. Someone who accepted an earlier version now gets one       */
/*  prompt instead, like the WhatsApp ask:                                     */
/*                                                                            */
/*  - in the Lounge: Will's message, the grey card (what's new, the three     */
/*    documents, the agreement sentence) and Close the app | Accept the       */
/*    update in place of the record button;                                   */
/*  - anywhere else, and whenever the backend refuses something because the   */
/*    acceptance is out of date: the same prompt as one screen; once          */
/*    accepted, the refused action carries on (the Take processes);           */
/*  - after Close the app: one screen with Accept the update, until accepted. */
/*                                                                            */
/*  ONE TAP. The receipt is the ordinary one, written by the one canonical    */
/*  boundary (accept_phase1_processing_authorization): the policy's own       */
/*  hashes sent back unchanged, the agreement sentence shown on the card, and */
/*  the country this person gave last time. When that country is no longer   */
/*  allowed, or the policy offers an optional choice to make, Accept opens    */
/*  the full consent screens instead, so nothing is chosen for anyone.        */
/*                                                                            */
/*  The status is read again when the app comes back to the screen, so an     */
/*  update published while it was open shows before the next Take.           */
/* -------------------------------------------------------------------------- */

/** The founder's words (prototype, approved 2026-10-15). No em-dashes. */
export const POLICY_UPDATE_COPY = {
  bubble:
    "We've updated our Terms and Privacy Policy. Accept the new versions to keep using WillpowerLab.",
  title: "We've updated our Terms and Privacy Policy",
  lead: "Accept the new versions to keep using WillpowerLab.",
  whatsNew:
    "New: the AI version of your voice, talking to Will, WhatsApp messages, lessons with a coach, sharing with a community, and California.",
  terms: "Terms",
  privacy: "Privacy Policy",
  aiNotice: "AI notice",
  close: "Close the app",
  accept: "Accept the update",
  accepting: "Accepting…",
  failed: "Couldn't save that. Try again.",
  closedTitle: "WillpowerLab needs the update",
  closedLead:
    "Accept the new Terms and Privacy Policy to record and get feedback. Your Takes and Ideal Texts are kept.",
} as const;

/** Refusals that mean "the acceptance is out of date", whatever the action. */
const NEEDS_ACCEPTANCE = new Set([
  "PROCESSING_AUTHORIZATION_REQUIRED",
  "PROCESSING_POLICY_STALE",
  "TRAINING_CONSENT_NEEDS_POLICY_RECEIPT",
]);

export function needsPolicyAcceptance(code: string | null | undefined): boolean {
  return !!code && NEEDS_ACCEPTANCE.has(code);
}

const CLIENT_VERSION = "phase1-update-web-v1";
/** Coming back to the app reads the status again, at most this often. */
const RECHECK_MS = 60_000;

type Phase = "none" | "needed" | "closed" | "flow";

interface Pending {
  policy: ProcessingPolicy;
  priorCountry: string | null;
}

interface PolicyUpdateApi {
  /** The Lounge shows the prompt as its offer (bubble + footer). */
  loungeOffer: boolean;
  /** The Lounge is on screen and presents the offer itself. */
  presentInLounge: () => () => void;
  /** A refusal came back: read the status, show the prompt if an update is
   *  what is missing, and run `resume` once it is accepted. */
  refused: (code: string | null | undefined, resume?: () => void) => void;
  accept: () => void;
  close: () => void;
  saving: boolean;
  failed: boolean;
  policy: ProcessingPolicy | null;
}

const PolicyUpdateContext = createContext<PolicyUpdateApi | null>(null);

/** The prompt's controls, or null outside the gate (the Data page). */
export function usePolicyUpdate(): PolicyUpdateApi | null {
  return useContext(PolicyUpdateContext);
}

function newKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `update-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function locale(): string {
  return safeLocale(typeof navigator === "undefined" ? "en" : navigator.language || "en");
}

/** What the status asks of this person: nothing, the prompt, or the full
 *  consent screens (never accepted any version). */
function pendingOf(status: AuthorizationStatus): { phase: Phase; pending: Pending | null } {
  if (status.kind !== "acceptance_required") return { phase: "none", pending: null };
  const pending = { policy: status.policy, priorCountry: status.priorCountry ?? null };
  return { phase: status.acceptedEarlierVersion ? "needed" : "flow", pending };
}

/** Whether Accept can write the receipt in one tap. */
async function oneTapCountry(pending: Pending): Promise<string | null> {
  const country = prefilledCountry(pending.policy, pending.priorCountry);
  if (!country) return null;
  const choices = await fetchConsentChoices();
  // An optional choice to make (or one that cannot be read) is the person's
  // to make on the full screens.
  if (!choices || choices.practiceOffered) return null;
  return country;
}

export function PolicyUpdateProvider({
  initial,
  children,
}: {
  /** The gate's own read: an update already outstanding when the app opens. */
  initial?: AuthorizationStatus | null;
  children: React.ReactNode;
}) {
  const first = initial ? pendingOf(initial) : { phase: "none" as Phase, pending: null };
  const [phase, setPhase] = useState<Phase>(first.phase);
  const [pending, setPending] = useState<Pending | null>(first.pending);
  const [screen, setScreen] = useState(false);
  const [presenters, setPresenters] = useState(0);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const resumes = useRef<Array<() => void>>([]);
  const lastRead = useRef(Date.now());
  const keyRef = useRef(newKey());

  const read = useCallback(async () => {
    lastRead.current = Date.now();
    const status = await fetchAuthorization();
    if (status.kind === "error") return;
    const next = pendingOf(status);
    if (next.phase === "none") {
      // Nothing to accept after all: the refusal was something else.
      resumes.current = [];
      setScreen(false);
    }
    setPending(next.pending);
    // Closed stays closed until accepted; anything else follows the server.
    setPhase((now) => (now === "closed" && next.phase === "needed" ? now : next.phase));
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRead.current < RECHECK_MS) return;
      void read();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [read]);

  const done = useCallback(() => {
    setPhase("none");
    setPending(null);
    setScreen(false);
    setSaving(false);
    setFailed(false);
    keyRef.current = newKey();
    const queued = resumes.current;
    resumes.current = [];
    queued.forEach((run) => run());
  }, []);

  const refused = useCallback((code: string | null | undefined, resume?: () => void) => {
    if (!needsPolicyAcceptance(code)) return;
    if (resume) resumes.current.push(resume);
    setScreen(true);
    void read();
  }, [read]);

  const accept = useCallback(() => {
    if (saving || !pending) return;
    setSaving(true);
    setFailed(false);
    void (async () => {
      const country = await oneTapCountry(pending);
      if (!country) {
        setSaving(false);
        setPhase("flow");
        return;
      }
      const result = await acceptAuthorization({
        policy: pending.policy,
        countryOfResidence: country,
        locale: locale(),
        clientVersion: CLIENT_VERSION,
        optionalPurposes: [],
        idempotencyKey: keyRef.current,
      });
      if (result.kind === "accepted") {
        done();
        return;
      }
      setSaving(false);
      if (result.kind === "stale") {
        // The policy moved again: new bytes, a new key, the prompt again.
        keyRef.current = newKey();
        void read();
        return;
      }
      setFailed(true);
    })();
  }, [saving, pending, done, read]);

  const close = useCallback(() => {
    setFailed(false);
    setPhase("closed");
  }, []);

  const presentInLounge = useCallback(() => {
    setPresenters((n) => n + 1);
    return () => setPresenters((n) => n - 1);
  }, []);

  const api = useMemo<PolicyUpdateApi>(() => ({
    loungeOffer: phase === "needed" && !screen && presenters > 0,
    presentInLounge,
    refused,
    accept,
    close,
    saving,
    failed,
    policy: pending?.policy ?? null,
  }), [phase, screen, presenters, presentInLounge, refused, accept, close, saving, failed, pending]);

  return (
    <PolicyUpdateContext.Provider value={api}>
      {children}
      {phase === "needed" && (screen || presenters === 0) ? (
        <Takeover><UpdateScreen /></Takeover>
      ) : null}
      {phase === "closed" ? <Takeover><ClosedScreen /></Takeover> : null}
      {phase === "flow" && pending ? (
        <Takeover>
          <Phase1AcceptanceFlow
            key={pending.policy.policyVersion}
            policy={pending.policy}
            priorCountry={pending.priorCountry}
            onAccepted={done}
            onStale={() => void read()}
          />
        </Takeover>
      ) : null}
    </PolicyUpdateContext.Provider>
  );
}

/** Full screen over whatever is open, as the acceptance gate draws it. */
function Takeover({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-background pt-[env(safe-area-inset-top)]">
      <div className="flex min-h-full flex-col">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------- pieces -- */

/** Will's message in the Lounge thread, a plain grey bot bubble. */
export function PolicyUpdateBubble() {
  if (!usePolicyUpdate()?.loungeOffer) return null;
  return (
    <div className="mr-auto block max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-left text-[15px] leading-relaxed text-foreground">
      {POLICY_UPDATE_COPY.bubble}
    </div>
  );
}

/** The footer in place of the record button: the grey card, then the pair. */
export function PolicyUpdateActions() {
  const update = usePolicyUpdate();
  if (!update) return null;
  return (
    <div className="flex flex-col gap-3">
      <WhatsNewCard policy={update.policy} />
      <Pair />
    </div>
  );
}

function Pair() {
  const update = usePolicyUpdate();
  if (!update) return null;
  return (
    <>
      <SymmetricPair
        closeLabel={POLICY_UPDATE_COPY.close}
        onClose={update.close}
        actionLabel={update.saving ? POLICY_UPDATE_COPY.accepting : POLICY_UPDATE_COPY.accept}
        onAction={update.accept}
      />
      {update.failed ? (
        <p role="alert" className="text-[13px] text-destructive">
          {POLICY_UPDATE_COPY.failed}
        </p>
      ) : null}
    </>
  );
}

type DocKey = "terms" | "privacy" | "ai";

const DOC_TITLE: Record<DocKey, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  ai: "How AI is used here",
};

function WhatsNewCard({ policy }: { policy: ProcessingPolicy | null }) {
  const [open, setOpen] = useState<DocKey | null>(null);
  if (!policy) return null;
  const docs: Record<DocKey, PolicyDocument> = {
    terms: policy.terms,
    privacy: policy.privacy,
    ai: policy.aiNotice,
  };
  const link = (key: DocKey, label: string) => (
    <button
      type="button"
      onClick={() => setOpen(key)}
      className="text-left underline underline-offset-4"
    >
      {label}
    </button>
  );
  return (
    <div className="rounded-xl bg-muted p-3 text-left text-[14px] leading-relaxed text-foreground">
      <p>{POLICY_UPDATE_COPY.whatsNew}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {link("terms", POLICY_UPDATE_COPY.terms)}
        {link("privacy", POLICY_UPDATE_COPY.privacy)}
        {link("ai", POLICY_UPDATE_COPY.aiNotice)}
      </div>
      {/* What the receipt records agreement to: the policy's own sentence. */}
      <p className="mt-2 text-[13px] text-muted-foreground">{policy.agreementCopy}</p>
      {open ? (
        <DocumentWindow
          title={DOC_TITLE[open]}
          document={docs[open]}
          isAiNotice={open === "ai"}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}

/** A document in its own window: the title and the button stay still and
 *  only the text scrolls, as on the consent screens. */
function DocumentWindow({
  title,
  document,
  isAiNotice,
  onClose,
}: {
  title: string;
  document: PolicyDocument;
  isAiNotice: boolean;
  onClose: () => void;
}) {
  // Showing the AI notice is an exposure in its own right (Art 50).
  useEffect(() => {
    if (!isAiNotice) return;
    void recordAiNoticeRendered({
      aiNoticeVersion: document.version,
      surface: "policy_update",
      clientRenderId: newKey(),
      clientVersion: CLIENT_VERSION,
    });
  }, [isAiNotice, document.version]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/35 p-4 pt-[max(1rem,env(safe-area-inset-top))]"
    >
      <div className="flex h-full max-h-[40rem] w-full max-w-[40rem] flex-col overflow-hidden rounded-2xl bg-background px-6 pb-6 pt-8 text-left shadow-xl">
        <div className="shrink-0 border-b border-border pb-4">
          <h2 className="text-[24px] font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Version {document.version}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap py-5 text-[15px] leading-[1.7] text-foreground/90">
          {document.copy}
        </div>
        <div className="flex shrink-0 justify-center pt-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-7 text-[14px] font-medium text-background transition hover:bg-foreground/90"
          >
            Continue
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          </button>
        </div>
      </div>
    </div>
  );
}

function UpdateScreen() {
  const update = usePolicyUpdate();
  return (
    <div className="mx-auto flex w-full max-w-[28rem] flex-1 flex-col justify-center px-6 py-8">
      <h1 className="text-balance text-[26px] font-semibold leading-tight tracking-tight text-foreground">
        {POLICY_UPDATE_COPY.title}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        {POLICY_UPDATE_COPY.lead}
      </p>
      <div className="mt-5 flex flex-col gap-3">
        <WhatsNewCard policy={update?.policy ?? null} />
        <Pair />
      </div>
    </div>
  );
}

function ClosedScreen() {
  const update = usePolicyUpdate();
  if (!update) return null;
  return (
    <div className="mx-auto flex w-full max-w-[28rem] flex-1 flex-col justify-center px-6 py-8">
      <h1 className="text-balance text-[26px] font-semibold leading-tight tracking-tight text-foreground">
        {POLICY_UPDATE_COPY.closedTitle}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        {POLICY_UPDATE_COPY.closedLead}
      </p>
      <button
        type="button"
        onClick={update.accept}
        className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-[15px] font-medium text-background transition hover:bg-foreground/90"
      >
        {update.saving ? POLICY_UPDATE_COPY.accepting : POLICY_UPDATE_COPY.accept}
        <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
      </button>
      {update.failed ? (
        <p role="alert" className="mt-2 text-[13px] text-destructive">
          {POLICY_UPDATE_COPY.failed}
        </p>
      ) : null}
    </div>
  );
}

/** The Lounge presents the prompt itself while it is on screen. */
export function usePresentPolicyUpdate(): void {
  const present = usePolicyUpdate()?.presentInLounge;
  useEffect(() => present?.(), [present]);
}

/** The Lounge's footer: the prompt's card and pair in place of the record
 *  control and the composer while the update is outstanding. */
export function PolicyUpdateSlot({ children }: { children: React.ReactNode }) {
  const update = usePolicyUpdate();
  return update?.loungeOffer ? <PolicyUpdateActions /> : <>{children}</>;
}
