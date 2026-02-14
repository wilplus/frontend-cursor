"use client";

import React, { useState, useCallback, useEffect } from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

const RecordingContext = React.createContext<{
  isRecording: boolean;
  setRecordingActive: (active: boolean) => void;
  setShowNavbar: (show: boolean) => void;
} | null>(null);

export function useRecordingContext() {
  const ctx = React.useContext(RecordingContext);
  return ctx ?? { isRecording: false, setRecordingActive: () => {}, setShowNavbar: () => {} };
}

/** Wraps dashboard content (single flow: warm-up + recording_1 → … → recording_2 → report). Navbar is shown only on step 5 (end report). When recording, body scroll is locked and main uses safe scroll. */
export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [showNavbar, setShowNavbar] = useState(true);
  const setRecordingActive = useCallback((active: boolean) => {
    setIsRecording(active);
  }, []);

  useEffect(() => {
    if (isRecording) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
    return () => document.body.classList.remove("no-scroll");
  }, [isRecording]);

  return (
    <RecordingContext.Provider value={{ isRecording, setRecordingActive, setShowNavbar }}>
      <div className="min-h-screen bg-background">
        {showNavbar && <DashboardHeader />}
        <main
          className={`w-full max-w-4xl mx-auto flex flex-col min-w-0 px-4 py-8 sm:px-8 lg:px-10 ${isRecording ? "recording-screen" : ""}`}
        >
          <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
            {children}
          </div>
        </main>
      </div>
    </RecordingContext.Provider>
  );
}
