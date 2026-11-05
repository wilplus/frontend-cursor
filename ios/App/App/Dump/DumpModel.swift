import AVFoundation
import Combine
import UIKit

/// The dump screen's state (backend N506, N507): idle, listening, kept. One
/// tap starts, one tap stops and keeps, a double tap undoes the first tap and
/// closes. Leaving the app, a call, or five minutes stops and keeps. Used on
/// the main thread only.
final class DumpModel: ObservableObject {
    enum Phase { case idle, listening, kept }
    /// The web notebook's limit; the backend refuses a longer note.
    static let maxSeconds = 300

    @Published private(set) var phase: Phase = .idle
    @Published private(set) var words = ""
    @Published private(set) var level: Float = 0
    @Published private(set) var seconds = 0
    let showHint = DumpGate.showHint
    let reader = TapReader()
    var onClose: ((_ keptSomething: Bool) -> Void)?

    private let recorder = DumpRecorder()
    private var current: (url: URL, key: String)?
    private var phaseBeforeStart: Phase = .idle
    private var timer: Timer?
    private var keptSomething = false
    private var closed = false
    private var observers: [NSObjectProtocol] = []

    var listening: Bool { phase == .listening }

    func appeared() {
        reader.screenAppeared()
        recorder.prepare()
        recorder.onLevel = { [weak self] l in DispatchQueue.main.async { self?.level = l } }
        recorder.onWords = { [weak self] w in DispatchQueue.main.async { self?.words = w } }
        let nc = NotificationCenter.default
        let leave: (Notification) -> Void = { [weak self] _ in self?.keepInBackground() }
        observers = [
            nc.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main, using: leave),
            nc.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main, using: leave),
        ]
    }

    func handle(_ action: TapReader.Action) {
        switch action {
        case .start: start()
        case .stop: keep(); tick()
        case .close(let discardStart):
            if discardStart { discard() }
            close()
        }
    }

    /// VoiceOver's one action: start or stop.
    func toggle() { if listening { keep(); tick() } else { start() } }

    func close() {
        guard !closed else { return }
        closed = true
        if listening { keep() }
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        tick()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.09) { Self.haptic() }
        onClose?(keptSomething)
    }

    private func start() {
        phaseBeforeStart = phase
        DumpRecorder.withMic { [weak self] ok in
            guard let self, ok, !self.closed, !self.listening else { return }
            let f = DumpOutbox.shared.newFile()
            do { try self.recorder.start(into: f.url) } catch { return }
            self.current = f
            self.words = ""
            self.seconds = 0
            self.phase = .listening
            self.startClock()
            self.tick()
        }
    }

    private func keep() {
        guard recorder.isListening, let c = current else { return }
        timer?.invalidate()
        let ms = recorder.stop()
        DumpOutbox.shared.keep(key: c.key, durationMs: ms)
        DumpGate.countKept()
        if !keptSomething { DumpRecorder.askForWordsOnce() }
        keptSomething = true
        current = nil
        level = 0
        phase = .kept
    }

    /// The first half of a double tap: nothing is kept.
    private func discard() {
        guard recorder.isListening else { return }
        timer?.invalidate()
        recorder.discard()
        current = nil
        level = 0
        words = ""
        phase = phaseBeforeStart
    }

    private func keepInBackground() {
        guard listening else { return }
        // A moment of background time to close the file and write its note.
        let task = BackgroundTask()
        keep()
        task.end()
    }

    private func startClock() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.seconds += 1
            if self.seconds >= Self.maxSeconds { self.keep() }
        }
    }

    private func tick() { Self.haptic() }
    private static func haptic() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
}

/// A short background task that ends itself if iOS runs out of time.
private final class BackgroundTask {
    private var id = UIBackgroundTaskIdentifier.invalid

    init() {
        id = UIApplication.shared.beginBackgroundTask { [weak self] in self?.end() }
    }

    func end() {
        guard id != .invalid else { return }
        UIApplication.shared.endBackgroundTask(id)
        id = .invalid
    }
}
