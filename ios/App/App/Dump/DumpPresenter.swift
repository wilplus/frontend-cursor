import UIKit

/// Puts the dump screen in its own window over the web view, so it can show
/// on launch before the website has loaded (backend N506 item 5). On close:
/// it slides down, the web view is underneath, and the web is told "kept".
enum DumpPresenter {
    private static var window: UIWindow?
    private static weak var screen: DumpViewController?
    /// Set when the plugin loads; it tells the web.
    static weak var plugin: DumpScreenPlugin?

    /// A link or a notification came in: not opened for a moment after, in
    /// case it came before the screen did.
    private static var holdUntil = Date.distantPast

    static var isShowing: Bool { window != nil }

    static func present(in scene: UIWindowScene) {
        guard window == nil, Date() >= holdUntil else { return }
        let model = DumpModel()
        let vc = DumpViewController(model: model)
        let w = UIWindow(windowScene: scene)
        w.windowLevel = UIWindow.Level(rawValue: UIWindow.Level.normal.rawValue + 1)
        w.rootViewController = vc
        model.onClose = { kept in dismiss(kept: kept) }
        w.makeKeyAndVisible()
        window = w
        screen = vc
    }

    /// A link or a notification arrived while it was open: close it (and
    /// keep anything being said).
    static func closeIfShowing() {
        holdUntil = Date().addingTimeInterval(2)
        screen?.model.close()
    }

    private static func dismiss(kept: Bool) {
        guard let w = window else { return }
        window = nil
        screen = nil
        let below = w.windowScene?.windows.first { $0 !== w && $0.windowLevel == .normal }
        UIView.animate(withDuration: 0.28, delay: 0, options: .curveEaseIn, animations: {
            w.transform = CGAffineTransform(translationX: 0, y: w.bounds.height)
        }, completion: { _ in
            w.isHidden = true
            below?.makeKey()
            if kept { plugin?.kept() }
        })
    }
}
