import XCTest
@testable import App

/// The taps as the founder decided them (backend N506 item 2).
final class TapReaderTests: XCTestCase {
    private let t0 = Date(timeIntervalSince1970: 1_000)
    private let here = CGPoint(x: 100, y: 300)

    private func reader() -> TapReader {
        let r = TapReader()
        r.screenAppeared(t0)
        return r
    }

    private func tap(_ r: TapReader, at s: TimeInterval, listening: Bool,
                     point: CGPoint? = nil, radius: CGFloat = 10, fingers: Int = 1) -> TapReader.Action? {
        let p = point ?? here
        return r.read(start: p, end: p, radius: radius, fingers: fingers,
                      listening: listening, now: t0.addingTimeInterval(s))
    }

    func testOneTapStartsAndTheNextStops() {
        let r = reader()
        XCTAssertEqual(tap(r, at: 1, listening: false), .start)
        XCTAssertEqual(tap(r, at: 5, listening: true), .stop)
    }

    func testDoubleTapOnIdleThrowsTheStartAwayAndCloses() {
        let r = reader()
        XCTAssertEqual(tap(r, at: 1, listening: false), .start)
        XCTAssertEqual(tap(r, at: 1.2, listening: true), .close(discardStart: true))
    }

    func testDoubleTapWhileListeningStopsKeepsAndCloses() {
        let r = reader()
        XCTAssertEqual(tap(r, at: 5, listening: true), .stop)
        XCTAssertEqual(tap(r, at: 5.2, listening: false), .close(discardStart: false))
    }

    func testTapsFarApartAreTwoTaps() {
        let r = reader()
        XCTAssertEqual(tap(r, at: 1, listening: false), .start)
        XCTAssertEqual(tap(r, at: 1.2, listening: true, point: CGPoint(x: 300, y: 300)), .stop)
    }

    func testTheFirstHalfSecondIsIgnored() {
        XCTAssertNil(tap(reader(), at: 0.4, listening: false))
    }

    func testAPalmTwoFingersAndASwipeAreIgnored() {
        let r = reader()
        XCTAssertNil(tap(r, at: 1, listening: false, radius: 40))
        XCTAssertNil(tap(r, at: 2, listening: false, fingers: 2))
        XCTAssertNil(r.read(start: here, end: CGPoint(x: 100, y: 320), radius: 10, fingers: 1,
                            listening: false, now: t0.addingTimeInterval(3)))
    }
}
