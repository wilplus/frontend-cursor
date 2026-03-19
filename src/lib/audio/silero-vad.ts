/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SILERO VAD — INTEGRATION SCAFFOLD + ML DEVELOPMENT ROADMAP
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * STATUS: Not yet wired in.
 * Currently the app uses EnergyVAD (vad.ts), which is rule-based.
 * Swap it out for SileroVAD below when you are ready for the ML-based step.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STEP 0 (current) — EnergyVAD (vad.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * Multi-feature rule-based VAD using adaptive noise floor, speech-band spectral
 * ratio, and zero-crossing rate.  Works with zero setup; no model files needed.
 * Handles background noise and tremor reasonably well.  Weakness: can be fooled
 * by sounds in the speech band (e.g. music, other voices, coughing).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STEP 1 — Silero VAD (this file)
 * ─────────────────────────────────────────────────────────────────────────────
 * Silero VAD is a ~2 MB ONNX model that runs in the browser via onnxruntime-web.
 * It was trained on thousands of hours of diverse speech + noise and generalises
 * much better than rule-based VAD, especially for:
 *   • Non-native speakers
 *   • Soft/whispered speech
 *   • Speakers with tremor (Parkinson's, Essential tremor)
 *   • Noisy environments (cafe, street, fan)
 *
 * HOW TO ENABLE
 * ──────────────
 * 1. Install the wrapper library:
 *      npm install @ricky0123/vad-web onnxruntime-web
 *
 * 2. Copy ONNX Runtime WASM files into /public/ort-wasm/:
 *      cp node_modules/onnxruntime-web/dist/*.wasm public/ort-wasm/
 *    Then set the WASM path in your app entry (e.g. layout.tsx or _app.tsx):
 *      import * as ort from "onnxruntime-web";
 *      ort.env.wasm.wasmPaths = "/ort-wasm/";
 *
 * 3. Copy the Silero VAD model:
 *      cp node_modules/@ricky0123/vad-web/dist/silero_vad.onnx public/models/
 *
 * 4. Replace `new EnergyVAD()` in useSniperMetrics.ts with `useSileroVAD(stream)`.
 *    See the adapter class below.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STEP 2 — Custom classifier (your own training data)
 * ─────────────────────────────────────────────────────────────────────────────
 * Once you have ~500–1 000 labelled recordings from your app users you can train
 * a lightweight anomaly detector on top of the Silero speech-probability signal.
 *
 * FEATURE EXTRACTION
 *   Per 2-second window, collect a feature vector:
 *     [sileroProb_mean, sileroProb_std, sileroProb_min, sileroProb_max,
 *      rms_db, spectral_centroid_hz, zcr_per_sec, pitch_hz_mean, pitch_hz_std]
 *   These 9 floats encode both "is speech?" and "what kind of speech?"
 *
 * LABELLING STRATEGY (using your app's recordings)
 *   a) Add a "Review" mode in the admin panel where you play back a recording
 *      and rate each 2-second segment: clean_speech / noisy / tremor / silence.
 *   b) The Supabase row for each recording already stores duration + transcript.
 *      Auto-label segments aligned to transcript word timestamps (Whisper gives
 *      word-level timestamps via the `timestamp_granularities=["word"]` param).
 *   c) For internet recordings: download speech corpora (LibriSpeech, VCTK,
 *      Common Voice) for clean speech + background noise (ESC-50, FreeSound)
 *      and mix them programmatically.
 *
 * MODEL TRAINING (TensorFlow.js, browser-compatible)
 *   import * as tf from "@tensorflow/tfjs";
 *   // 3-class classifier: [clean_speech, noisy_speech, non_speech]
 *   // Input: 9-feature vector per 2s window
 *   // Architecture: Dense(32, relu) → Dense(16, relu) → Dense(3, softmax)
 *   // Convert to TFJS format; load via tf.loadLayersModel("/models/vad_clf/model.json")
 *
 * INTEGRATION
 *   Run inference every 2 seconds.  The output probabilities replace (or blend
 *   with) the Silero speech probability to give a 3-way classification:
 *     clean_speech  → update all metrics normally
 *     noisy_speech  → update metrics with reduced weight / wider confidence interval
 *     non_speech    → freeze metrics (same behaviour as isSpeaking = false)
 *
 * DATA PIPELINE SUGGESTION
 *   Store raw feature vectors in a new Supabase table:
 *     recording_features(recording_id, segment_idx, features jsonb, label text)
 *   Export as CSV via Supabase Studio for offline training in Python/Colab.
 *   Re-import the trained ONNX model into /public/models/.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STEP 3 — Per-speaker adaptation
 * ─────────────────────────────────────────────────────────────────────────────
 * Once the classifier is in production, collect a baseline "calibration"
 * recording at the start of each session (10–15 seconds of read speech).
 * Store the feature vector mean/std for that speaker and normalise all
 * subsequent vectors relative to that baseline.  This dramatically improves
 * accuracy for speakers with atypical vocal characteristics (tremor, dysphonia).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Silero VAD adapter (Step 1 code — uncomment when ready) ─────────────────
//
// import { RealTimeVAD } from "@ricky0123/vad-web";
//
// /**
//  * Drop-in replacement for EnergyVAD.
//  * Call `start(stream)` once; read `isSpeaking` every tick.
//  */
// export class SileroVADAdapter {
//   private vad: Awaited<ReturnType<typeof RealTimeVAD.new>> | null = null;
//   isSpeaking = false;
//   speechProbability = 0;
//
//   async start(stream: MediaStream): Promise<void> {
//     this.vad = await RealTimeVAD.new({
//       stream,
//       modelURL: "/models/silero_vad.onnx",
//       onFrameProcessed: (probs) => {
//         this.speechProbability = probs.isSpeech;
//         this.isSpeaking = probs.isSpeech > 0.5;
//       },
//     });
//     this.vad.start();
//   }
//
//   stop(): void {
//     this.vad?.destroy();
//     this.vad = null;
//     this.isSpeaking = false;
//     this.speechProbability = 0;
//   }
//
//   /** To mirror the EnergyVAD.process() call site, just returns the cached value. */
//   process(): { isSpeaking: boolean; probability: number } {
//     return { isSpeaking: this.isSpeaking, probability: this.speechProbability };
//   }
// }

// This file intentionally exports nothing until Step 1 is activated.
export {};
