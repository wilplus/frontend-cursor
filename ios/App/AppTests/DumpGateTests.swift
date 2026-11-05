import XCTest
@testable import App

/// When the dump screen opens first (backend N506 item 4, N507 item 2).
final class DumpGateTests: XCTestCase {
    override func setUp() {
        let suite = "DumpGateTests"
        UserDefaults().removePersistentDomain(forName: suite)
        DumpGate.store = UserDefaults(suiteName: suite)!
    }

    func testOpensAtMostOnceAnHour() {
        DumpGate.configure(enabled: true, openFirst: true)
        let now = Date()
        XCTAssertTrue(DumpGate.shouldOpenFirst(launchedByLinkOrNotification: false, offline: false, now: now))
        DumpGate.markShown(now)
        XCTAssertFalse(DumpGate.shouldOpenFirst(launchedByLinkOrNotification: false, offline: false, now: now.addingTimeInterval(3599)))
        XCTAssertTrue(DumpGate.shouldOpenFirst(launchedByLinkOrNotification: false, offline: false, now: now.addingTimeInterval(3600)))
    }

    func testOfflineOpensEveryTime() {
        DumpGate.configure(enabled: true, openFirst: true)
        let now = Date()
        DumpGate.markShown(now)
        XCTAssertTrue(DumpGate.shouldOpenFirst(launchedByLinkOrNotification: false, offline: true, now: now.addingTimeInterval(60)))
        XCTAssertFalse(DumpGate.shouldOpenFirst(launchedByLinkOrNotification: true, offline: true, now: now))
    }

    func testNeverFromALinkOrANotification() {
        DumpGate.configure(enabled: true, openFirst: true)
        XCTAssertFalse(DumpGate.shouldOpenFirst(launchedByLinkOrNotification: true, offline: false))
    }

    func testNeverWhenTheWebSaysOff() {
        DumpGate.configure(enabled: false, openFirst: true)
        XCTAssertFalse(DumpGate.shouldOpenFirst(launchedByLinkOrNotification: false, offline: false))
        DumpGate.configure(enabled: true, openFirst: false)
        XCTAssertFalse(DumpGate.shouldOpenFirst(launchedByLinkOrNotification: false, offline: false))
    }
}
