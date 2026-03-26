"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CompactReportPreviewCard from "@/components/reports/CompactReportPreviewCard";
import HomeworkReportsModal from "@/components/homework/HomeworkReportsModal";
import StepFlowWrapper from "@/components/homework/shared/StepFlowWrapper";
import VideoModal from "@/components/homework/shared/VideoModal";
import InsufficientCreditsModal from "@/components/homework/shared/InsufficientCreditsModal";
import Step0WaitingCard from "@/components/homework/step0/Step0WaitingCard";
import Step0AssignmentCard from "@/components/homework/step0/Step0AssignmentCard";
import type { UserSniperProfile } from "@/lib/sniper/types";
import type { CompactReportPreview } from "@/lib/reports/compact-preview";
import { parseVimeoId } from "@/lib/api/homework-utils";

const STEP0_REPORTS_PAGE_SIZE = 5;

interface Step0Session {
  id: string;
  created_at?: string;
  completed_at?: string;
  status?: string;
  report_grade?: number | null;
  recording_id?: string;
  report_id?: string;
  report_delivered?: boolean | null;
  student_completion_email_sent_at?: string | null;
  report_preview?: { report_text_preview?: string };
}

interface Step0ScreenProps {
  // waiting state
  reviewPending: boolean;
  waitingMessage: string;
  sniperProfile: UserSniperProfile | null;
  // video / assignment
  step0TutorVideoUrl: string | null;
  step0TutorVideoDescription: string | null;
  assignedExercises: Array<{ id: string; title: string; video_url?: string | null; description?: string | null }>;
  loading: boolean;
  error: string | null;
  onStart: () => void;
  // video modal
  videoModalUrl: string | null;
  onOpenVideoModal: (url: string) => void;
  onCloseVideoModal: () => void;
  // credits modal
  showInsufficientCreditsModal: boolean;
  onCloseInsufficientCreditsModal: () => void;
  // reports list
  showReportsList: boolean;
  onToggleReportsList: () => void;
  step0Sessions: Step0Session[];
  step0SessionsLoading: boolean;
  visibleReportsCount: number;
  onLoadMoreReports: () => void;
  step0ReportPreviews: Record<string, CompactReportPreview | null>;
  step0ReportPreviewLoading: Record<string, boolean>;
  // reports modal
  reportsModalOpen: boolean;
  reportModalSessionId: string | null;
  onOpenReportModal: (sessionId: string) => void;
  onCloseReportModal: () => void;
}

export default function Step0Screen({
  reviewPending,
  waitingMessage,
  sniperProfile,
  step0TutorVideoUrl,
  step0TutorVideoDescription,
  assignedExercises,
  loading,
  error,
  onStart,
  videoModalUrl,
  onOpenVideoModal,
  onCloseVideoModal,
  showInsufficientCreditsModal,
  onCloseInsufficientCreditsModal,
  showReportsList,
  onToggleReportsList,
  step0Sessions,
  step0SessionsLoading,
  visibleReportsCount,
  onLoadMoreReports,
  step0ReportPreviews,
  step0ReportPreviewLoading,
  reportsModalOpen,
  reportModalSessionId,
  onOpenReportModal,
  onCloseReportModal,
}: Step0ScreenProps) {
  const ex = assignedExercises[0];
  const fallbackExerciseVideoUrl = ex?.video_url?.trim() ?? null;
  const videoUrl = step0TutorVideoUrl ?? fallbackExerciseVideoUrl;
  const vimeoId = videoUrl ? parseVimeoId(videoUrl) : null;

  const visibleStep0Sessions = step0Sessions.slice(0, visibleReportsCount);
  const canLoadMoreReports = visibleReportsCount < step0Sessions.length;

  return (
    <div className="flex flex-col items-center w-full pt-0 -mt-8 sm:-mt-10">
      <StepFlowWrapper step={0}>
        <Card className="w-full max-w-md mx-auto p-6 sm:p-8 border-0 bg-transparent shadow-none">
          <div className="flex flex-col items-center w-full max-w-[280px] mx-auto space-y-4">
            {reviewPending ? (
              <Step0WaitingCard message={waitingMessage} sniperProfile={sniperProfile} />
            ) : (
              <Step0AssignmentCard
                videoUrl={videoUrl ?? null}
                vimeoId={vimeoId}
                introText={step0TutorVideoDescription}
                loading={loading}
                error={error}
                onStart={onStart}
                onOpenVideoModal={onOpenVideoModal}
              />
            )}

            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={onToggleReportsList}
            >
              {showReportsList ? "Hide reports" : "View reports"}
            </Button>
          </div>

          {/* Reports list */}
          {showReportsList && (
            <div className="w-full max-w-[280px] mx-auto mt-8 space-y-4">
              {step0SessionsLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : step0Sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reports yet.</p>
              ) : (
                <div className="space-y-3">
                  {visibleStep0Sessions.map((s) => (
                    <CompactReportPreviewCard
                      key={s.id}
                      title={s.created_at ? new Date(s.created_at).toLocaleDateString() : "Report"}
                      preview={step0ReportPreviews[s.id] ?? null}
                      loading={!!step0ReportPreviewLoading[s.id]}
                      onOpen={() => onOpenReportModal(s.id)}
                    />
                  ))}
                  {canLoadMoreReports ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={onLoadMoreReports}
                    >
                      Load more
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          )}

          <VideoModal url={videoModalUrl} onClose={onCloseVideoModal} />
          <InsufficientCreditsModal
            open={showInsufficientCreditsModal}
            onClose={onCloseInsufficientCreditsModal}
          />
        </Card>

        <HomeworkReportsModal
          open={reportsModalOpen}
          onOpenChange={(open) => {
            if (!open) onCloseReportModal();
          }}
          sessionId={reportModalSessionId}
        />
      </StepFlowWrapper>
    </div>
  );
}
