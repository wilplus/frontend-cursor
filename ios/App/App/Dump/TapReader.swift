import CoreGraphics
import Foundation

/// Reads taps as the founder decided (backend N506 item 2): act at once, and
/// if a second tap follows within 0.3 s and 60 pt, undo the first and close.
/// No tap ever waits. The same rules as the web's readTap
/// (src/lib/willab/dumpScreen.ts). Plain values in, so it tests on its own.
final class TapReader {
    enum Action: Equatable { case start, stop, close(discardStart: Bool) }

    static let doubleWindow: TimeInterval = 0.30
    static let doubleDistance: CGFloat = 60
    static let openGuard: TimeInterval = 0.50
    static let palmRadius: CGFloat = 30
    static let moveLimit: CGFloat = 12

    private var openedAt = Date()
    private var last: (time: Date, point: CGPoint, didStart: Bool)?

    func screenAppeared(_ now: Date = Date()) { openedAt = now; last = nil }

    /// One finished touch. `listening`: the recorder's state before it.
    /// nil means ignored.
    func read(start: CGPoint, end: CGPoint, radius: CGFloat, fingers: Int,
              listening: Bool, now: Date = Date()) -> Action? {
        if now.timeIntervalSince(openedAt) < Self.openGuard { return nil }
        if fingers > 1 || radius > Self.palmRadius { return nil }
        if hypot(end.x - start.x, end.y - start.y) > Self.moveLimit { return nil }

        if let l = last, now.timeIntervalSince(l.time) < Self.doubleWindow,
           hypot(end.x - l.point.x, end.y - l.point.y) < Self.doubleDistance {
            last = nil
            return .close(discardStart: l.didStart)
        }
        last = (now, end, !listening)
        return listening ? .stop : .start
    }
}
