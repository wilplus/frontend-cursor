"use client";

import React from "react";
import type { Step } from "@/lib/api/types-homework";

export default function StepFlowWrapper({
  step,
  children,
}: {
  step: Step;
  children: React.ReactNode;
}) {
  // step is accepted as a prop for future per-step customization (e.g. analytics, transitions).
  void step;
  return (
    <div className="w-full space-y-4 animate-fade-in flex flex-col items-center">
      <div className="w-full flex flex-col items-center">{children}</div>
    </div>
  );
}
