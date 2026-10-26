"use client";

import { useEffect, useState } from "react";
import { getPlan, type Plan } from "@/services/api/plan";
import { PLAN_COPY } from "@/lib/willab/planCopy";
import { PlanBar } from "./PlanCard";

/* The bar on the walk's end sheet (rules: the-plan.md §1 E3, G5; prototype
   version 27, progressBlock): one part per Take with its walk, filled with
   what the speaker did, never a measure of the voice, and "{n} of {total}
   practices done. Next: {day}." Nothing for anyone without an active plan. */

export default function PlanProgress() {
  const [plan, setPlan] = useState<Plan | null>(null);
  useEffect(() => {
    let live = true;
    void getPlan().then((s) => {
      if (live && s.enabled && s.plan?.status === "active" && s.plan.first_take_done) setPlan(s.plan);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!plan) return null;
  return (
    <div className="flex flex-col gap-[7px]" data-plan-progress>
      <PlanBar plan={plan} />
      {plan.next_day ? (
        <div className="text-[13px]">{PLAN_COPY.doneNext(Math.min(plan.done, plan.total), plan.total, plan.next_day)}</div>
      ) : null}
    </div>
  );
}
