# WillpowerLab frontend

The Next.js frontend of WillpowerLab (willpowerlab.com, on Vercel). It talks to the backend,
[`wilplus/backend-cursor`](https://github.com/wilplus/backend-cursor) (Flask, Railway, Supabase), through
the BFF routes under `src/app/api/v2/*`.

## Start here

Every doc in both repos, with its label (In force, Reference, History or Archive), is listed in the
backend's master doc: **[`README.md` in `backend-cursor`](https://github.com/wilplus/backend-cursor/blob/main/README.md)** (backend N106).
The backend's `main` is the one source of truth (backend N95).

## This repo's own pages

**The rules (In force)**

- [`CLAUDE.md`](CLAUDE.md), and [`AGENTS.md`](AGENTS.md) for other coding agents
- [The Feedback walk and the chat](docs/flows/feedback-walk-and-chat.md)
- [The coach panel](docs/flows/coach-panel.md)
- [The Ideal Text page and its helper words](docs/flows/ideal-text.md)
- [The recording screens](docs/flows/recording-screens.md)
- [The consent screens and the Data & consent page](docs/flows/consent-screens.md)
- [The AI version of your voice in practice](docs/flows/ai-voice-practice.md)
- [The plan: from the first questions to the deadline](docs/flows/the-plan.md) · Founder-Approved: the Claude Code chat, 26 October 2026, "Okay", to the plan having its own flow page (backend N160)
- [The principles: the Sunday note and life goals](docs/flows/principles.md) · Founder-Approved: the Claude Code chat, 26 October 2026, "Own page, ring 6", to the principles having their own flow page (backend N182)
- [Customer requests: a client's customer asks, the answerer replies with a Take](docs/flows/customer-requests.md) · Founder-Approved: the Claude Code chat, 28 October 2026, "Approve as drafted", to the page (backend N229)

**How it works today (Reference)**

- [willab upload proxy (Cloudflare Worker)](cloudflare/upload-proxy/README.md)
- [WIL-74 principles (founder, 2026-10-20)](docs/PRINCIPLES-WIL-74.md)
- [Confidence recognizer — FE pointer](docs/SPEC-confidence-recognizer.md)
- [Life Panel FE — what shipped, what it assumes, what is still open](docs/life-panel-fe-status.md)
- [Life Panel — source artifacts still outside the repo](docs/life-panel-sources/README.md)
- [The Life Panel — implementation document](docs/life-panel-spec.md)

**Pointers to the backend's rules (In force)**

- [Locked screens](docs/LOCKS.md)
- [Willab canonical product contract](docs/CANONICAL_PRODUCT_CONTRACT.md)

**Kept as written (History and Archive), because the rules or the code still name them**

- [HANDOFF — frontend (willab), 2026-08-14](docs/HANDOFF.md)
- [The earlier, longer CLAUDE.md (2026-10-11)](docs/history/CLAUDE-2026-10-11.md)
- [Ideal-text flow — how the app talks to the user between takes](docs/ideal-text-flow-communication.md)
- [Designer brief — Wave 5 (October 2026)](docs/DESIGNER-BRIEF-wave5-2026-10.md)
- [SPEC — the in-thread top-up card (Lounge)](docs/SPEC-lounge-topup-card.md)
- [The two coach feedback lanes](docs/COACH-FEEDBACK-LANES.md)
- [Coach review flow — judgement first, one action per screen](docs/coach-review-flow/SPEC.md)

Each one's label is in the backend's master doc. The archived notes left `main` on 2026-10-21
(backend N107); every one is in git history, at
[the last commit that had them](https://github.com/wilplus/frontend-cursor/tree/501da43874460770310b24fafc664c4f5e606114/docs).

## Home docs for the code

Every part of the code has one home doc (backend N107 and N111). A session that changes code writes what
changed into the code's home doc, or into the pull request, never into a new file. "No page" means no doc
describes that part: the code and its comments do, and a rule about it goes into the backend's decisions log.
The files a flow page guards (`scripts/flow-pages.txt`) have that page as their home, whatever the table says.
The backend's table is in its [master doc](https://github.com/wilplus/backend-cursor/blob/main/README.md#6-home-docs-for-the-code).

- A pattern ending in `/` covers its whole folder; `*` stands for any part of one name; anything else is
  one file. When two rows match, the more exact pattern wins.
- Docs, tests and the repo's own settings files are not listed.
- New code in a folder or name group below is covered already. Anything else needs a row here, in the
  same pull request. `npm run check:docs` refuses code that no row covers, a pattern that matches nothing, and a home
  doc that is History or Archive.

<!-- code-homes:start -->
| Part of the code | Files | Home doc |
|---|---|---|
| The recording screens: setting up a Take, the slides, the mic and recording | `src/components/willab/Lab*`, `src/components/willab/lab*`, `src/components/willab/Recording*`, `src/components/willab/useRecording*`, `src/components/willab/Presentation*`, `src/components/willab/presentation*`, `src/components/willab/ContextDocumentInput.tsx`, `src/components/willab/SlideStage.tsx`, `src/components/willab/pdfSlides.tsx`, `src/components/willab/DiscardTakeDialog.tsx`, `src/components/willab/FeelingsCheckIn.tsx`, `src/components/willab/willabFeelings.ts`, `src/components/willab/restoredSetup.ts`, `src/components/willab/willabLastSetup.ts`, `src/components/willab/audioUploadValidation.ts`, `src/lib/willab/labEntryHandover.ts`, `src/components/willab/OneProjectQuestion.tsx`, `src/lib/willab/oneProject.ts`, `src/lib/willab/setupDraft.ts`, `src/lib/willab/defaultDeck.ts`, `src/lib/willab/exploreArc.ts`, `src/lib/willab/useNoPullToRefresh.ts`, `src/hooks/useDualCaptureMic.ts`, `src/services/api/arcSetup.ts`, `src/services/api/recordingConfig.ts`, `src/services/api/contextDocument.ts`, `src/services/api/presentationExtract.ts`, `src/app/api/v2/config/`, `src/app/api/v2/lab/presentation/`, `src/app/api/v2/explore/arc/[arcId]/setup/`, `src/app/api/v2/explore/arc/[arcId]/recording-roots/`, `src/app/api/v2/explore/arc/[arcId]/context-document/`, `src/app/dev/recording/`, `public/presentation/` | [`docs/flows/recording-screens.md`](docs/flows/recording-screens.md) |
| The wait while a Take is processed (voice mark, stage line, "Usually about a minute.") | `src/components/willab/Processing*`, `src/lib/willab/waitProgress.ts`, `src/app/dev/processing-wait/` | [`docs/flows/recording-screens.md`](docs/flows/recording-screens.md) |
| Sending a Take and following it through processing (upload, live status, retries) | `src/services/api/labRecording.ts`, `src/services/api/recordingProgress.ts`, `src/services/api/sessionReadout.ts`, `src/services/api/readouts.ts`, `src/components/willab/useLabReadoutLive.ts`, `src/components/willab/useFailedTakeRecheck.ts`, `src/components/willab/useStatusHydration.ts`, `src/components/willab/readout.ts`, `src/lib/willab/processingTake.ts`, `src/lib/sse.ts`, `src/app/api/v2/lab/recordings/`, `src/app/api/v2/user/readouts/`, `src/app/api/v2/user/sessions/` | [backend `docs/ASYNC-PIPELINE-QUEUE.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/ASYNC-PIPELINE-QUEUE.md) |
| The upload proxy that carries long recordings around Vercel | `cloudflare/upload-proxy/`, `src/lib/api/uploadProxy.ts` | [`cloudflare/upload-proxy/README.md`](cloudflare/upload-proxy/README.md) |
| The Ideal Text page: the text, its sheets, helper words, Presentation Mode and export | `src/components/willab/IdealText*`, `src/components/willab/idealText*`, `src/components/willab/Deck*`, `src/components/willab/Marked*`, `src/components/willab/Readout*`, `src/components/willab/useReadout*`, `src/components/willab/BlockVariant*`, `src/components/willab/blockVariant*`, `src/components/willab/AdditionsPanel.tsx`, `src/components/willab/AiGeneratedNote.tsx`, `src/components/willab/FeedbackFailedNotice.tsx`, `src/components/willab/LockPreviewText.tsx`, `src/components/willab/RichText.tsx`, `src/components/willab/PresentMode.tsx`, `src/components/willab/OpenChunkSheet.tsx`, `src/components/willab/paragraphSheetData.ts`, `src/components/willab/MomentPlayer.tsx`, `src/components/willab/CoachMessageSheet.tsx`, `src/components/willab/useCoachStep.ts`, `src/components/willab/feedbackPager.tsx`, `src/components/willab/useFeedbackFirst.ts`, `src/components/willab/usePractiseOffered.ts`, `src/components/willab/useReopenedJudgement.ts`, `src/components/willab/saveBehind.ts`, `src/components/willab/useArcDeckRef.ts`, `src/components/willab/useSaveIdealText.ts`, `src/components/willab/useSlideHeadlines.ts`, `src/components/willab/UpdateSlides.tsx`, `src/lib/willab/deck*`, `src/lib/willab/document*`, `src/lib/willab/helperWord*`, `src/lib/willab/ideal*`, `src/lib/willab/presentation*`, `src/lib/willab/tracked*`, `src/lib/willab/answeredBookmark.ts`, `src/lib/willab/bookmarkMotion.ts`, `src/lib/willab/changeJudgement.ts`, `src/lib/willab/chunkSteps.ts`, `src/lib/willab/emphasizeQuote.ts`, `src/lib/willab/markedEditorSerialize.ts`, `src/lib/willab/measureScreenFit.ts`, `src/lib/willab/paragraphOverlay.ts`, `src/lib/willab/phraseTokens.ts`, `src/lib/willab/pieceBadges.ts`, `src/lib/willab/readingBlocks.ts`, `src/lib/willab/richMarkers.ts`, `src/lib/willab/rootPhraseLayer.ts`, `src/lib/willab/aiGeneratedMark.ts`, `src/services/api/idealText.ts`, `src/services/api/saveIdealText.ts`, `src/services/api/projectDeck.ts`, `src/services/api/documentDecide.ts`, `src/services/api/blockVariants.ts`, `src/services/api/partLock.ts`, `src/services/api/bookmarkHistory.ts`, `src/services/api/suggestionFeedback.ts`, `src/services/api/confidentMomentBundles.ts`, `src/services/api/takeFeedback.ts`, `src/app/api/v2/explore/arc/[arcId]/ideal-text/`, `src/app/api/v2/explore/arc/[arcId]/parts/`, `src/app/api/v2/explore/arc/[arcId]/blocks/`, `src/app/api/v2/explore/arc/[arcId]/part-histories/`, `src/app/api/v2/explore/arc/[arcId]/prior-take/`, `src/app/api/v2/user/snippets/[snippetId]/suggestion-feedback/`, `src/app/dev/deck/`, `src/app/dev/marked-editor/` | [`docs/flows/ideal-text.md`](docs/flows/ideal-text.md) |
| Rooting-phrase qualification on a paragraph | `src/components/willab/RootingPhrase*`, `src/lib/willab/rootingPhrase*` | [backend `docs/ROOTING-PHRASE-QUALIFICATION-V1-IMPLEMENTATION.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/ROOTING-PHRASE-QUALIFICATION-V1-IMPLEMENTATION.md) |
| The chat with Will (the Lounge): its thread, bubbles, the Take's asks and the /chat screen | `src/components/willab/Lounge*`, `src/components/willab/lounge*`, `src/components/willab/useLoungeThread.ts`, `src/components/willab/Willab*`, `src/components/willab/useWillabFlow.ts`, `src/components/willab/willabHelpers.ts`, `src/components/willab/OfferBubble.tsx`, `src/components/willab/ReportCard.tsx`, `src/components/willab/IdealTextCard.tsx`, `src/components/willab/WillQuestion.tsx`, `src/components/willab/afterTake.ts`, `src/components/willab/feedbackCheck.ts`, `src/components/willab/flowCopy.ts`, `src/components/willab/unreadFeedback.ts`, `src/components/willab/useAdminAsk.ts`, `src/components/willab/usePinThreadBottom.ts`, `src/components/willab/useCoachBubbleFocus.ts`, `src/components/willab/SymmetricPair.tsx`, `src/components/willab/TypingDots.tsx`, `src/components/willab/Linkified.tsx`, `src/components/willab/OtherAccountLink.tsx`, `src/components/willab/topUpCardGate.ts`, `src/components/willab/FeedbackOverlay.tsx`, `src/components/willab/LibraryOverlay.tsx`, `src/components/willab/SnippetScreenShell.tsx`, `src/components/willab/useDocumentSettle.ts`, `src/lib/willab/newCoachFeedback.ts`, `src/lib/willab/openTrace.ts`, `src/lib/willab/installable.ts`, `src/lib/willab/linkify.ts`, `src/lib/willab/coachLink.ts`, `src/lib/willab/documentSettle.ts`, `src/lib/willab/enrichmentSettle.ts`, `src/lib/chatBoot.ts`, `src/lib/funnel/`, `src/lib/productDiscovery.ts`, `src/hooks/usePublishLiveSubscription.ts`, `src/hooks/publishLiveTransition.ts`, `src/services/api/afterTake.ts`, `src/services/api/chatQuery.ts`, `src/services/api/chatSessionState.ts`, `src/services/api/loungeMessages.ts`, `src/services/api/feedbackCheck.ts`, `src/services/api/willQuestion.ts`, `src/services/api/coachFeedbackSeen.ts`, `src/services/api/whatsapp.ts`, `src/services/api/arcFeedback.ts`, `src/services/api/strengths.ts`, `src/services/api/bootPrefetch.ts`, `src/services/api/productDiscoveries.ts`, `src/app/api/v2/chat/`, `src/app/api/v2/user/lounge/`, `src/app/api/v2/user/asks/`, `src/app/api/v2/user/whatsapp/`, `src/app/api/v2/user/coach-feedback/`, `src/app/api/v2/user/product-discoveries/`, `src/app/api/v2/user/presentations/`, `src/app/api/v2/user/takes/[takeSessionId]/feedback-response/`, `src/app/api/v2/user/takes/[takeSessionId]/feedback-responses/`, `src/app/api/v2/explore/arc/[arcId]/feedback/`, `src/app/api/v2/explore/arc/[arcId]/feedback-check/`, `src/app/api/v2/explore/arc/[arcId]/will-question/`, `src/app/api/v2/explore/arc/[arcId]/journey/`, `src/app/chat/` | [`docs/flows/feedback-walk-and-chat.md`](docs/flows/feedback-walk-and-chat.md) |
| The Feedback walk after a Take: praise, the Clearer version, practise, other speakers, the summary | `src/components/willab/useWalkJournalPost.ts`, `src/components/willab/ConfidencePracticeOverlay.tsx`, `src/lib/willab/clearerPieces.ts`, `src/lib/willab/praiseReason.ts`, `src/hooks/useExerciseRenderedAck.ts`, `src/services/api/lineBank.ts`, `src/services/api/praiseReasons.ts`, `src/services/api/reviewSummary*`, `src/services/api/walkPractise.ts`, `src/services/api/practiceCheck.ts`, `src/services/api/confidentVoicePractice.ts`, `src/services/api/otherSpeakers.ts`, `src/services/api/momentEvents.ts`, `src/services/api/exerciseRendered.ts`, `src/services/api/journalPost.ts`, `src/app/api/v2/user/line-bank/`, `src/app/api/v2/user/confidence-practice/`, `src/app/api/v2/user/snippets/`, `src/app/api/v2/explore/arc/[arcId]/praise-reasons/`, `src/app/api/v2/explore/arc/[arcId]/review/`, `src/app/dev/feedback-walk/` | [`docs/flows/feedback-walk-and-chat.md`](docs/flows/feedback-walk-and-chat.md) |
| The one player and the one set of judgement buttons, used across the app | `src/components/willab/SnippetWavePlayer.tsx`, `src/components/willab/NativeVideo.tsx`, `src/components/willab/ConfidenceLabelChips.tsx`, `src/components/results/`, `src/lib/media/` | [`docs/flows/feedback-walk-and-chat.md`](docs/flows/feedback-walk-and-chat.md) |
| Sharing the next Take and the speaker's communities | `src/components/willab/NextTakeShareScreen.tsx`, `src/lib/willab/nextTakeShare.ts`, `src/services/api/communities.ts`, `src/services/api/takeShares.ts`, `src/app/api/v2/user/communities/`, `src/app/api/v2/user/takes/[takeSessionId]/share/`, `src/app/api/v2/user/takes/shares/` | [`docs/flows/feedback-walk-and-chat.md`](docs/flows/feedback-walk-and-chat.md) |
| The coach panel: the queue, the blind Judge, the coach's words and video, the training corpus | `src/components/willab/Coach*`, `src/components/willab/coachChrome.tsx`, `src/components/willab/ConfidenceEvidenceReadout.tsx`, `src/components/willab/BlindExposureBoundary.tsx`, `src/components/willab/RaterLanguageGate.tsx`, `src/lib/willab/coach*`, `src/lib/willab/openSpeaker.ts`, `src/hooks/useCoach*`, `src/hooks/useCorpus*`, `src/services/api/coach*`, `src/services/api/machinePick.ts`, `src/services/api/speakingErrors.ts`, `src/services/api/trainingCorpus.ts`, `src/services/api/willBank.ts`, `src/app/api/v2/coach/`, `src/app/api/v2/admin/will-questions/`, `src/app/api/v2/admin/exercises/`, `src/app/coach/`, `src/app/admin/corpus/`, `src/app/dev/coach-panel/`, `src/app/dev/admin-library/`, `src/app/dev/corpus/` | [`docs/flows/coach-panel.md`](docs/flows/coach-panel.md) |
| Labels and learning: the one judging instrument, research, the golden set and the pace panel | `src/services/api/stateRatings.ts`, `src/services/api/learningExposures.ts`, `src/services/api/founderLearning.ts`, `src/hooks/useVisibleLearningExposure.ts`, `src/components/founder/`, `src/lib/founder/`, `src/app/api/v2/learning-exposures/`, `src/app/api/v2/research/`, `src/app/api/v2/admin/learning/`, `src/app/admin/research/`, `src/app/admin/pace/` | [backend `docs/LEARNING-AND-QUORUM.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/LEARNING-AND-QUORUM.md) |
| Will's private note about each speaker (the founder reads and corrects it) | `src/app/admin/users/[id]/SpeakerMemory.tsx`, `src/app/api/v2/admin/people/[id]/speaker-memory/` | [backend `docs/SPEAKER-MEMORY.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/SPEAKER-MEMORY.md) |
| The voice notebook in the chat | `src/components/willab/useVoiceNote*`, `src/services/api/voiceNotebook.ts`, `src/app/api/v2/notebook/`, `src/lib/willab/liveNoteWords.ts`, `src/lib/willab/voiceNoteOutbox.ts` | [backend `docs/WILL-LEARNING-PLAN.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/WILL-LEARNING-PLAN.md) |
| The plan: the questions, the plan card, the practice days and the deadline | `src/components/willab/plan/`, `src/lib/willab/planCopy.ts`, `src/services/api/plan.ts`, `src/services/api/planConsent.ts`, `src/app/api/v2/plan/` | [`docs/flows/the-plan.md`](docs/flows/the-plan.md) |
| The principles: the Sunday note, life goals, your why and strengths | `src/lib/willab/lifeGoals.ts`, `src/lib/willab/sundayNote.ts`, `src/components/willab/SundayLens.tsx`, `src/services/api/lifeGoals.ts`, `src/app/api/v2/life-goals/`, `src/app/panel/principles/`, `src/services/api/yourWhy.ts`, `src/services/api/lifeStrengths.ts`, `src/app/api/v2/your-why/`, `src/app/api/v2/strengths/`, `src/services/api/walkQuote.ts`, `src/app/api/v2/walk-quote/` | [`docs/flows/principles.md`](docs/flows/principles.md) |
| The Voice Album ("Practice yours", "Practice new") and what exercises do for one person | `src/app/voice-album/`, `src/components/willab/VoiceAlbum*`, `src/components/willab/PracticeNewQueue.tsx`, `src/services/api/voiceAlbum*`, `src/app/api/v2/voice-album/`, `src/app/admin/users/[id]/ExerciseEffects.tsx`, `src/app/api/v2/admin/people/[id]/practice-effects/` | [backend `docs/MLC3-EXERCISE-ADEQUACY-DESIGN.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/MLC3-EXERCISE-ADEQUACY-DESIGN.md) |
| Consent: the acceptance gate, consent asks in the chat, the policy documents and Data & consent | `src/components/willab/Phase1AcceptanceGate.tsx`, `src/components/willab/Mlc2FounderConsentGate.tsx`, `src/components/willab/ConsentAsk.tsx`, `src/components/willab/AccountEndedState.tsx`, `src/lib/legal/`, `src/components/legal/`, `src/app/account/`, `src/app/privacy/`, `src/app/terms/`, `src/hooks/useAppMenuData.ts`, `src/lib/willab/project*`, `src/services/api/consentChoices.ts`, `src/services/api/accountSignIn.ts`, `src/app/api/v2/account/`, `src/services/api/trainingConsent.ts`, `src/services/api/mlc2Consent.ts`, `src/services/api/publishedPolicy.ts`, `src/services/api/accountDeletion.ts`, `src/services/api/projectArchive.ts`, `src/services/api/projectDeletion.ts`, `src/app/api/v2/user/training-consent/`, `src/app/api/v2/training-consent/`, `src/app/api/v2/user/mlc2-consent/`, `src/app/api/v2/projects/[projectId]/archive/`, `src/app/api/v2/projects/[projectId]/deletion-request/` | [`docs/flows/consent-screens.md`](docs/flows/consent-screens.md) |
| Processing authorization: the check every recording and provider call passes | `src/services/api/processingAuthorization.ts`, `src/app/api/v2/processing-authorization/` | [backend `docs/PHASE1-PROCESSING-RUNBOOK.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/PHASE1-PROCESSING-RUNBOOK.md) |
| The Life Panel | `src/app/panel/`, `src/components/life/`, `src/lib/life/`, `src/services/api/life.ts`, `src/app/api/v2/life/`, `src/app/dev/life-bets/` | [`docs/life-panel-spec.md`](docs/life-panel-spec.md) |
| The Life Panel's day card (the morning plan and the evening summary) | `src/app/panel/today/` | [backend `docs/life-checkin-learning-contract.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/life-checkin-learning-contract.md) |
| The journal (blog) and its editor | `src/app/blog/`, `src/app/cms/`, `src/components/journal/`, `src/services/api/journal.ts`, `src/services/api/journalAdmin.ts`, `src/services/api/journalServer.ts`, `src/app/api/v2/journal/`, `src/app/api/v2/internal/journal/` | [backend `docs/JOURNAL-SETUP.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/JOURNAL-SETUP.md) |
| Guests: a Take before sign-up, and sending a Take to a coach | `src/components/willab/Guest*`, `src/components/willab/ReadySignUpScreen.tsx`, `src/components/willab/wallMoment.ts`, `src/components/willab/SendGate.tsx`, `src/components/willab/PendingCoachSend.tsx`, `src/components/willab/usePendingSendHold.ts`, `src/components/willab/sendStatus.ts`, `src/components/willab/willabParked.ts`, `src/services/api/sendTakeToCoach.ts`, `src/app/api/v2/projects/[projectId]/takes/`, `src/app/dev/ready-signup/` | No page |
| Projects: the project picker and the list of a speaker's trainings | `src/components/willab/Project*`, `src/services/api/projects.ts`, `src/services/api/trainings.ts`, `src/app/api/v2/projects/`, `src/app/api/v2/user/trainings/` | No page |
| The iPhone app: a Capacitor shell that opens willpowerlab.com (backend N267) | `capacitor.config.ts`, `capacitor/`, `ios/` | No page |
| Accounts and sign-in | `src/app/(auth)/`, `src/app/auth/`, `src/components/auth/`, `src/lib/auth/`, `src/app/api/auth/`, `src/app/api/v2/signup/`, `src/app/api/v2/first-visit/`, `src/lib/funnel/firstVisit.ts`, `src/components/phone/`, `src/lib/phone/`, `src/services/api/whatsappNumber.ts`, `src/app/(protected)/`, `src/lib/supabase/`, `src/middleware.ts`, `src/app/api/results/`, `src/components/willab/useSignedIn.ts`, `src/components/willab/useUserEmail.ts`, `src/components/willab/useUserId.ts`, `src/components/willab/useUserProfile.ts`, `src/services/api/userProfile.ts`, `src/app/api/v2/user/profile/` | No page |
| Tokens, prices and payments | `src/components/tokens/`, `src/hooks/useTokenWallet.ts`, `src/services/api/tokens.ts`, `src/services/api/subscribe.ts`, `src/app/api/v2/tokens/`, `src/app/api/v2/admin/tokens/`, `src/app/api/v2/user/offers/`, `src/app/(protected)/dashboard/pricing/` | No page |
| Booking a lesson | `src/app/book/`, `src/components/booking/`, `src/lib/booking/`, `src/app/api/v2/booking/`, `src/app/api/v2/admin/booking/`, `src/app/admin/booking/` | No page |
| Feature rings: who gets a feature, launches and kill switches | `src/components/rings/`, `src/hooks/useRingState.ts`, `src/services/api/rings.ts`, `src/services/api/adminRings.ts`, `src/app/api/v2/admin/rings/`, `src/app/api/v2/user/rings/`, `src/app/admin/rings/` | [backend `docs/OPS-FLAGS-AND-RELEASES.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/OPS-FLAGS-AND-RELEASES.md) |
| The CEO panel on dev.willpowerlab.com (bugs and tasks) and the founder's roadmap | `src/components/ceo/`, `src/lib/ceo/`, `src/app/admin/ceo/`, `src/app/api/v2/admin/ceo/`, `src/components/founder/RoadmapPanel.tsx`, `src/services/api/roadmap.ts`, `src/app/admin/roadmap/`, `src/app/api/v2/admin/roadmap/` | No page |
| The pace scale's bench and meter (the tempo step) | `src/app/admin/pace-circle/`, `src/lib/willab/pace/`, `src/components/willab/pace/`, `src/services/api/reviewTempo.ts` | [The Feedback walk and the chat, §2 Tempo](docs/flows/feedback-walk-and-chat.md) |
| The admin console: people, users, deletion requests | `src/app/admin/`, `src/components/admin/`, `src/app/api/v2/admin/`, `src/lib/founder.ts`, `src/components/founder/FounderFrame.tsx` | No page |
| Audits: the PDF reports a coach uploads for a speaker | `src/app/audits/`, `src/services/api/userAudits.ts`, `src/app/api/v2/user/audits/` | No page |
| The app's server routes: how they reach the backend | `src/app/api/_lib/`, `src/app/api/getAuth.ts`, `src/app/api/proxyResponse.ts`, `src/app/api/*.golden.json`, `src/lib/api/`, `src/services/api/glueContracts.golden.json`, `src/app/api/recordings/` | No page |
| The app shell: layout, header, error and loading screens, shared buttons and helpers | `src/app/layout.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/globals.css`, `src/app/icon.tsx`, `src/app/manifest.ts`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/fonts/`, `src/app/willab-logo/`, `src/app/game/`, `src/app/recordings/`, `src/components/Footer.tsx`, `src/components/Logo.tsx`, `src/components/SiteHeader.tsx`, `src/components/ui/`, `src/components/dashboard/`, `src/lib/utils.ts`, `src/lib/uuid.ts`, `src/lib/screenChrome.ts`, `src/lib/willabWindowEvents.ts`, `src/lib/lastCopy.ts`, `src/components/willab/ErrorState.tsx`, `src/components/willab/LoadingState.tsx`, `src/components/willab/OverlayCloseButton.tsx`, `src/components/willab/useBackDismiss.ts` | No page |
| Installing the app on a phone (home-screen app) | `src/components/pwa/`, `src/lib/pwa.ts`, `src/hooks/usePwaInstall.ts`, `public/sw.js`, `src/app/api/v2/user/home-screen/` | No page |
| The public pages: landing, about, unsubscribe, and the files in public/ | `src/app/page.tsx`, `src/app/page.client.tsx`, `src/app/about/`, `src/app/unsubscribe/`, `src/app/api/public/`, `public/` | No page |
| Build settings, packages and the repo's own check scripts | `package.json`, `package-lock.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `tsconfig.json`, `vercel.json`, `vitest.config.ts`, `scripts/` | No page |
<!-- code-homes:end -->

## Setup

- `npm install`
- Copy `.env.example` to `.env.local` and set Supabase + API URL.
- `npm run dev`

## Scripts

- `npm run dev`: start the dev server
- `npm run build` / `npm run start`: production
- `bash scripts/local_ci.sh`: the merge gate, run locally before pushing (Node 22)

## Older tooling

This repo once tracked tasks with [Task Master](https://docs.task-master.dev/) (`.taskmaster/`); its
files are archived (backend N106). Its commands still work: `npx task-master next`, `npx task-master list`.
