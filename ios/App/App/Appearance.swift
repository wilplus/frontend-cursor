import Capacitor
import UIKit

/// Dark mode in the app (backend N678 item 2, N679). The app is light unless
/// the page asks for dark: the window is held light from launch
/// (SceneDelegate), and the page decides, from the iPhone's own setting and
/// the ring row `dark_mode`, then calls `use`. `system` answers what the
/// iPhone itself is set to, which the held-light window no longer shows, and
/// `systemChange` fires when the person switches it (Control Center, Settings,
/// or the automatic sunset change) and comes back to the app.
@objc(AppearancePlugin)
public class AppearancePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppearancePlugin"
    public let jsName = "Appearance"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "system", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "use", returnType: CAPPluginReturnPromise),
    ]

    private var lastSystem: String?
    private var observer: NSObjectProtocol?

    public override func load() {
        lastSystem = Self.systemStyle()
        observer = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            let now = Self.systemStyle()
            if now != self.lastSystem {
                self.lastSystem = now
                self.notifyListeners("systemChange", data: ["style": now])
            }
        }
    }

    deinit {
        if let observer { NotificationCenter.default.removeObserver(observer) }
    }

    /// The iPhone's own setting. The screen's traits are not changed by the
    /// window's override, so they still say what the person chose.
    private static func systemStyle() -> String {
        UIScreen.main.traitCollection.userInterfaceStyle == .dark ? "dark" : "light"
    }

    @objc func system(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(["style": Self.systemStyle()]) }
    }

    /// Puts the app's own parts in the page's style: the status bar, the
    /// keyboard, and the ground behind the web view (no white edge on a
    /// black page, or black edge on a white one).
    @objc func use(_ call: CAPPluginCall) {
        let dark = call.getString("style") == "dark"
        DispatchQueue.main.async {
            let style: UIUserInterfaceStyle = dark ? .dark : .light
            let ground: UIColor = dark ? .black : .white
            if let window = self.bridge?.viewController?.view.window {
                window.overrideUserInterfaceStyle = style
                window.backgroundColor = ground
            }
            self.bridge?.viewController?.view.backgroundColor = ground
            self.bridge?.webView?.backgroundColor = ground
            self.bridge?.webView?.scrollView.backgroundColor = ground
            self.bridge?.viewController?.setNeedsStatusBarAppearanceUpdate()
            call.resolve()
        }
    }
}
