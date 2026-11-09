import SwiftUI
import WebKit

private let site = URL(string: "https://daos-phone-driver.ryker6365.chatgpt.site")!

@main
struct DriverApp: App {
    var body: some Scene {
        WindowGroup { DriverScreen() }
    }
}

struct DriverScreen: UIViewRepresentable {
    func makeCoordinator() -> DriverCoordinator { DriverCoordinator() }

    func makeUIView(context: Context) -> UIStackView {
        let coordinator = context.coordinator
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(coordinator, forURLScheme: "daos")
        configuration.userContentController.addScriptMessageHandler(coordinator, contentWorld: .page, name: "driverRequest")
        let web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = coordinator
        coordinator.web = web

        let toolbar = UIStackView()
        toolbar.spacing = 15
        for (title, action) in [("배송 작업", #selector(DriverCoordinator.openDriver)),
                                ("서버 로그인", #selector(DriverCoordinator.login))] {
            let button = UIButton(type: .system)
            button.setTitle(title, for: .normal)
            button.addTarget(coordinator, action: action, for: .touchUpInside)
            toolbar.addArrangedSubview(button)
        }
        let page = UIStackView(arrangedSubviews: [toolbar, web])
        page.axis = .vertical
        coordinator.openDriver()
        return page
    }
    func updateUIView(_ view: UIStackView, context: Context) {}
}

final class DriverCoordinator: NSObject, WKURLSchemeHandler, WKNavigationDelegate, WKScriptMessageHandlerWithReply {
    weak var web: WKWebView?

    @objc func openDriver() {
        web?.load(URLRequest(url: URL(string: "daos://driver/index.html")!))
    }
    @objc func login() {
        web?.load(URLRequest(url: URL(string: "/signin-with-chatgpt?return_to=%2Fdriver%2F", relativeTo: site)!))
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = action.request.url
        if url?.host == site.host && url?.path == "/driver/" {
            decisionHandler(.cancel)
            openDriver()
        } else if ["daos", "https"].contains(url?.scheme ?? "") {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
        }
    }
    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url, url.host == "driver" else {
            task.didFailWithError(URLError(.badURL)); return
        }
        let file = url.lastPathComponent
        let name = (file as NSString).deletingPathExtension
        let ext = (file as NSString).pathExtension
        let types = ["html":"text/html","css":"text/css","mjs":"text/javascript",
                     "js":"text/javascript","svg":"image/svg+xml","webmanifest":"application/manifest+json"]
        guard let type = types[ext], let asset = Bundle.main.url(forResource: name, withExtension: ext, subdirectory: "WebAssets"),
              let data = try? Data(contentsOf: asset) else {
            task.didFailWithError(URLError(.fileDoesNotExist)); return
        }
        let headers = ["Content-Type":"\(type); charset=utf-8","Access-Control-Allow-Origin":"*"]
        task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!)
        task.didReceive(data)
        task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.request.url?.scheme == "daos",
              let payload = message.body as? [String:Any], let path = payload["path"] as? String,
              let url = URL(string: path, relativeTo: site)?.absoluteURL, url.host == site.host,
              ["/api/driver","/api/driver/receipt","/api/driver/events"].contains(url.path),
              let store = web?.configuration.websiteDataStore.httpCookieStore else {
            replyHandler(nil, "요청 주소를 확인해 주세요."); return
        }
        var request = URLRequest(url: url, timeoutInterval: 7)
        if let body = payload["body"] as? [String:Any] {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        store.getAllCookies { cookies in
            let matching = cookies.filter {
                let domain = $0.domain.trimmingCharacters(in: CharacterSet(charactersIn: "."))
                return (url.host == domain || url.host?.hasSuffix("." + domain) == true)
                    && url.path.hasPrefix($0.path)
            }
            let cookieHeader = HTTPCookie.requestHeaderFields(with: matching)["Cookie"]
            request.setValue(cookieHeader, forHTTPHeaderField: "Cookie")
            URLSession.shared.dataTask(with: request) { data, response, _ in
                guard let data, let response = response as? HTTPURLResponse,
                      let body = String(data: data, encoding: .utf8) else {
                    replyHandler(nil, "서버 연결 끊김"); return
                }
                replyHandler(["status":response.statusCode,"body":body],nil)
            }.resume()
        }
    }
}
