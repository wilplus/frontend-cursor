import AVFoundation
import Capacitor
import UIKit

// MARK: - One owner of the audio session (backend N661)

/// The only place in the app that changes `AVAudioSession` for a recording.
/// A native recorder (the Take's here, the dump screen's in #1251) claims the
/// microphone, and gives it back when it ends: only one records at a time, so
/// the two can never fight over the microphone. The category the web view had
/// before is put back afterwards, so the walk's audio plays after a Take.
final class AudioSessionOwner {
    static let shared = AudioSessionOwner()

    enum Holder { case take, dump }
    enum ClaimError: Error { case busy }

    private let lock = NSLock()
    private var holder: Holder?
    private var saved: (AVAudioSession.Category, AVAudioSession.Mode, AVAudioSession.CategoryOptions)?

    /// A Take is recording (the dump screen must not open over it).
    var isTakeRecording: Bool {
        lock.lock(); defer { lock.unlock() }
        return holder == .take
    }

    func claim(_ who: Holder, mode: AVAudioSession.Mode, options: AVAudioSession.CategoryOptions) throws {
        lock.lock(); defer { lock.unlock() }
        if let current = holder, current != who { throw ClaimError.busy }
        let session = AVAudioSession.sharedInstance()
        if holder == nil { saved = (session.category, session.mode, session.categoryOptions) }
        try session.setCategory(.record, mode: mode, options: options)
        try? session.setPreferredSampleRate(48_000)
        try session.setActive(true)
        holder = who
    }

    func release(_ who: Holder) {
        lock.lock(); defer { lock.unlock() }
        guard holder == who else { return }
        holder = nil
        let session = AVAudioSession.sharedInstance()
        try? session.setActive(false, options: .notifyOthersOnDeactivation)
        if let before = saved {
            try? session.setCategory(before.0, mode: before.1, options: before.2)
        }
        saved = nil
    }
}

// MARK: - The Take's recorder (backend N655, N662)

