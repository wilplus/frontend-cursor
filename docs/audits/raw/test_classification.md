# Frontend test file classification (2026-09-13)

| test module | tier | runs in CI? | result (this run) | cases | test last touched | subject last touched | verdict | why |
|---|---|---|---|---|---|---|---|---|
| e2e/deck.spec.mjs | F1-path | NOT IN CI (not in README table either) | n/a (not run here) | - | 2026-08-14 | n/a | FIX: add to CI e2e job or delete | transcript review deck wiring; founder spec 2026-08-11; nothing runs it |
| e2e/ideal-text-canonical.spec.mjs | F1-path | CI e2e job | n/a (not run here) | - | 2026-09-08 | n/a | KEEP | L1 canonical ideal text in a real browser |
| e2e/marked-editor.spec.mjs | F1-path | CI e2e job | n/a (not run here) | - | 2026-08-26 | n/a | KEEP | ideal-text editor |
| e2e/record-flow.spec.mjs | F1-path | NOT IN CI (needs live backend) | n/a (not run here) | - | 2026-08-03 | n/a | DECIDE (Q) | the core record flow end to end; only runs by hand |
| src/components/willab/ProcessingWait.test.ts | F1-path | vitest (CI unit job) | 2 pass | 2 | 2026-08-26 | 2026-08-26 | KEEP | tiny (≤2 cases) — merge candidate |
| src/components/willab/audioUploadValidation.test.ts | F1-path | vitest (CI unit job) | 6 pass | 6 | 2026-07-13 | 2026-07-13 | KEEP |  |
| src/components/willab/deckSurface.test.ts | F1-path | vitest (CI unit job) | 21 pass | 21 | 2026-09-08 | n/a | KEEP | no src import — asserts on file text/structure only |
| src/components/willab/defaultDeckWiring.test.ts | F1-path | vitest (CI unit job) | 6 pass | 6 | 2026-08-24 | n/a | KEEP | no src import — asserts on file text/structure only |
| src/components/willab/displayKind.test.ts | F1-path | vitest (CI unit job) | 6 pass | 6 | 2026-08-18 | 2026-09-09 | KEEP | subject moved 2026-09-09, test last touched 2026-08-18 |
| src/components/willab/guestOwnerProcessing.test.ts | F1-path | vitest (CI unit job) | 1 pass | 1 | 2026-08-27 | n/a | KEEP | no src import — asserts on file text/structure only; tiny (≤2 cases) — merge candidate |
| src/components/willab/presentation.test.ts | F1-path | vitest (CI unit job) | 14 pass | 14 | 2026-06-19 | 2026-08-25 | KEEP | subject moved 2026-08-25, test last touched 2026-06-19 |
| src/components/willab/processingJourney.test.ts | F1-path | vitest (CI unit job) | 6 pass | 6 | 2026-08-29 | n/a | KEEP | no src import — asserts on file text/structure only |
| src/components/willab/processingResumeOverlay.test.ts | F1-path | vitest (CI unit job) | 3 pass | 3 | 2026-08-26 | n/a | KEEP | no src import — asserts on file text/structure only |
| src/components/willab/processingWaitingTips.test.ts | F1-path | vitest (CI unit job) | 3 pass | 3 | 2026-08-18 | 2026-08-18 | KEEP |  |
| src/components/willab/reRecordEntersTheMic.test.ts | F1-path | vitest (CI unit job) | 4 pass | 4 | 2026-08-12 | n/a | KEEP | no src import — asserts on file text/structure only |
| src/components/willab/readout.back.test.ts | F1-path | vitest (CI unit job) | 5 pass | 5 | 2026-06-20 | 2026-08-24 | KEEP | subject moved 2026-08-24, test last touched 2026-06-20 |
| src/components/willab/readout.groupSnippets.test.ts | F1-path | vitest (CI unit job) | 5 pass | 5 | 2026-08-22 | 2026-08-24 | KEEP |  |
| src/components/willab/readout.instantChunk.test.ts | F1-path | vitest (CI unit job) | 5 pass | 5 | 2026-07-16 | 2026-08-24 | KEEP | subject moved 2026-08-24, test last touched 2026-07-16 |
| src/components/willab/readout.sayItStronger.test.ts | F1-path | vitest (CI unit job) | 14 pass | 14 | 2026-07-16 | 2026-08-24 | KEEP | subject moved 2026-08-24, test last touched 2026-07-16 |
| src/components/willab/readout.test.ts | F1-path | vitest (CI unit job) | 16 pass | 16 | 2026-08-24 | 2026-08-24 | KEEP |  |
| src/components/willab/recordingScreen.test.ts | F1-path | vitest (CI unit job) | 15 pass | 15 | 2026-09-07 | n/a | KEEP | no src import — asserts on file text/structure only |
| src/components/willab/slideCorrection.test.ts | F1-path | vitest (CI unit job) | 8 pass | 8 | 2026-08-11 | n/a | KEEP | no src import — asserts on file text/structure only |
| src/components/willab/useWillabFlow.test.ts | F1-path | vitest (CI unit job) | 5 pass | 5 | 2026-07-25 | 2026-08-18 | KEEP | subject moved 2026-08-18, test last touched 2026-07-25 |
| src/lib/willab/additionsAndLock.test.ts | F1-path | vitest (CI unit job) | 16 pass | 16 | 2026-08-26 | 2026-09-09 | KEEP | subject moved 2026-09-09, test last touched 2026-08-26 |
| src/lib/willab/deckChunks.test.ts | F1-path | vitest (CI unit job) | 31 pass | 31 | 2026-09-07 | 2026-09-07 | KEEP |  |
| src/lib/willab/deckScroll.test.ts | F1-path | vitest (CI unit job) | 22 pass | 22 | 2026-08-19 | 2026-08-19 | KEEP |  |
| src/lib/willab/defaultDeck.test.ts | F1-path | vitest (CI unit job) | 10 pass | 10 | 2026-08-25 | 2026-08-25 | KEEP |  |
| src/lib/willab/documentParts.test.ts | F1-path | vitest (CI unit job) | 34 pass | 34 | 2026-08-29 | 2026-08-29 | KEEP |  |
| src/lib/willab/documentSegments.test.ts | F1-path | vitest (CI unit job) | 16 pass | 16 | 2026-07-29 | 2026-07-29 | KEEP |  |
| src/lib/willab/exploreArc.test.ts | F1-path | vitest (CI unit job) | 4 pass | 4 | 2026-08-17 | 2026-08-17 | KEEP |  |
| src/lib/willab/linkify.test.ts | F1-path | vitest (CI unit job) | 11 pass | 11 | 2026-07-27 | 2026-07-27 | KEEP |  |
| src/lib/willab/markedEditorSerialize.test.ts | F1-path | vitest (CI unit job) | 18 pass | 18 | 2026-08-03 | 2026-08-03 | KEEP |  |
| src/lib/willab/praiseLane.test.ts | F1-path | vitest (CI unit job) | 23 pass | 23 | 2026-09-07 | 2026-09-09 | KEEP |  |
| src/lib/willab/presentationDocument.test.ts | F1-path | vitest (CI unit job) | 4 pass | 4 | 2026-08-29 | 2026-09-09 | KEEP | subject moved 2026-09-09, test last touched 2026-08-29 |
| src/lib/willab/processingTake.test.ts | F1-path | vitest (CI unit job) | 12 pass | 12 | 2026-08-26 | 2026-08-26 | KEEP |  |
| src/lib/willab/readingBlocks.test.ts | F1-path | vitest (CI unit job) | 8 pass | 8 | 2026-07-27 | 2026-07-27 | KEEP |  |
| src/lib/willab/richMarkers.test.ts | F1-path | vitest (CI unit job) | 37 pass | 37 | 2026-07-27 | 2026-07-27 | KEEP |  |
| src/lib/willab/trackedChangeWhy.test.ts | F1-path | vitest (CI unit job) | 15 pass | 15 | 2026-08-27 | 2026-09-09 | KEEP | subject moved 2026-09-09, test last touched 2026-08-27 |
| src/lib/willab/trackedChanges.test.ts | F1-path | vitest (CI unit job) | 13 pass | 13 | 2026-08-27 | 2026-09-09 | KEEP | subject moved 2026-09-09, test last touched 2026-08-27 |
| src/services/api/blockVariants.test.ts | F1-path | vitest (CI unit job) | 24 pass | 24 | 2026-08-03 | 2026-08-03 | KEEP |  |
| src/services/api/idealText.changes.test.ts | F1-path | vitest (CI unit job) | 27 pass | 27 | 2026-08-27 | 2026-09-09 | KEEP | subject moved 2026-09-09, test last touched 2026-08-27 |
| src/services/api/idealText.coreEnrichment.test.ts | F1-path | vitest (CI unit job) | 6 pass | 6 | 2026-09-07 | 2026-09-09 | KEEP |  |
| src/services/api/idealText.exposure.test.ts | F1-path | vitest (CI unit job) | 2 pass | 2 | 2026-08-27 | 2026-09-09 | KEEP | subject moved 2026-09-09, test last touched 2026-08-27; tiny (≤2 cases) — merge candidate |
| src/services/api/idealText.pieces.test.ts | F1-path | vitest (CI unit job) | 15 pass | 15 | 2026-08-03 | 2026-09-09 | KEEP | subject moved 2026-09-09, test last touched 2026-08-03 |
| src/services/api/idealText.recordingRoots.test.ts | F1-path | vitest (CI unit job) | 2 pass | 2 | 2026-09-07 | 2026-09-09 | KEEP | tiny (≤2 cases) — merge candidate |
| src/services/api/idealText.test.ts | F1-path | vitest (CI unit job) | 35 pass | 35 | 2026-08-22 | 2026-09-09 | KEEP | subject moved 2026-09-09, test last touched 2026-08-22 |
| src/services/api/idealText.userEdit.test.ts | F1-path | vitest (CI unit job) | 17 pass | 17 | 2026-08-26 | 2026-09-09 | KEEP | subject moved 2026-09-09, test last touched 2026-08-26 |
| src/services/api/labRecording.test.ts | F1-path | vitest (CI unit job) | 28 pass | 28 | 2026-08-27 | 2026-08-27 | KEEP |  |
| src/services/api/partLock.test.ts | F1-path | vitest (CI unit job) | 7 pass | 7 | 2026-08-26 | 2026-08-26 | KEEP |  |
| src/services/api/projects.test.ts | F1-path | vitest (CI unit job) | 3 pass | 3 | 2026-08-27 | 2026-08-27 | KEEP |  |
| src/services/api/recordingConfig.test.ts | F1-path | vitest (CI unit job) | 3 pass | 3 | 2026-07-27 | 2026-07-27 | KEEP |  |
| src/services/api/recordingProgress.test.ts | F1-path | vitest (CI unit job) | 8 pass | 8 | 2026-06-10 | 2026-06-10 | KEEP |  |
| src/services/api/strengths.test.ts | F1-path | vitest (CI unit job) | 14 pass | 14 | 2026-06-21 | 2026-06-21 | KEEP |  |
| src/services/api/takeFeedback.test.ts | F1-path | vitest (CI unit job) | 2 pass | 2 | 2026-09-08 | 2026-09-08 | KEEP | tiny (≤2 cases) — merge candidate |
| src/services/api/transcriptEdits.test.ts | F1-path | vitest (CI unit job) | 5 pass | 5 | 2026-08-24 | 2026-08-24 | KEEP |  |
| e2e/corpus.spec.mjs | F2 | CI e2e job | n/a (not run here) | - | 2026-08-26 | n/a | KEEP | coach corpus harness |
| e2e/star-verdicts.spec.mjs | F2 | CI e2e job | n/a (not run here) | - | 2026-08-03 | n/a | KEEP | coach star-verdict harness |
| src/components/willab/confidentVoicePractice.test.ts | F2 | vitest (CI unit job) | 8 pass | 8 | 2026-09-10 | n/a | KEEP | no src import — asserts on file text/structure only |
| src/services/api/coachGuidanceDelivery.test.ts | F2 | vitest (CI unit job) | 11 pass | 11 | 2026-09-10 | 2026-09-10 | KEEP |  |
| src/services/api/coachStudents.test.ts | F2 | vitest (CI unit job) | 3 pass | 3 | 2026-07-16 | 2026-07-16 | KEEP |  |
| src/services/api/confidenceReview.test.ts | F2 | vitest (CI unit job) | 5 pass | 5 | 2026-08-03 | 2026-08-03 | KEEP |  |
| src/services/api/confidentVoicePractice.test.ts | F2 | vitest (CI unit job) | 2 pass | 2 | 2026-08-19 | 2026-08-19 | KEEP | tiny (≤2 cases) — merge candidate |
| src/services/api/founderConfidenceComparison.test.ts | F2 | vitest (CI unit job) | 2 pass | 2 | 2026-08-24 | 2026-08-26 | KEEP | tiny (≤2 cases) — merge candidate |
| src/services/api/learningExposures.test.ts | F2 | vitest (CI unit job) | 3 pass | 3 | 2026-08-27 | 2026-08-27 | KEEP |  |
| src/services/api/mlc2Consent.test.ts | F2 | vitest (CI unit job) | 3 pass | 3 | 2026-09-08 | 2026-09-08 | KEEP |  |
| src/services/api/mlc3FirstClient.test.ts | F2 | vitest (CI unit job) | 4 pass | 4 | 2026-09-10 | 2026-09-10 | KEEP |  |
| src/services/api/sendTakeToCoach.test.ts | F2 | vitest (CI unit job) | 2 pass | 2 | 2026-08-24 | 2026-08-24 | KEEP | tiny (≤2 cases) — merge candidate |
| src/services/api/starVerdicts.test.ts | F2 | vitest (CI unit job) | 37 pass | 37 | 2026-08-22 | 2026-08-22 | KEEP |  |
| src/services/api/stateRatings.inline.test.ts | F2 | vitest (CI unit job) | 4 pass | 4 | 2026-09-09 | 2026-09-09 | KEEP |  |
| src/services/api/stateRatings.test.ts | F2 | vitest (CI unit job) | 7 pass | 7 | 2026-08-26 | 2026-09-09 | KEEP | subject moved 2026-09-09, test last touched 2026-08-26 |
| src/services/api/suggestionFeedback.test.ts | F2 | vitest (CI unit job) | 1 pass | 1 | 2026-08-24 | 2026-08-24 | KEEP | tiny (≤2 cases) — merge candidate |
| src/services/api/trainingCorpus.languageRouting.test.ts | F2 | vitest (CI unit job) | 3 pass | 3 | 2026-09-08 | 2026-09-09 | KEEP |  |
| src/services/api/trainingCorpus.test.ts | F2 | vitest (CI unit job) | 60 pass | 60 | 2026-09-09 | 2026-09-09 | KEEP |  |
| e2e/csp-violations.spec.mjs | fence | CI csp job | n/a (not run here) | - | 2026-08-04 | n/a | KEEP (fence) | production CSP against real routes |
| src/app/coach/compare/blinding.test.ts | fence | vitest (CI unit job) | 7 pass | 7 | 2026-08-11 | n/a | KEEP (fence) | asserts a written invariant |
| src/app/coach/corpus/corpusFence.test.ts | fence | vitest (CI unit job) | 9 pass | 9 | 2026-08-24 | n/a | KEEP (fence) | asserts a written invariant |
| src/components/tokens/tierKeyFence.test.ts | fence | vitest (CI unit job) | 2 pass | 1 | 2026-08-15 | n/a | KEEP (fence) | asserts a written invariant; tiny (≤2 cases) — merge candidate |
| src/components/willab/CoachInlineBlindExposureBoundary.test.tsx | fence | vitest (CI unit job) | 2 pass | 2 | 2026-09-09 | 2026-09-09 | KEEP (fence) | asserts a written invariant; tiny (≤2 cases) — merge candidate |
| src/components/willab/blindLabelingIsBlind.test.ts | fence | vitest (CI unit job) | 32 pass | 32 | 2026-09-09 | 2026-09-09 | KEEP (fence) | asserts a written invariant |
| src/components/willab/idealTextCoreFirst.contract.test.ts | fence | vitest (CI unit job) | 3 pass | 2 | 2026-09-01 | n/a | KEEP (fence) | asserts a written invariant; tiny (≤2 cases) — merge candidate |
| src/components/willab/loadingStateContract.test.ts | fence | vitest (CI unit job) | 6 pass | 6 | 2026-08-26 | n/a | KEEP (fence) | asserts a written invariant |
| src/components/willab/lockAfterEdit.test.ts | fence | vitest (CI unit job) | 5 pass | 5 | 2026-08-26 | n/a | KEEP (fence) | asserts a written invariant |
| src/components/willab/mlc2ConsentContract.test.ts | fence | vitest (CI unit job) | 7 pass | 7 | 2026-08-28 | 2026-08-04 | KEEP (fence) | asserts a written invariant |
| src/components/willab/noStarsOnUserSurfaces.test.ts | fence | vitest (CI unit job) | 4 pass | 4 | 2026-08-11 | n/a | KEEP (fence) | asserts a written invariant |
| src/components/willab/noTopBarEditing.test.ts | fence | vitest (CI unit job) | 4 pass | 4 | 2026-08-26 | n/a | KEEP (fence) | asserts a written invariant |
| src/components/willab/starVerdictSeparation.test.ts | fence | vitest (CI unit job) | 9 pass | 9 | 2026-08-26 | n/a | KEEP (fence) | asserts a written invariant |
| src/lib/life/isolation.test.ts | fence | vitest (CI unit job) | 8 pass | 8 | 2026-07-27 | 2026-08-03 | KEEP (fence) | asserts a written invariant; subject moved 2026-08-03, test last touched 2026-07-27 |
| src/lib/pwa/serviceWorkerPolicy.test.ts | fence | vitest (CI unit job) | 15 pass | 15 | 2026-08-04 | n/a | KEEP (fence) | asserts a written invariant |
| src/lib/security/csp.test.ts | fence | vitest (CI unit job) | 7 pass | 7 | 2026-08-04 | 2026-08-25 | KEEP (fence) | asserts a written invariant |
| src/services/api/uploadKey.test.ts | fence | vitest (CI unit job) | 3 pass | 3 | 2026-08-24 | n/a | KEEP (fence) | asserts a written invariant |
| src/components/willab/speakerSexAskGate.test.ts | retired? | vitest (CI unit job) | 7 pass | 7 | 2026-07-30 | 2026-08-18 | DECIDE (Q) | guards a mount for the retired speaker-sex ask; subject moved 2026-08-18, test last touched 2026-07-30 |
| src/services/api/bestPresentation.test.ts | retired? | vitest (CI unit job) | 5 pass | 5 | 2026-08-22 | 2026-08-29 | DECIDE (Q) | Best Presentation is retired per L1; BestPresentationOverlay + API client still shipped |
| src/services/api/userProfile.sex.test.ts | retired? | vitest (CI unit job) | 23 pass | 13 | 2026-08-26 | 2026-08-26 | DECIDE (Q) | speaker-sex collection is retired (2026-08-29) but the profile_sex field, prompts and this test are still live |
| e2e/bets-reorder.spec.mjs | scaffolding | CI e2e job | n/a (not run here) | - | 2026-08-03 | n/a | KEEP (off-path) | Life panel harness |
| src/components/life/useDragReorder.test.ts | scaffolding | vitest (CI unit job) | 5 pass | 5 | 2026-07-27 | 2026-07-27 | KEEP (off-path) | valid but protects non-F1 surface |
| src/components/tokens/copy.test.ts | scaffolding | vitest (CI unit job) | 13 pass | 13 | 2026-08-19 | 2026-08-22 | KEEP (off-path) | valid but protects non-F1 surface |
| src/components/tokens/planControls.test.ts | scaffolding | vitest (CI unit job) | 10 pass | 10 | 2026-08-15 | 2026-08-22 | KEEP (off-path) | valid but protects non-F1 surface |
| src/components/willab/flowCopy.test.ts | scaffolding | vitest (CI unit job) | 8 pass | 8 | 2026-08-26 | 2026-08-26 | KEEP (off-path) | valid but protects non-F1 surface |
| src/components/willab/loungeOffers.test.ts | scaffolding | vitest (CI unit job) | 5 pass | 5 | 2026-07-31 | 2026-07-31 | KEEP (off-path) | valid but protects non-F1 surface |
| src/components/willab/loungePrompts.test.ts | scaffolding | vitest (CI unit job) | 5 pass | 5 | 2026-08-19 | 2026-08-26 | KEEP (off-path) | valid but protects non-F1 surface |
| src/components/willab/loungeReports.test.ts | scaffolding | vitest (CI unit job) | 9 pass | 9 | 2026-08-26 | 2026-08-26 | KEEP (off-path) | valid but protects non-F1 surface |
| src/components/willab/restoredSetup.test.ts | scaffolding | vitest (CI unit job) | 7 pass | 7 | 2026-07-31 | 2026-08-17 | KEEP (off-path) | valid but protects non-F1 surface; subject moved 2026-08-17, test last touched 2026-07-31 |
| src/components/willab/sendStatus.test.ts | scaffolding | vitest (CI unit job) | 6 pass | 6 | 2026-08-24 | 2026-08-24 | KEEP (off-path) | valid but protects non-F1 surface |
| src/components/willab/styleLaneHasAHandle.test.ts | scaffolding | vitest (CI unit job) | 12 pass | 12 | 2026-08-18 | 2026-09-07 | KEEP (off-path) | valid but protects non-F1 surface; subject moved 2026-09-07, test last touched 2026-08-18 |
| src/components/willab/takeReviewOrder.test.ts | scaffolding | vitest (CI unit job) | 8 pass | 8 | 2026-08-24 | 2026-08-24 | KEEP (off-path) | valid but protects non-F1 surface |
| src/components/willab/topUpCardGate.test.ts | scaffolding | vitest (CI unit job) | 4 pass | 4 | 2026-08-15 | 2026-08-18 | KEEP (off-path) | valid but protects non-F1 surface |
| src/components/willab/waitingTips.test.ts | scaffolding | vitest (CI unit job) | 7 pass | 7 | 2026-08-26 | 2026-08-18 | KEEP (off-path) | valid but protects non-F1 surface |
| src/components/willab/willabHelpers.test.ts | scaffolding | vitest (CI unit job) | 33 pass | 33 | 2026-08-26 | 2026-08-26 | KEEP (off-path) | valid but protects non-F1 surface |
| src/components/willab/willabParked.test.ts | scaffolding | vitest (CI unit job) | 4 pass | 4 | 2026-08-24 | 2026-08-24 | KEEP (off-path) | valid but protects non-F1 surface |
| src/hooks/usePublishLiveSubscription.test.ts | scaffolding | vitest (CI unit job) | 8 pass | 8 | 2026-05-21 | 2026-05-21 | KEEP (off-path) | valid but protects non-F1 surface |
| src/hooks/usePwaInstall.test.ts | scaffolding | vitest (CI unit job) | 12 pass | 12 | 2026-06-19 | 2026-06-19 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/ceo/clickNavigation.test.ts | scaffolding | vitest (CI unit job) | 1 pass | 1 | 2026-08-26 | n/a | KEEP (off-path) | valid but protects non-F1 surface; no src import — asserts on file text/structure only; tiny (≤2 cases) — merge candidate |
| src/lib/ceo/domain.test.ts | scaffolding | vitest (CI unit job) | 3 pass | 3 | 2026-08-26 | 2026-08-27 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/ceo/hostRouting.test.ts | scaffolding | vitest (CI unit job) | 6 pass | 6 | 2026-08-26 | 2026-08-26 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/ceo/overview.test.ts | scaffolding | vitest (CI unit job) | 8 pass | 8 | 2026-08-26 | 2026-08-26 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/ceo/workItems.test.ts | scaffolding | vitest (CI unit job) | 5 pass | 5 | 2026-08-25 | 2026-08-25 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/funnel/loungeLocalThread.test.ts | scaffolding | vitest (CI unit job) | 6 pass | 6 | 2026-06-03 | 2026-08-26 | KEEP (off-path) | valid but protects non-F1 surface; subject moved 2026-08-26, test last touched 2026-06-03 |
| src/lib/life/copy.test.ts | scaffolding | vitest (CI unit job) | 15 pass | 15 | 2026-07-30 | 2026-08-04 | KEEP (off-path) | valid but protects non-F1 surface; subject moved 2026-08-04, test last touched 2026-07-30 |
| src/lib/life/documentFold.test.ts | scaffolding | vitest (CI unit job) | 20 pass | 20 | 2026-08-01 | 2026-08-03 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/life/draftGroups.test.ts | scaffolding | vitest (CI unit job) | 4 pass | 4 | 2026-07-31 | 2026-07-31 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/life/duePresets.test.ts | scaffolding | vitest (CI unit job) | 8 pass | 8 | 2026-07-27 | 2026-07-31 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/life/goalOrder.test.ts | scaffolding | vitest (CI unit job) | 7 pass | 7 | 2026-08-02 | 2026-08-02 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/life/hashtags.test.ts | scaffolding | vitest (CI unit job) | 17 pass | 17 | 2026-07-26 | 2026-07-26 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/life/mappers.test.ts | scaffolding | vitest (CI unit job) | 54 pass | 54 | 2026-08-04 | 2026-08-04 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/life/menu.test.ts | scaffolding | vitest (CI unit job) | 24 pass | 24 | 2026-08-04 | 2026-08-04 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/life/panelCache.test.ts | scaffolding | vitest (CI unit job) | 6 pass | 6 | 2026-08-01 | 2026-08-01 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/life/prefetch.test.ts | scaffolding | vitest (CI unit job) | 6 pass | 6 | 2026-08-04 | 2026-08-04 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/life/setupSteps.test.ts | scaffolding | vitest (CI unit job) | 14 pass | 14 | 2026-07-30 | 2026-07-31 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/life/timelineScale.test.ts | scaffolding | vitest (CI unit job) | 10 pass | 10 | 2026-07-26 | 2026-07-26 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/life/uploadKind.test.ts | scaffolding | vitest (CI unit job) | 5 pass | 5 | 2026-07-31 | 2026-08-04 | KEEP (off-path) | valid but protects non-F1 surface; subject moved 2026-08-04, test last touched 2026-07-31 |
| src/lib/productDiscovery.test.ts | scaffolding | vitest (CI unit job) | 5 pass | 5 | 2026-08-25 | 2026-08-25 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/sse.test.ts | scaffolding | vitest (CI unit job) | 8 pass | 8 | 2026-08-03 | 2026-08-24 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/supabase/client.test.ts | scaffolding | vitest (CI unit job) | 6 pass | 6 | 2026-08-04 | 2026-08-04 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/willab/autosaveDrafts.test.ts | scaffolding | vitest (CI unit job) | 6 pass | 6 | 2026-08-15 | 2026-08-15 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/willab/documentSettle.test.ts | scaffolding | vitest (CI unit job) | 10 pass | 10 | 2026-08-26 | 2026-08-26 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/willab/emphasizeQuote.test.ts | scaffolding | vitest (CI unit job) | 12 pass | 12 | 2026-08-15 | 2026-08-15 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/willab/idealTitleCache.test.ts | scaffolding | vitest (CI unit job) | 13 pass | 13 | 2026-08-15 | 2026-08-15 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/willab/rootPhraseLayer.test.ts | scaffolding | vitest (CI unit job) | 3 pass | 3 | 2026-08-29 | 2026-08-29 | KEEP (off-path) | valid but protects non-F1 surface |
| src/lib/willab/rootingPhraseQualification.test.ts | scaffolding | vitest (CI unit job) | 4 pass | 4 | 2026-09-08 | 2026-09-08 | KEEP (off-path) | valid but protects non-F1 surface |
| src/services/api/arcFeedback.tokens.test.ts | scaffolding | vitest (CI unit job) | 4 pass | 4 | 2026-07-31 | 2026-08-22 | KEEP (off-path) | valid but protects non-F1 surface; subject moved 2026-08-22, test last touched 2026-07-31 |
| src/services/api/chatQuery.test.ts | scaffolding | vitest (CI unit job) | 1 pass | 1 | 2026-08-19 | 2026-08-25 | KEEP (off-path) | valid but protects non-F1 surface; tiny (≤2 cases) — merge candidate |
| src/services/api/journal.test.ts | scaffolding | vitest (CI unit job) | 44 pass | 44 | 2026-07-30 | 2026-08-19 | KEEP (off-path) | valid but protects non-F1 surface; subject moved 2026-08-19, test last touched 2026-07-30 |
| src/services/api/lifeDraft.test.ts | scaffolding | vitest (CI unit job) | 11 pass | 11 | 2026-08-01 | 2026-08-03 | KEEP (off-path) | valid but protects non-F1 surface |
| src/services/api/lifeStrategyDownload.test.ts | scaffolding | vitest (CI unit job) | 7 pass | 7 | 2026-07-27 | 2026-08-03 | KEEP (off-path) | valid but protects non-F1 surface; subject moved 2026-08-03, test last touched 2026-07-27 |
| src/services/api/loungeMessages.test.ts | scaffolding | vitest (CI unit job) | 9 pass | 9 | 2026-08-26 | 2026-08-26 | KEEP (off-path) | valid but protects non-F1 surface |
| src/services/api/tokens.test.ts | scaffolding | vitest (CI unit job) | 33 pass | 33 | 2026-08-22 | 2026-08-22 | KEEP (off-path) | valid but protects non-F1 surface |
| src/services/api/userProfile.languages.test.ts | scaffolding | vitest (CI unit job) | 3 pass | 3 | 2026-08-26 | 2026-08-26 | KEEP (off-path) | valid but protects non-F1 surface |
| src/services/api/willabMappers.test.ts | scaffolding | vitest (CI unit job) | 35 pass | 35 | 2026-08-24 | 2026-08-26 | KEEP (off-path) | valid but protects non-F1 surface |
| src/services/api/winsDerive.test.ts | scaffolding | vitest (CI unit job) | 8 pass | 8 | 2026-08-03 | 2026-08-03 | KEEP (off-path) | valid but protects non-F1 surface |
