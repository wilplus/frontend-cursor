"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StepFlowWrapper from "@/components/homework/shared/StepFlowWrapper";
import CoachMessageBanner from "@/components/homework/shared/CoachMessageBanner";

interface Step2SelfRatingScreenProps {
  recordingProcessingFailed: boolean;
  savingRating: boolean;
  ratingSubmitted: boolean;
  coachMessage: string | null;
  onRatingSelect: (n: number) => void;
  onSkip: () => void;
  onAbandon: () => void;
  resetting: boolean;
}

export default function Step2SelfRatingScreen({
  recordingProcessingFailed,
  savingRating,
  ratingSubmitted: _ratingSubmitted,
  coachMessage,
  onRatingSelect,
  onSkip,
  onAbandon: _onAbandon,
  resetting,
}: Step2SelfRatingScreenProps) {
  void _ratingSubmitted;
  void _onAbandon;

  if (recordingProcessingFailed) {
    return (
      <StepFlowWrapper step={2}>
        <CoachMessageBanner message={coachMessage} />
        <Card className="w-full max-w-md mx-auto border-0 bg-transparent p-6 shadow-none">
          <h3 className="text-lg font-semibold mb-2">We couldn&apos;t process this recording. Please record again.</h3>
          <p className="text-sm text-muted-foreground mb-4">
            This recording could not be analyzed, so this session cannot be completed.
          </p>
          <Button onClick={onSkip} disabled={resetting} className="w-full rounded-xl h-12 font-semibold">
            {resetting ? "Sending…" : "Start New Practice"}
          </Button>
        </Card>
      </StepFlowWrapper>
    );
  }

  return (
    <StepFlowWrapper step={2}>
      <CoachMessageBanner message={coachMessage} />
      <Card className="mx-auto w-full max-w-2xl border-0 bg-transparent px-4 py-6 shadow-none sm:px-6">
        <div className="mb-6 text-center">
          <p className="text-2xl font-bold leading-tight text-foreground sm:text-3xl md:text-4xl">
            How do you feel about your performance
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base md:text-lg">
            Choose a number from 1 to 5, with 1 being your lowest rating and 5 being your strongest.
          </p>
        </div>
        <div className="mb-4">
          <div className="grid grid-cols-5 gap-3 md:gap-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                type="button"
                variant="outline"
                disabled={savingRating}
                onClick={() => onRatingSelect(n)}
                className="h-20 rounded-2xl border-2 text-2xl font-bold shadow-sm transition-all hover:scale-[1.02] hover:bg-accent/70 sm:h-24 sm:text-3xl"
              >
                {n}
              </Button>
            ))}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={savingRating}
          onClick={onSkip}
          className="mx-auto mt-2 flex text-base text-muted-foreground"
        >
          Skip
        </Button>
      </Card>
    </StepFlowWrapper>
  );
}
