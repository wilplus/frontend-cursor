import Combine
import SwiftUI
import UIKit

/// The dump screen's controller (backend N506 item 2). UIKit owns the
/// touches (finger count, contact size, movement); SwiftUI only draws.
/// Ways out: a double tap, the ×, a swipe down of more than 90 pt, and the
/// accessibility Escape (two-finger Z). VoiceOver sees one element whose
/// action starts or stops, and the ×.
final class DumpViewController: UIViewController {
    static let swipeClose: CGFloat = 90

    let model: DumpModel
    private var began: CGPoint = .zero
    private var radius: CGFloat = 0
    private var multi = false
    private var watching: AnyCancellable?

    init(model: DumpModel) {
        self.model = model
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("not from a storyboard") }

    override func loadView() {
        let surface = DumpSurface()
        surface.element.onActivate = { [weak self] in self?.model.toggle() }
        surface.onEscape = { [weak self] in self?.model.close() }
        view = surface
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
        view.isMultipleTouchEnabled = true
        view.accessibilityViewIsModal = true

        let host = UIHostingController(rootView: DumpView(model: model))
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        host.view.isUserInteractionEnabled = false
        host.view.accessibilityElementsHidden = true
        view.addSubview(host.view)
        host.didMove(toParent: self)

        let close = UIButton(type: .system)
        close.setImage(UIImage(systemName: "xmark", withConfiguration: UIImage.SymbolConfiguration(pointSize: 12, weight: .semibold)), for: .normal)
        close.tintColor = UIColor(white: 0.07, alpha: 1)
        close.backgroundColor = .white
        close.layer.cornerRadius = 15
        close.layer.borderWidth = 1
        close.layer.borderColor = UIColor(white: 0.92, alpha: 1).cgColor
        close.accessibilityLabel = DumpStrings.close
        close.addAction(UIAction { [weak self] _ in self?.model.close() }, for: .touchUpInside)
        close.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(close)
        (view as? DumpSurface)?.closeButton = close
        NSLayoutConstraint.activate([
            close.widthAnchor.constraint(equalToConstant: 30),
            close.heightAnchor.constraint(equalToConstant: 30),
            close.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            close.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
        ])

        // The web screen's label: what a tap does now.
        watching = model.$phase.sink { [weak self] phase in
            (self?.view as? DumpSurface)?.element.accessibilityLabel = phase == .listening ? DumpStrings.tapToStop : DumpStrings.idleHint
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        model.appeared()
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        if (event?.allTouches?.count ?? 1) > 1 { multi = true; return }
        guard let t = touches.first else { return }
        began = t.location(in: view)
        radius = t.majorRadius
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let t = touches.first, !multi else { return }
        radius = max(radius, t.majorRadius)
        let dy = t.location(in: view).y - began.y
        view.transform = dy > 8 ? CGAffineTransform(translationX: 0, y: min(dy, 200)) : .identity
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        let stillDown = event?.allTouches?.contains { $0.phase != .ended && $0.phase != .cancelled } ?? false
        if stillDown { return }
        defer { multi = false }
        view.transform = .identity
        guard let t = touches.first else { return }
        let end = t.location(in: view)
        if !multi && end.y - began.y > Self.swipeClose { model.close(); return }
        let action = model.reader.read(start: began, end: end, radius: max(radius, t.majorRadius),
                                       fingers: multi ? 2 : 1, listening: model.listening)
        if let action { model.handle(action) }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        multi = false
        view.transform = .identity
    }
}

/// For VoiceOver the screen is two things: the whole screen, whose action
/// starts or stops, and the ×. The Escape gesture closes.
final class DumpSurface: UIView {
    lazy var element = DumpElement(accessibilityContainer: self)
    weak var closeButton: UIButton?
    var onEscape: (() -> Void)?

    override var accessibilityElements: [Any]? {
        get { [element] + (closeButton.map { [$0] } ?? []) }
        set { }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        element.accessibilityFrameInContainerSpace = bounds
    }

    override func accessibilityPerformEscape() -> Bool { onEscape?(); return true }
}

final class DumpElement: UIAccessibilityElement {
    var onActivate: (() -> Void)?

    override init(accessibilityContainer container: Any) {
        super.init(accessibilityContainer: container)
        accessibilityTraits = .button
        accessibilityLabel = DumpStrings.idleHint
    }

    override func accessibilityActivate() -> Bool { onActivate?(); return true }
}
