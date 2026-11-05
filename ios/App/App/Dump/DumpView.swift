import SwiftUI

/// What the dump screen draws, as the web's DumpScreen does: the mic-ready
/// mark (three dots in a soft ring), the title and hint, the live words, and
/// the grey clock bar with the red dot. Drawing only: the touches are the
/// controller's (DumpScreen.swift).
struct DumpView: View {
    @ObservedObject var model: DumpModel

    var body: some View {
        ZStack(alignment: .bottom) {
            DumpColor.background.ignoresSafeArea()
            VStack(spacing: 18) {
                DumpMark(phase: model.phase, level: model.level)
                Text(title)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(model.phase == .kept ? DumpColor.affirm : DumpColor.text)
                Text(hint)
                    .font(.system(size: 14))
                    .foregroundColor(DumpColor.muted)
                    .padding(.top, -10)
            }
            .padding(.horizontal, 28)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.bottom, 90)
            VStack(spacing: 10) {
                if !model.words.isEmpty {
                    Text(Self.lastWords(model.words))
                        .font(.system(size: 15))
                        .foregroundColor(DumpColor.text.opacity(0.8))
                        .lineLimit(4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 22)
                }
                DumpClockBar(listening: model.listening, seconds: model.seconds,
                             note: model.showHint && !model.listening ? DumpStrings.doubleTapToClose : "")
                    .padding(.horizontal, 14)
                    .padding(.bottom, 22)
            }
        }
    }

    /// The newest words, up to about four lines: older ones go off the top,
    /// as in the prototype.
    static func lastWords(_ words: String, keep: Int = 170) -> String {
        guard words.count > keep else { return words }
        let tail = words.suffix(keep)
        guard let space = tail.firstIndex(of: " ") else { return String(tail) }
        return "…" + tail[space...]
    }

    private var title: String {
        switch model.phase {
        case .idle: return DumpStrings.idlePrompt
        case .listening: return DumpStrings.listening
        case .kept: return DumpStrings.kept + "."
        }
    }

    private var hint: String {
        switch model.phase {
        case .idle: return DumpStrings.idleHint
        case .listening: return DumpStrings.tapToStop
        case .kept: return DumpStrings.tapToSayMore
        }
    }
}

/// The web's colours (src/app/globals.css, light; the app is light only).
enum DumpColor {
    static let background = Color.white
    static let text = Color(red: 0.07, green: 0.07, blue: 0.07)          // --foreground
    static let muted = Color(red: 0.45, green: 0.45, blue: 0.45)         // --muted-foreground
    static let bar = Color(red: 0.96, green: 0.96, blue: 0.96)           // --muted
    static let primary = Color(red: 1.0, green: 0.42, blue: 0.04)        // --primary
    static let affirm = Color(red: 0.18, green: 0.50, blue: 0.35)        // --affirm
    static let record = Color(red: 0xE0 / 255, green: 0x45 / 255, blue: 0x3A / 255)
}

/// Three dots in a 108 pt ring; while it listens they breathe as the web's
/// voice-dot does (1.2 s, 150 ms apart), a little more when the voice is louder.
struct DumpMark: View {
    var phase: DumpModel.Phase
    var level: Float

    var body: some View {
        ZStack {
            Circle().strokeBorder(ring, lineWidth: 1.5).frame(width: 108, height: 108)
            if phase == .listening {
                TimelineView(.animation) { context in
                    dots(at: context.date.timeIntervalSinceReferenceDate)
                }
            } else {
                dots(at: nil)
            }
        }
    }

    private func dots(at t: TimeInterval?) -> some View {
        let lift = CGFloat(min(level * 6, 0.4))
        return HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(DumpColor.text.opacity(0.8))
                    .frame(width: i == 1 ? 8.7 : 6, height: i == 1 ? 8.7 : 6)
                    .scaleEffect(x: 1, y: t.map { Self.breath($0 - Double(i) * 0.15) + lift } ?? 1)
            }
        }
    }

    /// 1 → 0.6 → 1 every 1.2 s.
    private static func breath(_ t: TimeInterval) -> CGFloat {
        CGFloat(0.8 + 0.2 * cos(2 * Double.pi * t / 1.2))
    }

    private var ring: Color {
        switch phase {
        case .listening: return DumpColor.record.opacity(0.45)
        case .kept: return DumpColor.affirm.opacity(0.4)
        case .idle: return DumpColor.primary.opacity(0.25)
        }
    }
}

/// The locked recording screen's grey bar: the red dot, the clock, the hint.
struct DumpClockBar: View {
    var listening: Bool
    var seconds: Int
    var note: String

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(DumpColor.record.opacity(listening ? 1 : 0.4))
                .frame(width: 10, height: 10)
            Text("\(seconds / 60):" + String(format: "%02d", seconds % 60))
                .font(.system(size: 16, weight: .semibold, design: .monospaced))
                .foregroundColor(DumpColor.text)
            if !note.isEmpty {
                Text(note).font(.system(size: 12.5)).foregroundColor(DumpColor.muted).lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .frame(height: 50)
        .background(RoundedRectangle(cornerRadius: 16).fill(DumpColor.bar))
    }
}
