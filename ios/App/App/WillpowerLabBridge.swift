import AuthenticationServices
import Capacitor
import UIKit

/// The app's own native pieces (backend N365), registered on the bridge so the
/// web app can call them through Capacitor. Each one runs in the app only; the
/// website keeps its own way.
class WillpowerLabViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppleSignInPlugin())
        bridge?.registerPluginInstance(DumpScreenPlugin())
    }
}

/// Sign in with Apple, native (N365 item 2): Apple's own sheet, with Face ID.
/// It answers with Apple's identity token, which the web app hands to
/// Supabase (`signInWithIdToken`), and the name Apple gives on the first
/// sign-in only. The web side sends a hashed nonce; Supabase checks the raw one.
@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)
    ]

    private var pending: CAPPluginCall?

    @objc func authorize(_ call: CAPPluginCall) {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = call.getString("nonce")
        pending?.reject("A newer sign-in replaced this one.", "REPLACED")
        pending = call
        DispatchQueue.main.async {
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return bridge?.webView?.window ?? UIWindow()
    }

    public func authorizationController(controller: ASAuthorizationController,
                                        didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = pending else { return }
        pending = nil
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let data = credential.identityToken,
              let token = String(data: data, encoding: .utf8) else {
            call.reject("Apple gave no identity token.", "NO_TOKEN")
            return
        }
        call.resolve([
            "identityToken": token,
            "givenName": credential.fullName?.givenName ?? "",
            "familyName": credential.fullName?.familyName ?? "",
        ])
    }

    public func authorizationController(controller: ASAuthorizationController,
                                        didCompleteWithError error: Error) {
        guard let call = pending else { return }
        pending = nil
        let canceled = (error as? ASAuthorizationError)?.code == .canceled
        call.reject(error.localizedDescription, canceled ? "CANCELED" : "FAILED", error)
    }
}

/// The dump screen, native (backend N506 item 5, N507). The web owns the
/// switch: it tells the app whether the screen is on for this person (the
/// ring row `dump_screen`, the notebook's Yes, and "Open to the dump screen")
/// and hears "kept" to show "Kept". The screen itself: Dump/.
@objc(DumpScreenPlugin)
public class DumpScreenPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DumpScreenPlugin"
    public let jsName = "DumpScreen"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "close", returnType: CAPPluginReturnPromise),
    ]

    override public func load() {
        DumpPresenter.plugin = self
    }

    @objc func configure(_ call: CAPPluginCall) {
        DumpGate.configure(enabled: call.getBool("enabled") ?? false,
                           openFirst: call.getBool("openFirst") ?? false)
        DumpOutbox.shared.sendAll()   // signed in now: send what waited
        call.resolve()
    }

    @objc func open(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard DumpGate.enabled, let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.resolve(["opened": false])
                return
            }
            DumpPresenter.present(in: scene)
            call.resolve(["opened": true])
        }
    }

    /// The web opened a page a notification named: the screen gets out of the way.
    @objc func close(_ call: CAPPluginCall) {
        DispatchQueue.main.async { DumpPresenter.closeIfShowing() }
        call.resolve()
    }

    /// A dump reached the backend: the web reads Will's chat again.
    func sent() {
        notifyListeners("sent", data: [:])
    }

    func kept() {
        // Kept until the web listens, in case it has not loaded yet.
        notifyListeners("kept", data: [:], retainUntilConsumed: true)
    }
}
