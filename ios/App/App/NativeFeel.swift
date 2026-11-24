import Capacitor
import UIKit
import WebKit

// MARK: - Text size (backend N681 item 1)

/// The app follows the iPhone's text size (Settings → Display & Brightness →
/// Text Size, or Accessibility → Larger Text) by scaling its pages, as
/// Safari's own text size does: the text grows and the layout reflows to fit.
/// From the default size (1.0) up to 1.35 at the largest standard size; the
/// accessibility sizes stay at 1.35, and the sizes below the default leave
/// the app at 1.0 so no tap target shrinks below 44 points. Pinch-to-zoom
/// stays as it is.
enum TextSize {
    /// The page zoom for a text size: Dynamic Type's body point size over
    /// the default's 17, kept between 1.0 and 1.35.
    static func zoom(for category: UIContentSizeCategory) -> CGFloat {
        let body: CGFloat
        switch category {
        case .extraLarge: body = 19
        case .extraExtraLarge: body = 21
        case .extraExtraExtraLarge: body = 23
        case _ where category.isAccessibilityCategory: body = 23
        default: body = 17
        }
        return min(max(body / 17, 1.0), 1.35)
    }

    static func apply(to webView: WKWebView?) {
        guard let webView else { return }
        let zoom = zoom(for: UIApplication.shared.preferredContentSizeCategory)
        if abs(webView.pageZoom - zoom) > 0.001 { webView.pageZoom = zoom }
    }
}

// MARK: - The edge swipe back (backend N681 item 2)

/// The iPhone's own swipe from the left edge, going back through the web
/// view's history (the overlay on top closes, the screen under it follows the
/// finger). Off by default; the page turns it on only where Back simply
/// closes the screen on top, and never while a Take is at risk
/// (src/lib/phone/swipeBack.ts).
@objc(NavigationPlugin)
public class NavigationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NavigationPlugin"
    public let jsName = "Navigation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setSwipeBack", returnType: CAPPluginReturnPromise),
    ]

    private var observer: NSObjectProtocol?

    public override func load() {
        // Text size lives here too: it needs the web view, and nothing to
        // say to the page.
        DispatchQueue.main.async {
            self.bridge?.webView?.allowsBackForwardNavigationGestures = false
            TextSize.apply(to: self.bridge?.webView)
        }
        observer = NotificationCenter.default.addObserver(
            forName: UIContentSizeCategory.didChangeNotification, object: nil, queue: .main
        ) { [weak self] _ in
            TextSize.apply(to: self?.bridge?.webView)
        }
    }

    deinit {
        if let observer { NotificationCenter.default.removeObserver(observer) }
    }

    @objc func setSwipeBack(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        DispatchQueue.main.async {
            self.bridge?.webView?.allowsBackForwardNavigationGestures = enabled
            call.resolve()
        }
    }
}
