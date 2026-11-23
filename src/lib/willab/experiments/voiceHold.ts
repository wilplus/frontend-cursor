import { calmFromFile, type BaselinePrompt, type ExperimentConfig, type VoiceModel } from "./voiceCatalog";

/* The host's choice for this tab, when the config route is not on yet.
   This is not the chat recipe. A successful PUT replaces it. */

export type VoiceHold = {
  model: VoiceModel | null;
  prompts: BaselinePrompt[];
  caseName: string | null;
  agreed: boolean;
};

const EMPTY: VoiceHold = { model: null, prompts: [], caseName: null, agreed: false };
const listeners = new Set<() => void>();
let hold: VoiceHold = EMPTY;
let caseFile: File | null = null;

export function readHold(): VoiceHold {
  return hold;
}

export function writeHold(next: Partial<VoiceHold>): VoiceHold {
  hold = { ...hold, ...next };
  listeners.forEach((fn) => fn());
  return hold;
}

export function readCaseFile(): File | null {
  return caseFile;
}

export function setCaseFile(file: File | null): void {
  caseFile = file;
  writeHold({ caseName: file?.name ?? null });
}

export function clearHold(): void {
  caseFile = null;
  hold = EMPTY;
  listeners.forEach((fn) => fn());
}

export function subscribeHold(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function holdFromConfig(config: ExperimentConfig, models: VoiceModel[]): VoiceHold {
  const model = models.find((item) => item.id === config.model_id) ?? hold.model;
  return writeHold({
    model: model ?? null,
    prompts: config.baseline_prompts.length ? config.baseline_prompts : calmFromFile(),
  });
}

export function chooseModel(model: VoiceModel): VoiceHold {
  const known = calmFromFile();
  const prompts = model.baseline_prompt_ids
    .map((id) => known.find((prompt) => prompt.id === id))
    .filter((prompt): prompt is BaselinePrompt => Boolean(prompt));
  return writeHold({ model, prompts: prompts.length ? prompts : known });
}