/// In the iPhone app the phone records the Take itself: an m4a, AAC, mono,
/// 48 kHz, at the bitrate the web asks (64 kbps, N662 item 2), with the
/// phone-call processing off (`.measurement` mode: no gain riding the voice,
/// no noise suppression, no echo cancelling), from whichever microphone the
/// phone picks (N662 item 3; Bluetooth allowed, as today). A call or another
/// app's audio pauses it and it resumes after (N437 item 2). The screen stays
/// on while it records (N116).
///
/// Only the capture is native. The web code (`src/hooks/useNativeTakeMic.ts`)
/// keeps the screens, the slides and their times, the clock, the upload and
/// the device copy; it reads the finished file with `read` and lets it go
/// with `release`.
@objc(TakeRecorderPlugin)
public class TakeRecorderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TakeRecorderPlugin"
    public let jsName = "TakeRecorder"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "release", returnType: CAPPluginReturnPromise),
    ]

    private let queue = DispatchQueue(label: "com.willpowerlab.take-recorder")
    private var recorder: AVAudioRecorder?
    private var fileURL: URL?
    /// Paused by iOS (a call, another app's audio), waiting to resume.
    private var interrupted = false
    private var observers: [NSObjectProtocol] = []

    private static var folder: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("Takes", isDirectory: true)
    }

    public override func load() {
        // A Take the web never collected (the app was closed between Finish
        // and the read) is let go after a day: the web's own copy is the one
        // that waits for the server (N556).
        queue.async { Self.sweep(olderThan: 24 * 60 * 60) }
    }

    // MARK: start

    @objc func start(_ call: CAPPluginCall) {
        let bitrate = call.getInt("bitrate") ?? 64_000
        let sampleRate = call.getDouble("sampleRate") ?? 48_000
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            guard granted else {
                call.reject("Microphone permission denied.", "DENIED")
                return
            }
            self.queue.async { self.begin(call, bitrate: bitrate, sampleRate: sampleRate) }
        }
    }

    private func begin(_ call: CAPPluginCall, bitrate: Int, sampleRate: Double) {
        if recorder != nil { discardCurrent() }
        do {
            try AudioSessionOwner.shared.claim(.take, mode: .measurement, options: [.allowBluetooth])
        } catch AudioSessionOwner.ClaimError.busy {
            call.reject("Another recording holds the microphone.", "BUSY")
            return
        } catch {
            call.reject("Couldn't access the microphone.", "FAILED")
            return
        }
        do {
            try FileManager.default.createDirectory(at: Self.folder, withIntermediateDirectories: true)
            let url = Self.folder.appendingPathComponent("take-\(UUID().uuidString).m4a")
            let settings: [String: Any] = [
                AVFormatIDKey: kAudioFormatMPEG4AAC,
                AVSampleRateKey: sampleRate,
                AVNumberOfChannelsKey: 1,
                AVEncoderBitRateKey: bitrate,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
            ]
            let rec = try AVAudioRecorder(url: url, settings: settings)
            guard rec.prepareToRecord(), rec.record() else {
                throw NSError(domain: "TakeRecorder", code: 1)
            }
            recorder = rec
            fileURL = url
            interrupted = false
            observe()
            DispatchQueue.main.async { UIApplication.shared.isIdleTimerDisabled = true }
            call.resolve([
                "sinceFirstSampleMs": Int(rec.currentTime * 1000),
                "micKind": Self.micKind(),
            ])
        } catch {
            discardCurrent()
            call.reject("Couldn't access the microphone.", "FAILED")
        }
    }

    // MARK: stop / cancel

    @objc func stop(_ call: CAPPluginCall) {
        queue.async {
            guard let rec = self.recorder, let url = self.fileURL else {
                call.reject("Not recording.", "FAILED")
                return
            }
            // Recorded time, paused time left out; read before stop() resets it.
            let durationMs = Int(rec.currentTime * 1000)
            rec.stop()
            self.finishSession()
            self.recorder = nil
            self.fileURL = nil
            let attributes = try? FileManager.default.attributesOfItem(atPath: url.path)
            let bytes = (attributes?[.size] as? NSNumber)?.intValue ?? 0
            call.resolve([
                "path": url.path,
                "durationMs": durationMs,
                "bytes": bytes,
                "mimeType": "audio/mp4",
            ])
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        queue.async {
            self.discardCurrent()
            call.resolve()
        }
    }

    private func discardCurrent() {
        recorder?.stop()
        recorder?.deleteRecording()
        recorder = nil
        if let url = fileURL { try? FileManager.default.removeItem(at: url) }
        fileURL = nil
        finishSession()
    }

    private func finishSession() {
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        observers = []
        interrupted = false
        AudioSessionOwner.shared.release(.take)
        DispatchQueue.main.async { UIApplication.shared.isIdleTimerDisabled = false }
    }

    // MARK: read / release (only files in the Takes folder)

    @objc func read(_ call: CAPPluginCall) {
        guard let url = Self.ownFile(call.getString("path")) else {
            call.reject("No such recording.", "FAILED")
            return
        }
        let offset = UInt64(max(0, call.getInt("offset") ?? 0))
        let length = max(0, call.getInt("length") ?? 0)
        queue.async {
            do {
                let handle = try FileHandle(forReadingFrom: url)
                defer { try? handle.close() }
                try handle.seek(toOffset: offset)
                let data = handle.readData(ofLength: length)
                call.resolve(["data": data.base64EncodedString()])
            } catch {
                call.reject("Couldn't read the recording.", "FAILED")
            }
        }
    }

    @objc func release(_ call: CAPPluginCall) {
        if let url = Self.ownFile(call.getString("path")) {
            try? FileManager.default.removeItem(at: url)
        }
        call.resolve()
    }

    private static func ownFile(_ path: String?) -> URL? {
        guard let path else { return nil }
        let url = URL(fileURLWithPath: path).standardizedFileURL
        guard url.deletingLastPathComponent().path == folder.standardizedFileURL.path else { return nil }
        return url
    }

    private static func sweep(olderThan seconds: TimeInterval) {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.contentModificationDateKey]) else { return }
        let cutoff = Date().addingTimeInterval(-seconds)
        for file in files {
            let date = (try? file.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
            if let date, date < cutoff { try? fm.removeItem(at: file) }
        }
    }

    // MARK: a call, another app's audio (N437 item 2)

    private func observe() {
        let center = NotificationCenter.default
        observers = [
            center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: nil) { [weak self] note in
                self?.queue.async { self?.interruption(note) }
            },
            // Back in the app after an interruption iOS never ended: try again.
            center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: nil) { [weak self] _ in
                self?.queue.async { self?.resumeIfInterrupted() }
            },
        ]
    }

    private func interruption(_ note: Notification) {
        guard recorder != nil,
              let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        switch type {
        case .began:
            guard !interrupted else { return }
            interrupted = true
            recorder?.pause()
            notifyListeners("paused", data: [:])
        case .ended:
            resumeIfInterrupted()
        @unknown default:
            break
        }
    }

    /// Carries on into the same file. If the microphone does not come back,
    /// the Take stays paused and Finish still hands over what was said.
    private func resumeIfInterrupted() {
        guard interrupted, let rec = recorder else { return }
        do {
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            return
        }
        if rec.record() {
            interrupted = false
            notifyListeners("resumed", data: [:])
        }
    }

    // MARK: the kind of microphone, never its name (N662 item 3)

    private static func micKind() -> String {
        guard let port = AVAudioSession.sharedInstance().currentRoute.inputs.first?.portType else { return "other" }
        switch port {
        case .builtInMic: return "builtIn"
        case .bluetoothHFP, .bluetoothLE, .bluetoothA2DP: return "bluetooth"
        case .headsetMic, .usbAudio, .lineIn: return "wired"
        default: return "other"
        }
    }
}
