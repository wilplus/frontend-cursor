import Foundation

/// When the dump screen opens first (backend N506 item 4, N507 item 2).
/// The web owns the switch: it calls DumpScreenPlugin.configure once it has
/// read the ring row, the notebook's Yes and the person's choice. The app
/// keeps the answer so a cold launch can decide before the web view loads.
enum DumpGate {
    /// A var so the tests can use their own suite.
    static var store = UserDefaults.standard
    static let every: TimeInterval = 3600
    static let hintDumps = 3

    private static let kEnabled = "dump.enabled"      // ring row on + notebook's Yes
    private static let kOpenFirst = "dump.openFirst"  // the person's choice
    private static let kLastShown = "dump.lastShown"
    private static let kKeptCount = "dump.keptCount"

    static func configure(enabled: Bool, openFirst: Bool) {
        store.set(enabled, forKey: kEnabled)
        store.set(openFirst, forKey: kOpenFirst)
    }

    static var enabled: Bool { store.bool(forKey: kEnabled) }

    /// On cold launch and on return to the front. Never when a link or a
    /// notification opened the app; at most once an hour.
    static func shouldOpenFirst(launchedByLinkOrNotification: Bool, now: Date = Date()) -> Bool {
        guard enabled, store.bool(forKey: kOpenFirst), !launchedByLinkOrNotification else { return false }
        let last = store.object(forKey: kLastShown) as? Date ?? .distantPast
        return now.timeIntervalSince(last) >= every
    }

    static func markShown(_ now: Date = Date()) { store.set(now, forKey: kLastShown) }

    /// "Double tap to close" for the first three kept dumps only.
    static var showHint: Bool { store.integer(forKey: kKeptCount) < hintDumps }
    static func countKept() { store.set(store.integer(forKey: kKeptCount) + 1, forKey: kKeptCount) }
}
