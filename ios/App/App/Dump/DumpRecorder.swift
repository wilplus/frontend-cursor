import AVFoundation
import Speech

/// The mic, straight to an m4a file on disk (AAC, 32 kbps, as the web
/// notebook records), with a level for the mark and live words made on the
/// phone only (backend N506 item 5): if on-device speech isn't there, no
/// words. The audio is never sent anywhere for them.
final class DumpRecorder {
    private let engine = AVAudioEngine()
    private let lock = NSLock()
    private var file: AVAudioFile?
    private var startedAt: Date?
    private(set) var url: URL?
    private var speech: SFSpeechAudioBufferRecognitionRequest?
    private var speechTask: SFSpeechRecognitionTask?
    private let recognizer = SFSpeechRecognizer()   // the phone's language

    /// Called on the audio thread; the screen hops to the main thread.
    var onLevel: ((Float) -> Void)?
    var onWords: ((String) -> Void)?
    var isListening: Bool { startedAt != nil }

    /// When the screen appears: makes the first tap start fast. The session
    /// is only made active on the first tap, so music isn't cut on opening.
    func prepare() {
        let bluetooth: AVAudioSession.CategoryOptions
        if #available(iOS 26.0, *) { bluetooth = .allowBluetoothHFP } else { bluetooth = .allowBluetooth }
        try? AVAudioSession.sharedInstance().setCategory(
            .playAndRecord, mode: .spokenAudio, options: [.defaultToSpeaker, bluetooth])
        // iOS mutes haptics while recording unless allowed: the tick that
        // says "listening" must be felt (backend N519).
        try? AVAudioSession.sharedInstance().setAllowHapticsAndSystemSoundsDuringRecording(true)
    }

    /// The mic permission, asked the first time only (the app already asks it
    /// for Takes, so usually it is there). Answers on the main thread.
    static func withMic(_ go: @escaping (Bool) -> Void) {
        let s = AVAudioSession.sharedInstance()
        switch s.recordPermission {
        case .granted: go(true)
        case .denied: go(false)
        default: s.requestRecordPermission { ok in DispatchQueue.main.async { go(ok) } }
        }
    }

    func start(into url: URL) throws {
        try AVAudioSession.sharedInstance().setActive(true)
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: format.sampleRate,
            AVNumberOfChannelsKey: format.channelCount,
            AVEncoderBitRateKey: 32_000,
        ]
        let out = try AVAudioFile(forWriting: url, settings: settings,
                                  commonFormat: format.commonFormat, interleaved: format.isInterleaved)
        lock.lock(); file = out; lock.unlock()
        self.url = url
        startLiveWords()
        input.installTap(onBus: 0, bufferSize: 2048, format: format) { [weak self] buffer, _ in
            guard let self else { return }
            self.lock.lock()
            try? self.file?.write(from: buffer)
            self.speech?.append(buffer)
            self.lock.unlock()
            self.onLevel?(Self.level(buffer))
        }
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            lock.lock(); file = nil; lock.unlock()
            stopLiveWords()
            throw error
        }
        startedAt = Date()
    }

    /// How long it ran, in ms. The file is complete once this returns.
    @discardableResult
    func stop() -> Int {
        guard let began = startedAt else { return 0 }
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        lock.lock(); file = nil; lock.unlock()   // closes the file
        stopLiveWords()
        startedAt = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        return Int(Date().timeIntervalSince(began) * 1000)
    }

    /// A start that lasted under 0.3 s (the first half of a double tap).
    func discard() {
        stop()
        if let url { try? FileManager.default.removeItem(at: url) }
        url = nil
    }

    /// The on-device speech permission, asked after the first kept dump,
    /// never on opening; recording works without it.
    static func askForWordsOnce() {
        guard SFSpeechRecognizer.authorizationStatus() == .notDetermined else { return }
        SFSpeechRecognizer.requestAuthorization { _ in }
    }

    private func startLiveWords() {
        guard let recognizer, recognizer.supportsOnDeviceRecognition, recognizer.isAvailable,
              SFSpeechRecognizer.authorizationStatus() == .authorized else { return }
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = true
        lock.lock(); speech = request; lock.unlock()
        speechTask = recognizer.recognitionTask(with: request) { [weak self] result, _ in
            if let text = result?.bestTranscription.formattedString { self?.onWords?(text) }
        }
    }

    private func stopLiveWords() {
        lock.lock(); speech?.endAudio(); speech = nil; lock.unlock()
        speechTask?.cancel(); speechTask = nil
    }

    private static func level(_ b: AVAudioPCMBuffer) -> Float {
        guard let ch = b.floatChannelData?[0], b.frameLength > 0 else { return 0 }
        var sum: Float = 0
        for i in 0..<Int(b.frameLength) { sum += ch[i] * ch[i] }
        return sqrt(sum / Float(b.frameLength))
    }
}
