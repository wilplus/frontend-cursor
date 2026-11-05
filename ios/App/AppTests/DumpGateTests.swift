import XCTest
@testable import App

/// When the dump screen opens first (backend N506 item 4, N520): every open,
/// never from a link or a notification, never when the web says it is off.
final class DumpGateTests: XCTestCase {
    override func setUp() {
        let suite = "DumpGateTests"
        UserDefaults().removePersistentDomain(forName: suite)
        DumpGate.store = UserDefaults(suiteName: suite)!
    }

    func testOpensOnEveryOpen() {
        DumpGate.configure(enabled: true, openFirst: true)
        XCTAssertTrue(DumpGate.shouldOpenFirst(launchedByLinkOrNotification: false))
        XCTAssertTrue(DumpGate.shouldOpenFirst(launchedByLinkOrNotification: false))
    }

    func testNeverFromALinkOrANotification() {
        DumpGate.configure(enabled: true, openFirst: true)
        XCTAssertFalse(DumpGate.shouldOpenFirst(launchedByLinkOrNotification: true))
    }

    func testNeverWhenTheWebSaysOff() {
        DumpGate.configure(enabled: false, openFirst: true)
        XCTAssertFalse(DumpGate.shouldOpenFirst(launchedByLinkOrNotification: false))
        DumpGate.configure(enabled: true, openFirst: false)
        XCTAssertFalse(DumpGate.shouldOpenFirst(launchedByLinkOrNotification: false))
    }
}
