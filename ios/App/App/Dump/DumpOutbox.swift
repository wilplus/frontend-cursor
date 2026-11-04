import Foundation
import WebKit

/// Every kept dump is a file in Application Support until the backend has it
/// (backend N506 item 3: nothing said is lost). It goes to the web
/// notebook's own upload, `POST /api/v2/notebook/notes`, which runs under the
/// speaker's processing authorization and refuses without the notebook's
/// consent. The `key` makes a retry count once (N194). A background
/// URLSession, so an upload finishes even after the app is closed.
///
/// Sign-in is the web view's own cookies. If the BFF refreshes the session
/// while answering, its new cookies are written back into the web view, so
/// the web view never holds a refresh token that has been used up.
final class DumpOutbox: NSObject, URLSessionDataDelegate {
    static let shared = DumpOutbox()
    static let sessionId = "com.willpowerlab.app.dump"
    private let base = URL(string: "https://www.willpowerlab.com")!
    /// Set by the AppDelegate when iOS wakes the app for finished uploads.
    var backgroundDone: (() -> Void)?
    /// Keys being uploaded now (main thread only), so a key goes once at a time.
    private var sending = Set<String>()
    private var restored = false

    private lazy var session: URLSession = {
        let c = URLSessionConfiguration.background(withIdentifier: Self.sessionId)
        c.sessionSendsLaunchEvents = true
        c.httpShouldSetCookies = false   // the web view's cookies, set by hand
        c.httpCookieAcceptPolicy = .never
        return URLSession(configuration: c, delegate: self, delegateQueue: nil)
    }()

    /// iOS woke the app for this session: making it again hears the results.
    func reconnect() { _ = session }

    var dir: URL {
        let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("dumps", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }

    private func path(_ key: String, _ ext: String) -> URL { dir.appendingPathComponent("\(key).\(ext)") }

    func newFile() -> (url: URL, key: String) {
        let key = UUID().uuidString.lowercased()
        return (path(key, "m4a"), key)
    }

    /// The recording is complete on disk: write its note, then try to send.
    func keep(key: String, durationMs: Int) {
        let meta = ["key": key, "duration_ms": String(durationMs)]
        try? JSONSerialization.data(withJSONObject: meta).write(to: path(key, "json"))
        DispatchQueue.main.async { self.send(key: key) }
    }

    /// On launch, on return to the front, and when the web has said who is
    /// signed in. Nothing goes while the web says the screen is off for them.
    func sendAll() {
        DispatchQueue.main.async {
            let names = (try? FileManager.default.contentsOfDirectory(atPath: self.dir.path)) ?? []
            names.filter { $0.hasSuffix(".json") }.forEach { self.send(key: String($0.dropLast(5))) }
        }
    }

    /// Main thread.
    private func send(key: String) {
        guard DumpGate.enabled else { return }
        guard restored else {
            // After a relaunch, uploads iOS still runs are not sent twice.
            session.getAllTasks { tasks in
                DispatchQueue.main.async {
                    tasks.compactMap(\.taskDescription).forEach { self.sending.insert($0) }
                    self.restored = true
                    self.send(key: key)
                }
            }
            return
        }
        guard !sending.contains(key),
              let data = try? Data(contentsOf: path(key, "json")),
              let meta = try? JSONSerialization.jsonObject(with: data) as? [String: String],
              FileManager.default.fileExists(atPath: path(key, "m4a").path) else { return }
        sending.insert(key)

        WKWebsiteDataStore.default().httpCookieStore.getAllCookies { cookies in
            let host = self.base.host ?? ""
            let mine = cookies.filter { c in
                let d = c.domain.hasPrefix(".") ? String(c.domain.dropFirst()) : c.domain
                return host == d || host.hasSuffix("." + d)
            }
            guard !mine.isEmpty, let body = self.multipart(key: key, meta: meta) else {
                self.sending.remove(key)   // not signed in yet: again later
                return
            }
            var req = URLRequest(url: self.base.appendingPathComponent("api/v2/notebook/notes"))
            req.httpMethod = "POST"
            HTTPCookie.requestHeaderFields(with: mine).forEach { req.setValue($1, forHTTPHeaderField: $0) }
            req.setValue("multipart/form-data; boundary=dump-\(key)", forHTTPHeaderField: "Content-Type")
            let task = self.session.uploadTask(with: req, fromFile: body)
            task.taskDescription = key
            task.resume()
        }
    }

    /// The same three fields the web notebook sends (sendVoiceNote).
    private func multipart(key: String, meta: [String: String]) -> URL? {
        guard let bytes = try? Data(contentsOf: path(key, "m4a")) else { return nil }
        let boundary = "dump-\(key)"
        var d = Data()
        func line(_ s: String) { d.append(Data(s.utf8)) }
        for (k, v) in [("duration_ms", meta["duration_ms"] ?? "0"), ("key", key)] {
            line("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(k)\"\r\n\r\n\(v)\r\n")
        }
        line("--\(boundary)\r\nContent-Disposition: form-data; name=\"audio\"; filename=\"note.m4a\"\r\n")
        line("Content-Type: audio/mp4\r\n\r\n")
        d.append(bytes)
        line("\r\n--\(boundary)--\r\n")
        let out = path(key, "body")
        return (try? d.write(to: out)) != nil ? out : nil
    }

    // Done: 2xx. Refused for good: 4xx except 401 and 429 (nothing heard, too
    // long, no consent), as the web's sendVoiceNote reads it. Anything else
    // stays on the phone and goes again later.
    func urlSession(_ s: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let key = task.taskDescription else { return }
        try? FileManager.default.removeItem(at: path(key, "body"))
        let response = task.response as? HTTPURLResponse
        let status = response?.statusCode ?? 0
        let done = (200..<300).contains(status)
        let refused = (400..<500).contains(status) && status != 401 && status != 429
        if done || refused {
            ["m4a", "json"].forEach { try? FileManager.default.removeItem(at: path(key, $0)) }
        }
        let fresh = response.map { r -> [HTTPCookie] in
            let fields = r.allHeaderFields.reduce(into: [String: String]()) { out, kv in
                if let k = kv.key as? String, let v = kv.value as? String { out[k] = v }
            }
            return HTTPCookie.cookies(withResponseHeaderFields: fields, for: base)
        } ?? []
        DispatchQueue.main.async {
            let store = WKWebsiteDataStore.default().httpCookieStore
            fresh.forEach { store.setCookie($0) }
            self.sending.remove(key)
        }
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        DispatchQueue.main.async {
            self.backgroundDone?()
            self.backgroundDone = nil
        }
    }
}
