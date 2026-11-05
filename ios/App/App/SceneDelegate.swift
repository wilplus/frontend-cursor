import UIKit
import Capacitor
import UserNotifications

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    /// The dump screen (backend N506 item 4): on return to the front it is
    /// decided once the scene is active, so a link that brought the app
    /// back is known first.
    private var checkOnActive = false
    private var linkArrived = false
    private var skipLaunchForeground = true

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // Ours, not Capacitor's plain one: it registers the app's native
        // plugins (WillpowerLabBridge.swift). The storyboard is not used here.
        window?.rootViewController = WillpowerLabViewController()
        window?.makeKeyAndVisible()

        // Before the web view has loaded anything, so the first tap listens.
        let byLink = !connectionOptions.urlContexts.isEmpty
            || !connectionOptions.userActivities.isEmpty
            || connectionOptions.notificationResponse != nil
        openDumpIfDue(windowScene, byLink: byLink)
        DumpOutbox.shared.sendAll()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        if skipLaunchForeground { skipLaunchForeground = false; return }
        linkArrived = false
        checkOnActive = true
        DumpOutbox.shared.sendAll()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        guard checkOnActive, let windowScene = scene as? UIWindowScene else { return }
        checkOnActive = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            self.openDumpIfDue(windowScene, byLink: self.linkArrived)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        linkArrived = true
        DumpPresenter.closeIfShowing()
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        linkArrived = true
        DumpPresenter.closeIfShowing()
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    private func openDumpIfDue(_ scene: UIWindowScene, byLink: Bool) {
        guard !DumpPresenter.isShowing,
              DumpGate.shouldOpenFirst(launchedByLinkOrNotification: byLink) else { return }
        DumpPresenter.present(in: scene)
    }
}
