"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getFirstTen, type SetupState } from "@/services/api/modelSetup";
import ModelSetup from "../../models/ModelSetup";
import { AddExampleScreen } from "../../models/ModelAdd";

/* -------------------------------------------------------------------------- */
/*  "Teach it" and "Check its guesses" inside the blank setup (FIRST-08,      */
/*  FIRST-23; backend N618 item 3): the AI models' own screens for the model  */
/*  the host just made, with its model_id, and no words of their own. The    */
/*  owner's first 10 (GET /v2/models/<id>/setup/first-ten) when examples      */
/*  wait; a brand-new model has none, so "Add an example" for that model     */
/*  (words only, no answer), then the first 10 read again, which now hold     */
/*  it, answered there as the owner's own. Done, Back, ✕ or "Do it later" all go on to "Add       */
/*  another model?".                                                          */
/* -------------------------------------------------------------------------- */

/** Nothing to answer yet: no example on screen and "Do it later" alone. */
const empty = (state: SetupState) => !state.screen.teaching && state.screen.actions.length < 2;

export default function HostTeach({ modelId, onDone: done }: { modelId: string; onDone: () => void }) {
  // Once: a step past the first 10, Back and ✕ may all say "done" together.
  const left = useRef(false);
  const doneRef = useRef(done);
  doneRef.current = done;
  const onDone = useCallback(() => {
    if (left.current) return;
    left.current = true;
    doneRef.current();
  }, []);
  const [state, setState] = useState<SetupState | null | undefined>(undefined);
  const [reads, setReads] = useState(0);
  useEffect(() => {
    let alive = true;
    void getFirstTen(modelId).then((got) => {
      if (!alive) return;
      if (!got) onDone();
      else setState(got);
    });
    return () => {
      alive = false;
    };
  }, [modelId, onDone, reads]);
  const again = () => {
    setState(undefined);
    setReads((n) => n + 1);
  };
  if (!state) return null;
  if (empty(state)) {
    return <AddExampleScreen only={modelId} onBack={onDone} onClose={onDone} onAdded={again} onSet={again} />;
  }
  return (
    <ModelSetup
      key={reads}
      first={state}
      onBack={onDone}
      onClose={onDone}
      onList={onDone}
      onTeachOther={onDone}
      onTry={onDone}
      onPast={onDone}
    />
  );
}
