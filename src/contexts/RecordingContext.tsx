"use client";

import { createContext, useContext, useState, useCallback } from "react";

type RecordingContextValue = {
  isRecording: boolean;
  setRecordingActive: (active: boolean) => void;
};

const RecordingContext = createContext<RecordingContextValue | null>(null);

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const [isRecording, setIsRecording] = useState(false);
  const setRecordingActive = useCallback((active: boolean) => {
    setIsRecording(active);
  }, []);
  return (
    <RecordingContext.Provider value={{ isRecording, setRecordingActive }}>
      {children}
    </RecordingContext.Provider>
  );
}

export function useRecordingContext(): RecordingContextValue {
  const ctx = useContext(RecordingContext);
  if (!ctx) {
    return {
      isRecording: false,
      setRecordingActive: () => {},
    };
  }
  return ctx;
}
